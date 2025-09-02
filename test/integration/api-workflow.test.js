/**
 * Integration tests for complete API workflows
 * Tests end-to-end scenarios with all components working together
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B2Client } from '../../src/index.js';
import { B2_ERROR_CODES } from '../../src/constants.js';

describe('Complete API Workflow Integration', () => {
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

  describe('Full File Upload Workflow', () => {
    it('should complete full file upload workflow', async () => {
      // Step 1: Mock authorization
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
          allowed: {
            capabilities: ['listBuckets', 'writeFiles'],
            bucketId: null,
            bucketName: null,
            namePrefix: null
          }
        })
      });

      // Step 2: Mock get upload URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          uploadUrl: 'https://upload.backblaze.com/b2api/v2/b2_upload_file/bucket_123',
          authorizationToken: 'upload_token_123'
        })
      });

      // Step 3: Mock file upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'file_123',
          fileName: 'test-file.txt',
          accountId: 'account_123',
          bucketId: 'bucket_123',
          contentLength: 11,
          contentSha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
          contentType: 'text/plain',
          fileInfo: {},
          uploadTimestamp: Date.now()
        })
      });

      // Execute workflow
      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });

      const uploadUrl = await client.buckets.getUploadUrl({
        bucketId: 'bucket_123'
      });

      const uploadResult = await client.files.uploadFile({
        uploadUrl: uploadUrl.uploadUrl,
        uploadAuthToken: uploadUrl.authorizationToken,
        fileName: 'test-file.txt',
        data: 'Hello World',
        contentType: 'text/plain'
      });

      // Verify the workflow
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(uploadResult.fileId).toBe('file_123');
      expect(uploadResult.fileName).toBe('test-file.txt');
    });

    it('should handle upload workflow with retry on failure', async () => {
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

      // Mock get upload URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          uploadUrl: 'https://upload.backblaze.com/b2api/v2/b2_upload_file/bucket_123',
          authorizationToken: 'upload_token_123'
        })
      });

      // Mock upload failure then success
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'file_123',
          fileName: 'test-file.txt',
          contentLength: 11,
          contentSha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
        })
      });

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });

      const uploadUrl = await client.buckets.getUploadUrl({
        bucketId: 'bucket_123'
      });

      const uploadResult = await client.files.uploadFile({
        uploadUrl: uploadUrl.uploadUrl,
        uploadAuthToken: uploadUrl.authorizationToken,
        fileName: 'test-file.txt',
        data: 'Hello World'
      });

      expect(uploadResult.fileId).toBe('file_123');
    });
  });

  describe('Large File Upload Workflow', () => {
    it('should complete large file upload workflow', async () => {
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

      // Mock start large file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'large_file_123',
          fileName: 'large-file.bin',
          accountId: 'account_123',
          bucketId: 'bucket_123',
          contentType: 'application/octet-stream',
          uploadTimestamp: Date.now()
        })
      });

      // Mock get upload part URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          uploadUrl: 'https://upload.backblaze.com/b2api/v2/b2_upload_part/large_file_123',
          authorizationToken: 'part_upload_token_123'
        })
      });

      // Mock upload part
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'large_file_123',
          partNumber: 1,
          contentLength: 1000000,
          contentSha1: 'part1_sha1_hash',
          uploadTimestamp: Date.now()
        })
      });

      // Mock finish large file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'large_file_123',
          fileName: 'large-file.bin',
          accountId: 'account_123',
          bucketId: 'bucket_123',
          contentLength: 1000000,
          contentSha1: 'final_sha1_hash',
          contentType: 'application/octet-stream',
          fileInfo: {},
          uploadTimestamp: Date.now()
        })
      });

      // Execute large file workflow
      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });

      const startResult = await client.files.startLargeFile({
        bucketId: 'bucket_123',
        fileName: 'large-file.bin',
        contentType: 'application/octet-stream'
      });

      const partUrl = await client.files.getUploadPartUrl({
        fileId: startResult.fileId
      });

      const partData = new Uint8Array(1000000).fill(65); // 1MB of 'A'
      const partResult = await client.files.uploadPart({
        uploadUrl: partUrl.uploadUrl,
        uploadAuthToken: partUrl.authorizationToken,
        partNumber: 1,
        data: partData
      });

      const finishResult = await client.files.finishLargeFile({
        fileId: startResult.fileId,
        partSha1Array: [partResult.contentSha1]
      });

      expect(finishResult.fileId).toBe('large_file_123');
      expect(finishResult.fileName).toBe('large-file.bin');
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('File Download Workflow', () => {
    it('should complete file download by name workflow', async () => {
      // Mock authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'auth_token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['readFiles'] }
        })
      });

      // Mock file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/plain'],
          ['content-length', '11'],
          ['x-bz-file-id', 'file_123'],
          ['x-bz-file-name', 'test-file.txt']
        ]),
        text: () => Promise.resolve('Hello World')
      });

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });

      const downloadResult = await client.files.downloadFileByName({
        bucketName: 'test-bucket',
        fileName: 'test-file.txt',
        responseType: 'text'
      });

      expect(downloadResult.data).toBe('Hello World');
      expect(downloadResult.headers.get('x-bz-file-id')).toBe('file_123');
    });
  });

  describe('Bucket Management Workflow', () => {
    it('should complete bucket lifecycle workflow', async () => {
      // Mock authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'auth_token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['listBuckets', 'writeBuckets'] }
        })
      });

      // Mock create bucket
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          accountId: 'account_123',
          bucketId: 'bucket_123',
          bucketName: 'test-bucket',
          bucketType: 'allPrivate',
          bucketInfo: {},
          corsRules: [],
          lifecycleRules: [],
          revision: 1
        })
      });

      // Mock list buckets
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          buckets: [{
            accountId: 'account_123',
            bucketId: 'bucket_123',
            bucketName: 'test-bucket',
            bucketType: 'allPrivate'
          }]
        })
      });

      // Mock delete bucket
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          accountId: 'account_123',
          bucketId: 'bucket_123',
          bucketName: 'test-bucket'
        })
      });

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });

      // Create bucket
      const createResult = await client.buckets.createBucket({
        bucketName: 'test-bucket',
        bucketType: 'allPrivate'
      });

      // List buckets
      const listResult = await client.buckets.listBuckets();

      // Delete bucket
      const deleteResult = await client.buckets.deleteBucket({
        bucketId: createResult.bucketId
      });

      expect(createResult.bucketName).toBe('test-bucket');
      expect(listResult.buckets).toHaveLength(1);
      expect(deleteResult.bucketId).toBe('bucket_123');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });
});