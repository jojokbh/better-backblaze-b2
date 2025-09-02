/**
 * HTTP Client using native fetch API
 * Provides axios-like interface for making HTTP requests
 */

import { HTTP_STATUS, DEFAULT_CONFIG, CONTENT_TYPES } from '../constants.js';
import { ProgressHandler } from './progress-handler.js';

export class HttpClient {
  constructor(options = {}) {
    this.timeout = options.timeout || DEFAULT_CONFIG.REQUEST_TIMEOUT;
    this.baseURL = options.baseURL || '';
    this.defaultHeaders = options.headers || {};
    this.progressHandler = new ProgressHandler(options.progress || {});
    
    // Performance monitoring
    this.performanceMetrics = {
      enabled: options.enablePerformanceMetrics || false,
      requestCount: 0,
      totalRequestTime: 0,
      averageRequestTime: 0,
      slowRequests: [], // Track requests > 5 seconds
      errorCount: 0
    };
  }

  /**
   * Start performance timing for a request
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @returns {Object} Performance timer object
   */
  startPerformanceTimer(method, url) {
    if (!this.performanceMetrics.enabled) {
      return null;
    }

    return {
      method,
      url,
      startTime: performance.now(),
      startMemory: process.memoryUsage?.() || null
    };
  }

  /**
   * End performance timing and record metrics
   * @param {Object} timer - Performance timer object
   * @param {boolean} isError - Whether the request resulted in an error
   */
  endPerformanceTimer(timer, isError = false) {
    if (!timer || !this.performanceMetrics.enabled) {
      return;
    }

    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    const endMemory = process.memoryUsage?.() || null;

    // Update metrics
    this.performanceMetrics.requestCount++;
    this.performanceMetrics.totalRequestTime += duration;
    this.performanceMetrics.averageRequestTime = 
      this.performanceMetrics.totalRequestTime / this.performanceMetrics.requestCount;

    if (isError) {
      this.performanceMetrics.errorCount++;
    }

    // Track slow requests (> 5 seconds)
    if (duration > 5000) {
      this.performanceMetrics.slowRequests.push({
        method: timer.method,
        url: timer.url,
        duration,
        timestamp: new Date().toISOString(),
        memoryDelta: endMemory && timer.startMemory ? 
          endMemory.heapUsed - timer.startMemory.heapUsed : null
      });

      // Keep only last 10 slow requests
      if (this.performanceMetrics.slowRequests.length > 10) {
        this.performanceMetrics.slowRequests.shift();
      }
    }
  }

  /**
   * Get performance metrics
   * @returns {Object} Current performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      ...this.performanceMetrics,
      requestCount: 0,
      totalRequestTime: 0,
      averageRequestTime: 0,
      slowRequests: [],
      errorCount: 0
    };
  }

  /**
   * Create an AbortController with timeout
   * @param {number} timeout - Timeout in milliseconds
   * @returns {AbortController}
   */
  createAbortController(timeout) {
    const controller = new AbortController();

    if (timeout > 0) {
      setTimeout(() => {
        controller.abort();
      }, timeout);
    }

    return controller;
  }

