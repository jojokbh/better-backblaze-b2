import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../../src/core/http-client.js';
import { HTTP_STATUS, CONTENT_TYPES } from '../../../src/constants.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HttpClient', () => {
  let httpClient;

  beforeEach(() => {
    httpClient = new HttpClient({
      baseURL: 'https://api.example.com',
      timeout: 5000
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const client = new HttpClient();
      expect(client.timeout).toBe(30000); // DEFAULT_CONFIG.REQUEST_TIMEOUT
      expect(client.baseURL).toBe('');
      expect(client.defaultHeaders).toEqual({});
    });

    it('should initialize with custom options', () => {
      const options = {
        timeout: 10000,
        baseURL: 'https://custom.api.com',
        headers: { 'Custom-Header': 'value' }
      };
      const client = new HttpClient(options);
      expect(client.timeout).toBe(10000);
      expect(client.baseURL).toBe('https://custom.api.com');
      expect(client.defaultHeaders).toEqual({ 'Custom-Header': 'value' });
    });
  });

  describe('request method', () => {
    it('should make successful GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'https://api.example.com/test',
        json: vi.fn().mockResolvedValue({ success: true })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await httpClient.request({
        method: 'GET',
        url: '/test'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: {},
          body: null,
          signal: expect.any(AbortSignal)
        })
      );

      expect(response).toEqual({
        status: 200,
        statusText: 'OK',
        headers: mockResponse.headers,
        data: { success: true },
        config: {
          url: 'https://api.example.com/test',
          method: 'GET'
        }
      });
    });

    it('should make successful POST request with JSON data', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'https://api.example.com/test',
        json: vi.fn().mockResolvedValue({ id: 123 })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const postData = { name: 'test' };
      const response = await httpClient.request({
        method: 'POST',
        url: '/test',
        data: postData
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postData),
          signal: expect.any(AbortSignal)
        })
      );

      expect(response.status).toBe(201);
      expect(response.data).toEqual({ id: 123 });
    });

    it('should handle HTTP error responses', async () => {
      const errorData = { code: 'bad_request', message: 'Invalid input' };
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'https://api.example.com/test',
        json: vi.fn().mockResolvedValue(errorData)
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(httpClient.request({
        method: 'GET',
        url: '/test'
      })).rejects.toThrow();

      try {
        await httpClient.request({ method: 'GET', url: '/test' });
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.code).toBe('bad_request');
        expect(error.message).toBe('Invalid input');
        expect(error.isHttpError).toBe(true);
        expect(error.response.data).toEqual(errorData);
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(httpClient.request({
        method: 'GET',
        url: '/test'
      })).rejects.toThrow('Network error: Network failure');

      try {
        await httpClient.request({ method: 'GET', url: '/test' });
      } catch (error) {
        expect(error.code).toBe('NETWORK_ERROR');
        expect(error.isNetworkError).toBe(true);
        expect(error.originalError).toBeInstanceOf(Error);
      }
    });

    it('should handle timeout errors', async () => {
      // Mock AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(httpClient.request({
        method: 'GET',
        url: '/test',
        timeout: 1000
      })).rejects.toThrow('Request timeout after 1000ms');

      try {
        await httpClient.request({ method: 'GET', url: '/test', timeout: 1000 });
      } catch (error) {
        expect(error.code).toBe('TIMEOUT');
        expect(error.isNetworkError).toBe(true);
      }
    });

    it('should handle different response types', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        url: 'https://api.example.com/test',
        text: vi.fn().mockResolvedValue('plain text response'),
        json: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn()
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await httpClient.request({
        method: 'GET',
        url: '/test'
      });

      expect(mockResponse.text).toHaveBeenCalled();
      expect(response.data).toBe('plain text response');
    });

    it('should handle binary response data', async () => {
      const mockArrayBuffer = new ArrayBuffer(8);
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        url: 'https://api.example.com/test',
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        json: vi.fn(),
        text: vi.fn(),
        blob: vi.fn()
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await httpClient.request({
        method: 'GET',
        url: '/test'
      });

      expect(mockResponse.arrayBuffer).toHaveBeenCalled();
      expect(response.data).toBe(mockArrayBuffer);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'https://api.example.com/test',
        json: vi.fn().mockResolvedValue({ success: true })
      };
      mockFetch.mockResolvedValue(mockResponse);
    });

    it('should make GET request', async () => {
      await httpClient.get('/test', { headers: { 'Custom': 'header' } });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Custom': 'header' }
        })
      );
    });

    it('should make POST request', async () => {
      const data = { test: 'data' };
      await httpClient.post('/test', data, { headers: { 'Custom': 'header' } });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Custom': 'header', 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      );
    });

    it('should make PUT request', async () => {
      const data = { test: 'data' };
      await httpClient.put('/test', data);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data)
        })
      );
    });

    it('should make DELETE request', async () => {
      await httpClient.delete('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('createAbortController', () => {
    it('should create AbortController with timeout', () => {
      vi.useFakeTimers();
      
      const controller = httpClient.createAbortController(1000);
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
      
      vi.advanceTimersByTime(1000);
      expect(controller.signal.aborted).toBe(true);
      
      vi.useRealTimers();
    });

    it('should not set timeout when timeout is 0', () => {
      const controller = httpClient.createAbortController(0);
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
    });
  });
});