/**
 * Integration tests for B2Client
 * Tests the complete integration of all components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B2Client, BUCKET_TYPES, KEY_CAPABILITIES } from '../../src/index.js';

describe('B2Client Integration', () => {
  let client;

  beforeEach(() => {
    // Mock fetch globally for integration tests
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('module exports', () => {
    it('should export B2Client class', () => {
      expect(B2Client).toBeDefined();
      expect(typeof B2Client).toBe('function');
    });

    it('should export BUCKET_TYPES constant', () => {
      expect(BUCKET_TYPES).toBeDefined();
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
    });

    it('should export KEY_CAPABILITIES constant', () => {
      expect(KEY_CAPABILITIES).toBeDefined();
      expect(KEY_CAPABILITIES.LIST_FILES).toBe('listFiles');
      expect(KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
    });
  });

  describe('client instantiation', () => {
    it('should create B2Client instance with default config', () => {
      client = new B2Client();
      
      expect(client).toBeInstanceOf(B2Client);
      expect(client.BUCKET_TYPES).toBeDefined();
      expect(client.KEY_CAPABILITIES).toBeDefined();
    });

    it('should create B2Client instance with custom config', () => {
      const config = {
        timeout: 60000,
        retries: 5,
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      };

      client = new B2Client(config);
      
      expect(client).toBeInstanceOf(B2Client);
      expect(client.applicationKeyId).toBe('test-key-id');
      expect(client.applicationKey).toBe('test-key');
    });
  });

  describe('method availability', () => {
    beforeEach(() => {
      client = new B2Client();
    });

    it('should have all authentication methods', () => {
      expect(typeof client.authorize).toBe('function');
      expect(typeof client.isAuthenticated).toBe('function');
      expect(typeof client.getAuthContext).toBe('function');
      expect(typeof client.clearAuth).toBe('function');
      expect(typeof client.refreshAuth).toBe('function');
    });

    it('should have all bucket methods', () => {
      expect(typeof client.createBucket).toBe('function');
      expect(typeof client.deleteBucket).toBe('function');
      expect(typeof client.listBuckets).toBe('function');
      expect(typeof client.getBucket).toBe('function');
      expect(typeof client.updateBucket).toBe('function');
      expect(typeof client.getUploadUrl).toBe('function');
    });

    it('should have all file methods', () => {
      expect(typeof client.uploadFile).toBe('function');
      expect(typeof client.downloadFileByName).toBe('function');
      expect(typeof client.downloadFileById).toBe('function');
      expect(typeof client.listFileNames).toBe('function');
      expect(typeof client.listFileVersions).toBe('function');
      expect(typeof client.getFileInfo).toBe('function');
      expect(typeof client.deleteFileVersion).toBe('function');
      expect(typeof client.hideFile).toBe('function');
      expect(typeof client.getDownloadAuthorization).toBe('function');
    });

    it('should have all large file methods', () => {
      expect(typeof client.startLargeFile).toBe('function');
      expect(typeof client.getUploadPartUrl).toBe('function');
      expect(typeof client.uploadPart).toBe('function');
      expect(typeof client.finishLargeFile).toBe('function');
      expect(typeof client.cancelLargeFile).toBe('function');
      expect(typeof client.listParts).toBe('function');
      expect(typeof client.listUnfinishedLargeFiles).toBe('function');
    });

    it('should have all key management methods', () => {
      expect(typeof client.createKey).toBe('function');
      expect(typeof client.deleteKey).toBe('function');
      expect(typeof client.listKeys).toBe('function');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      client = new B2Client();
    });

    it('should throw error when calling methods without authentication', async () => {
      // Mock fetch to simulate unauthenticated state
      global.fetch.mockRejectedValue(new Error('Not authenticated'));

      await expect(client.listBuckets()).rejects.toThrow();
    });
  });

  describe('backward compatibility', () => {
    beforeEach(() => {
      client = new B2Client({
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      });
    });

    it('should support legacy constructor properties', () => {
      expect(client.applicationKeyId).toBe('test-key-id');
      expect(client.applicationKey).toBe('test-key');
      expect(client.authorizationToken).toBeNull();
      expect(client.apiUrl).toBeNull();
      expect(client.downloadUrl).toBeNull();
    });

    it('should have constants as instance properties', () => {
      expect(client.BUCKET_TYPES).toEqual(BUCKET_TYPES);
      expect(client.KEY_CAPABILITIES).toEqual(KEY_CAPABILITIES);
    });
  });
});