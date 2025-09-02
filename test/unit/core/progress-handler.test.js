/**
 * Unit tests for ProgressHandler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressHandler } from '../../../src/core/progress-handler.js';

describe('ProgressHandler', () => {
  let progressHandler;
  let mockProgressCallback;

  beforeEach(() => {
    progressHandler = new ProgressHandler();
    mockProgressCallback = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const handler = new ProgressHandler();
      expect(handler).toBeInstanceOf(ProgressHandler);
      expect(handler.options).toEqual({});
    });

    it('should create instance with custom options', () => {
      const options = { throttle: 50 };
      const handler = new ProgressHandler(options);
      expect(handler.options).toEqual(options);
    });
  });

  describe('createProgressEvent', () => {
    it('should create progress event with all properties', () => {
      const event = progressHandler.createProgressEvent(500, 1000);
      
      expect(event).toEqual({
        loaded: 500,
        total: 1000,
        lengthComputable: true,
        progress: 0.5,
        percentage: 50
      });
    });

    it('should handle zero total size', () => {
      const event = progressHandler.createProgressEvent(0, 0);
      
      expect(event).toEqual({
        loaded: 0,
        total: 0,
        lengthComputable: true,
        progress: 0,
        percentage: 0
      });
    });

    it('should handle unknown total size', () => {
      const event = progressHandler.createProgressEvent(500, 0, false);
      
      expect(event).toEqual({
        loaded: 500,
        total: 0,
        lengthComputable: false,
        progress: 0,
        percentage: 0
      });
    });

    it('should calculate 100% progress correctly', () => {
      const event = progressHandler.createProgressEvent(1000, 1000);
      
      expect(event.progress).toBe(1);
      expect(event.percentage).toBe(100);
    });
  });

  describe('createUploadProgressTracker', () => {
    it('should return null for non-function callback', () => {
      const tracker = progressHandler.createUploadProgressTracker(null, 1000);
      expect(tracker).toBeNull();
    });

    it('should create tracker that calls progress callback', () => {
      const tracker = progressHandler.createUploadProgressTracker(mockProgressCallback, 1000);
      expect(typeof tracker).toBe('function');

      // Simulate chunk upload
      const chunk = new Uint8Array(100);
      tracker(chunk);

      expect(mockProgressCallback).toHaveBeenCalledWith({
        loaded: 100,
        total: 1000,
        lengthComputable: true,
        progress: 0.1,
        percentage: 10
      });
    });

    it('should accumulate progress across multiple chunks', () => {
      const tracker = progressHandler.createUploadProgressTracker(mockProgressCallback, 1000);

      // First chunk
      tracker(new Uint8Array(300));
      expect(mockProgressCallback).toHaveBeenLastCalledWith({
        loaded: 300,
        total: 1000,
        lengthComputable: true,
        progress: 0.3,
        percentage: 30
      });

      // Second chunk
      tracker(new Uint8Array(200));
      expect(mockProgressCallback).toHaveBeenLastCalledWith({
        loaded: 500,
        total: 1000,
        lengthComputable: true,
        progress: 0.5,
        percentage: 50
      });
    });

    it('should handle chunks with byteLength property', () => {
      const tracker = progressHandler.createUploadProgressTracker(mockProgressCallback, 1000);
      const chunk = { byteLength: 150 };
      
      tracker(chunk);

      expect(mockProgressCallback).toHaveBeenCalledWith({
        loaded: 150,
        total: 1000,
        lengthComputable: true,
        progress: 0.15,
        percentage: 15
      });
    });

    it('should handle empty chunks gracefully', () => {
      const tracker = progressHandler.createUploadProgressTracker(mockProgressCallback, 1000);
      
      tracker(null);
      tracker(undefined);
      tracker({});

      expect(mockProgressCallback).toHaveBeenCalledTimes(3);
      expect(mockProgressCallback).toHaveBeenLastCalledWith({
        loaded: 0,
        total: 1000,
        lengthComputable: true,
        progress: 0,
        percentage: 0
      });
    });
  });

  describe('createDownloadProgressTracker', () => {
    it('should return null for non-function callback', () => {
      const tracker = progressHandler.createDownloadProgressTracker(null, 1000);
      expect(tracker).toBeNull();
    });

    it('should create tracker that calls progress callback', () => {
      const tracker = progressHandler.createDownloadProgressTracker(mockProgressCallback, 2000);
      
      const chunk = new Uint8Array(500);
      tracker(chunk);

      expect(mockProgressCallback).toHaveBeenCalledWith({
        loaded: 500,
        total: 2000,
        lengthComputable: true,
        progress: 0.25,
        percentage: 25
      });
    });

    it('should accumulate progress across multiple chunks', () => {
      const tracker = progressHandler.createDownloadProgressTracker(mockProgressCallback, 1000);

      tracker(new Uint8Array(400));
      tracker(new Uint8Array(300));

      expect(mockProgressCallback).toHaveBeenLastCalledWith({
        loaded: 700,
        total: 1000,
        lengthComputable: true,
        progress: 0.7,
        percentage: 70
      });
    });
  });

  describe('wrapUploadBody', () => {
    it('should return original body when no progress tracker', () => {
      const body = 'test data';
      const result = progressHandler.wrapUploadBody(body, null);
      expect(result).toBe(body);
    });

    it('should return original body when no body provided', () => {
      const result = progressHandler.wrapUploadBody(null, mockProgressCallback);
      expect(result).toBeNull();
    });

    it('should create ReadableStream for string body', () => {
      const body = 'test data';
      const tracker = vi.fn();
      
      const result = progressHandler.wrapUploadBody(body, tracker);
      expect(result).toBeInstanceOf(ReadableStream);
    });

    it('should create ReadableStream for Uint8Array body', () => {
      const body = new Uint8Array([1, 2, 3, 4, 5]);
      const tracker = vi.fn();
      
      const result = progressHandler.wrapUploadBody(body, tracker);
      expect(result).toBeInstanceOf(ReadableStream);
    });

    it('should create ReadableStream for ArrayBuffer body', () => {
      const body = new ArrayBuffer(10);
      const tracker = vi.fn();
      
      const result = progressHandler.wrapUploadBody(body, tracker);
      expect(result).toBeInstanceOf(ReadableStream);
    });

    it('should return FormData as-is', () => {
      const body = new FormData();
      const tracker = vi.fn();
      
      const result = progressHandler.wrapUploadBody(body, tracker);
      expect(result).toBe(body);
    });
  });

  describe('wrapDownloadResponse', () => {
    let mockResponse;
    let mockReader;

    beforeEach(() => {
      mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined })
      };
      
      mockResponse = {
        body: {
          getReader: vi.fn().mockReturnValue(mockReader)
        }
      };
    });

    it('should return original body when no progress tracker', () => {
      const result = progressHandler.wrapDownloadResponse(mockResponse, null);
      expect(result).toBe(mockResponse.body);
    });

    it('should return original body when no response body', () => {
      const responseWithoutBody = { body: null };
      const result = progressHandler.wrapDownloadResponse(responseWithoutBody, mockProgressCallback);
      expect(result).toBeNull();
    });

    it('should create ReadableStream with progress tracking', () => {
      const tracker = vi.fn();
      const result = progressHandler.wrapDownloadResponse(mockResponse, tracker);
      
      expect(result).toBeInstanceOf(ReadableStream);
      expect(mockResponse.body.getReader).toHaveBeenCalled();
    });
  });

  describe('processResponseWithProgress', () => {
    let mockResponse;

    beforeEach(() => {
      mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue('1000')
        },
        body: {
          getReader: vi.fn().mockReturnValue({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined })
          })
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1000)),
        text: vi.fn().mockResolvedValue('test response'),
        json: vi.fn().mockResolvedValue({ data: 'test' }),
        blob: vi.fn().mockResolvedValue(new Blob(['test']))
      };
    });

    it('should process response without progress when no callback', async () => {
      const result = await progressHandler.processResponseWithProgress(mockResponse, 'text', null);
      expect(result).toBe('test response');
      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should process arraybuffer response type', async () => {
      const result = await progressHandler.processResponseWithProgress(mockResponse, 'arraybuffer', null);
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(mockResponse.arrayBuffer).toHaveBeenCalled();
    });

    it('should process json response type', async () => {
      const result = await progressHandler.processResponseWithProgress(mockResponse, 'json', null);
      expect(result).toEqual({ data: 'test' });
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should process blob response type', async () => {
      const result = await progressHandler.processResponseWithProgress(mockResponse, 'blob', null);
      expect(result).toBeInstanceOf(Blob);
      expect(mockResponse.blob).toHaveBeenCalled();
    });

    it('should return stream for stream response type', async () => {
      const result = await progressHandler.processResponseWithProgress(mockResponse, 'stream', null);
      expect(result).toBe(mockResponse.body);
    });
  });

  describe('processResponseWithoutProgress', () => {
    let mockResponse;

    beforeEach(() => {
      mockResponse = {
        headers: {
          get: vi.fn()
        },
        body: new ReadableStream(),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1000)),
        text: vi.fn().mockResolvedValue('test response'),
        json: vi.fn().mockResolvedValue({ data: 'test' }),
        blob: vi.fn().mockResolvedValue(new Blob(['test']))
      };
    });

    it('should handle stream response type', async () => {
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'stream');
      expect(result).toBe(mockResponse.body);
    });

    it('should handle blob response type', async () => {
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'blob');
      expect(result).toBeInstanceOf(Blob);
      expect(mockResponse.blob).toHaveBeenCalled();
    });

    it('should handle arraybuffer response type', async () => {
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'arraybuffer');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(mockResponse.arrayBuffer).toHaveBeenCalled();
    });

    it('should handle text response type', async () => {
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'text');
      expect(result).toBe('test response');
      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should handle json response type', async () => {
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'json');
      expect(result).toEqual({ data: 'test' });
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should auto-detect json content type', async () => {
      mockResponse.headers.get.mockReturnValue('application/json');
      
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'auto');
      expect(result).toEqual({ data: 'test' });
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should auto-detect text content type', async () => {
      mockResponse.headers.get.mockReturnValue('text/plain');
      
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'auto');
      expect(result).toBe('test response');
      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should default to arraybuffer for unknown content type', async () => {
      mockResponse.headers.get.mockReturnValue('application/octet-stream');
      
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'auto');
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(mockResponse.arrayBuffer).toHaveBeenCalled();
    });

    it('should fallback to text when json parsing fails', async () => {
      mockResponse.headers.get.mockReturnValue('application/json');
      mockResponse.json.mockRejectedValue(new Error('Invalid JSON'));
      
      const result = await progressHandler.processResponseWithoutProgress(mockResponse, 'auto');
      expect(result).toBe('test response');
      expect(mockResponse.text).toHaveBeenCalled();
    });
  });

  describe('calculateBodySize', () => {
    it('should return 0 for null/undefined body', () => {
      expect(progressHandler.calculateBodySize(null)).toBe(0);
      expect(progressHandler.calculateBodySize(undefined)).toBe(0);
    });

    it('should calculate size for string body', () => {
      const size = progressHandler.calculateBodySize('hello world');
      expect(size).toBe(11); // 'hello world' is 11 bytes in UTF-8
    });

    it('should calculate size for ArrayBuffer', () => {
      const buffer = new ArrayBuffer(1024);
      expect(progressHandler.calculateBodySize(buffer)).toBe(1024);
    });

    it('should calculate size for Uint8Array', () => {
      const array = new Uint8Array(512);
      expect(progressHandler.calculateBodySize(array)).toBe(512);
    });

    it('should calculate size for Blob', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      expect(progressHandler.calculateBodySize(blob)).toBe(4);
    });

    it('should return 0 for FormData', () => {
      const formData = new FormData();
      expect(progressHandler.calculateBodySize(formData)).toBe(0);
    });

    it('should handle objects with length property', () => {
      const obj = { length: 100 };
      expect(progressHandler.calculateBodySize(obj)).toBe(100);
    });

    it('should handle objects with size property', () => {
      const obj = { size: 200 };
      expect(progressHandler.calculateBodySize(obj)).toBe(200);
    });

    it('should return 0 for objects without size properties', () => {
      const obj = { data: 'test' };
      expect(progressHandler.calculateBodySize(obj)).toBe(0);
    });
  });

  describe('validateProgressCallback', () => {
    it('should not throw for undefined callback', () => {
      expect(() => {
        progressHandler.validateProgressCallback(undefined);
      }).not.toThrow();
    });

    it('should not throw for function callback', () => {
      expect(() => {
        progressHandler.validateProgressCallback(() => {});
      }).not.toThrow();
    });

    it('should throw for non-function callback', () => {
      expect(() => {
        progressHandler.validateProgressCallback('not a function');
      }).toThrow('Progress callback must be a function');
    });

    it('should throw for object callback', () => {
      expect(() => {
        progressHandler.validateProgressCallback({});
      }).toThrow('Progress callback must be a function');
    });
  });

  describe('createThrottledProgressCallback', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return null for non-function callback', () => {
      const throttled = progressHandler.createThrottledProgressCallback(null);
      expect(throttled).toBeNull();
    });

    it('should call callback immediately on first event', () => {
      const throttled = progressHandler.createThrottledProgressCallback(mockProgressCallback, 100);
      const event = { progress: 0.1 };
      
      throttled(event);
      
      expect(mockProgressCallback).toHaveBeenCalledWith(event);
    });

    it('should throttle subsequent calls', () => {
      const throttled = progressHandler.createThrottledProgressCallback(mockProgressCallback, 100);
      
      // First call - should go through
      throttled({ progress: 0.1 });
      expect(mockProgressCallback).toHaveBeenCalledTimes(1);
      
      // Second call within throttle window - should be ignored
      vi.advanceTimersByTime(50);
      throttled({ progress: 0.2 });
      expect(mockProgressCallback).toHaveBeenCalledTimes(1);
      
      // Third call after throttle window - should go through
      vi.advanceTimersByTime(60);
      throttled({ progress: 0.3 });
      expect(mockProgressCallback).toHaveBeenCalledTimes(2);
    });

    it('should always call callback for completion (100% progress)', () => {
      const throttled = progressHandler.createThrottledProgressCallback(mockProgressCallback, 100);
      
      // First call
      throttled({ progress: 0.1 });
      expect(mockProgressCallback).toHaveBeenCalledTimes(1);
      
      // Completion call within throttle window - should still go through
      vi.advanceTimersByTime(50);
      throttled({ progress: 1.0 });
      expect(mockProgressCallback).toHaveBeenCalledTimes(2);
    });

    it('should use default throttle interval of 100ms', () => {
      const throttled = progressHandler.createThrottledProgressCallback(mockProgressCallback);
      
      throttled({ progress: 0.1 });
      expect(mockProgressCallback).toHaveBeenCalledTimes(1);
      
      // Within default 100ms window
      vi.advanceTimersByTime(50);
      throttled({ progress: 0.2 });
      expect(mockProgressCallback).toHaveBeenCalledTimes(1);
      
      // After default 100ms window
      vi.advanceTimersByTime(60);
      throttled({ progress: 0.3 });
      expect(mockProgressCallback).toHaveBeenCalledTimes(2);
    });
  });
});