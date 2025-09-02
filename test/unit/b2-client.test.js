/**
 * Unit tests for B2Client class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B2Client, BUCKET_TYPES, KEY_CAPABILITIES } from '../../src/b2-client.js';
import { HttpClient } from '../../src/core/http-client.js';
import { RetryHandler } from '../../src/core/retry-handler.js';
import { AuthManager } from '../../src/managers/auth-manager.js';
import { BucketManager } from '../../src/managers/bucket-manager.js';
import { FileManager } from '../../src/managers/file-manager.js';
import { KeyManager } from '../../src/managers/key-manager.js';

// Mock all manager classes
vi.mock('../../src/core/http-client.js');
vi.mock('../../src/core/retry-handler.js');
vi.mock('../../src/managers/auth-manager.js');
vi.mock('../../src/managers/bucket-manager.js');
vi.mock('../../src/managers/file-manager.js');
vi.mock('../../src/managers/key-manager.js');

describe('B2Client', () => {
  let client;
  let mockHttpClient;
  let mockRetryHandler;
  let mockAuthManager;
  let mockBucketManager;
  let mockFileManager;
  let mockKeyManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    mockRetryHandler = {
      executeWithRetry: vi.fn((fn) => fn())
    };

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
      listParts: vi.fn()
    };

    mockKeyManager = {
      createKey: vi.fn(),
      deleteKey: vi.fn(),
      listKeys: vi.fn()
    };

    // Mock constructors
    HttpClient.mockImplementation(() => mockHttpClient);
    RetryHandler.mockImplementation(() => mockRetryHandler);
    AuthManager.mockImplementation(() => mockAuthManager);
    BucketManager.mockImplementation(() => mockBucketManager);
    FileManager.mockImplementation(() => mockFileManager);
    KeyManager.mockImplementation(() => mockKeyManager);

    // Create client instance
    client = new B2Client();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create B2Client with default configuration', () => {
      expect(client).toBeInstanceOf(B2Client);
      expect(HttpClient).toHaveBeenCalledWith(expect.objectContaining({
        timeout: expect.any(Number),
        headers: expect.any(Object)
      }));
      expect(RetryHandler).toHaveBeenCalledWith(expect.objectContaining({
        retries: expect.any(Number),
        retryDelay: expect.any(Number)
      }));
    });

    it('should create B2Client with custom configuration', () => {
      const customConfig = {
        timeout: 60000,
        retries: 5,
        retryDelay: 2000,
        headers: { 'Custom-Header': 'value' }
      };

      const customClient = new B2Client(customConfig);
      
      expect(customClient).toBeInstanceOf(B2Client);
      expect(HttpClient).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 60000,
        headers: { 'Custom-Header': 'value' }
      }));
      expect(RetryHandler).toHaveBeenCalledWith(expect.objectContaining({
        retries: 5,
        retryDelay: 2000
      }));
    });

    it('should throw error for invalid options', () => {
      expect(() => new B2Client('invalid')).toThrow('options must be an object');
    });

    it('should initialize all managers', () => {
      expect(AuthManager).toHaveBeenCalledWith(mockHttpClient, expect.any(Object));
      expect(BucketManager).toHaveBeenCalledWith(mockHttpClient, mockAuthManager, expect.any(Object));
      expect(FileManager).toHaveBeenCalledWith(mockHttpClient, mockAuthManager, expect.any(Object));
      expect(KeyManager).toHaveBeenCalledWith(mockHttpClient, mockAuthManager, expect.any(Object));
    });
  });

  describe('authentication methods', () => {
    describe('authorize', () => {
      it('should authorize with object parameters', async () => {
        const credentials = {
          applicationKeyId: 'testKeyId',
          applicationKey: 'testKey'
        };
        const mockResponse = { data: { authorizationToken: 'token' } };
        
        mockAuthManager.authorize.mockResolvedValue(mockResponse);

        const result = await client.authorize(credentials);

        expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
        expect(mockAuthManager.authorize).toHaveBeenCalledWith(credentials, expect.any(Object));
        expect(result).toBe(mockResponse);
        expect(client.credentials).toEqual(credentials);
      });

      it('should authorize with string parameters (backward compatibility)', async () => {
        const mockResponse = { data: { authorizationToken: 'token' } };
        mockAuthManager.authorize.mockResolvedValue(mockResponse);

        const result = await client.authorize('testKeyId', 'testKey');

        expect(mockAuthManager.authorize).toHaveBeenCalledWith({
          applicationKeyId: 'testKeyId',
          applicationKey: 'testKey'
        }, expect.any(Object));
        expect(result).toBe(mockResponse);
      });

      it('should throw error for invalid arguments', async () => {
        await expect(client.authorize()).rejects.toThrow('Invalid arguments');
        await expect(client.authorize(123)).rejects.toThrow('Invalid arguments');
      });
    });

    it('should check authentication status', () => {
      mockAuthManager.isAuthenticated.mockReturnValue(true);
      expect(client.isAuthenticated()).toBe(true);
      expect(mockAuthManager.isAuthenticated).toHaveBeenCalled();
    });

    it('should get auth context', () => {
      const mockContext = { authorizationToken: 'token' };
      mockAuthManager.getAuthContext.mockReturnValue(mockContext);
      
      expect(client.getAuthContext()).toBe(mockContext);
      expect(mockAuthManager.getAuthContext).toHaveBeenCalled();
    });

    it('should clear auth', () => {
      client.credentials = { applicationKeyId: 'test', applicationKey: 'test' };
      
      client.clearAuth();
      
      expect(mockAuthManager.clearAuthContext).toHaveBeenCalled();
      expect(client.credentials).toBeNull();
    });

    it('should refresh auth with stored credentials', async () => {
      const credentials = { applicationKeyId: 'test', applicationKey: 'test' };
      client.credentials = credentials;
      
      const mockResponse = { data: { authorizationToken: 'newToken' } };
      mockAuthManager.authorize.mockResolvedValue(mockResponse);

      const result = await client.refreshAuth();

      expect(mockAuthManager.authorize).toHaveBeenCalledWith(credentials, expect.any(Object));
      expect(result).toBe(mockResponse);
    });

    it('should throw error when refreshing without stored credentials', async () => {
      await expect(client.refreshAuth()).rejects.toThrow('No credentials stored');
    });
  });

  describe('bucket methods', () => {
    it('should create bucket with object parameters', async () => {
      const options = { bucketName: 'test-bucket', bucketType: 'allPrivate' };
      const mockResponse = { data: { bucketId: 'bucket123' } };
      
      mockBucketManager.create.mockResolvedValue(mockResponse);

      const result = await client.createBucket(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockBucketManager.create).toHaveBeenCalledWith(options, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should create bucket with string parameters (backward compatibility)', async () => {
      const mockResponse = { data: { bucketId: 'bucket123' } };
      mockBucketManager.create.mockResolvedValue(mockResponse);

      const result = await client.createBucket('test-bucket', 'allPrivate');

      expect(mockBucketManager.create).toHaveBeenCalledWith('test-bucket', 'allPrivate');
      expect(result).toBe(mockResponse);
    });

    it('should delete bucket', async () => {
      const options = { bucketId: 'bucket123' };
      const mockResponse = { data: { bucketId: 'bucket123' } };
      
      mockBucketManager.delete.mockResolvedValue(mockResponse);

      const result = await client.deleteBucket(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockBucketManager.delete).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should list buckets', async () => {
      const mockResponse = { data: { buckets: [] } };
      mockBucketManager.list.mockResolvedValue(mockResponse);

      const result = await client.listBuckets();

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockBucketManager.list).toHaveBeenCalledWith({});
      expect(result).toBe(mockResponse);
    });

    it('should get bucket', async () => {
      const options = { bucketName: 'test-bucket' };
      const mockResponse = { data: { bucketId: 'bucket123' } };
      
      mockBucketManager.get.mockResolvedValue(mockResponse);

      const result = await client.getBucket(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockBucketManager.get).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should update bucket', async () => {
      const options = { bucketId: 'bucket123', bucketType: 'allPublic' };
      const mockResponse = { data: { bucketId: 'bucket123' } };
      
      mockBucketManager.update.mockResolvedValue(mockResponse);

      const result = await client.updateBucket(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockBucketManager.update).toHaveBeenCalledWith(options, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should get upload URL', async () => {
      const options = { bucketId: 'bucket123' };
      const mockResponse = { data: { uploadUrl: 'https://upload.url' } };
      
      mockBucketManager.getUploadUrl.mockResolvedValue(mockResponse);

      const result = await client.getUploadUrl(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockBucketManager.getUploadUrl).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });
  });

  describe('file methods', () => {
    it('should upload file', async () => {
      const options = {
        uploadUrl: 'https://upload.url',
        uploadAuthToken: 'token',
        fileName: 'test.txt',
        data: 'file content'
      };
      const mockResponse = { data: { fileId: 'file123' } };
      
      mockFileManager.uploadFile.mockResolvedValue(mockResponse);

      const result = await client.uploadFile(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.uploadFile).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should download file by name with object parameters', async () => {
      const options = { bucketName: 'test-bucket', fileName: 'test.txt' };
      const mockResponse = { data: new ArrayBuffer(10) };
      
      mockFileManager.downloadFileByName.mockResolvedValue(mockResponse);

      const result = await client.downloadFileByName(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.downloadFileByName).toHaveBeenCalledWith(options, undefined);
      expect(result).toBe(mockResponse);
    });

    it('should download file by name with string parameters (backward compatibility)', async () => {
      const mockResponse = { data: new ArrayBuffer(10) };
      mockFileManager.downloadFileByName.mockResolvedValue(mockResponse);

      const result = await client.downloadFileByName('test-bucket', 'test.txt');

      expect(mockFileManager.downloadFileByName).toHaveBeenCalledWith('test-bucket', 'test.txt');
      expect(result).toBe(mockResponse);
    });

    it('should download file by ID', async () => {
      const options = { fileId: 'file123' };
      const mockResponse = { data: new ArrayBuffer(10) };
      
      mockFileManager.downloadFileById.mockResolvedValue(mockResponse);

      const result = await client.downloadFileById(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.downloadFileById).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should list file names', async () => {
      const options = { bucketId: 'bucket123' };
      const mockResponse = { data: { files: [] } };
      
      mockFileManager.listFileNames.mockResolvedValue(mockResponse);

      const result = await client.listFileNames(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.listFileNames).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should list file versions', async () => {
      const options = { bucketId: 'bucket123' };
      const mockResponse = { data: { files: [] } };
      
      mockFileManager.listFileVersions.mockResolvedValue(mockResponse);

      const result = await client.listFileVersions(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.listFileVersions).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should get file info', async () => {
      const options = { fileId: 'file123' };
      const mockResponse = { data: { fileName: 'test.txt' } };
      
      mockFileManager.getFileInfo.mockResolvedValue(mockResponse);

      const result = await client.getFileInfo(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.getFileInfo).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should delete file version', async () => {
      const options = { fileId: 'file123', fileName: 'test.txt' };
      const mockResponse = { data: { fileId: 'file123' } };
      
      mockFileManager.deleteFileVersion.mockResolvedValue(mockResponse);

      const result = await client.deleteFileVersion(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.deleteFileVersion).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should hide file', async () => {
      const options = { bucketId: 'bucket123', fileName: 'test.txt' };
      const mockResponse = { data: { fileId: 'file123' } };
      
      mockFileManager.hideFile.mockResolvedValue(mockResponse);

      const result = await client.hideFile(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.hideFile).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should get download authorization', async () => {
      const options = { bucketId: 'bucket123', fileNamePrefix: 'test' };
      const mockResponse = { data: { authorizationToken: 'token' } };
      
      mockFileManager.getDownloadAuthorization.mockResolvedValue(mockResponse);

      const result = await client.getDownloadAuthorization(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.getDownloadAuthorization).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });
  });

  describe('large file methods', () => {
    it('should start large file', async () => {
      const options = { bucketId: 'bucket123', fileName: 'large-file.zip' };
      const mockResponse = { data: { fileId: 'file123' } };
      
      mockFileManager.startLargeFile.mockResolvedValue(mockResponse);

      const result = await client.startLargeFile(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.startLargeFile).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should get upload part URL', async () => {
      const options = { fileId: 'file123' };
      const mockResponse = { data: { uploadUrl: 'https://upload.url' } };
      
      mockFileManager.getUploadPartUrl.mockResolvedValue(mockResponse);

      const result = await client.getUploadPartUrl(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.getUploadPartUrl).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should upload part', async () => {
      const options = {
        uploadUrl: 'https://upload.url',
        authorizationToken: 'token',
        partNumber: 1,
        data: 'part data'
      };
      const mockResponse = { data: { partNumber: 1 } };
      
      mockFileManager.uploadPart.mockResolvedValue(mockResponse);

      const result = await client.uploadPart(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.uploadPart).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should finish large file', async () => {
      const options = { fileId: 'file123', partSha1Array: ['sha1', 'sha2'] };
      const mockResponse = { data: { fileId: 'file123' } };
      
      mockFileManager.finishLargeFile.mockResolvedValue(mockResponse);

      const result = await client.finishLargeFile(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.finishLargeFile).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should cancel large file', async () => {
      const options = { fileId: 'file123' };
      const mockResponse = { data: { fileId: 'file123' } };
      
      mockFileManager.cancelLargeFile.mockResolvedValue(mockResponse);

      const result = await client.cancelLargeFile(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.cancelLargeFile).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should list parts', async () => {
      const options = { fileId: 'file123' };
      const mockResponse = { data: { parts: [] } };
      
      mockFileManager.listParts.mockResolvedValue(mockResponse);

      const result = await client.listParts(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockFileManager.listParts).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });
  });

  describe('key management methods', () => {
    it('should create key', async () => {
      const options = {
        keyName: 'test-key',
        capabilities: ['listFiles', 'readFiles']
      };
      const mockResponse = { data: { applicationKeyId: 'key123' } };
      
      mockKeyManager.createKey.mockResolvedValue(mockResponse);

      const result = await client.createKey(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockKeyManager.createKey).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should delete key', async () => {
      const options = { applicationKeyId: 'key123' };
      const mockResponse = { data: { applicationKeyId: 'key123' } };
      
      mockKeyManager.deleteKey.mockResolvedValue(mockResponse);

      const result = await client.deleteKey(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockKeyManager.deleteKey).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });

    it('should list keys', async () => {
      const options = { maxKeyCount: 50 };
      const mockResponse = { data: { keys: [] } };
      
      mockKeyManager.listKeys.mockResolvedValue(mockResponse);

      const result = await client.listKeys(options);

      expect(mockRetryHandler.executeWithRetry).toHaveBeenCalled();
      expect(mockKeyManager.listKeys).toHaveBeenCalledWith(options);
      expect(result).toBe(mockResponse);
    });
  });

  describe('constants export', () => {
    it('should export BUCKET_TYPES', () => {
      expect(BUCKET_TYPES).toBeDefined();
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
    });

    it('should export KEY_CAPABILITIES', () => {
      expect(KEY_CAPABILITIES).toBeDefined();
      expect(KEY_CAPABILITIES.LIST_FILES).toBe('listFiles');
      expect(KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
    });
  });
});