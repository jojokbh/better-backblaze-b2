/**
 * Performance tests for large file operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B2Client } from '../../src/index.js';
import { Sha1Hasher } from '../../src/utils/crypto.js';

describe('Performance Tests', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = new B2Client();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Large File Upload Performance', () => {
    beforeEach(async () => {
      // Mock authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'auth_token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          recommendedPartSize: 100000000,
          absoluteMinimumPartSize: 5000000,
          allowed: { capabilities: ['writeFiles'] }
        })
      });

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });
    });

    it('should handle large file upload efficiently', async () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const largeData = new Uint8Array(fileSize).fill(65); // Fill with 'A'

      // Mock get upload URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          uploadUrl: 'https://upload.backblaze.com/upload',
          authorizationToken: 'upload_token_123'
        })
      });

      // Mock upload response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'large_file_123',
          fileName: 'large-file.bin',
          contentLength: fileSize,
          contentSha1: await Sha1Hasher.hash(largeData),
          uploadTimestamp: Date.now()
        })
      });

      const startTime = performance.now();

      const uploadUrl = await client.buckets.getUploadUrl({
        bucketId: 'bucket_123'
      });

      const result = await client.files.uploadFile({
        uploadUrl: uploadUrl.uploadUrl,
        uploadAuthToken: uploadUrl.authorizationToken,
        fileName: 'large-file.bin',
        data: largeData,
        onUploadProgress: (progress) => {
          // Verify progress callback is called
          expect(progress.loaded).toBeGreaterThanOrEqual(0);
          expect(progress.total).toBe(fileSize);
        }
      });

      const endTime = performance.now();
      const uploadTime = endTime - startTime;

      expect(result.fileId).toBe('large_file_123');
      expect(result.contentLength).toBe(fileSize);
      expect(uploadTime).toBeLessThan(5000); // Should complete within 5 seconds in test
    });

    it('should handle multiple concurrent uploads efficiently', async () => {
      const fileSize = 1024 * 1024; // 1MB each
      const numFiles = 5;
      const files = Array.from({ length: numFiles }, (_, i) => ({
        name: `file-${i}.bin`,
        data: new Uint8Array(fileSize).fill(65 + i) // Different content for each file
      }));

      // Mock get upload URL for each file
      for (let i = 0; i < numFiles; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            uploadUrl: `https://upload.backblaze.com/upload-${i}`,
            authorizationToken: `upload_token_${i}`
          })
        });
      }

      // Mock upload responses
      for (let i = 0; i < numFiles; i++) {
        const fileHash = await Sha1Hasher.hash(files[i].data);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            fileId: `file_${i}`,
            fileName: `file-${i}.bin`,
            contentLength: fileSize,
            contentSha1: fileHash,
            uploadTimestamp: Date.now()
          })
        });
      }

      const startTime = performance.now();

      // Start all uploads concurrently
      const uploadPromises = files.map(async (file, index) => {
        const uploadUrl = await client.buckets.getUploadUrl({
          bucketId: 'bucket_123'
        });

        return client.files.uploadFile({
          uploadUrl: uploadUrl.uploadUrl,
          uploadAuthToken: uploadUrl.authorizationToken,
          fileName: file.name,
          data: file.data
        });
      });

      const results = await Promise.all(uploadPromises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(numFiles);
      results.forEach((result, index) => {
        expect(result.fileId).toBe(`file_${index}`);
        expect(result.contentLength).toBe(fileSize);
      });

      // Concurrent uploads should be faster than sequential
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Large File Multi-part Upload Performance', () => {
    beforeEach(async () => {
      // Mock authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'auth_token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          recommendedPartSize: 5000000, // 5MB parts
          absoluteMinimumPartSize: 5000000,
          allowed: { capabilities: ['writeFiles'] }
        })
      });

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });
    });

    it('should handle multi-part upload efficiently', async () => {
      const partSize = 5 * 1024 * 1024; // 5MB per part
      const numParts = 3;
      const totalSize = partSize * numParts;

      // Mock start large file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'large_file_123',
          fileName: 'multi-part-file.bin',
          uploadTimestamp: Date.now()
        })
      });

      // Mock get upload part URLs
      for (let i = 0; i < numParts; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            uploadUrl: `https://upload.backblaze.com/part-${i}`,
            authorizationToken: `part_token_${i}`
          })
        });
      }

      // Mock upload part responses
      const partSha1Array = [];
      for (let i = 0; i < numParts; i++) {
        const partData = new Uint8Array(partSize).fill(65 + i);
        const partSha1 = await Sha1Hasher.hash(partData);
        partSha1Array.push(partSha1);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            fileId: 'large_file_123',
            partNumber: i + 1,
            contentLength: partSize,
            contentSha1: partSha1,
            uploadTimestamp: Date.now()
          })
        });
      }

      // Mock finish large file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'large_file_123',
          fileName: 'multi-part-file.bin',
          contentLength: totalSize,
          contentSha1: 'final_sha1_hash',
          uploadTimestamp: Date.now()
        })
      });

      const startTime = performance.now();

      // Start large file
      const startResult = await client.files.startLargeFile({
        bucketId: 'bucket_123',
        fileName: 'multi-part-file.bin',
        contentType: 'application/octet-stream'
      });

      // Upload parts concurrently
      const partPromises = Array.from({ length: numParts }, async (_, i) => {
        const partUrl = await client.files.getUploadPartUrl({
          fileId: startResult.fileId
        });

        const partData = new Uint8Array(partSize).fill(65 + i);
        return client.files.uploadPart({
          uploadUrl: partUrl.uploadUrl,
          uploadAuthToken: partUrl.authorizationToken,
          partNumber: i + 1,
          data: partData,
          onUploadProgress: (progress) => {
            expect(progress.loaded).toBeGreaterThanOrEqual(0);
            expect(progress.total).toBe(partSize);
          }
        });
      });

      const partResults = await Promise.all(partPromises);

      // Finish large file
      const finishResult = await client.files.finishLargeFile({
        fileId: startResult.fileId,
        partSha1Array: partResults.map(part => part.contentSha1)
      });

      const endTime = performance.now();
      const uploadTime = endTime - startTime;

      expect(finishResult.fileId).toBe('large_file_123');
      expect(finishResult.contentLength).toBe(totalSize);
      expect(partResults).toHaveLength(numParts);
      expect(uploadTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Hash Calculation Performance', () => {
    it('should calculate SHA1 hash efficiently for large data', async () => {
      const dataSize = 50 * 1024 * 1024; // 50MB
      const largeData = new Uint8Array(dataSize).fill(65);

      const startTime = performance.now();
      const hash = await Sha1Hasher.hash(largeData);
      const endTime = performance.now();

      const hashTime = endTime - startTime;

      expect(hash).toMatch(/^[a-f0-9]{40}$/);
      expect(hashTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle streaming hash calculation efficiently', async () => {
      const chunkSize = 1024 * 1024; // 1MB chunks
      const numChunks = 20; // 20MB total
      const hasher = Sha1Hasher.createStream();

      const startTime = performance.now();

      for (let i = 0; i < numChunks; i++) {
        const chunk = new Uint8Array(chunkSize).fill(65 + (i % 26));
        await hasher.update(chunk);
      }

      const hash = await hasher.digest();
      const endTime = performance.now();

      const hashTime = endTime - startTime;

      expect(hash).toMatch(/^[a-f0-9]{40}$/);
      expect(hashTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Memory Usage Tests', () => {
    it('should handle large file operations without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const fileSize = 10 * 1024 * 1024; // 10MB

      // Create and process large data
      const largeData = new Uint8Array(fileSize).fill(65);
      const hash = await Sha1Hasher.hash(largeData);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(hash).toMatch(/^[a-f0-9]{40}$/);
      // Memory increase should be reasonable (less than 2x the file size)
      expect(memoryIncrease).toBeLessThan(fileSize * 2);
    });
  });
});