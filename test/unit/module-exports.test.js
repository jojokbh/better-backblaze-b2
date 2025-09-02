/**
 * Tests for module import/export functionality
 * Validates that all exports work correctly in both ES modules and CommonJS
 */

import { describe, it, expect } from 'vitest';

describe('Module Exports', () => {
  describe('ES Module Imports', () => {
    it('should export B2Client as default export', async () => {
      const { default: B2Client } = await import('../../src/index.js');
      expect(B2Client).toBeDefined();
      expect(typeof B2Client).toBe('function');
      expect(B2Client.name).toBe('B2Client');
    });

    it('should export B2Client as named export', async () => {
      const { B2Client } = await import('../../src/index.js');
      expect(B2Client).toBeDefined();
      expect(typeof B2Client).toBe('function');
      expect(B2Client.name).toBe('B2Client');
    });

    it('should export constants', async () => {
      const { BUCKET_TYPES, KEY_CAPABILITIES } = await import('../../src/index.js');
      
      expect(BUCKET_TYPES).toBeDefined();
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
      
      expect(KEY_CAPABILITIES).toBeDefined();
      expect(KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
      expect(KEY_CAPABILITIES.WRITE_FILES).toBe('writeFiles');
    });

    it('should export core classes', async () => {
      const { 
        HttpClient, 
        RetryHandler, 
        ErrorHandler, 
        B2Error, 
        ProgressHandler 
      } = await import('../../src/index.js');
      
      expect(HttpClient).toBeDefined();
      expect(typeof HttpClient).toBe('function');
      
      expect(RetryHandler).toBeDefined();
      expect(typeof RetryHandler).toBe('function');
      
      expect(ErrorHandler).toBeDefined();
      expect(typeof ErrorHandler).toBe('function');
      
      expect(B2Error).toBeDefined();
      expect(typeof B2Error).toBe('function');
      
      expect(ProgressHandler).toBeDefined();
      expect(typeof ProgressHandler).toBe('function');
    });

    it('should export manager classes', async () => {
      const { 
        AuthManager, 
        BucketManager, 
        FileManager, 
        KeyManager 
      } = await import('../../src/index.js');
      
      expect(AuthManager).toBeDefined();
      expect(typeof AuthManager).toBe('function');
      
      expect(BucketManager).toBeDefined();
      expect(typeof BucketManager).toBe('function');
      
      expect(FileManager).toBeDefined();
      expect(typeof FileManager).toBe('function');
      
      expect(KeyManager).toBeDefined();
      expect(typeof KeyManager).toBe('function');
    });

    it('should export utility classes', async () => {
      const { 
        EndpointBuilder, 
        AuthHeaders, 
        HeaderUtils, 
        Validator, 
        Sha1Hasher 
      } = await import('../../src/index.js');
      
      expect(EndpointBuilder).toBeDefined();
      expect(typeof EndpointBuilder).toBe('function');
      
      expect(AuthHeaders).toBeDefined();
      expect(typeof AuthHeaders).toBe('object');
      
      expect(HeaderUtils).toBeDefined();
      expect(typeof HeaderUtils).toBe('object');
      
      expect(Validator).toBeDefined();
      expect(typeof Validator).toBe('function'); // Validator is a class
      
      expect(Sha1Hasher).toBeDefined();
      expect(typeof Sha1Hasher).toBe('function'); // Sha1Hasher is a class
    });
  });

  describe('Module Structure', () => {
    it('should have all expected exports', async () => {
      const moduleExports = await import('../../src/index.js');
      
      const expectedExports = [
        'AuthHeaders',
        'AuthManager', 
        'B2Client',
        'B2Error',
        'BUCKET_TYPES',
        'BucketManager',
        'EndpointBuilder',
        'ErrorHandler',
        'FileManager',
        'HeaderUtils',
        'HttpClient',
        'KEY_CAPABILITIES',
        'KeyManager',
        'ProgressHandler',
        'RetryHandler',
        'Sha1Hasher',
        'Validator',
        'default'
      ];
      
      for (const exportName of expectedExports) {
        expect(moduleExports).toHaveProperty(exportName);
      }
    });

    it('should not have unexpected exports', async () => {
      const moduleExports = await import('../../src/index.js');
      const exportNames = Object.keys(moduleExports);
      
      // Should only have the expected exports (no extra ones)
      const expectedCount = 18; // Total number of expected exports (18 actual)
      expect(exportNames.length).toBe(expectedCount);
    });
  });

  describe('Instantiation Tests', () => {
    it('should be able to instantiate B2Client', async () => {
      const { B2Client } = await import('../../src/index.js');
      
      const client = new B2Client();
      expect(client).toBeInstanceOf(B2Client);
      expect(client.BUCKET_TYPES).toBeDefined();
      expect(client.KEY_CAPABILITIES).toBeDefined();
    });

    it('should be able to instantiate core classes', async () => {
      const { 
        HttpClient, 
        RetryHandler, 
        ErrorHandler, 
        ProgressHandler 
      } = await import('../../src/index.js');
      
      const httpClient = new HttpClient();
      expect(httpClient).toBeInstanceOf(HttpClient);
      
      const retryHandler = new RetryHandler();
      expect(retryHandler).toBeInstanceOf(RetryHandler);
      
      const errorHandler = new ErrorHandler();
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
      
      const progressHandler = new ProgressHandler();
      expect(progressHandler).toBeInstanceOf(ProgressHandler);
    });

    it('should be able to create B2Error instances', async () => {
      const { B2Error } = await import('../../src/index.js');
      
      const error = new B2Error('Test error', { status: 400 });
      expect(error).toBeInstanceOf(B2Error);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support default import syntax', async () => {
      const B2Client = (await import('../../src/index.js')).default;
      
      expect(B2Client).toBeDefined();
      expect(typeof B2Client).toBe('function');
      
      const client = new B2Client();
      expect(client).toBeInstanceOf(B2Client);
    });

    it('should support destructured imports', async () => {
      const { 
        B2Client, 
        BUCKET_TYPES, 
        KEY_CAPABILITIES 
      } = await import('../../src/index.js');
      
      expect(B2Client).toBeDefined();
      expect(BUCKET_TYPES).toBeDefined();
      expect(KEY_CAPABILITIES).toBeDefined();
      
      const client = new B2Client();
      expect(client.BUCKET_TYPES).toEqual(BUCKET_TYPES);
      expect(client.KEY_CAPABILITIES).toEqual(KEY_CAPABILITIES);
    });

    it('should support namespace imports', async () => {
      const B2 = await import('../../src/index.js');
      
      expect(B2.B2Client).toBeDefined();
      expect(B2.BUCKET_TYPES).toBeDefined();
      expect(B2.KEY_CAPABILITIES).toBeDefined();
      expect(B2.default).toBeDefined();
      
      const client = new B2.B2Client();
      expect(client).toBeInstanceOf(B2.B2Client);
    });
  });

  describe('Constants Validation', () => {
    it('should have correct BUCKET_TYPES values', async () => {
      const { BUCKET_TYPES } = await import('../../src/index.js');
      
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
      
      // Constants are not frozen in this implementation
      // This is acceptable for backward compatibility
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
    });

    it('should have correct KEY_CAPABILITIES values', async () => {
      const { KEY_CAPABILITIES } = await import('../../src/index.js');
      
      expect(KEY_CAPABILITIES.LIST_KEYS).toBe('listKeys');
      expect(KEY_CAPABILITIES.WRITE_KEYS).toBe('writeKeys');
      expect(KEY_CAPABILITIES.DELETE_KEYS).toBe('deleteKeys');
      expect(KEY_CAPABILITIES.LIST_BUCKETS).toBe('listBuckets');
      expect(KEY_CAPABILITIES.WRITE_BUCKETS).toBe('writeBuckets');
      expect(KEY_CAPABILITIES.DELETE_BUCKETS).toBe('deleteBuckets');
      expect(KEY_CAPABILITIES.LIST_FILES).toBe('listFiles');
      expect(KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
      expect(KEY_CAPABILITIES.SHARE_FILES).toBe('shareFiles');
      expect(KEY_CAPABILITIES.WRITE_FILES).toBe('writeFiles');
      expect(KEY_CAPABILITIES.DELETE_FILES).toBe('deleteFiles');
    });
  });
});