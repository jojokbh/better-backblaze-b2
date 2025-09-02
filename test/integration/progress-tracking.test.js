/**
 * Integration tests for progress tracking functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../src/core/http-client.js';
import { FileManager } from '../../src/managers/file-manager.js';
import { AuthManager } from '../../src/managers/auth-manager.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Progress Tracking Integration', () => {
  let httpClient;
  let authManager;
  let fileManager;
  let mockProgressCallback;

  beforeEach(() => {
    vi.clearAllMocks();
    
    httpClient = new HttpClient();
    authManager = new AuthManager(httpClient, {});
    fileManager = new FileManager(httpClient, authManager, {});
    mockProgressCallback = vi.fn();

    // Mock authentication
    authManager.authContext = {
      authorizationToken: 'test_token',
      apiUrl: 'https://api.backblaze.com',
      downloadUrl: 'https://download.backblaze.com',
      accountId: 'test_account',
      isAuthenticated: true
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Upload Progress Tracking', () => {
    it('should track upload progress for file uploads', async () => {
      // Mock successful upload response
      const mockResponse = new Response(
        JSON.stringify({
          fileId: 'test_file_id',
          fileName: 'test.txt',
          contentType: 'text/plain'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );

      global.fetch.mockResolvedValue(mockResponse);

      const uploadOptions = {
        uploadUrl: 'https://upload.backblaze.com/b2api/v2/b2_upload_file/bucket_id',
        uploadAuthToken: 'upload_token',
        fileName: 'test.txt',
        data: 'Hello, World!',
        contentType: 'text/plain',
        onUploadProgress: mockProgressCallback
      };

      await fileManager.uploadFile(uploadOptions);

      // Verify that progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
      
      // Verify progress event structure
      const progressCalls = mockProgressCallback.mock.calls;
      expect(progressCalls.length).toBeGreaterThan(0);
      
      const lastProgressEvent = progressCalls[progressCalls.length - 1][0];
      expect(lastProgressEvent).toHaveProperty('loaded');
      expect(lastProgressEvent).toHaveProperty('total');
      expect(lastProgressEvent).toHaveProperty('progress');
      expect(lastProgressEvent).toHaveProperty('percentage');
      expect(lastProgressEvent).toHaveProperty('lengthComputable');
    });

    it('should handle upload progress for binary data', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          fileId: 'test_file_id',
          fileName: 'binary.dat'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );

      global.fetch.mockResolvedValue(mockResponse);

      const binaryData = new Uint8Array(1024); // 1KB of data
      for (let i = 0; i < binaryData.length; i++) {
        binaryData[i] = i % 256;
      }

      const uploadOptions = {
        uploadUrl: 'https://upload.backblaze.com/b2api/v2/b2_upload_file/bucket_id',
        uploadAuthToken: 'upload_token',
        fileName: 'binary.dat',
        data: binaryData,
        contentType: 'application/octet-stream',
        onUploadProgress: mockProgressCallback
      };

      await fileManager.uploadFile(uploadOptions);

      expect(mockProgressCallback).toHaveBeenCalled();
      
      // Check that the final progress shows completion
      const progressCalls = mockProgressCallback.mock.calls;
      const finalProgress = progressCalls[progressCalls.length - 1][0];
      expect(finalProgress.total).toBeGreaterThan(0);
      expect(finalProgress.loaded).toBeGreaterThan(0);
      expect(finalProgress.loaded).toBeLessThanOrEqual(finalProgress.total);
    });

    it('should not call progress callback when not provided', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          fileId: 'test_file_id',
          fileName: 'test.txt'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );

      global.fetch.mockResolvedValue(mockResponse);

      const uploadOptions = {
        uploadUrl: 'https://upload.backblaze.com/b2api/v2/b2_upload_file/bucket_id',
        uploadAuthToken: 'upload_token',
        fileName: 'test.txt',
        data: 'Hello, World!',
        contentType: 'text/plain'
        // No onUploadProgress callback
      };

      await fileManager.uploadFile(uploadOptions);

      // Should not throw any errors and complete successfully
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Download Progress Tracking', () => {
    it('should track download progress for file downloads by name', async () => {
      // Create a mock response with a readable stream
      const testData = 'This is test file content for download progress tracking';
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(testData);
      
      const mockStream = new ReadableStream({
        start(controller) {
          // Simulate chunked download
          const chunkSize = 10;
          let offset = 0;
          
          const pump = () => {
            if (offset >= encodedData.length) {
              controller.close();
              return;
            }
            
            const chunk = encodedData.slice(offset, offset + chunkSize);
            controller.enqueue(chunk);
            offset += chunk.length;
            
            // Use setTimeout to simulate async behavior
            setTimeout(pump, 1);
          };
          
          pump();
        }
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        headers: { 
          'content-type': 'text/plain',
          'content-length': encodedData.length.toString()
        }
      });

      global.fetch.mockResolvedValue(mockResponse);

      const downloadOptions = {
        bucketName: 'test-bucket',
        fileName: 'test.txt',
        responseType: 'text',
        onDownloadProgress: mockProgressCallback
      };

      const response = await fileManager.downloadFileByName(downloadOptions);

      expect(response.data).toBe(testData);
      expect(mockProgressCallback).toHaveBeenCalled();
      
      // Verify progress events
      const progressCalls = mockProgressCallback.mock.calls;
      expect(progressCalls.length).toBeGreaterThan(0);
      
      // Check that progress increases over time
      let lastLoaded = 0;
      for (const call of progressCalls) {
        const progressEvent = call[0];
        expect(progressEvent.loaded).toBeGreaterThanOrEqual(lastLoaded);
        expect(progressEvent.total).toBe(encodedData.length);
        expect(progressEvent.lengthComputable).toBe(true);
        lastLoaded = progressEvent.loaded;
      }
    });

    it('should track download progress for file downloads by ID', async () => {
      const testData = new ArrayBuffer(2048); // 2KB of binary data
      
      const mockStream = new ReadableStream({
        start(controller) {
          const view = new Uint8Array(testData);
          const chunkSize = 256; // 256 byte chunks
          let offset = 0;
          
          const pump = () => {
            if (offset >= view.length) {
              controller.close();
              return;
            }
            
            const chunk = view.slice(offset, offset + chunkSize);
            controller.enqueue(chunk);
            offset += chunk.length;
            
            setTimeout(pump, 1);
          };
          
          pump();
        }
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        headers: { 
          'content-type': 'application/octet-stream',
          'content-length': testData.byteLength.toString()
        }
      });

      global.fetch.mockResolvedValue(mockResponse);

      const downloadOptions = {
        fileId: 'test_file_id',
        responseType: 'arraybuffer',
        onDownloadProgress: mockProgressCallback
      };

      const response = await fileManager.downloadFileById(downloadOptions);

      expect(response.data).toBeInstanceOf(ArrayBuffer);
      expect(response.data.byteLength).toBe(2048);
      expect(mockProgressCallback).toHaveBeenCalled();
      
      // Verify final progress shows completion
      const progressCalls = mockProgressCallback.mock.calls;
      const finalProgress = progressCalls[progressCalls.length - 1][0];
      expect(finalProgress.total).toBe(2048);
      expect(finalProgress.loaded).toBe(2048);
      expect(finalProgress.progress).toBe(1);
      expect(finalProgress.percentage).toBe(100);
    });

    it('should handle downloads without content-length header', async () => {
      const testData = 'Test content without known length';
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(testData);
      
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encodedData);
          controller.close();
        }
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        headers: { 
          'content-type': 'text/plain'
          // No content-length header
        }
      });

      global.fetch.mockResolvedValue(mockResponse);

      const downloadOptions = {
        bucketName: 'test-bucket',
        fileName: 'test.txt',
        responseType: 'text',
        onDownloadProgress: mockProgressCallback
      };

      const response = await fileManager.downloadFileByName(downloadOptions);

      expect(response.data).toBe(testData);
      expect(mockProgressCallback).toHaveBeenCalled();
      
      // Progress should still be tracked, but lengthComputable should be false
      const progressCalls = mockProgressCallback.mock.calls;
      const progressEvent = progressCalls[0][0];
      expect(progressEvent.lengthComputable).toBe(false);
      expect(progressEvent.total).toBe(0);
      expect(progressEvent.loaded).toBeGreaterThan(0);
    });
  });

  describe('Progress Callback Validation', () => {
    it('should throw error for invalid upload progress callback', async () => {
      const uploadOptions = {
        uploadUrl: 'https://upload.backblaze.com/b2api/v2/b2_upload_file/bucket_id',
        uploadAuthToken: 'upload_token',
        fileName: 'test.txt',
        data: 'Hello, World!',
        onUploadProgress: 'not a function'
      };

      await expect(fileManager.uploadFile(uploadOptions)).rejects.toThrow('Progress callback must be a function');
    });

    it('should throw error for invalid download progress callback', async () => {
      const downloadOptions = {
        bucketName: 'test-bucket',
        fileName: 'test.txt',
        onDownloadProgress: 123
      };

      await expect(fileManager.downloadFileByName(downloadOptions)).rejects.toThrow('Progress callback must be a function');
    });
  });

  describe('Large File Progress Tracking', () => {
    it('should handle progress tracking for large uploads', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          fileId: 'large_file_id',
          fileName: 'large.dat'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );

      global.fetch.mockResolvedValue(mockResponse);

      // Create a large buffer (1MB)
      const largeData = new Uint8Array(1024 * 1024);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const uploadOptions = {
        uploadUrl: 'https://upload.backblaze.com/b2api/v2/b2_upload_file/bucket_id',
        uploadAuthToken: 'upload_token',
        fileName: 'large.dat',
        data: largeData,
        contentType: 'application/octet-stream',
        onUploadProgress: mockProgressCallback
      };

      await fileManager.uploadFile(uploadOptions);

      expect(mockProgressCallback).toHaveBeenCalled();
      
      // Verify that progress was tracked for the large file
      const progressCalls = mockProgressCallback.mock.calls;
      expect(progressCalls.length).toBeGreaterThan(0);
      
      const finalProgress = progressCalls[progressCalls.length - 1][0];
      expect(finalProgress.total).toBeGreaterThan(0);
      expect(finalProgress.loaded).toBeGreaterThan(0);
      expect(finalProgress.loaded).toBeLessThanOrEqual(finalProgress.total);
    });
  });
});