  /**
   * Transform fetch response to axios-like response format
   * @param {Response} response - Fetch response object
   * @param {any} data - Response data
   * @returns {Object} Axios-like response object
   */
  transformResponse(response, data) {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: data,
      config: {
        url: response.url,
        method: response.method || 'GET',
      },
    };
  }

  /**
   * Check if response should be streamed based on content length
   * @param {Response} response - Fetch response object
   * @param {string} responseType - Expected response type
   * @returns {boolean} Whether to use streaming
   */
  shouldUseStreaming(response, responseType) {
    const contentLength = response.headers.get('content-length');
    const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
    
    // Use streaming for large files or when explicitly requested
    return (
      responseType === 'stream' ||
      (contentLength && parseInt(contentLength) > LARGE_FILE_THRESHOLD) ||
      response.headers.get('content-type')?.includes('application/octet-stream')
    );
  }

  /**
   * Optimize memory usage for large file uploads
   * @param {any} data - Upload data
   * @returns {any} Optimized data
   */
  optimizeUploadData(data) {
    // For large ArrayBuffers, consider using streams (threshold: 10MB)
    if (data instanceof ArrayBuffer && data.byteLength > 10 * 1024 * 1024) {
      // Convert to ReadableStream for memory efficiency
      return new ReadableStream({
        start(controller) {
          const chunk = new Uint8Array(data);
          const chunkSize = 64 * 1024; // 64KB chunks
          let offset = 0;
          
          const pump = () => {
            if (offset < chunk.length) {
              const end = Math.min(offset + chunkSize, chunk.length);
              controller.enqueue(chunk.slice(offset, end));
              offset = end;
              // Use setTimeout to avoid blocking the event loop
              setTimeout(pump, 0);
            } else {
              controller.close();
            }
          };
          
          pump();
        }
      });
    }
    
    return data;
  }

  /**
   * Parse response data based on content type and requested response type
   * @param {Response} response - Fetch response object
   * @param {string} responseType - Requested response type
   * @returns {Promise<any>} Parsed response data
   */
  async parseResponseData(response, responseType = 'auto') {
    // Use ProgressHandler for consistent response processing
    return await this.progressHandler.processResponseWithoutProgress(
      response,
      responseType
    );
  }

  /**
   * Create error from fetch response
   * @param {Response} response - Fetch response object
   * @param {any} data - Response data
   * @returns {Error} HTTP error
   */
  async createHttpError(response, data) {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
    error.status = response.status;
    error.statusText = response.statusText;
    error.response = this.transformResponse(response, data);
    error.isHttpError = true;

    // Add B2-specific error information if available
    if (data && typeof data === 'object') {
      if (data.code) {
        error.code = data.code;
      }
      if (data.message) {
        error.message = data.message;
      }
    }

    return error;
  }

  /**
   * Make HTTP request using fetch
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async request(options = {}) {
    const {
      method = 'GET',
      url,
      data,
      headers = {},
      timeout = this.timeout,
      responseType = 'auto',
      onUploadProgress,
      onDownloadProgress,
    } = options;

    // Start performance monitoring
    const perfTimer = this.startPerformanceTimer(method, url);

    // Validate progress callbacks
    this.progressHandler.validateProgressCallback(onUploadProgress);
    this.progressHandler.validateProgressCallback(onDownloadProgress);

    // Construct full URL
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    // Prepare headers
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };

    // Prepare request body with progress tracking and memory optimization
    let body = null;
    if (data !== undefined && method !== 'GET' && method !== 'HEAD') {
      if (
        data instanceof FormData ||
        data instanceof ArrayBuffer ||
        data instanceof Blob
      ) {
        // Optimize large uploads for memory efficiency
        body = this.optimizeUploadData(data);
      } else if (typeof data === 'object') {
        body = JSON.stringify(data);
        if (!requestHeaders['Content-Type']) {
          requestHeaders['Content-Type'] = CONTENT_TYPES.JSON;
        }
      } else {
        body = data;
      }

      // Wrap body with upload progress tracking if callback provided
      if (onUploadProgress && body) {
        const bodySize = this.progressHandler.calculateBodySize(body);
        const uploadTracker = this.progressHandler.createUploadProgressTracker(
          onUploadProgress,
          bodySize
        );
        if (uploadTracker) {
          body = this.progressHandler.wrapUploadBody(body, uploadTracker);
        }
      }
    }

    // Create abort controller for timeout
    const controller = this.createAbortController(timeout);

    // Prepare fetch options
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: requestHeaders,
      body,
      signal: controller.signal,
    };

    try {
      // Make the request
      const response = await fetch(fullUrl, fetchOptions);

      // Check if response is successful before processing
      if (!response.ok) {
        // For error responses, parse without progress tracking
        const responseData = await this.parseResponseData(
          response,
          responseType
        );
        const error = await this.createHttpError(response, responseData);
        throw error;
      }

      // Parse response data with progress tracking for downloads
      const responseData =
        await this.progressHandler.processResponseWithProgress(
          response,
          responseType,
          onDownloadProgress
        );

      // End performance monitoring (success)
      this.endPerformanceTimer(perfTimer, false);

      // Return axios-like response
      return this.transformResponse(response, responseData);
    } catch (error) {
      // End performance monitoring (error)
      this.endPerformanceTimer(perfTimer, true);

      // Handle fetch errors (network errors, timeouts, etc.)
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeout}ms`);
        timeoutError.code = 'TIMEOUT';
        timeoutError.isNetworkError = true;
        throw timeoutError;
      }

      if (error.isHttpError) {
        // Re-throw HTTP errors as-is
        throw error;
      }

      // Handle network errors
      const networkError = new Error(`Network error: ${error.message}`);
      networkError.code = 'NETWORK_ERROR';
      networkError.isNetworkError = true;
      networkError.originalError = error;
      throw networkError;
    }
  }

  /**
   * Make GET request
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async get(url, options = {}) {
    return this.request({
      method: 'GET',
      url,
      ...options,
    });
  }

  /**
   * Make POST request
   * @param {string} url - Request URL
   * @param {any} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async post(url, data, options = {}) {
    return this.request({
      method: 'POST',
      url,
      data,
      ...options,
    });
  }

  /**
   * Make PUT request
   * @param {string} url - Request URL
   * @param {any} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async put(url, data, options = {}) {
    return this.request({
      method: 'PUT',
      url,
      data,
      ...options,
    });
  }

  /**
   * Make DELETE request
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response object
   */
  async delete(url, options = {}) {
    return this.request({
      method: 'DELETE',
      url,
      ...options,
    });
  }
}

export default HttpClient;