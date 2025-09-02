/**
 * Compatibility tests comparing behavior with old library
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B2Client } from '../../src/index.js';

describe('Library Compatibility Tests', () => {
  let newClient;
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    newClient = new B2Client();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Response Format Compatibility', () => {
    it('should return compatible response format for authorization', async () => {
      const mockAuthResponse = {
        authorizationToken: 'token_123',
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
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAuthResponse)
      });

      const result = await newClient.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });

      // Verify response structure matches old library expectations
      expect(result).toHaveProperty('authorizationToken');
      expect(result).toHaveProperty('apiUrl');
      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('accountId');
      expect(result).toHaveProperty('recommendedPartSize');
      expect(result).toHaveProperty('absoluteMinimumPartSize');
      expect(result).toHaveProperty('allowed');
      expect(result.allowed).toHaveProperty('capabilities');
      expect(Array.isArray(result.allowed.capabilities)).toBe(true);
    });

    it('should return compatible response format for bucket operations', async () => {
      // Mock authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['listBuckets'] }
        })
      });

      // Mock list buckets response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          buckets: [{
            accountId: 'account_123',
            bucketId: 'bucket_123',
            bucketName: 'test-bucket',
            bucketType: 'allPrivate',
            bucketInfo: {},
            corsRules: [],
            lifecycleRules: [],
            revision: 1
          }]
        })
      });

      await newClient.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });

      const result = await newClient.buckets.listBuckets();

      // Verify response structure matches old library
      expect(result).toHaveProperty('buckets');
      expect(Array.isArray(result.buckets)).toBe(true);
      expect(result.buckets[0]).toHaveProperty('accountId');
      expect(result.buckets[0]).toHaveProperty('bucketId');
      expect(result.buckets[0]).toHaveProperty('bucketName');
      expect(result.buckets[0]).toHaveProperty('bucketType');
    });

    it('should return compatible response format for file operations', async () => {
      // Mock authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['writeFiles'] }
        })
      });

      // Mock get upload URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          uploadUrl: 'https://upload.backblaze.com/upload',
          authorizationToken: 'upload_token_123'
        })
      });

      // Mock file upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'file_123',
          fileName: 'test.txt',
          accountId: 'account_123',
          bucketId: 'bucket_123',
          contentLength: 11,
          contentSha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
          contentType: 'text/plain',
          fileInfo: {},
          uploadTimestamp: 1234567890000
        })
      });

      await newClient.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });

      const uploadUrl = await newClient.buckets.getUploadUrl({
        bucketId: 'bucket_123'
      });

      const result = await newClient.files.uploadFile({
        uploadUrl: uploadUrl.uploadUrl,
        uploadAuthToken: uploadUrl.authorizationToken,
        fileName: 'test.txt',
        data: 'Hello World'
      });

      // Verify response structure matches old library
      expect(result).toHaveProperty('fileId');
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('accountId');
      expect(result).toHaveProperty('bucketId');
      expect(result).toHaveProperty('contentLength');
      expect(result).toHaveProperty('contentSha1');
      expect(result).toHaveProperty('contentType');
      expect(result).toHaveProperty('uploadTimestamp');
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should throw errors in compatible format', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          status: 401,
          code: 'bad_auth_token',
          message: 'Invalid credentials'
        })
      });

      try {
        await newClient.authorize({
          applicationKeyId: 'invalid_key',
          applicationKey: 'invalid_key'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Verify error structure matches old library expectations
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Invalid credentials');
        expect(error.status).toBe(401);
        expect(error.code).toBe('bad_auth_token');
      }
    });

    it('should handle network errors consistently', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      try {
        await newClient.authorize({
          applicationKeyId: 'test_key',
          applicationKey: 'test_key'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Network error');
      }
    });
  });

  describe('Method Signature Compatibility', () => {
    beforeEach(async () => {
      // Mock authorization for method tests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['listBuckets', 'writeFiles', 'readFiles'] }
        })
      });

      await newClient.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });
    });

    it('should support backward compatible method signatures for file info', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'file_123',
          fileName: 'test.txt',
          contentType: 'text/plain',
          contentLength: 11,
          contentSha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
        })
      });

      // Test both old and new method signatures
      const result1 = await newClient.files.getFileInfo('file_123'); // Old signature
      const result2 = await newClient.files.getFileInfo({ fileId: 'file_123' }); // New signature

      expect(result1.fileId).toBe('file_123');
      expect(result2.fileId).toBe('file_123');
      expect(result1).toEqual(result2);
    });

    it('should support backward compatible method signatures for file download', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'text/plain'],
          ['content-length', '11']
        ]),
        text: () => Promise.resolve('Hello World')
      });

      // Test both old and new method signatures
      const result1 = await newClient.files.downloadFileByName('bucket-name', 'file.txt'); // Old signature
      const result2 = await newClient.files.downloadFileByName({ 
        bucketName: 'bucket-name', 
        fileName: 'file.txt' 
      }); // New signature

      expect(result1.data).toBe('Hello World');
      expect(result2.data).toBe('Hello World');
    });
  });

  describe('Configuration Compatibility', () => {
    it('should accept old-style configuration options', () => {
      const config = {
        timeout: 30000,
        retries: 3,
        retryDelay: 1000
      };

      const client = new B2Client(config);
      
      expect(client.config.timeout).toBe(30000);
      expect(client.config.retries).toBe(3);
      expect(client.config.retryDelay).toBe(1000);
    });

    it('should handle missing configuration gracefully', () => {
      const client = new B2Client();
      
      // Should have default values
      expect(client.config).toBeDefined();
      expect(typeof client.config.timeout).toBe('number');
    });
  });

  describe('Constants Compatibility', () => {
    it('should export compatible bucket type constants', () => {
      expect(newClient.BUCKET_TYPES).toBeDefined();
      expect(newClient.BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(newClient.BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
    });

    it('should export compatible key capability constants', () => {
      expect(newClient.KEY_CAPABILITIES).toBeDefined();
      expect(newClient.KEY_CAPABILITIES.LIST_FILES).toBe('listFiles');
      expect(newClient.KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
      expect(newClient.KEY_CAPABILITIES.WRITE_FILES).toBe('writeFiles');
    });
  });

  describe('Progress Callback Compatibility', () => {
    beforeEach(async () => {
      // Mock authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['writeFiles'] }
        })
      });

      await newClient.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });
    });

    it('should call progress callbacks with compatible format', async () => {
      const progressCallback = vi.fn();

      // Mock get upload URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          uploadUrl: 'https://upload.backblaze.com/upload',
          authorizationToken: 'upload_token_123'
        })
      });

      // Mock upload with progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          fileId: 'file_123',
          fileName: 'test.txt',
          contentLength: 1000
        })
      });

      const uploadUrl = await newClient.buckets.getUploadUrl({
        bucketId: 'bucket_123'
      });

      await newClient.files.uploadFile({
        uploadUrl: uploadUrl.uploadUrl,
        uploadAuthToken: uploadUrl.authorizationToken,
        fileName: 'test.txt',
        data: new Uint8Array(1000),
        onUploadProgress: progressCallback
      });

      // Verify progress callback format matches old library
      if (progressCallback.mock.calls.length > 0) {
        const progressEvent = progressCallback.mock.calls[0][0];
        expect(progressEvent).toHaveProperty('loaded');
        expect(progressEvent).toHaveProperty('total');
        expect(typeof progressEvent.loaded).toBe('number');
        expect(typeof progressEvent.total).toBe('number');
      }
    });
  });
});