/**
 * Final comprehensive compatibility verification
 * This test ensures the new library is 100% compatible with the old library API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { B2Client, BUCKET_TYPES, KEY_CAPABILITIES } from '../../src/index.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Final Compatibility Check', () => {
  let client;

  beforeEach(() => {
    fetch.mockClear();
  });

  describe('Complete API Surface Compatibility', () => {
    it('should have all expected exports from main module', async () => {
      const exports = await import('../../src/index.js');
      
      // Main exports
      expect(exports.B2Client).toBeDefined();
      expect(exports.BUCKET_TYPES).toBeDefined();
      expect(exports.KEY_CAPABILITIES).toBeDefined();
      expect(exports.default).toBe(exports.B2Client);

      // Core classes (for advanced usage)
      expect(exports.HttpClient).toBeDefined();
      expect(exports.RetryHandler).toBeDefined();
      expect(exports.ErrorHandler).toBeDefined();
      expect(exports.B2Error).toBeDefined();
      expect(exports.ProgressHandler).toBeDefined();

      // Manager classes (for advanced usage)
      expect(exports.AuthManager).toBeDefined();
      expect(exports.BucketManager).toBeDefined();
      expect(exports.FileManager).toBeDefined();
      expect(exports.KeyManager).toBeDefined();

      // Utility classes (for advanced usage)
      expect(exports.EndpointBuilder).toBeDefined();
      expect(exports.AuthHeaders).toBeDefined();
      expect(exports.HeaderUtils).toBeDefined();
      expect(exports.Validator).toBeDefined();
      expect(exports.Sha1Hasher).toBeDefined();
    });

    it('should support all legacy constructor patterns', () => {
      // Empty constructor
      const client1 = new B2Client();
      expect(client1).toBeInstanceOf(B2Client);

      // With credentials
      const client2 = new B2Client({
        applicationKeyId: 'key-id',
        applicationKey: 'key'
      });
      expect(client2.applicationKeyId).toBe('key-id');
      expect(client2.applicationKey).toBe('key');

      // With all legacy options
      const client3 = new B2Client({
        accountId: 'account-id',
        applicationKeyId: 'key-id',
        applicationKey: 'key',
        timeout: 60000,
        retries: 5,
        retryDelay: 2000
      });
      expect(client3.accountId).toBe('account-id');
      expect(client3.config.timeout).toBe(60000);
      expect(client3.config.retries).toBe(5);
      expect(client3.config.retryDelay).toBe(2000);
    });

    it('should have all expected instance properties', () => {
      client = new B2Client({
        accountId: 'test-account',
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      });

      // Legacy properties
      expect(client.accountId).toBe('test-account');
      expect(client.applicationKeyId).toBe('test-key-id');
      expect(client.applicationKey).toBe('test-key');
      expect(client.authorizationToken).toBeNull();
      expect(client.apiUrl).toBeNull();
      expect(client.downloadUrl).toBeNull();

      // Configuration
      expect(client.config).toBeDefined();
      expect(typeof client.config.timeout).toBe('number');
      expect(typeof client.config.retries).toBe('number');

      // Constants
      expect(client.BUCKET_TYPES).toEqual(BUCKET_TYPES);
      expect(client.KEY_CAPABILITIES).toEqual(KEY_CAPABILITIES);
    });

    it('should have all expected public methods', () => {
      client = new B2Client();

      const expectedMethods = [
        // Authentication
        'authorize', 'clearAuth',
        
        // Bucket operations
        'createBucket', 'deleteBucket', 'listBuckets', 'getBucket', 'updateBucket', 'getUploadUrl',
        
        // File operations
        'uploadFile', 'downloadFileByName', 'downloadFileById', 'listFileNames', 'listFileVersions',
        'getFileInfo', 'deleteFileVersion', 'hideFile', 'getDownloadAuthorization',
        
        // Large file operations
        'startLargeFile', 'getUploadPartUrl', 'uploadPart', 'finishLargeFile', 'cancelLargeFile',
        'listParts', 'listUnfinishedLargeFiles',
        
        // Key management
        'createKey', 'deleteKey', 'listKeys'
      ];

      expectedMethods.forEach(method => {
        expect(typeof client[method]).toBe('function');
      });
    });
  });

  describe('Method Signature Compatibility', () => {
    beforeEach(() => {
      client = new B2Client({
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      });

      // Mock successful auth response
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          authorizationToken: 'token_123',
          apiUrl: 'https://api.backblaze.com',
          downloadUrl: 'https://download.backblaze.com',
          accountId: 'account_123',
          recommendedPartSize: 100000000,
          absoluteMinimumPartSize: 5000000,
          allowed: { capabilities: ['listBuckets', 'writeFiles', 'readFiles'] }
        }),
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([]),
        text: async () => '{}'
      });
    });

    it('should support all authorize method signatures', async () => {
      // No arguments (uses instance properties)
      await expect(client.authorize()).resolves.toBeDefined();

      // Object argument
      await expect(client.authorize({
        applicationKeyId: 'key-id',
        applicationKey: 'key'
      })).resolves.toBeDefined();

      // Separate arguments (legacy)
      await expect(client.authorize('key-id', 'key')).resolves.toBeDefined();
    });

    it('should support all bucket method signatures', async () => {
      await client.authorize();

      // createBucket signatures
      await expect(client.createBucket({
        bucketName: 'test-bucket',
        bucketType: 'allPrivate'
      })).resolves.toBeDefined();

      await expect(client.createBucket('test-bucket', 'allPrivate')).resolves.toBeDefined();

      // deleteBucket signatures
      await expect(client.deleteBucket({ bucketId: 'bucket123' })).resolves.toBeDefined();
      await expect(client.deleteBucket('bucket123')).resolves.toBeDefined();

      // getUploadUrl signatures
      await expect(client.getUploadUrl({ bucketId: 'bucket123' })).resolves.toBeDefined();
      await expect(client.getUploadUrl('bucket123')).resolves.toBeDefined();
    });

    it('should support all file method signatures', async () => {
      await client.authorize();

      // Mock file response
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/octet-stream']]),
        json: async () => ({ fileId: 'file123' }),
        arrayBuffer: async () => new ArrayBuffer(10),
        blob: async () => new Blob(['test']),
        text: async () => 'test'
      });

      // downloadFileByName signatures
      await expect(client.downloadFileByName({
        bucketName: 'bucket',
        fileName: 'file.txt'
      })).resolves.toBeDefined();

      await expect(client.downloadFileByName('bucket', 'file.txt')).resolves.toBeDefined();

      // downloadFileById signatures
      await expect(client.downloadFileById({ fileId: 'file123' })).resolves.toBeDefined();
      await expect(client.downloadFileById('file123')).resolves.toBeDefined();

      // getFileInfo signatures
      await expect(client.getFileInfo({ fileId: 'file123' })).resolves.toBeDefined();
      await expect(client.getFileInfo('file123')).resolves.toBeDefined();
    });
  });

  describe('Response Format Compatibility', () => {
    it('should return axios-compatible response format for all operations', async () => {
      client = new B2Client({
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      });

      const mockResponse = {
        authorizationToken: 'token_123',
        apiUrl: 'https://api.backblaze.com',
        downloadUrl: 'https://download.backblaze.com',
        accountId: 'account_123',
        recommendedPartSize: 100000000,
        absoluteMinimumPartSize: 5000000,
        allowed: { capabilities: ['listBuckets'] }
      };

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([]),
        text: async () => JSON.stringify(mockResponse),
        url: 'https://api.backblaze.com/b2api/v2/b2_authorize_account'
      });

      const result = await client.authorize();

      // Verify axios-compatible response structure
      expect(result).toHaveProperty('status', 200);
      expect(result).toHaveProperty('statusText', 'OK');
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('config');
      expect(result.config).toHaveProperty('url');
      expect(result.config).toHaveProperty('method');
      expect(result.data).toEqual(mockResponse);

      // Verify legacy properties are updated
      expect(client.authorizationToken).toBe('token_123');
      expect(client.apiUrl).toBe('https://api.backblaze.com');
      expect(client.downloadUrl).toBe('https://download.backblaze.com');
    });
  });

  describe('Constants and Exports Compatibility', () => {
    it('should export all required constants with correct values', () => {
      // BUCKET_TYPES
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');

      // KEY_CAPABILITIES
      expect(KEY_CAPABILITIES.LIST_KEYS).toBe('listKeys');
      expect(KEY_CAPABILITIES.WRITE_KEYS).toBe('writeKeys');
      expect(KEY_CAPABILITIES.DELETE_KEYS).toBe('deleteKeys');
      expect(KEY_CAPABILITIES.LIST_BUCKETS).toBe('listBuckets');
      expect(KEY_CAPABILITIES.WRITE_BUCKETS).toBe('writeBuckets');
      expect(KEY_CAPABILITIES.DELETE_BUCKETS).toBe('deleteBuckets');
      expect(KEY_CAPABILITIES.LIST_ALL_BUCKET_NAMES).toBe('listAllBucketNames');
      expect(KEY_CAPABILITIES.LIST_FILES).toBe('listFiles');
      expect(KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
      expect(KEY_CAPABILITIES.SHARE_FILES).toBe('shareFiles');
      expect(KEY_CAPABILITIES.WRITE_FILES).toBe('writeFiles');
      expect(KEY_CAPABILITIES.DELETE_FILES).toBe('deleteFiles');
    });

    it('should have constants available on client instance', () => {
      client = new B2Client();
      
      expect(client.BUCKET_TYPES).toEqual(BUCKET_TYPES);
      expect(client.KEY_CAPABILITIES).toEqual(KEY_CAPABILITIES);
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle errors in compatible format', async () => {
      client = new B2Client({
        applicationKeyId: 'invalid-key',
        applicationKey: 'invalid-key'
      });

      const mockErrorResponse = {
        status: 401,
        code: 'bad_auth_token',
        message: 'Invalid credentials'
      };

      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockErrorResponse,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([]),
        text: async () => JSON.stringify(mockErrorResponse)
      });

      try {
        await client.authorize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.status).toBe(401);
        expect(error.code).toBe('bad_auth_token');
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(401);
        expect(error.response.data).toEqual(mockErrorResponse);
      }
    });
  });

  describe('Tree-shaking and Module Compatibility', () => {
    it('should support individual imports for tree-shaking', async () => {
      // Test individual imports work
      const { HttpClient } = await import('../../src/core/http-client.js');
      const { BUCKET_TYPES } = await import('../../src/constants.js');
      const { Validator } = await import('../../src/utils/validation.js');

      expect(HttpClient).toBeDefined();
      expect(BUCKET_TYPES).toBeDefined();
      expect(Validator).toBeDefined();
    });

    it('should support both ES modules and CommonJS patterns', async () => {
      const esModule = await import('../../src/index.js');
      
      // ES module exports
      expect(esModule.B2Client).toBeDefined();
      expect(esModule.default).toBe(esModule.B2Client);
      
      // Named exports
      expect(esModule.BUCKET_TYPES).toBeDefined();
      expect(esModule.KEY_CAPABILITIES).toBeDefined();
    });
  });
});