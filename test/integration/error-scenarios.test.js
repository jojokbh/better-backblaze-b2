/**
 * Integration tests for error scenarios with real API error responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B2Client } from '../../src/index.js';
import { B2_ERROR_CODES } from '../../src/constants.js';

describe('Error Scenario Integration Tests', () => {
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

  describe('Authentication Errors', () => {
    it('should handle invalid credentials error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          status: 401,
          code: 'bad_auth_token',
          message: 'Invalid applicationKeyId or applicationKey'
        })
      });

      await expect(client.authorize({
        applicationKeyId: 'invalid_key_id',
        applicationKey: 'invalid_key'
      })).rejects.toThrow('Invalid applicationKeyId or applicationKey');
    });

    it('should handle account suspended error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          status: 401,
          code: 'account_suspended',
          message: 'Account has been suspended'
        })
      });

      await expect(client.authorize({
        applicationKeyId: 'suspended_key_id',
        applicationKey: 'suspended_key'
      })).rejects.toThrow('Account has been suspended');
    });

    it('should handle rate limiting during authentication', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '60']]),
        json: () => Promise.resolve({
          status: 429,
          code: 'too_many_requests',
          message: 'Too many requests'
        })
      });

      await expect(client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      })).rejects.toThrow('Too many requests');
    });
  });

  describe('File Operation Errors', () => {
    beforeEach(async () => {
      // Mock successful authorization for file operation tests
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'auth_token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['readFiles', 'writeFiles'] }
        })
      });

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });
    });

    it('should handle file not found error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          status: 404,
          code: 'file_not_present',
          message: 'File not found'
        })
      });

      await expect(client.files.getFileInfo({
        fileId: 'nonexistent_file_id'
      })).rejects.toThrow('File not found');
    });

    it('should handle insufficient permissions error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          status: 401,
          code: 'unauthorized',
          message: 'Application key does not allow this operation'
        })
      });

      await expect(client.files.deleteFileVersion({
        fileId: 'file_123',
        fileName: 'test.txt'
      })).rejects.toThrow('Application key does not allow this operation');
    });

    it('should handle upload URL expired error', async () => {
      // Mock get upload URL success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          uploadUrl: 'https://upload.backblaze.com/expired',
          authorizationToken: 'expired_token'
        })
      });

      // Mock upload with expired URL
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          status: 401,
          code: 'bad_auth_token',
          message: 'Upload authorization token has expired'
        })
      });

      const uploadUrl = await client.buckets.getUploadUrl({
        bucketId: 'bucket_123'
      });

      await expect(client.files.uploadFile({
        uploadUrl: uploadUrl.uploadUrl,
        uploadAuthToken: uploadUrl.authorizationToken,
        fileName: 'test.txt',
        data: 'test data'
      })).rejects.toThrow('Upload authorization token has expired');
    });

    it('should handle checksum mismatch error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          status: 400,
          code: 'bad_request',
          message: 'SHA1 checksum does not match'
        })
      });

      await expect(client.files.uploadFile({
        uploadUrl: 'https://upload.backblaze.com/test',
        uploadAuthToken: 'token_123',
        fileName: 'test.txt',
        data: 'test data',
        contentSha1: 'invalid_sha1_hash'
      })).rejects.toThrow('SHA1 checksum does not match');
    });
  });

  describe('Bucket Operation Errors', () => {
    beforeEach(async () => {
      // Mock successful authorization
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

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });
    });

    it('should handle bucket name already exists error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          status: 400,
          code: 'duplicate_bucket_name',
          message: 'Bucket name already exists'
        })
      });

      await expect(client.buckets.createBucket({
        bucketName: 'existing-bucket',
        bucketType: 'allPrivate'
      })).rejects.toThrow('Bucket name already exists');
    });

    it('should handle invalid bucket name error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          status: 400,
          code: 'bad_request',
          message: 'Invalid bucket name'
        })
      });

      await expect(client.buckets.createBucket({
        bucketName: 'invalid..bucket..name',
        bucketType: 'allPrivate'
      })).rejects.toThrow('Invalid bucket name');
    });

    it('should handle bucket not empty error when deleting', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          status: 400,
          code: 'bucket_not_empty',
          message: 'Bucket is not empty'
        })
      });

      await expect(client.buckets.deleteBucket({
        bucketId: 'bucket_with_files'
      })).rejects.toThrow('Bucket is not empty');
    });
  });

  describe('Network and Server Errors', () => {
    beforeEach(async () => {
      // Mock successful authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'auth_token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['listBuckets'] }
        })
      });

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });
    });

    it('should handle network timeout error', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      await expect(client.buckets.listBuckets()).rejects.toThrow('Network timeout');
    });

    it('should handle server internal error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          status: 500,
          code: 'internal_error',
          message: 'Internal server error'
        })
      });

      await expect(client.buckets.listBuckets()).rejects.toThrow('Internal server error');
    });

    it('should handle service unavailable error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Map([['retry-after', '120']]),
        json: () => Promise.resolve({
          status: 503,
          code: 'service_unavailable',
          message: 'Service temporarily unavailable'
        })
      });

      await expect(client.buckets.listBuckets()).rejects.toThrow('Service temporarily unavailable');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(client.buckets.listBuckets()).rejects.toThrow();
    });
  });

  describe('Large File Operation Errors', () => {
    beforeEach(async () => {
      // Mock successful authorization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          authorizationToken: 'auth_token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          allowed: { capabilities: ['writeFiles'] }
        })
      });

      await client.authorize({
        applicationKeyId: 'test_key_id',
        applicationKey: 'test_key'
      });
    });

    it('should handle part number out of range error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          status: 400,
          code: 'bad_request',
          message: 'Part number must be between 1 and 10000'
        })
      });

      await expect(client.files.uploadPart({
        uploadUrl: 'https://upload.backblaze.com/part',
        uploadAuthToken: 'token_123',
        partNumber: 10001,
        data: new Uint8Array(1000)
      })).rejects.toThrow('Part number must be between 1 and 10000');
    });

    it('should handle part too small error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          status: 400,
          code: 'bad_request',
          message: 'Part size is too small'
        })
      });

      await expect(client.files.uploadPart({
        uploadUrl: 'https://upload.backblaze.com/part',
        uploadAuthToken: 'token_123',
        partNumber: 1,
        data: new Uint8Array(1000) // Too small
      })).rejects.toThrow('Part size is too small');
    });

    it('should handle missing parts error when finishing large file', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          status: 400,
          code: 'bad_request',
          message: 'Missing parts for large file'
        })
      });

      await expect(client.files.finishLargeFile({
        fileId: 'large_file_123',
        partSha1Array: [] // Empty parts array
      })).rejects.toThrow('Missing parts for large file');
    });
  });
});