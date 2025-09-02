/**
 * Unit tests for KeyManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyManager } from '../../../src/managers/key-manager.js';
import { KEY_CAPABILITIES, B2_ERROR_CODES } from '../../../src/constants.js';

describe('KeyManager', () => {
  let keyManager;
  let mockHttpClient;
  let mockAuthManager;

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn()
    };

    mockAuthManager = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      getAuthContext: vi.fn().mockReturnValue({
        accountId: 'test-account-id',
        apiUrl: 'https://api.test.com'
      }),
      getAccountId: vi.fn().mockReturnValue('test-account-id'),
      getAuthHeaders: vi.fn().mockReturnValue({
        Authorization: 'test-token'
      })
    };

    keyManager = new KeyManager(mockHttpClient, mockAuthManager);
  });

  describe('constructor', () => {
    it('should initialize with http client and auth manager', () => {
      expect(keyManager.httpClient).toBe(mockHttpClient);
      expect(keyManager.authManager).toBe(mockAuthManager);
      expect(keyManager.config).toEqual({});
    });

    it('should store config when provided', () => {
      const config = { timeout: 5000 };
      const manager = new KeyManager(mockHttpClient, mockAuthManager, config);
      
      expect(manager.config).toBe(config);
    });
  });

  describe('validateKeyName', () => {
    it('should validate valid key names', () => {
      const validNames = [
        'test-key',
        'my_key_123',
        'key.name',
        'a',
        'A'.repeat(100)
      ];

      validNames.forEach(name => {
        expect(() => keyManager.validateKeyName(name)).not.toThrow();
      });
    });

    it('should throw error for invalid key names', () => {
      expect(() => keyManager.validateKeyName(null)).toThrow('keyName is required and must be a string');
      expect(() => keyManager.validateKeyName(undefined)).toThrow('keyName is required and must be a string');
      expect(() => keyManager.validateKeyName(123)).toThrow('keyName is required and must be a string');
      expect(() => keyManager.validateKeyName('')).toThrow('Key name must be between 1 and 100 characters');
      expect(() => keyManager.validateKeyName('A'.repeat(101))).toThrow('Key name must be between 1 and 100 characters');
      expect(() => keyManager.validateKeyName('key with spaces')).toThrow('Key name can only contain letters, numbers, hyphens, underscores, and periods');
      expect(() => keyManager.validateKeyName('key@name')).toThrow('Key name can only contain letters, numbers, hyphens, underscores, and periods');
    });
  });

  describe('validateCapabilities', () => {
    it('should validate valid capabilities', () => {
      const validCapabilities = [
        [KEY_CAPABILITIES.LIST_KEYS],
        [KEY_CAPABILITIES.WRITE_KEYS, KEY_CAPABILITIES.DELETE_KEYS],
        Object.values(KEY_CAPABILITIES)
      ];

      validCapabilities.forEach(capabilities => {
        expect(() => keyManager.validateCapabilities(capabilities)).not.toThrow();
      });
    });

    it('should throw error for invalid capabilities', () => {
      expect(() => keyManager.validateCapabilities(null)).toThrow('capabilities must be an array');
      expect(() => keyManager.validateCapabilities('string')).toThrow('capabilities must be an array');
      expect(() => keyManager.validateCapabilities([])).toThrow('At least one capability is required');
      expect(() => keyManager.validateCapabilities([123])).toThrow('All capabilities must be strings');
      expect(() => keyManager.validateCapabilities(['invalidCapability'])).toThrow('Invalid capability: invalidCapability');
      expect(() => keyManager.validateCapabilities([KEY_CAPABILITIES.LIST_KEYS, KEY_CAPABILITIES.LIST_KEYS])).toThrow('Duplicate capabilities are not allowed');
    });
  });

  describe('validateKeyId', () => {
    it('should validate valid key IDs', () => {
      expect(() => keyManager.validateKeyId('valid-key-id')).not.toThrow();
      expect(() => keyManager.validateKeyId('123456789')).not.toThrow();
    });

    it('should throw error for invalid key IDs', () => {
      expect(() => keyManager.validateKeyId(null)).toThrow('applicationKeyId is required and must be a string');
      expect(() => keyManager.validateKeyId(undefined)).toThrow('applicationKeyId is required and must be a string');
      expect(() => keyManager.validateKeyId(123)).toThrow('applicationKeyId is required and must be a string');
      expect(() => keyManager.validateKeyId('')).toThrow('applicationKeyId cannot be empty');
      expect(() => keyManager.validateKeyId('   ')).toThrow('applicationKeyId cannot be empty');
    });
  });

  describe('validateBucketId', () => {
    it('should validate valid bucket IDs', () => {
      expect(() => keyManager.validateBucketId('valid-bucket-id')).not.toThrow();
      expect(() => keyManager.validateBucketId(null)).not.toThrow();
      expect(() => keyManager.validateBucketId(undefined)).not.toThrow();
    });

    it('should throw error for invalid bucket IDs', () => {
      expect(() => keyManager.validateBucketId(123)).toThrow('bucketId must be a string or null');
      expect(() => keyManager.validateBucketId('')).toThrow('bucketId cannot be empty string');
      expect(() => keyManager.validateBucketId('   ')).toThrow('bucketId cannot be empty string');
    });
  });

  describe('validateNamePrefix', () => {
    it('should validate valid name prefixes', () => {
      expect(() => keyManager.validateNamePrefix('prefix/')).not.toThrow();
      expect(() => keyManager.validateNamePrefix('')).not.toThrow();
      expect(() => keyManager.validateNamePrefix(null)).not.toThrow();
      expect(() => keyManager.validateNamePrefix(undefined)).not.toThrow();
    });

    it('should throw error for invalid name prefixes', () => {
      expect(() => keyManager.validateNamePrefix(123)).toThrow('namePrefix must be a string or null');
    });
  });

  describe('ensureAuthenticated', () => {
    it('should not throw when authenticated', () => {
      expect(() => keyManager.ensureAuthenticated()).not.toThrow();
      expect(mockAuthManager.isAuthenticated).toHaveBeenCalled();
    });

    it('should throw error when not authenticated', () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);
      
      expect(() => keyManager.ensureAuthenticated()).toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('createKey', () => {
    const validOptions = {
      keyName: 'test-key',
      capabilities: [KEY_CAPABILITIES.LIST_KEYS, KEY_CAPABILITIES.READ_FILES]
    };

    const mockResponse = {
      status: 200,
      data: {
        applicationKeyId: 'key123',
        keyName: 'test-key',
        capabilities: [KEY_CAPABILITIES.LIST_KEYS, KEY_CAPABILITIES.READ_FILES],
        accountId: 'test-account-id'
      }
    };

    it('should create key with valid options', async () => {
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const response = await keyManager.createKey(validOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_create_key'),
        {
          accountId: 'test-account-id',
          keyName: 'test-key',
          capabilities: [KEY_CAPABILITIES.LIST_KEYS, KEY_CAPABILITIES.READ_FILES]
        },
        {
          headers: { Authorization: 'test-token' },
          timeout: undefined
        }
      );

      expect(response).toBe(mockResponse);
    });

    it('should create key with optional parameters', async () => {
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const optionsWithExtras = {
        ...validOptions,
        bucketId: 'bucket123',
        namePrefix: 'files/',
        validDurationInSeconds: 3600
      };

      await keyManager.createKey(optionsWithExtras);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          bucketId: 'bucket123',
          namePrefix: 'files/',
          validDurationInSeconds: 3600
        }),
        expect.any(Object)
      );
    });

    it('should throw error for missing options', async () => {
      await expect(keyManager.createKey()).rejects.toThrow('options object is required');
      await expect(keyManager.createKey(null)).rejects.toThrow('options object is required');
      await expect(keyManager.createKey('string')).rejects.toThrow('options object is required');
    });

    it('should throw error for invalid key name', async () => {
      const invalidOptions = { ...validOptions, keyName: '' };
      await expect(keyManager.createKey(invalidOptions)).rejects.toThrow('Key name must be between 1 and 100 characters');
    });

    it('should throw error for invalid capabilities', async () => {
      const invalidOptions = { ...validOptions, capabilities: [] };
      await expect(keyManager.createKey(invalidOptions)).rejects.toThrow('At least one capability is required');
    });

    it('should throw error for invalid validDurationInSeconds', async () => {
      const invalidOptions = { ...validOptions, validDurationInSeconds: -1 };
      await expect(keyManager.createKey(invalidOptions)).rejects.toThrow('validDurationInSeconds must be a positive number');

      const tooLongOptions = { ...validOptions, validDurationInSeconds: 1001 * 24 * 60 * 60 };
      await expect(keyManager.createKey(tooLongOptions)).rejects.toThrow('validDurationInSeconds cannot exceed 1000 days');
    });

    it('should handle B2 API errors', async () => {
      const apiError = new Error('Invalid bucket ID');
      apiError.status = 400;
      apiError.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(apiError);

      await expect(keyManager.createKey({ ...validOptions, bucketId: 'invalid' })).rejects.toThrow('Invalid bucket ID: invalid');
    });

    it('should handle not allowed errors', async () => {
      const apiError = new Error('Not allowed');
      apiError.status = 400;
      apiError.code = B2_ERROR_CODES.NOT_ALLOWED;
      mockHttpClient.post.mockRejectedValue(apiError);

      await expect(keyManager.createKey(validOptions)).rejects.toThrow('Not allowed to create keys with the specified capabilities');
    });

    it('should re-throw other errors', async () => {
      const networkError = new Error('Network error');
      networkError.status = 500;
      mockHttpClient.post.mockRejectedValue(networkError);

      await expect(keyManager.createKey(validOptions)).rejects.toThrow('Network error');
    });

    it('should throw error when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(keyManager.createKey(validOptions)).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('deleteKey', () => {
    const mockResponse = {
      status: 200,
      data: {
        applicationKeyId: 'key123'
      }
    };

    it('should delete key with object parameter', async () => {
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const response = await keyManager.deleteKey({ applicationKeyId: 'key123' });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_delete_key'),
        {
          applicationKeyId: 'key123'
        },
        {
          headers: { Authorization: 'test-token' },
          timeout: undefined
        }
      );

      expect(response).toBe(mockResponse);
    });

    it('should delete key with string parameter (backward compatibility)', async () => {
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const response = await keyManager.deleteKey('key123');

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          applicationKeyId: 'key123'
        },
        expect.any(Object)
      );

      expect(response).toBe(mockResponse);
    });

    it('should throw error for invalid parameters', async () => {
      await expect(keyManager.deleteKey()).rejects.toThrow('Invalid arguments. Expected object with applicationKeyId or applicationKeyId as string');
      await expect(keyManager.deleteKey(null)).rejects.toThrow('Invalid arguments. Expected object with applicationKeyId or applicationKeyId as string');
      await expect(keyManager.deleteKey(123)).rejects.toThrow('Invalid arguments. Expected object with applicationKeyId or applicationKeyId as string');
    });

    it('should throw error for invalid key ID', async () => {
      await expect(keyManager.deleteKey({ applicationKeyId: '' })).rejects.toThrow('applicationKeyId cannot be empty');
    });

    it('should handle B2 API errors', async () => {
      const apiError = new Error('Invalid key ID');
      apiError.status = 400;
      mockHttpClient.post.mockRejectedValue(apiError);

      await expect(keyManager.deleteKey('invalid-key')).rejects.toThrow('Invalid application key ID: invalid-key');
    });

    it('should throw error when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(keyManager.deleteKey('key123')).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('listKeys', () => {
    const mockResponse = {
      status: 200,
      data: {
        keys: [
          {
            applicationKeyId: 'key123',
            keyName: 'test-key',
            capabilities: [KEY_CAPABILITIES.LIST_KEYS]
          }
        ],
        nextApplicationKeyId: null
      }
    };

    it('should list keys with default options', async () => {
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const response = await keyManager.listKeys();

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_list_keys'),
        {
          accountId: 'test-account-id'
        },
        {
          headers: { Authorization: 'test-token' },
          timeout: undefined
        }
      );

      expect(response).toBe(mockResponse);
    });

    it('should list keys with options', async () => {
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const options = {
        maxKeyCount: 50,
        startApplicationKeyId: 'start-key-id'
      };

      await keyManager.listKeys(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          accountId: 'test-account-id',
          maxKeyCount: 50,
          startApplicationKeyId: 'start-key-id'
        },
        expect.any(Object)
      );
    });

    it('should throw error for invalid options', async () => {
      await expect(keyManager.listKeys('string')).rejects.toThrow('options must be an object');
    });

    it('should throw error for invalid maxKeyCount', async () => {
      await expect(keyManager.listKeys({ maxKeyCount: 0 })).rejects.toThrow('maxKeyCount must be a number between 1 and 10000');
      await expect(keyManager.listKeys({ maxKeyCount: 10001 })).rejects.toThrow('maxKeyCount must be a number between 1 and 10000');
      await expect(keyManager.listKeys({ maxKeyCount: 'string' })).rejects.toThrow('maxKeyCount must be a number between 1 and 10000');
    });

    it('should throw error for invalid startApplicationKeyId', async () => {
      await expect(keyManager.listKeys({ startApplicationKeyId: '' })).rejects.toThrow('applicationKeyId cannot be empty');
    });

    it('should handle API errors', async () => {
      const apiError = new Error('API error');
      apiError.status = 500;
      mockHttpClient.post.mockRejectedValue(apiError);

      await expect(keyManager.listKeys()).rejects.toThrow('API error');
    });

    it('should throw error when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(keyManager.listKeys()).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('configuration and timeout', () => {
    it('should pass timeout from config to http client', async () => {
      const config = { timeout: 5000 };
      const manager = new KeyManager(mockHttpClient, mockAuthManager, config);
      
      mockHttpClient.post.mockResolvedValue({ status: 200, data: {} });

      await manager.createKey({
        keyName: 'test-key',
        capabilities: [KEY_CAPABILITIES.LIST_KEYS]
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 5000
        })
      );
    });
  });
});