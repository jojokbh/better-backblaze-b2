/**
 * Compatibility tests for B2Client class
 * Tests backward compatibility with the original library API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B2Client, BUCKET_TYPES, KEY_CAPABILITIES } from '../../src/b2-client.js';
import { HttpClient } from '../../src/core/http-client.js';
import { RetryHandler } from '../../src/core/retry-handler.js';
import { AuthManager } from '../../src/managers/auth-manager.js';
import { BucketManager } from '../../src/managers/bucket-manager.js';
import { FileManager } from '../../src/managers/file-manager.js';
import { KeyManager } from '../../src/managers/key-manager.js';

// Mock all dependencies
vi.mock('../../src/core/http-client.js');
vi.mock('../../src/core/retry-handler.js');
vi.mock('../../src/managers/auth-manager.js');
vi.mock('../../src/managers/bucket-manager.js');
vi.mock('../../src/managers/file-manager.js');
vi.mock('../../src/managers/key-manager.js');

describe('B2Client Backward Compatibility', () => {
  let client;
  let mockAuthManager;
  let mockBucketManager;
  let mockFileManager;
  let mockKeyManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock managers with minimal required methods
    mockAuthManager = {
      authorize: vi.fn(),
      isAuthenticated: vi.fn(),
      getAuthContext: vi.fn(),
      clearAuthContext: vi.fn()
    };

    mockBucketManager = {
      create: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      getUploadUrl: vi.fn()
    };

    mockFileManager = {
      uploadFile: vi.fn(),
      downloadFileByName: vi.fn(),
      downloadFileById: vi.fn(),
      listFileNames: vi.fn(),
      listFileVersions: vi.fn(),
      getFileInfo: vi.fn(),
      deleteFileVersion: vi.fn(),
      hideFile: vi.fn(),
      getDownloadAuthorization: vi.fn(),
      startLargeFile: vi.fn(),
      getUploadPartUrl: vi.fn(),
      uploadPart: vi.fn(),
      finishLargeFile: vi.fn(),
      cancelLargeFile: vi.fn(),
      listParts: vi.fn(),
      listUnfinishedLargeFiles: vi.fn()
    };

    mockKeyManager = {
      createKey: vi.fn(),
      deleteKey: vi.fn(),
      listKeys: vi.fn()
    };

    // Mock the constructors to return our mocks
    HttpClient.mockImplementation(() => ({}));
    RetryHandler.mockImplementation(() => ({ executeWithRetry: vi.fn((fn) => fn()) }));
    AuthManager.mockImplementation(() => mockAuthManager);
    BucketManager.mockImplementation(() => mockBucketManager);
    FileManager.mockImplementation(() => mockFileManager);
    KeyManager.mockImplementation(() => mockKeyManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor compatibility', () => {
    it('should support legacy constructor with accountId, applicationKeyId, applicationKey', () => {
      const options = {
        accountId: 'test-account-id',
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      };

      client = new B2Client(options);

      expect(client.accountId).toBe('test-account-id');
      expect(client.applicationKeyId).toBe('test-key-id');
      expect(client.applicationKey).toBe('test-key');
      expect(client.authorizationToken).toBeNull();
      expect(client.apiUrl).toBeNull();
      expect(client.downloadUrl).toBeNull();
    });

    it('should have BUCKET_TYPES as instance property', () => {
      client = new B2Client();
      
      expect(client.BUCKET_TYPES).toBeDefined();
      expect(client.BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(client.BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
    });

    it('should have KEY_CAPABILITIES as instance property', () => {
      client = new B2Client();
      
      expect(client.KEY_CAPABILITIES).toBeDefined();
      expect(client.KEY_CAPABILITIES.LIST_FILES).toBe('listFiles');
      expect(client.KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
    });
  });

  describe('authorize method compatibility', () => {
    beforeEach(() => {
      client = new B2Client({
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      });
    });

    it('should authorize without arguments using instance properties', async () => {
      const mockResponse = {
        data: {
          authorizationToken: 'test-token',
          apiUrl: 'https://api.test.com',
          downloadUrl: 'https://download.test.com'
        }
      };
      
      mockAuthManager.authorize.mockResolvedValue(mockResponse);

      const result = await client.authorize();

      expect(mockAuthManager.authorize).toHaveBeenCalledWith({
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      }, expect.any(Object));

      // Check that legacy instance properties are updated
      expect(client.authorizationToken).toBe('test-token');
      expect(client.apiUrl).toBe('https://api.test.com');
      expect(client.downloadUrl).toBe('https://download.test.com');
      expect(result).toBe(mockResponse);
    });

    it('should authorize with object argument', async () => {
      const credentials = {
        applicationKeyId: 'new-key-id',
        applicationKey: 'new-key'
      };
      const mockResponse = {
        data: {
          authorizationToken: 'new-token',
          apiUrl: 'https://api.new.com',
          downloadUrl: 'https://download.new.com'
        }
      };
      
      mockAuthManager.authorize.mockResolvedValue(mockResponse);

      const result = await client.authorize(credentials);

      expect(mockAuthManager.authorize).toHaveBeenCalledWith(credentials, expect.any(Object));
      expect(client.authorizationToken).toBe('new-token');
      expect(client.apiUrl).toBe('https://api.new.com');
      expect(client.downloadUrl).toBe('https://download.new.com');
      expect(result).toBe(mockResponse);
    });

    it('should clear legacy properties when clearing auth', () => {
      client.authorizationToken = 'test-token';
      client.apiUrl = 'https://api.test.com';
      client.downloadUrl = 'https://download.test.com';

      client.clearAuth();

      expect(client.authorizationToken).toBeNull();
      expect(client.apiUrl).toBeNull();
      expect(client.downloadUrl).toBeNull();
      expect(mockAuthManager.clearAuthContext).toHaveBeenCalled();
    });
  });

  describe('bucket methods compatibility', () => {
    beforeEach(() => {
      client = new B2Client();
    });

    it('should support createBucket with separate arguments (legacy format)', async () => {
      const mockResponse = { data: { bucketId: 'bucket123' } };
      mockBucketManager.create.mockResolvedValue(mockResponse);

      const result = await client.createBucket('test-bucket', 'allPrivate');

      expect(mockBucketManager.create).toHaveBeenCalledWith('test-bucket', 'allPrivate');
      expect(result).toBe(mockResponse);
    });

    it('should support updateBucket with separate arguments (legacy format)', async () => {
      const mockResponse = { data: { bucketId: 'bucket123' } };
      mockBucketManager.update.mockResolvedValue(mockResponse);

      const result = await client.updateBucket('bucket123', 'allPublic');

      expect(mockBucketManager.update).toHaveBeenCalledWith('bucket123', 'allPublic');
      expect(result).toBe(mockResponse);
    });

    it('should support deleteBucket with string argument (legacy format)', async () => {
      const mockResponse = { data: { bucketId: 'bucket123' } };
      mockBucketManager.delete.mockResolvedValue(mockResponse);

      const result = await client.deleteBucket('bucket123');

      expect(mockBucketManager.delete).toHaveBeenCalledWith('bucket123');
      expect(result).toBe(mockResponse);
    });

    it('should support getUploadUrl with string argument (legacy format)', async () => {
      const mockResponse = { data: { uploadUrl: 'https://upload.url' } };
      mockBucketManager.getUploadUrl.mockResolvedValue(mockResponse);

      const result = await client.getUploadUrl('bucket123');

      expect(mockBucketManager.getUploadUrl).toHaveBeenCalledWith('bucket123');
      expect(result).toBe(mockResponse);
    });
  });

  describe('file methods compatibility', () => {
    beforeEach(() => {
      client = new B2Client();
    });

    it('should support downloadFileByName with separate arguments (legacy format)', async () => {
      const mockResponse = { data: new ArrayBuffer(10) };
      mockFileManager.downloadFileByName.mockResolvedValue(mockResponse);

      const result = await client.downloadFileByName('test-bucket', 'test.txt');

      expect(mockFileManager.downloadFileByName).toHaveBeenCalledWith('test-bucket', 'test.txt');
      expect(result).toBe(mockResponse);
    });

    it('should support downloadFileById with string argument (legacy format)', async () => {
      const mockResponse = { data: new ArrayBuffer(10) };
      mockFileManager.downloadFileById.mockResolvedValue(mockResponse);

      const result = await client.downloadFileById('file123');

      expect(mockFileManager.downloadFileById).toHaveBeenCalledWith('file123');
      expect(result).toBe(mockResponse);
    });

    it('should support getFileInfo with string argument (legacy format)', async () => {
      const mockResponse = { data: { fileName: 'test.txt' } };
      mockFileManager.getFileInfo.mockResolvedValue(mockResponse);

      const result = await client.getFileInfo('file123');

      expect(mockFileManager.getFileInfo).toHaveBeenCalledWith('file123');
      expect(result).toBe(mockResponse);
    });

    it('should have listUnfinishedLargeFiles method', async () => {
      const mockResponse = { data: { files: [] } };
      mockFileManager.listUnfinishedLargeFiles.mockResolvedValue(mockResponse);

      const result = await client.listUnfinishedLargeFiles({ bucketId: 'bucket123' });

      expect(mockFileManager.listUnfinishedLargeFiles).toHaveBeenCalledWith({ bucketId: 'bucket123' });
      expect(result).toBe(mockResponse);
    });
  });

  describe('key management compatibility', () => {
    beforeEach(() => {
      client = new B2Client();
    });

    it('should support deleteKey with string argument (legacy format)', async () => {
      const mockResponse = { data: { applicationKeyId: 'key123' } };
      mockKeyManager.deleteKey.mockResolvedValue(mockResponse);

      const result = await client.deleteKey('key123');

      expect(mockKeyManager.deleteKey).toHaveBeenCalledWith('key123');
      expect(result).toBe(mockResponse);
    });
  });

  describe('constants compatibility', () => {
    it('should export BUCKET_TYPES constant', () => {
      expect(BUCKET_TYPES).toBeDefined();
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
    });

    it('should export KEY_CAPABILITIES constant', () => {
      expect(KEY_CAPABILITIES).toBeDefined();
      expect(KEY_CAPABILITIES.LIST_FILES).toBe('listFiles');
      expect(KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
      expect(KEY_CAPABILITIES.WRITE_FILES).toBe('writeFiles');
      expect(KEY_CAPABILITIES.DELETE_FILES).toBe('deleteFiles');
    });
  });

  describe('response format compatibility', () => {
    beforeEach(() => {
      client = new B2Client();
    });

    it('should return axios-compatible response format', async () => {
      const mockAxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        data: { bucketId: 'bucket123' },
        config: {
          url: 'https://api.test.com/b2api/v2/b2_create_bucket',
          method: 'POST'
        }
      };
      
      mockBucketManager.create.mockResolvedValue(mockAxiosResponse);

      const result = await client.createBucket({ bucketName: 'test', bucketType: 'allPrivate' });

      expect(result).toHaveProperty('status', 200);
      expect(result).toHaveProperty('statusText', 'OK');
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('config');
      expect(result.data).toEqual({ bucketId: 'bucket123' });
    });
  });
});