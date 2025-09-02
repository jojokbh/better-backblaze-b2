import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BucketManager, BUCKET_TYPES } from '../../../src/managers/bucket-manager.js';
import { B2_ERROR_CODES } from '../../../src/constants.js';

describe('BucketManager', () => {
  let bucketManager;
  let mockHttpClient;
  let mockAuthManager;
  let mockConfig;

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn()
    };

    mockAuthManager = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      getAuthContext: vi.fn().mockReturnValue({
        apiUrl: 'https://api.backblazeb2.com',
        accountId: 'test-account-id'
      }),
      getAccountId: vi.fn().mockReturnValue('test-account-id'),
      getAuthHeaders: vi.fn().mockReturnValue({
        Authorization: 'Bearer test-token'
      })
    };

    mockConfig = {
      timeout: 30000
    };

    bucketManager = new BucketManager(mockHttpClient, mockAuthManager, mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(bucketManager.httpClient).toBe(mockHttpClient);
      expect(bucketManager.authManager).toBe(mockAuthManager);
      expect(bucketManager.config).toBe(mockConfig);
      expect(bucketManager.endpointBuilder).toBeDefined();
    });
  });

  describe('validateBucketName', () => {
    it('should accept valid bucket names', () => {
      expect(() => bucketManager.validateBucketName('my-bucket')).not.toThrow();
      expect(() => bucketManager.validateBucketName('bucket123')).not.toThrow();
      expect(() => bucketManager.validateBucketName('test-bucket-name')).not.toThrow();
    });

    it('should reject invalid bucket names', () => {
      expect(() => bucketManager.validateBucketName('')).toThrow('bucketName is required');
      expect(() => bucketManager.validateBucketName(null)).toThrow('bucketName is required');
      expect(() => bucketManager.validateBucketName(123)).toThrow('bucketName is required');
      expect(() => bucketManager.validateBucketName('short')).toThrow('between 6 and 50 characters');
      expect(() => bucketManager.validateBucketName('a'.repeat(51))).toThrow('between 6 and 50 characters');
      expect(() => bucketManager.validateBucketName('Bucket')).toThrow('lowercase letters');
      expect(() => bucketManager.validateBucketName('bucket_name')).toThrow('lowercase letters');
      expect(() => bucketManager.validateBucketName('-bucket')).toThrow('start and end with alphanumeric');
      expect(() => bucketManager.validateBucketName('bucket-')).toThrow('start and end with alphanumeric');
      expect(() => bucketManager.validateBucketName('bucket--name')).toThrow('consecutive hyphens');
    });
  });

  describe('validateBucketType', () => {
    it('should accept valid bucket types', () => {
      expect(() => bucketManager.validateBucketType(BUCKET_TYPES.ALL_PUBLIC)).not.toThrow();
      expect(() => bucketManager.validateBucketType(BUCKET_TYPES.ALL_PRIVATE)).not.toThrow();
    });

    it('should reject invalid bucket types', () => {
      expect(() => bucketManager.validateBucketType('')).toThrow('bucketType is required');
      expect(() => bucketManager.validateBucketType(null)).toThrow('bucketType is required');
      expect(() => bucketManager.validateBucketType('invalid')).toThrow('Invalid bucket type');
    });
  });

  describe('validateBucketId', () => {
    it('should accept valid bucket IDs', () => {
      expect(() => bucketManager.validateBucketId('bucket-id-123')).not.toThrow();
    });

    it('should reject invalid bucket IDs', () => {
      expect(() => bucketManager.validateBucketId('')).toThrow('bucketId is required');
      expect(() => bucketManager.validateBucketId(null)).toThrow('bucketId is required');
      expect(() => bucketManager.validateBucketId('   ')).toThrow('bucketId cannot be empty');
    });
  });

  describe('ensureAuthenticated', () => {
    it('should not throw when authenticated', () => {
      expect(() => bucketManager.ensureAuthenticated()).not.toThrow();
      expect(mockAuthManager.isAuthenticated).toHaveBeenCalled();
    });

    it('should throw when not authenticated', () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);
      expect(() => bucketManager.ensureAuthenticated()).toThrow('Not authenticated');
    });
  });

  describe('create', () => {
    const mockResponse = {
      data: {
        bucketId: 'bucket-123',
        bucketName: 'test-bucket',
        bucketType: 'allPrivate'
      }
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue(mockResponse);
    });

    it('should create bucket with object parameters', async () => {
      const options = {
        bucketName: 'test-bucket',
        bucketType: BUCKET_TYPES.ALL_PRIVATE
      };

      const result = await bucketManager.create(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_create_bucket'),
        {
          accountId: 'test-account-id',
          bucketName: 'test-bucket',
          bucketType: 'allPrivate'
        },
        {
          headers: { Authorization: 'Bearer test-token' },
          timeout: 30000
        }
      );
      expect(result).toBe(mockResponse);
    });

    it('should create bucket with string parameters (backward compatibility)', async () => {
      const result = await bucketManager.create('test-bucket', BUCKET_TYPES.ALL_PRIVATE);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_create_bucket'),
        {
          accountId: 'test-account-id',
          bucketName: 'test-bucket',
          bucketType: 'allPrivate'
        },
        expect.any(Object)
      );
      expect(result).toBe(mockResponse);
    });

    it('should validate bucket name and type', async () => {
      await expect(bucketManager.create({ bucketName: 'short', bucketType: 'allPrivate' }))
        .rejects.toThrow('between 6 and 50 characters');

      await expect(bucketManager.create({ bucketName: 'valid-bucket', bucketType: 'invalid' }))
        .rejects.toThrow('Invalid bucket type');
    });

    it('should handle duplicate bucket name error', async () => {
      const error = new Error('Duplicate bucket name');
      error.status = 400;
      error.code = B2_ERROR_CODES.DUPLICATE_BUCKET_NAME;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(bucketManager.create('test-bucket', 'allPrivate'))
        .rejects.toThrow("Bucket name 'test-bucket' already exists");
    });

    it('should handle invalid bucket name error', async () => {
      const error = new Error('Invalid bucket name');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_NAME;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(bucketManager.create('test-bucket', 'allPrivate'))
        .rejects.toThrow('Invalid bucket name: test-bucket');
    });

    it('should require authentication', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);
      
      await expect(bucketManager.create('test-bucket', 'allPrivate'))
        .rejects.toThrow('Not authenticated');
    });
  });

  describe('delete', () => {
    const mockResponse = {
      data: {
        bucketId: 'bucket-123',
        bucketName: 'test-bucket'
      }
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue(mockResponse);
    });

    it('should delete bucket with object parameter', async () => {
      const result = await bucketManager.delete({ bucketId: 'bucket-123' });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_delete_bucket'),
        {
          accountId: 'test-account-id',
          bucketId: 'bucket-123'
        },
        {
          headers: { Authorization: 'Bearer test-token' },
          timeout: 30000
        }
      );
      expect(result).toBe(mockResponse);
    });

    it('should delete bucket with string parameter (backward compatibility)', async () => {
      const result = await bucketManager.delete('bucket-123');

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_delete_bucket'),
        {
          accountId: 'test-account-id',
          bucketId: 'bucket-123'
        },
        expect.any(Object)
      );
      expect(result).toBe(mockResponse);
    });

    it('should validate bucket ID', async () => {
      await expect(bucketManager.delete({ bucketId: '' }))
        .rejects.toThrow('bucketId is required');
    });

    it('should handle invalid bucket ID error', async () => {
      const error = new Error('Invalid bucket ID');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(bucketManager.delete('invalid-bucket-id'))
        .rejects.toThrow('Invalid bucket ID: invalid-bucket-id');
    });

    it('should handle bucket not empty error', async () => {
      const error = new Error('Bucket not empty');
      error.status = 400;
      error.code = B2_ERROR_CODES.BUCKET_NOT_EMPTY;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(bucketManager.delete('bucket-123'))
        .rejects.toThrow('Bucket is not empty and cannot be deleted');
    });
  });

  describe('list', () => {
    const mockResponse = {
      data: {
        buckets: [
          { bucketId: 'bucket-1', bucketName: 'bucket-one', bucketType: 'allPrivate' },
          { bucketId: 'bucket-2', bucketName: 'bucket-two', bucketType: 'allPublic' }
        ]
      }
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue(mockResponse);
    });

    it('should list buckets', async () => {
      const result = await bucketManager.list();

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_list_buckets'),
        {
          accountId: 'test-account-id'
        },
        {
          headers: { Authorization: 'Bearer test-token' },
          timeout: 30000
        }
      );
      expect(result).toBe(mockResponse);
    });

    it('should list buckets with options', async () => {
      const result = await bucketManager.list({ someOption: 'value' });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_list_buckets'),
        {
          accountId: 'test-account-id'
        },
        expect.any(Object)
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe('get', () => {
    const mockResponse = {
      data: {
        buckets: [
          { bucketId: 'bucket-123', bucketName: 'test-bucket', bucketType: 'allPrivate' }
        ]
      }
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue(mockResponse);
    });

    it('should get bucket by name', async () => {
      const result = await bucketManager.get({ bucketName: 'test-bucket' });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_list_buckets'),
        {
          accountId: 'test-account-id',
          bucketName: 'test-bucket'
        },
        {
          headers: { Authorization: 'Bearer test-token' },
          timeout: 30000
        }
      );
      expect(result).toBe(mockResponse);
    });

    it('should get bucket by ID', async () => {
      const result = await bucketManager.get({ bucketId: 'bucket-123' });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_list_buckets'),
        {
          accountId: 'test-account-id',
          bucketId: 'bucket-123'
        },
        expect.any(Object)
      );
      expect(result).toBe(mockResponse);
    });

    it('should require either bucketName or bucketId', async () => {
      await expect(bucketManager.get({}))
        .rejects.toThrow('Either bucketName or bucketId is required');
    });

    it('should not allow both bucketName and bucketId', async () => {
      await expect(bucketManager.get({ bucketName: 'test', bucketId: 'bucket-123' }))
        .rejects.toThrow('Cannot specify both bucketName and bucketId');
    });

    it('should validate bucket name when provided', async () => {
      await expect(bucketManager.get({ bucketName: 'short' }))
        .rejects.toThrow('between 6 and 50 characters');
    });

    it('should validate bucket ID when provided', async () => {
      await expect(bucketManager.get({ bucketId: '' }))
        .rejects.toThrow('bucketId is required');
    });
  });

  describe('update', () => {
    const mockResponse = {
      data: {
        bucketId: 'bucket-123',
        bucketName: 'test-bucket',
        bucketType: 'allPublic'
      }
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue(mockResponse);
    });

    it('should update bucket with object parameters', async () => {
      const options = {
        bucketId: 'bucket-123',
        bucketType: BUCKET_TYPES.ALL_PUBLIC
      };

      const result = await bucketManager.update(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_update_bucket'),
        {
          accountId: 'test-account-id',
          bucketId: 'bucket-123',
          bucketType: 'allPublic'
        },
        {
          headers: { Authorization: 'Bearer test-token' },
          timeout: 30000
        }
      );
      expect(result).toBe(mockResponse);
    });

    it('should update bucket with string parameters (backward compatibility)', async () => {
      const result = await bucketManager.update('bucket-123', BUCKET_TYPES.ALL_PUBLIC);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_update_bucket'),
        {
          accountId: 'test-account-id',
          bucketId: 'bucket-123',
          bucketType: 'allPublic'
        },
        expect.any(Object)
      );
      expect(result).toBe(mockResponse);
    });

    it('should validate bucket ID and type', async () => {
      await expect(bucketManager.update({ bucketId: '', bucketType: 'allPublic' }))
        .rejects.toThrow('bucketId is required');

      await expect(bucketManager.update({ bucketId: 'bucket-123', bucketType: 'invalid' }))
        .rejects.toThrow('Invalid bucket type');
    });

    it('should handle invalid bucket ID error', async () => {
      const error = new Error('Invalid bucket ID');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(bucketManager.update('invalid-bucket-id', 'allPublic'))
        .rejects.toThrow('Invalid bucket ID: invalid-bucket-id');
    });
  });

  describe('getUploadUrl', () => {
    const mockResponse = {
      data: {
        bucketId: 'bucket-123',
        uploadUrl: 'https://upload.backblazeb2.com/b2api/v2/b2_upload_file/bucket-123',
        authorizationToken: 'upload-token'
      }
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue(mockResponse);
    });

    it('should get upload URL with object parameter', async () => {
      const result = await bucketManager.getUploadUrl({ bucketId: 'bucket-123' });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_get_upload_url'),
        {
          bucketId: 'bucket-123'
        },
        {
          headers: { Authorization: 'Bearer test-token' },
          timeout: 30000
        }
      );
      expect(result).toBe(mockResponse);
    });

    it('should get upload URL with string parameter (backward compatibility)', async () => {
      const result = await bucketManager.getUploadUrl('bucket-123');

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_get_upload_url'),
        {
          bucketId: 'bucket-123'
        },
        expect.any(Object)
      );
      expect(result).toBe(mockResponse);
    });

    it('should validate bucket ID', async () => {
      await expect(bucketManager.getUploadUrl({ bucketId: '' }))
        .rejects.toThrow('bucketId is required');
    });

    it('should handle invalid bucket ID error', async () => {
      const error = new Error('Invalid bucket ID');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(bucketManager.getUploadUrl('invalid-bucket-id'))
        .rejects.toThrow('Invalid bucket ID: invalid-bucket-id');
    });
  });

  describe('BUCKET_TYPES export', () => {
    it('should export BUCKET_TYPES constants', () => {
      expect(BUCKET_TYPES).toBeDefined();
      expect(BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
    });
  });
});