// API constants and configuration values

// B2 API Base URLs
const B2_API_BASE_URL = 'https://api.backblazeb2.com';

// API Endpoints
const API_ENDPOINTS = {
  // Authentication
  AUTHORIZE_ACCOUNT: '/b2api/v4/b2_authorize_account',

  // Bucket operations
  CREATE_BUCKET: '/b2api/v2/b2_create_bucket',
  DELETE_BUCKET: '/b2api/v2/b2_delete_bucket',
  LIST_BUCKETS: '/b2api/v2/b2_list_buckets',
  UPDATE_BUCKET: '/b2api/v2/b2_update_bucket',
  GET_UPLOAD_URL: '/b2api/v2/b2_get_upload_url',

  DOWNLOAD_FILE_BY_ID: '/b2api/v2/b2_download_file_by_id',
  DOWNLOAD_FILE_BY_NAME: '/file',
  LIST_FILE_NAMES: '/b2api/v2/b2_list_file_names',
  LIST_FILE_VERSIONS: '/b2api/v2/b2_list_file_versions',
  GET_FILE_INFO: '/b2api/v2/b2_get_file_info',
  DELETE_FILE_VERSION: '/b2api/v2/b2_delete_file_version',
  HIDE_FILE: '/b2api/v2/b2_hide_file',

  // Large file operations
  START_LARGE_FILE: '/b2api/v2/b2_start_large_file',
  GET_UPLOAD_PART_URL: '/b2api/v2/b2_get_upload_part_url',
  FINISH_LARGE_FILE: '/b2api/v2/b2_finish_large_file',
  CANCEL_LARGE_FILE: '/b2api/v2/b2_cancel_large_file',
  LIST_PARTS: '/b2api/v2/b2_list_parts',
  LIST_UNFINISHED_LARGE_FILES: '/b2api/v2/b2_list_unfinished_large_files',

  // Key management
  CREATE_KEY: '/b2api/v2/b2_create_key',
  DELETE_KEY: '/b2api/v2/b2_delete_key',
  LIST_KEYS: '/b2api/v2/b2_list_keys',

  // Download authorization
  GET_DOWNLOAD_AUTHORIZATION: '/b2api/v2/b2_get_download_authorization',
};

// Bucket Types
const BUCKET_TYPES = {
  ALL_PRIVATE: 'allPrivate',
  ALL_PUBLIC: 'allPublic',
};

// Key Capabilities
const KEY_CAPABILITIES = {
  LIST_KEYS: 'listKeys',
  WRITE_KEYS: 'writeKeys',
  DELETE_KEYS: 'deleteKeys',
  LIST_BUCKETS: 'listBuckets',
  WRITE_BUCKETS: 'writeBuckets',
  DELETE_BUCKETS: 'deleteBuckets',
  LIST_ALL_BUCKET_NAMES: 'listAllBucketNames',
  LIST_FILES: 'listFiles',
  READ_FILES: 'readFiles',
  SHARE_FILES: 'shareFiles',
  WRITE_FILES: 'writeFiles',
  DELETE_FILES: 'deleteFiles',
};

// HTTP Status Codes
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REQUEST_TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

// Default Configuration
const DEFAULT_CONFIG = {
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  RETRY_DELAY_MULTIPLIER: 2,
  MAX_RETRY_DELAY: 30000, // 30 seconds

  // Request configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_PARTS_COUNT: 10000};

// Error Codes
const B2_ERROR_CODES = {
  BAD_AUTH_TOKEN: 'bad_auth_token',
  EXPIRED_AUTH_TOKEN: 'expired_auth_token',
  INVALID_BUCKET_ID: 'invalid_bucket_id',
  INVALID_BUCKET_NAME: 'invalid_bucket_name',
  BUCKET_NOT_EMPTY: 'bucket_not_empty',
  DUPLICATE_BUCKET_NAME: 'duplicate_bucket_name',
  FILE_NOT_PRESENT: 'file_not_present',
  NOT_ALLOWED: 'not_allowed',
  REQUEST_TIMEOUT: 'request_timeout',
  TOO_MANY_REQUESTS: 'too_many_requests',
};

// Retryable Error Codes
const RETRYABLE_ERROR_CODES = new Set([
  B2_ERROR_CODES.REQUEST_TIMEOUT,
  B2_ERROR_CODES.TOO_MANY_REQUESTS,
]);

// Retryable HTTP Status Codes
const RETRYABLE_STATUS_CODES = new Set([
  HTTP_STATUS.REQUEST_TIMEOUT,
  HTTP_STATUS.TOO_MANY_REQUESTS,
  HTTP_STATUS.INTERNAL_SERVER_ERROR,
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.GATEWAY_TIMEOUT,
]);

// Content Types
const CONTENT_TYPES = {
  JSON: 'application/json',
  OCTET_STREAM: 'application/octet-stream'};

// Headers
const HEADERS = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  CONTENT_LENGTH: 'Content-Length',
  CONTENT_SHA1: 'X-Bz-Content-Sha1',
  FILE_NAME: 'X-Bz-File-Name',
  PART_NUMBER: 'X-Bz-Part-Number'};

/**
 * Progress Handler for tracking upload and download progress
 * Provides progress callbacks for file operations using fetch streams
 */

class ProgressHandler {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Create a progress event object
   * @param {number} loaded - Number of bytes loaded
   * @param {number} total - Total number of bytes
   * @param {boolean} lengthComputable - Whether the total length is known
   * @returns {Object} Progress event object
   */
  createProgressEvent(loaded, total, lengthComputable = true) {
    return {
      loaded,
      total,
      lengthComputable,
      progress: lengthComputable && total > 0 ? loaded / total : 0,
      percentage:
        lengthComputable && total > 0 ? Math.round((loaded / total) * 100) : 0,
    };
  }

  /**
   * Create an upload progress tracker for fetch requests
   * @param {Function} onProgress - Progress callback function
   * @param {number} totalSize - Total size of the upload
   * @returns {Function} Progress tracker function
   */
  createUploadProgressTracker(onProgress, totalSize) {
    if (typeof onProgress !== 'function') {
      return null;
    }

    let loaded = 0;

    return (chunk) => {
      if (chunk) {
        loaded += chunk.length || chunk.byteLength || 0;
      }

      const progressEvent = this.createProgressEvent(
        loaded,
        totalSize,
        totalSize > 0
      );
      onProgress(progressEvent);
    };
  }

  /**
   * Create a download progress tracker for fetch responses
   * @param {Function} onProgress - Progress callback function
   * @param {number} totalSize - Total size of the download (from Content-Length header)
   * @returns {Function} Progress tracker function
   */
  createDownloadProgressTracker(onProgress, totalSize) {
    if (typeof onProgress !== 'function') {
      return null;
    }

    let loaded = 0;

    return (chunk) => {
      if (chunk) {
        loaded += chunk.length || chunk.byteLength || 0;
      }

      const progressEvent = this.createProgressEvent(
        loaded,
        totalSize,
        totalSize > 0
      );
      onProgress(progressEvent);
    };
  }

  /**
   * Wrap request body with progress tracking for uploads
   * @param {any} body - Request body (Buffer, Uint8Array, string, etc.)
   * @param {Function} progressTracker - Progress tracker function
   * @returns {ReadableStream} Wrapped body with progress tracking
   */
  wrapUploadBody(body, progressTracker) {
    if (!progressTracker || !body) {
      return body;
    }

    // Convert body to Uint8Array if it's a string
    let bodyData;
    if (typeof body === 'string') {
      bodyData = new TextEncoder().encode(body);
    } else if (body instanceof ArrayBuffer) {
      bodyData = new Uint8Array(body);
    } else if (body instanceof Uint8Array || body instanceof Buffer) {
      bodyData = body;
    } else {
      // For other types (FormData, Blob, etc.), return as-is
      // Progress tracking for these types is handled differently
      return body;
    }

    // Create a ReadableStream that tracks progress
    return new ReadableStream({
      start(controller) {
        const chunkSize = 64 * 1024; // 64KB chunks
        let offset = 0;

        const pump = () => {
          if (offset >= bodyData.length) {
            controller.close();
            return;
          }

          const chunk = bodyData.slice(offset, offset + chunkSize);
          controller.enqueue(chunk);

          // Track progress
          progressTracker(chunk);

          offset += chunk.length;

          // Use setTimeout to avoid blocking the main thread
          setTimeout(pump, 0);
        };

        pump();
      },
    });
  }

  /**
   * Wrap response stream with progress tracking for downloads
   * @param {Response} response - Fetch response object
   * @param {Function} progressTracker - Progress tracker function
   * @returns {ReadableStream} Wrapped response stream with progress tracking
   */
  wrapDownloadResponse(response, progressTracker) {
    if (!progressTracker || !response.body) {
      return response.body;
    }

    const reader = response.body.getReader();

    return new ReadableStream({
      start(controller) {
        const pump = () => {
          return reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }

              // Track progress
              progressTracker(value);

              controller.enqueue(value);
              return pump();
            })
            .catch((error) => {
              controller.error(error);
            });
        };

        return pump();
      },
    });
  }

  /**
   * Process response with progress tracking and return appropriate data type
   * @param {Response} response - Fetch response object
   * @param {string} responseType - Desired response type
   * @param {Function} onDownloadProgress - Progress callback function
   * @returns {Promise<any>} Processed response data
   */
  async processResponseWithProgress(
    response,
    responseType,
    onDownloadProgress
  ) {
    if (!onDownloadProgress || !response.body) {
      // No progress tracking needed, use standard processing
      return this.processResponseWithoutProgress(response, responseType);
    }

    // Get content length for progress calculation
    const contentLength = parseInt(
      response.headers.get('content-length') || '0',
      10
    );
    const progressTracker = this.createDownloadProgressTracker(
      onDownloadProgress,
      contentLength
    );

    // Wrap the response stream with progress tracking
    const progressStream = this.wrapDownloadResponse(response, progressTracker);

    // Create a new response with the wrapped stream
    const progressResponse = new Response(progressStream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Process the response based on the requested type
    return this.processResponseWithoutProgress(progressResponse, responseType);
  }

  /**
   * Process response without progress tracking (fallback method)
   * @param {Response} response - Fetch response object
   * @param {string} responseType - Desired response type
   * @returns {Promise<any>} Processed response data
   */
  async processResponseWithoutProgress(response, responseType) {
    switch (responseType) {
      case 'stream':
        return response.body;
      case 'blob':
        return await response.blob();
      case 'arraybuffer':
        return await response.arrayBuffer();
      case 'text':
        return await response.text();
      case 'json':
        return await response.json();
      default:
        // Auto-detect based on content type
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            return await response.json();
          } catch (error) {
            return await response.text();
          }
        }
        if (contentType.includes('text/')) {
          return await response.text();
        }
        return await response.arrayBuffer();
    }
  }

  /**
   * Calculate upload body size for progress tracking
   * @param {any} body - Request body
   * @returns {number} Size in bytes
   */
  calculateBodySize(body) {
    if (!body) {
      return 0;
    }

    if (typeof body === 'string') {
      return new TextEncoder().encode(body).length;
    }

    if (body instanceof ArrayBuffer) {
      return body.byteLength;
    }

    if (body instanceof Uint8Array || body instanceof Buffer) {
      return body.length;
    }

    if (body instanceof Blob) {
      return body.size;
    }

    if (body instanceof FormData) {
      // FormData size is difficult to calculate precisely
      // Return 0 to indicate unknown size
      return 0;
    }

    // For other types, try to get length property
    return body.length || body.size || 0;
  }

  /**
   * Validate progress callback function
   * @param {Function} callback - Progress callback to validate
   * @throws {Error} If callback is not a valid function
   */
  validateProgressCallback(callback) {
    if (callback !== undefined && typeof callback !== 'function') {
      throw new Error('Progress callback must be a function');
    }
  }

  /**
   * Create a throttled progress callback to limit update frequency
   * @param {Function} callback - Original progress callback
   * @param {number} throttleMs - Throttle interval in milliseconds (default: 100ms)
   * @returns {Function} Throttled progress callback
   */
  createThrottledProgressCallback(callback, throttleMs = 100) {
    if (!callback || typeof callback !== 'function') {
      return null;
    }

    let lastCallTime = 0;

    return (progressEvent) => {
      const now = Date.now();

      // Always call on first event or completion (100% progress)
      if (
        lastCallTime === 0 ||
        progressEvent.progress >= 1 ||
        now - lastCallTime >= throttleMs
      ) {
        lastCallTime = now;
        callback(progressEvent);
      }
    };
  }
}

/**
 * HTTP Client using native fetch API
 * Provides axios-like interface for making HTTP requests
 */


class HttpClient {
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

/**
 * Retry Handler with exponential backoff
 * Provides configurable retry logic for HTTP requests
 */


class RetryHandler {
  constructor(options = {}) {
    this.retries = options.retries ?? DEFAULT_CONFIG.RETRY_ATTEMPTS;
    this.retryDelay = options.retryDelay ?? DEFAULT_CONFIG.RETRY_DELAY;
    this.retryDelayMultiplier =
      options.retryDelayMultiplier ?? DEFAULT_CONFIG.RETRY_DELAY_MULTIPLIER;
    this.maxRetryDelay =
      options.maxRetryDelay ?? DEFAULT_CONFIG.MAX_RETRY_DELAY;
    this.retryCondition =
      options.retryCondition || this.defaultRetryCondition.bind(this);
    this.onRetry = options.onRetry || null;
  }

  /**
   * Default retry condition - determines if an error should trigger a retry
   * @param {Error} error - The error that occurred
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {boolean} Whether to retry the request
   */
  defaultRetryCondition(error, attempt) {
    // Don't retry if we've exceeded max attempts
    if (attempt >= this.retries) {
      return false;
    }

    // Retry network errors (connection failures, timeouts)
    if (error.isNetworkError) {
      return true;
    }

    // Retry specific HTTP status codes
    if (error.status && RETRYABLE_STATUS_CODES.has(error.status)) {
      return true;
    }

    // Retry specific B2 error codes
    if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) {
      return true;
    }

    // Don't retry client errors (4xx except 429)
    if (
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== HTTP_STATUS.TOO_MANY_REQUESTS
    ) {
      return false;
    }

    // Retry server errors (5xx)
    if (error.status >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay for next retry attempt with exponential backoff and jitter
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    // Calculate exponential backoff: baseDelay * (multiplier ^ attempt)
    const exponentialDelay =
      this.retryDelay * Math.pow(this.retryDelayMultiplier, attempt);

    // Apply maximum delay limit
    const cappedDelay = Math.min(exponentialDelay, this.maxRetryDelay);

    // Add jitter (±25% of the delay) to avoid thundering herd
    const jitterRange = cappedDelay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute a function with retry logic
   * @param {Function} requestFn - Function that returns a Promise
   * @param {Object} options - Retry options
   * @returns {Promise<any>} Result of successful request
   */
  async executeWithRetry(requestFn, options = {}) {
    const maxAttempts = (options.retries ?? this.retries) + 1; // +1 for initial attempt
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Execute the request function
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        const shouldRetry = this.retryCondition(error, attempt);

        // If this is the last attempt or we shouldn't retry, throw the error
        if (attempt === maxAttempts - 1 || !shouldRetry) {
          // Add retry information to the error
          error.retryAttempts = attempt + 1;
          error.isRetryExhausted = attempt === maxAttempts - 1;
          throw error;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);

        // Call onRetry callback if provided
        if (this.onRetry) {
          this.onRetry(error, attempt + 1, delay);
        }

        // Wait before next attempt
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }

    // This should never be reached, but just in case
    throw lastError;
  }

  /**
   * Create a retry wrapper for a function
   * @param {Function} fn - Function to wrap with retry logic
   * @param {Object} options - Retry options
   * @returns {Function} Wrapped function with retry logic
   */
  wrap(fn, options = {}) {
    return (...args) => {
      return this.executeWithRetry(() => fn(...args), options);
    };
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} Whether the error is retryable
   */
  isRetryable(error) {
    return this.retryCondition(error, 0);
  }

  /**
   * Get retry configuration
   * @returns {Object} Current retry configuration
   */
  getConfig() {
    return {
      retries: this.retries,
      retryDelay: this.retryDelay,
      retryDelayMultiplier: this.retryDelayMultiplier,
      maxRetryDelay: this.maxRetryDelay,
    };
  }

  /**
   * Update retry configuration
   * @param {Object} options - New retry options
   */
  updateConfig(options = {}) {
    if (options.retries !== undefined) this.retries = options.retries;
    if (options.retryDelay !== undefined) this.retryDelay = options.retryDelay;
    if (options.retryDelayMultiplier !== undefined)
      this.retryDelayMultiplier = options.retryDelayMultiplier;
    if (options.maxRetryDelay !== undefined)
      this.maxRetryDelay = options.maxRetryDelay;
    if (options.retryCondition !== undefined)
      this.retryCondition = options.retryCondition;
    if (options.onRetry !== undefined) this.onRetry = options.onRetry;
  }
}

/**
 * Authentication header utilities
 */
const AuthHeaders = {
  /**
   * Create Basic authentication header
   * @param {string} applicationKeyId - Application key ID
   * @param {string} applicationKey - Application key
   * @returns {Object} Headers object with Authorization header
   */
  createBasicAuth(applicationKeyId, applicationKey) {
    if (!applicationKeyId || !applicationKey) {
      throw new Error(
        'Application key ID and application key are required for Basic auth'
      );
    }

    const credentials = btoa(`${applicationKeyId}:${applicationKey}`);
    return {
      [HEADERS.AUTHORIZATION]: `Basic ${credentials}`,
    };
  },

  /**
   * Create Bearer authentication header
   * @param {string} token - Bearer token
   * @returns {Object} Headers object with Authorization header
   */
  createBearerAuth(token) {
    if (!token) {
      throw new Error('Token is required for Bearer auth');
    }

    return {
      [HEADERS.AUTHORIZATION]: token,
    };
  },

  /**
   * Extract authorization token from headers
   * @param {Object} headers - Headers object
   * @returns {string|null} Authorization token or null if not found
   */
  extractAuthToken(headers) {
    return headers?.[HEADERS.AUTHORIZATION] || null;
  },
};

/**
 * Info header utilities for file metadata
 */
const InfoHeaders = {
  /**
   * Maximum number of info headers allowed by B2
   */
  MAX_INFO_HEADERS: 10,

  /**
   * Add info headers to existing headers object
   * @param {Object} headers - Existing headers object
   * @param {Object} info - Info object with metadata
   * @returns {Object} Updated headers object
   */
  addInfoHeaders(headers, info) {
    if (!info || typeof info !== 'object') {
      return headers;
    }

    const keys = Object.keys(info);

    if (keys.length > this.MAX_INFO_HEADERS) {
      throw new Error(
        `Too many info headers: maximum of ${this.MAX_INFO_HEADERS} allowed`
      );
    }

    const invalidKeys = [];
    const updatedHeaders = { ...headers };

    keys.forEach((key) => {
      if (this.isValidInfoHeaderKey(key)) {
        const headerName = `X-Bz-Info-${key}`;
        updatedHeaders[headerName] = encodeURIComponent(String(info[key]));
      } else {
        invalidKeys.push(key);
      }
    });

    if (invalidKeys.length > 0) {
      throw new Error(
        `Info header keys contain invalid characters: ${invalidKeys.join(', ')}`
      );
    }

    return updatedHeaders;
  },

  /**
   * Validate info header key
   * @param {string} key - Header key to validate
   * @returns {boolean} True if valid
   */
  isValidInfoHeaderKey(key) {
    return typeof key === 'string' && /^[a-zA-Z0-9\-_]+$/.test(key);
  },

  /**
   * Extract info headers from response headers
   * @param {Object} headers - Response headers
   * @returns {Object} Extracted info headers
   */
  extractInfoHeaders(headers) {
    const info = {};

    if (!headers || typeof headers !== 'object') {
      return info;
    }

    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase().startsWith('x-bz-info-')) {
        const infoKey = key.substring(10); // Remove 'x-bz-info-' prefix (10 characters)
        try {
          info[infoKey] = decodeURIComponent(value);
        } catch (error) {
          // If decoding fails, use the raw value
          info[infoKey] = value;
        }
      }
    });

    return info;
  },
};

/**
 * Common header utilities
 */
const HeaderUtils = {
  /**
   * Create headers for JSON requests
   * @param {string} authToken - Authorization token
   * @returns {Object} Headers object
   */
  createJsonHeaders(authToken) {
    const headers = {
      [HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    };

    if (authToken) {
      headers[HEADERS.AUTHORIZATION] = authToken;
    }

    return headers;
  },

  /**
   * Create headers for file upload
   * @param {Object} options - Upload options
   * @param {string} options.authToken - Authorization token
   * @param {string} options.fileName - File name
   * @param {string} options.contentType - Content type
   * @param {string} options.contentSha1 - SHA1 hash
   * @param {number} options.contentLength - Content length
   * @param {Object} options.info - File info metadata
   * @returns {Object} Headers object
   */
  createUploadHeaders({
    authToken,
    fileName,
    contentType,
    contentSha1,
    contentLength,
    info,
  }) {
    let headers = {};

    if (authToken) {
      headers[HEADERS.AUTHORIZATION] = authToken;
    }

    if (fileName) {
      headers[HEADERS.FILE_NAME] = encodeURIComponent(fileName);
    }

    if (contentType) {
      headers[HEADERS.CONTENT_TYPE] = contentType;
    }

    if (contentSha1) {
      headers[HEADERS.CONTENT_SHA1] = contentSha1;
    }

    if (contentLength !== undefined) {
      headers[HEADERS.CONTENT_LENGTH] = String(contentLength);
    }

    // Add info headers if provided
    if (info) {
      headers = InfoHeaders.addInfoHeaders(headers, info);
    }

    return headers;
  },

  /**
   * Create headers for part upload
   * @param {Object} options - Part upload options
   * @param {string} options.authToken - Authorization token
   * @param {number} options.partNumber - Part number
   * @param {string} options.contentSha1 - SHA1 hash of part
   * @param {number} options.contentLength - Content length
   * @returns {Object} Headers object
   */
  createPartUploadHeaders({
    authToken,
    partNumber,
    contentSha1,
    contentLength,
  }) {
    const headers = {};

    if (authToken) {
      headers[HEADERS.AUTHORIZATION] = authToken;
    }

    if (partNumber !== undefined) {
      headers[HEADERS.PART_NUMBER] = String(partNumber);
    }

    if (contentSha1) {
      headers[HEADERS.CONTENT_SHA1] = contentSha1;
    }

    if (contentLength !== undefined) {
      headers[HEADERS.CONTENT_LENGTH] = String(contentLength);
    }

    return headers;
  },

  /**
   * Normalize header names to lowercase
   * @param {Object} headers - Headers object
   * @returns {Object} Normalized headers object
   */
  normalizeHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
      return {};
    }

    const normalized = {};
    Object.entries(headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value;
    });

    return normalized;
  },

  /**
   * Convert B2 response headers to camelCase object
   * @param {Object} headers - Response headers
   * @returns {Object} Converted headers object
   */
  convertBzHeaders(headers) {
    const result = {};

    if (!headers || typeof headers !== 'object') {
      return result;
    }

    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase().startsWith('x-bz-')) {
        let camelKey;

        if (key.toLowerCase().startsWith('x-bz-info-')) {
          // Handle info headers specially
          camelKey = 'info' + this.toCamelCase(key.substring(11));
        } else {
          // Handle other B2 headers
          camelKey = this.toCamelCase(key.substring(5)); // Remove 'x-bz-' prefix
        }

        result[camelKey] = value;
      }
    });

    return result;
  },

  /**
   * Convert kebab-case to camelCase
   * @param {string} str - String to convert
   * @returns {string} CamelCase string
   */
  toCamelCase(str) {
    return str
      .split('-')
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  },
};

/**
 * Input validation utilities for B2 API parameters
 */
class Validator {
  /**
   * Validate required parameters
   * @param {Object} params - Parameters object
   * @param {string[]} required - Array of required parameter names
   * @throws {Error} If any required parameter is missing
   */
  static validateRequired(params, required) {
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters object is required');
    }

    const missing = required.filter(
      (param) =>
        params[param] === undefined ||
        params[param] === null ||
        params[param] === ''
    );

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Validate string parameter
   * @param {any} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum length
   * @param {number} options.maxLength - Maximum length
   * @param {RegExp} options.pattern - Pattern to match
   * @throws {Error} If validation fails
   */
  static validateString(value, name, options = {}) {
    if (typeof value !== 'string') {
      throw new Error(`${name} must be a string`);
    }

    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new Error(
        `${name} must be at least ${options.minLength} characters long`
      );
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new Error(
        `${name} must be no more than ${options.maxLength} characters long`
      );
    }

    if (options.pattern && !options.pattern.test(value)) {
      throw new Error(`${name} format is invalid`);
    }
  }

  /**
   * Validate number parameter
   * @param {any} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {Object} options - Validation options
   * @param {number} options.min - Minimum value
   * @param {number} options.max - Maximum value
   * @param {boolean} options.integer - Must be integer
   * @throws {Error} If validation fails
   */
  static validateNumber(value, name, options = {}) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${name} must be a valid number`);
    }

    if (options.integer && !Number.isInteger(value)) {
      throw new Error(`${name} must be an integer`);
    }

    if (options.min !== undefined && value < options.min) {
      throw new Error(`${name} must be at least ${options.min}`);
    }

    if (options.max !== undefined && value > options.max) {
      throw new Error(`${name} must be no more than ${options.max}`);
    }
  }

  /**
   * Validate array parameter
   * @param {any} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum array length
   * @param {number} options.maxLength - Maximum array length
   * @throws {Error} If validation fails
   */
  static validateArray(value, name, options = {}) {
    if (!Array.isArray(value)) {
      throw new Error(`${name} must be an array`);
    }

    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new Error(
        `${name} must contain at least ${options.minLength} items`
      );
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new Error(
        `${name} must contain no more than ${options.maxLength} items`
      );
    }
  }

  /**
   * Validate bucket name
   * @param {string} bucketName - Bucket name to validate
   * @throws {Error} If bucket name is invalid
   */
  static validateBucketName(bucketName) {
    this.validateString(bucketName, 'bucketName', {
      minLength: 6,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9\-]+$/,
    });

    // Additional B2-specific rules
    if (bucketName.startsWith('-') || bucketName.endsWith('-')) {
      throw new Error('Bucket name cannot start or end with a hyphen');
    }

    if (bucketName.includes('--')) {
      throw new Error('Bucket name cannot contain consecutive hyphens');
    }
  }

  /**
   * Validate bucket type
   * @param {string} bucketType - Bucket type to validate
   * @throws {Error} If bucket type is invalid
   */
  static validateBucketType(bucketType) {
    const validTypes = Object.values(BUCKET_TYPES);
    if (!validTypes.includes(bucketType)) {
      throw new Error(
        `Invalid bucket type. Must be one of: ${validTypes.join(', ')}`
      );
    }
  }

  /**
   * Validate file name
   * @param {string} fileName - File name to validate
   * @throws {Error} If file name is invalid
   */
  static validateFileName(fileName) {
    this.validateString(fileName, 'fileName', {
      minLength: 1,
      maxLength: 1024,
    });

    // B2 doesn't allow certain characters in file names
    const invalidChars = /[\x00-\x1f\x7f]/;
    if (invalidChars.test(fileName)) {
      throw new Error('File name contains invalid control characters');
    }

    // File name cannot start with '/'
    if (fileName.startsWith('/')) {
      throw new Error('File name cannot start with a forward slash');
    }
  }

  /**
   * Validate SHA1 hash
   * @param {string} sha1 - SHA1 hash to validate
   * @throws {Error} If SHA1 hash is invalid
   */
  static validateSha1(sha1) {
    this.validateString(sha1, 'SHA1 hash', {
      minLength: 40,
      maxLength: 40,
      pattern: /^[a-fA-F0-9]{40}$/,
    });
  }

  /**
   * Validate content type
   * @param {string} contentType - Content type to validate
   * @throws {Error} If content type is invalid
   */
  static validateContentType(contentType) {
    this.validateString(contentType, 'contentType', {
      minLength: 1,
      maxLength: 1024,
      pattern:
        /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/,
    });
  }

  /**
   * Validate key capabilities
   * @param {string[]} capabilities - Array of capabilities to validate
   * @throws {Error} If any capability is invalid
   */
  static validateKeyCapabilities(capabilities) {
    this.validateArray(capabilities, 'capabilities', { minLength: 1 });

    const validCapabilities = Object.values(KEY_CAPABILITIES);
    const invalid = capabilities.filter(
      (cap) => !validCapabilities.includes(cap)
    );

    if (invalid.length > 0) {
      throw new Error(`Invalid key capabilities: ${invalid.join(', ')}`);
    }
  }

  /**
   * Validate part number for multipart uploads
   * @param {number} partNumber - Part number to validate
   * @throws {Error} If part number is invalid
   */
  static validatePartNumber(partNumber) {
    this.validateNumber(partNumber, 'partNumber', {
      min: 1,
      max: 10000,
      integer: true,
    });
  }

  /**
   * Validate file size
   * @param {number} size - File size in bytes
   * @param {Object} options - Validation options
   * @param {number} options.maxSize - Maximum allowed size
   * @throws {Error} If file size is invalid
   */
  static validateFileSize(size, options = {}) {
    this.validateNumber(size, 'file size', {
      min: 0,
      integer: true,
    });

    if (options.maxSize && size > options.maxSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${options.maxSize} bytes`
      );
    }
  }

  /**
   * Validate pagination parameters
   * @param {Object} params - Pagination parameters
   * @param {number} params.maxFileCount - Maximum number of files to return
   * @param {string} params.startFileName - File name to start listing from
   * @throws {Error} If pagination parameters are invalid
   */
  static validatePagination(params) {
    if (params.maxFileCount !== undefined) {
      this.validateNumber(params.maxFileCount, 'maxFileCount', {
        min: 1,
        max: 10000,
        integer: true,
      });
    }

    if (params.startFileName !== undefined) {
      this.validateFileName(params.startFileName);
    }
  }

  /**
   * Validate authentication credentials
   * @param {Object} credentials - Authentication credentials
   * @param {string} credentials.applicationKeyId - Application key ID
   * @param {string} credentials.applicationKey - Application key
   * @throws {Error} If credentials are invalid
   */
  static validateAuthCredentials(credentials) {
    this.validateRequired(credentials, ['applicationKeyId', 'applicationKey']);

    this.validateString(credentials.applicationKeyId, 'applicationKeyId', {
      minLength: 1,
      maxLength: 1024,
    });

    this.validateString(credentials.applicationKey, 'applicationKey', {
      minLength: 1,
      maxLength: 1024,
    });
  }
}

/**
 * Authentication Manager for B2 API
 * Handles credential validation, authorization, and auth context management
 */


class AuthManager {
  constructor(httpClient, config = {}) {
    this.httpClient = httpClient;
    this.config = config;

    // Auth context storage
    this.authContext = {
      authorizationToken: null,
      apiUrl: null,
      downloadUrl: null,
      accountId: null,
      recommendedPartSize: null,
      absoluteMinimumPartSize: null,
      allowed: null,
      isAuthenticated: false,
    };
  }

  /**
   * Validate credentials for authentication
   * @param {Object} credentials - Authentication credentials
   * @param {string} credentials.applicationKeyId - Application key ID
   * @param {string} credentials.applicationKey - Application key
   * @throws {Error} If credentials are invalid
   */
  validateCredentials(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('credentials is required');
    }

    if (!credentials.hasOwnProperty('applicationKeyId')) {
      throw new Error('applicationKeyId is required');
    }

    if (!credentials.hasOwnProperty('applicationKey')) {
      throw new Error('applicationKey is required');
    }

    if (typeof credentials.applicationKeyId !== 'string') {
      throw new Error('applicationKeyId must be a string');
    }

    if (typeof credentials.applicationKey !== 'string') {
      throw new Error('applicationKey must be a string');
    }

    if (credentials.applicationKeyId.trim().length === 0) {
      throw new Error('Application key ID cannot be empty');
    }

    if (credentials.applicationKey.trim().length === 0) {
      throw new Error('Application key cannot be empty');
    }
  }

  /**
   * Generate Basic authentication header
   * @param {string} applicationKeyId - Application key ID
   * @param {string} applicationKey - Application key
   * @returns {Object} Headers object with Basic auth
   */
  generateBasicAuthHeader(applicationKeyId, applicationKey) {
    try {
      return AuthHeaders.createBasicAuth(applicationKeyId, applicationKey);
    } catch (error) {
      throw new Error(`Failed to generate Basic auth header: ${error.message}`);
    }
  }

  /**
   * Save authentication context from API response
   * @param {Object} authResponse - Authentication response from B2 API
   */
  saveAuthContext(authResponse) {
    if (!authResponse || typeof authResponse !== 'object') {
      throw new Error('Invalid authentication response');
    }

    // Handle both old and new B2 API response formats
    let apiUrl, downloadUrl, recommendedPartSize, absoluteMinimumPartSize, allowed;

    // New format: nested in apiInfo.storageApi
    if (authResponse.apiInfo && authResponse.apiInfo.storageApi) {
      const storageApi = authResponse.apiInfo.storageApi;
      apiUrl = storageApi.apiUrl;
      downloadUrl = storageApi.downloadUrl;
      recommendedPartSize = storageApi.recommendedPartSize;
      absoluteMinimumPartSize = storageApi.absoluteMinimumPartSize; 
      allowed = storageApi.allowed;
    }
    // Old format: fields at root level (for backward compatibility)
    else {
      apiUrl = authResponse.apiUrl;
      downloadUrl = authResponse.downloadUrl;
      recommendedPartSize = authResponse.recommendedPartSize;
      absoluteMinimumPartSize = authResponse.absoluteMinimumPartSize;
      allowed = authResponse.allowed;
    }

    // Validate required fields
    const requiredFields = [
      { name: 'authorizationToken', value: authResponse.authorizationToken },
      { name: 'apiUrl', value: apiUrl },
      { name: 'downloadUrl', value: downloadUrl },
      { name: 'accountId', value: authResponse.accountId },
    ];

    for (const field of requiredFields) {
      if (!field.value) {
        throw new Error(`Missing required field in auth response: ${field.name}`);
      }
    }

    this.authContext = {
      authorizationToken: authResponse.authorizationToken,
      apiUrl: apiUrl,
      downloadUrl: downloadUrl,
      accountId: authResponse.accountId,
      recommendedPartSize: recommendedPartSize || null,
      absoluteMinimumPartSize: absoluteMinimumPartSize || null,
      allowed: allowed || null,
      isAuthenticated: true,
    };
  }

  /**
   * Get current authentication context
   * @returns {Object} Current auth context
   */
  getAuthContext() {
    return { ...this.authContext };
  }

  /**
   * Check if currently authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return (
      this.authContext.isAuthenticated && !!this.authContext.authorizationToken
    );
  }

  /**
   * Get authorization token for authenticated requests
   * @returns {string|null} Authorization token or null if not authenticated
   */
  getAuthToken() {
    return this.authContext.authorizationToken;
  }

  /**
   * Get API URL for making authenticated requests
   * @returns {string|null} API URL or null if not authenticated
   */
  getApiUrl() {
    return this.authContext.apiUrl;
  }

  /**
   * Get download URL for file downloads
   * @returns {string|null} Download URL or null if not authenticated
   */
  getDownloadUrl() {
    return this.authContext.downloadUrl;
  }

  /**
   * Get account ID
   * @returns {string|null} Account ID or null if not authenticated
   */
  getAccountId() {
    return this.authContext.accountId;
  }

  /**
   * Get recommended part size for large file uploads
   * @returns {number|null} Recommended part size or null if not available
   */
  getRecommendedPartSize() {
    return this.authContext.recommendedPartSize;
  }

  /**
   * Clear authentication context
   */
  clearAuthContext() {
    this.authContext = {
      authorizationToken: null,
      apiUrl: null,
      downloadUrl: null,
      accountId: null,
      recommendedPartSize: null,
      absoluteMinimumPartSize: null,
      allowed: null,
      isAuthenticated: false,
    };
  }

  /**
   * Authorize with B2 API using application credentials
   * @param {Object} credentials - Authentication credentials
   * @param {string} credentials.applicationKeyId - Application key ID
   * @param {string} credentials.applicationKey - Application key
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Authentication response
   */
  async authorize(credentials, options = {}) {
    // Validate credentials
    this.validateCredentials(credentials);

    // Generate Basic auth header
    const authHeaders = this.generateBasicAuthHeader(
      credentials.applicationKeyId,
      credentials.applicationKey
    );

    try {
      // Make authorization request
      const response = await this.httpClient.get(
        `${B2_API_BASE_URL}${API_ENDPOINTS.AUTHORIZE_ACCOUNT}`,
        {
          headers: authHeaders,
          timeout: options.timeout,
        }
      );

      // Save auth context from response
      this.saveAuthContext(response.data);

      return response;
    } catch (error) {
      // Clear any existing auth context on failure
      this.clearAuthContext();

      // Handle specific B2 authentication errors
      if (error.status === 401) {
        const b2Error = new Error(
          'Authentication failed: Invalid application key ID or application key'
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        b2Error.isAuthError = true;
        // Preserve original response for compatibility
        b2Error.response = error.response;
        throw b2Error;
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get headers for authenticated requests
   * @returns {Object} Headers object with authorization token
   * @throws {Error} If not authenticated
   */
  getAuthHeaders() {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Call authorize() first.');
    }

    return AuthHeaders.createBearerAuth(this.authContext.authorizationToken);
  }

  /**
   * Refresh authentication if token is expired
   * @param {Object} credentials - Original credentials for re-authentication
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} New authentication response
   */
  async refreshAuth(credentials, options = {}) {
    // Clear current context and re-authenticate
    this.clearAuthContext();
    return this.authorize(credentials, options);
  }

  /**
   * Check if an error indicates expired authentication
   * @param {Error} error - Error to check
   * @returns {boolean} True if error indicates expired auth
   */
  isAuthExpiredError(error) {
    return (
      error.status === 401 ||
      error.code === B2_ERROR_CODES.BAD_AUTH_TOKEN ||
      error.code === B2_ERROR_CODES.EXPIRED_AUTH_TOKEN
    );
  }
}

/**
 * Utility class for constructing B2 API endpoint URLs
 */
class EndpointBuilder {
  constructor(authContext = null) {
    this.authContext = authContext;
  }

  /**
   * Update the auth context for dynamic URL construction
   * @param {Object} authContext - Authentication context containing apiUrl and downloadUrl
   */
  setAuthContext(authContext) {
    this.authContext = authContext;
  }

  /**
   * Get the base API URL (either from auth context or default)
   * @returns {string} Base API URL
   */
  getApiUrl() {
    return this.authContext?.apiUrl || B2_API_BASE_URL;
  }

  /**
   * Get the download URL from auth context
   * @returns {string} Download URL
   */
  getDownloadUrl() {
    if (!this.authContext?.downloadUrl) {
      throw new Error('Download URL not available. Please authenticate first.');
    }
    return this.authContext.downloadUrl;
  }

  /**
   * Build a complete API endpoint URL
   * @param {string} endpoint - The endpoint path from API_ENDPOINTS
   * @param {Object} params - Optional query parameters
   * @returns {string} Complete URL
   */
  buildApiUrl(endpoint, params = {}) {
    const baseUrl = this.getApiUrl();
    const url = new URL(endpoint, baseUrl);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  /**
   * Build a download URL
   * @param {string} endpoint - The download endpoint path
   * @param {Object} params - Optional query parameters
   * @returns {string} Complete download URL
   */
  buildDownloadUrl(endpoint, params = {}) {
    const baseUrl = this.getDownloadUrl();
    const url = new URL(endpoint, baseUrl);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  // Authentication endpoints
  getAuthorizeAccountUrl() {
    return this.buildApiUrl(API_ENDPOINTS.AUTHORIZE_ACCOUNT);
  }

  // Bucket endpoints
  getCreateBucketUrl() {
    return this.buildApiUrl(API_ENDPOINTS.CREATE_BUCKET);
  }

  getDeleteBucketUrl() {
    return this.buildApiUrl(API_ENDPOINTS.DELETE_BUCKET);
  }

  getListBucketsUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_BUCKETS);
  }

  getUpdateBucketUrl() {
    return this.buildApiUrl(API_ENDPOINTS.UPDATE_BUCKET);
  }

  getUploadUrl() {
    return this.buildApiUrl(API_ENDPOINTS.GET_UPLOAD_URL);
  }

  // File endpoints
  getListFileNamesUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_FILE_NAMES);
  }

  getListFileVersionsUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_FILE_VERSIONS);
  }

  getFileInfoUrl() {
    return this.buildApiUrl(API_ENDPOINTS.GET_FILE_INFO);
  }

  getDeleteFileVersionUrl() {
    return this.buildApiUrl(API_ENDPOINTS.DELETE_FILE_VERSION);
  }

  getHideFileUrl() {
    return this.buildApiUrl(API_ENDPOINTS.HIDE_FILE);
  }

  /**
   * Get download file by name URL
   * @param {string} bucketName - The bucket name
   * @param {string} fileName - The file name (will be URL encoded)
   * @returns {string} Download URL
   */
  getDownloadFileByNameUrl(bucketName, fileName) {
    const encodedFileName = encodeURIComponent(fileName);
    const endpoint = `${API_ENDPOINTS.DOWNLOAD_FILE_BY_NAME}/${encodeURIComponent(bucketName)}/${encodedFileName}`;
    return this.buildDownloadUrl(endpoint);
  }

  /**
   * Get download file by ID URL
   * @param {string} fileId - The file ID
   * @returns {string} Download URL
   */
  getDownloadFileByIdUrl(fileId) {
    return this.buildDownloadUrl(API_ENDPOINTS.DOWNLOAD_FILE_BY_ID, { fileId });
  }

  // Large file endpoints
  getStartLargeFileUrl() {
    return this.buildApiUrl(API_ENDPOINTS.START_LARGE_FILE);
  }

  getUploadPartUrlEndpoint() {
    return this.buildApiUrl(API_ENDPOINTS.GET_UPLOAD_PART_URL);
  }

  getFinishLargeFileUrl() {
    return this.buildApiUrl(API_ENDPOINTS.FINISH_LARGE_FILE);
  }

  getCancelLargeFileUrl() {
    return this.buildApiUrl(API_ENDPOINTS.CANCEL_LARGE_FILE);
  }

  getListPartsUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_PARTS);
  }

  getListUnfinishedLargeFilesUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_UNFINISHED_LARGE_FILES);
  }

  // Key management endpoints
  getCreateKeyUrl() {
    return this.buildApiUrl(API_ENDPOINTS.CREATE_KEY);
  }

  getDeleteKeyUrl() {
    return this.buildApiUrl(API_ENDPOINTS.DELETE_KEY);
  }

  getListKeysUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_KEYS);
  }

  // Download authorization
  getDownloadAuthorizationUrl() {
    return this.buildApiUrl(API_ENDPOINTS.GET_DOWNLOAD_AUTHORIZATION);
  }
}

/**
 * Bucket Manager for B2 API
 * Handles bucket CRUD operations and upload URL generation
 */


class BucketManager {
  constructor(httpClient, authManager, config = {}) {
    this.httpClient = httpClient;
    this.authManager = authManager;
    this.config = config;
    this.endpointBuilder = new EndpointBuilder();
  }

  /**
   * Validate bucket name according to B2 requirements
   * @param {string} bucketName - Bucket name to validate
   * @throws {Error} If bucket name is invalid
   */
  validateBucketName(bucketName) {
    if (!bucketName || typeof bucketName !== 'string') {
      throw new Error('bucketName is required and must be a string');
    }

    if (bucketName.length < 6 || bucketName.length > 50) {
      throw new Error('Bucket name must be between 6 and 50 characters');
    }

    // B2 bucket name requirements
    const validPattern = /^[a-z0-9][a-z0-9\-]*[a-z0-9]$/;
    if (!validPattern.test(bucketName)) {
      throw new Error(
        'Bucket name must start and end with alphanumeric characters and contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Cannot contain consecutive hyphens
    if (bucketName.includes('--')) {
      throw new Error('Bucket name cannot contain consecutive hyphens');
    }
  }

  /**
   * Validate bucket type
   * @param {string} bucketType - Bucket type to validate
   * @throws {Error} If bucket type is invalid
   */
  validateBucketType(bucketType) {
    if (!bucketType || typeof bucketType !== 'string') {
      throw new Error('bucketType is required and must be a string');
    }

    const validTypes = Object.values(BUCKET_TYPES);
    if (!validTypes.includes(bucketType)) {
      throw new Error(
        `Invalid bucket type. Must be one of: ${validTypes.join(', ')}`
      );
    }
  }

  /**
   * Validate bucket ID
   * @param {string} bucketId - Bucket ID to validate
   * @throws {Error} If bucket ID is invalid
   */
  validateBucketId(bucketId) {
    if (!bucketId || typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }
  }

  /**
   * Ensure authentication before making requests
   * @throws {Error} If not authenticated
   */
  ensureAuthenticated() {
    if (!this.authManager.isAuthenticated()) {
      throw new Error('Not authenticated. Call authorize() first.');
    }

    // Update endpoint builder with current auth context
    this.endpointBuilder.setAuthContext(this.authManager.getAuthContext());
  }

  /**
   * Create a new bucket
   * @param {Object|string} options - Bucket creation options or bucket name (for backward compatibility)
   * @param {string} options.bucketName - Name of the bucket to create
   * @param {string} options.bucketType - Type of bucket (allPublic or allPrivate)
   * @param {string} [bucketType] - Bucket type (for backward compatibility when first param is string)
   * @returns {Promise<Object>} Bucket creation response
   */
  async create(options, bucketType) {
    this.ensureAuthenticated();

    // Handle backward compatibility: create(bucketName, bucketType)
    let bucketName, type;
    if (typeof options === 'string') {
      bucketName = options;
      type = bucketType;
    } else if (options && typeof options === 'object') {
      bucketName = options.bucketName;
      type = options.bucketType;
    } else {
      throw new Error(
        'Invalid arguments. Expected object with bucketName and bucketType, or bucketName and bucketType as separate parameters'
      );
    }

    // Validate inputs
    this.validateBucketName(bucketName);
    this.validateBucketType(type);

    const requestData = {
      accountId: this.authManager.getAccountId(),
      bucketName: bucketName,
      bucketType: type,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getCreateBucketUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 bucket creation errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.DUPLICATE_BUCKET_NAME) {
          const b2Error = new Error(
            `Bucket name '${bucketName}' already exists`
          );
          b2Error.code = B2_ERROR_CODES.DUPLICATE_BUCKET_NAME;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_NAME) {
          const b2Error = new Error(`Invalid bucket name: ${bucketName}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_NAME;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
  }

  /**
   * Delete a bucket
   * @param {Object|string} options - Bucket deletion options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to delete
   * @returns {Promise<Object>} Bucket deletion response
   */
  async delete(options) {
    this.ensureAuthenticated();

    // Handle backward compatibility: delete(bucketId)
    let bucketId;
    if (typeof options === 'string') {
      bucketId = options;
    } else if (options && typeof options === 'object') {
      bucketId = options.bucketId;
    } else {
      throw new Error(
        'Invalid arguments. Expected object with bucketId or bucketId as string'
      );
    }

    // Validate inputs
    this.validateBucketId(bucketId);

    const requestData = {
      accountId: this.authManager.getAccountId(),
      bucketId: bucketId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getDeleteBucketUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 bucket deletion errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_ID) {
          const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.BUCKET_NOT_EMPTY) {
          const b2Error = new Error(
            `Bucket is not empty and cannot be deleted`
          );
          b2Error.code = B2_ERROR_CODES.BUCKET_NOT_EMPTY;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
  }

  /**
   * List buckets
   * @param {Object} [options={}] - List options
   * @returns {Promise<Object>} List of buckets response
   */
  async list(options = {}) {
    this.ensureAuthenticated();

    const requestData = {
      accountId: this.authManager.getAccountId(),
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListBucketsUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get bucket information by name or ID
   * @param {Object} options - Get bucket options
   * @param {string} [options.bucketName] - Name of the bucket to get
   * @param {string} [options.bucketId] - ID of the bucket to get
   * @returns {Promise<Object>} Bucket information response
   */
  async get(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    if (!options.bucketName && !options.bucketId) {
      throw new Error('Either bucketName or bucketId is required');
    }

    if (options.bucketName && options.bucketId) {
      throw new Error('Cannot specify both bucketName and bucketId');
    }

    const requestData = {
      accountId: this.authManager.getAccountId(),
    };

    // Add either bucketName or bucketId to the request
    if (options.bucketName) {
      this.validateBucketName(options.bucketName);
      requestData.bucketName = options.bucketName;
    } else {
      this.validateBucketId(options.bucketId);
      requestData.bucketId = options.bucketId;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListBucketsUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update bucket type
   * @param {Object|string} options - Bucket update options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to update
   * @param {string} options.bucketType - New bucket type
   * @param {string} [bucketType] - New bucket type (for backward compatibility when first param is string)
   * @returns {Promise<Object>} Bucket update response
   */
  async update(options, bucketType) {
    this.ensureAuthenticated();

    // Handle backward compatibility: update(bucketId, bucketType)
    let bucketId, type;
    if (typeof options === 'string') {
      bucketId = options;
      type = bucketType;
    } else if (options && typeof options === 'object') {
      bucketId = options.bucketId;
      type = options.bucketType;
    } else {
      throw new Error(
        'Invalid arguments. Expected object with bucketId and bucketType, or bucketId and bucketType as separate parameters'
      );
    }

    // Validate inputs
    this.validateBucketId(bucketId);
    this.validateBucketType(type);

    const requestData = {
      accountId: this.authManager.getAccountId(),
      bucketId: bucketId,
      bucketType: type,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getUpdateBucketUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 bucket update errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.INVALID_BUCKET_ID
      ) {
        const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
        b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Get upload URL for a bucket
   * @param {Object|string} options - Upload URL options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to get upload URL for
   * @returns {Promise<Object>} Upload URL response
   */
  async getUploadUrl(options) {
    this.ensureAuthenticated();

    // Handle backward compatibility: getUploadUrl(bucketId)
    let bucketId;
    if (typeof options === 'string') {
      bucketId = options;
    } else if (options && typeof options === 'object') {
      bucketId = options.bucketId;
    } else {
      throw new Error(
        'Invalid arguments. Expected object with bucketId or bucketId as string'
      );
    }

    // Validate inputs
    this.validateBucketId(bucketId);

    const requestData = {
      bucketId: bucketId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getUploadUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 upload URL errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.INVALID_BUCKET_ID
      ) {
        const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
        b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }
}

/**
 * Cryptographic utilities for B2 API operations
 * Uses Node.js crypto module and Web Crypto API for browser compatibility
 */

// Check if we're in Node.js or browser environment
const isNode =
  typeof process !== 'undefined' && process.versions && process.versions.node;

// Lazy-load crypto module to avoid top-level await
let crypto;
let cryptoPromise;

function getCrypto() {
  if (crypto) {
    return crypto;
  }

  if (isNode) {
    // Node.js environment - use dynamic import
    if (!cryptoPromise) {
      cryptoPromise = import('crypto').then((cryptoModule) => {
        crypto = cryptoModule;
        return crypto;
      });
    }
    return cryptoPromise;
  } else {
    // Browser environment - use Web Crypto API
    crypto = globalThis.crypto;
    return crypto;
  }
}

/**
 * SHA1 hashing utilities for file integrity verification
 */
class Sha1Hasher {
  /**
   * Calculate SHA1 hash of data
   * @param {Buffer|Uint8Array|string} data - Data to hash
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  static async hash(data) {
    if (isNode) {
      return this.hashNode(data);
    } else {
      return this.hashBrowser(data);
    }
  }

  /**
   * Calculate SHA1 hash using Node.js crypto module
   * @param {Buffer|string} data - Data to hash
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  static async hashNode(data) {
    const cryptoModule = await getCrypto();
    const hash = cryptoModule.createHash('sha1');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Calculate SHA1 hash using Web Crypto API
   * @param {Uint8Array|string} data - Data to hash
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  static async hashBrowser(data) {
    // Convert string to Uint8Array if needed
    if (typeof data === 'string') {
      data = new TextEncoder().encode(data);
    }

    // Calculate hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);

    // Convert to hex string
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create a streaming SHA1 hasher for large files
   * @returns {Sha1Stream} Streaming hasher instance
   */
  static createStream() {
    return new Sha1Stream();
  }

  /**
   * Verify SHA1 hash matches expected value
   * @param {Buffer|Uint8Array|string} data - Data to verify
   * @param {string} expectedHash - Expected SHA1 hash
   * @returns {Promise<boolean>} True if hash matches
   */
  static async verify(data, expectedHash) {
    const actualHash = await this.hash(data);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Calculate SHA1 hash of a file (Node.js only)
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  static async hashFile(filePath) {
    if (!isNode) {
      throw new Error('File hashing is only available in Node.js environment');
    }

    const fs = await import('fs');
    const stream = fs.createReadStream(filePath);
    const hasher = this.createStream();

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => hasher.update(chunk));
      stream.on('end', () => resolve(hasher.digest()));
      stream.on('error', reject);
    });
  }
}

/**
 * Streaming SHA1 hasher for processing large amounts of data
 */
class Sha1Stream {
  constructor() {
    this.isNode = isNode;
    if (isNode) {
      this.cryptoPromise = getCrypto();
      this.hash = null;
    } else {
      this.chunks = [];
    }
  }

  /**
   * Initialize the hasher (async for Node.js)
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isNode && !this.hash) {
      const cryptoModule = await this.cryptoPromise;
      this.hash = cryptoModule.createHash('sha1');
    }
  }

  /**
   * Update hash with new data
   * @param {Buffer|Uint8Array|string} data - Data to add to hash
   */
  async update(data) {
    if (this.isNode) {
      await this.init();
      this.hash.update(data);
    } else {
      // Store chunks for browser processing
      if (typeof data === 'string') {
        data = new TextEncoder().encode(data);
      }
      this.chunks.push(data);
    }
  }

  /**
   * Finalize hash and return result
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  async digest() {
    if (this.isNode) {
      await this.init();
      return this.hash.digest('hex');
    } else {
      // Combine all chunks and hash in browser
      const totalLength = this.chunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );
      const combined = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of this.chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return Sha1Hasher.hashBrowser(combined);
    }
  }
}

// Export convenience functions
Sha1Hasher.hash.bind(Sha1Hasher);
Sha1Hasher.verify.bind(Sha1Hasher);
Sha1Hasher.createStream.bind(Sha1Hasher);

/**
 * File Manager for B2 API
 * Handles file upload, download, listing, and management operations
 */


class FileManager {
  constructor(httpClient, authManager, config = {}) {
    this.httpClient = httpClient;
    this.authManager = authManager;
    this.config = config;
    this.endpointBuilder = new EndpointBuilder();
  }

  /**
   * Ensure authentication before making requests
   * @throws {Error} If not authenticated
   */
  ensureAuthenticated() {
    if (!this.authManager.isAuthenticated()) {
      throw new Error('Not authenticated. Call authorize() first.');
    }

    // Update endpoint builder with current auth context
    this.endpointBuilder.setAuthContext(this.authManager.getAuthContext());
  }

  /**
   * Validate file name according to B2 requirements
   * @param {string} fileName - File name to validate
   * @throws {Error} If file name is invalid
   */
  validateFileName(fileName) {
    if (typeof fileName !== 'string') {
      throw new Error('fileName is required and must be a string');
    }

    if (fileName.length === 0) {
      throw new Error('File name cannot be empty');
    }

    if (fileName.length > 1024) {
      throw new Error('File name cannot exceed 1024 characters');
    }

    // B2 doesn't allow certain characters in file names
    const invalidChars = /[\x00-\x1f\x7f]/;
    if (invalidChars.test(fileName)) {
      throw new Error('File name contains invalid characters');
    }
  }

  /**
   * Validate file ID
   * @param {string} fileId - File ID to validate
   * @throws {Error} If file ID is invalid
   */
  validateFileId(fileId) {
    if (typeof fileId !== 'string') {
      throw new Error('fileId is required and must be a string');
    }

    if (fileId.trim().length === 0) {
      throw new Error('fileId cannot be empty');
    }
  }

  /**
   * Upload a file to B2
   * @param {Object} options - Upload options
   * @param {string} options.uploadUrl - Upload URL from getUploadUrl
   * @param {string} options.uploadAuthToken - Upload authorization token
   * @param {string} options.fileName - Name of the file
   * @param {Buffer|Uint8Array|string} options.data - File data to upload
   * @param {string} [options.contentType] - Content type (defaults to application/octet-stream)
   * @param {string} [options.contentSha1] - SHA1 hash of content (will be calculated if not provided)
   * @param {Object} [options.info] - File info metadata
   * @param {Function} [options.onUploadProgress] - Progress callback function
   * @returns {Promise<Object>} Upload response
   */
  async uploadFile(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      uploadUrl,
      uploadAuthToken,
      fileName,
      data,
      contentType = CONTENT_TYPES.OCTET_STREAM,
      contentSha1,
      info,
      onUploadProgress,
    } = options;

    // Validate required parameters
    if (!uploadUrl || typeof uploadUrl !== 'string') {
      throw new Error('uploadUrl is required and must be a string');
    }

    if (!uploadAuthToken || typeof uploadAuthToken !== 'string') {
      throw new Error('uploadAuthToken is required and must be a string');
    }

    this.validateFileName(fileName);

    if (!data) {
      throw new Error('data is required');
    }

    // Calculate content length
    let contentLength;
    if (typeof data === 'string') {
      contentLength = new TextEncoder().encode(data).length;
    } else {
      contentLength = data.length;
    }

    // Calculate SHA1 if not provided
    let sha1Hash = contentSha1;
    if (!sha1Hash) {
      sha1Hash = await Sha1Hasher.hash(data);
    }

    // Create upload headers
    const headers = HeaderUtils.createUploadHeaders({
      authToken: uploadAuthToken,
      fileName,
      contentType,
      contentSha1: sha1Hash,
      contentLength,
      info,
    });

    try {
      const response = await this.httpClient.post(uploadUrl, data, {
        headers,
        timeout: this.config.uploadTimeout || this.config.timeout,
        onUploadProgress,
      });

      return response;
    } catch (error) {
      // Handle specific B2 upload errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`File upload failed: ${error.message}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
  }

  /**
   * Get file information
   * @param {Object|string} options - File info options or file ID (for backward compatibility)
   * @param {string} options.fileId - ID of the file to get info for
   * @returns {Promise<Object>} File information response
   */
  async getFileInfo(options) {
    this.ensureAuthenticated();

    // Handle backward compatibility: getFileInfo(fileId)
    let fileId;
    if (typeof options === 'string') {
      fileId = options;
    } else if (options && typeof options === 'object') {
      fileId = options.fileId;
    } else {
      throw new Error(
        'Invalid arguments. Expected object with fileId or fileId as string'
      );
    }

    // Validate inputs
    this.validateFileId(fileId);

    const requestData = {
      fileId: fileId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getFileInfoUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 file info errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.FILE_NOT_PRESENT
      ) {
        const b2Error = new Error(`File not found: ${fileId}`);
        b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Delete a file version
   * @param {Object} options - Delete options
   * @param {string} options.fileId - ID of the file to delete
   * @param {string} options.fileName - Name of the file to delete
   * @returns {Promise<Object>} Delete response
   */
  async deleteFileVersion(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId, fileName } = options;

    // Validate inputs
    this.validateFileId(fileId);
    this.validateFileName(fileName);

    const requestData = {
      fileId: fileId,
      fileName: fileName,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getDeleteFileVersionUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 delete errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.FILE_NOT_PRESENT
      ) {
        const b2Error = new Error(`File not found: ${fileId}`);
        b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * List file names in a bucket
   * @param {Object} options - List options
   * @param {string} options.bucketId - ID of the bucket to list files from
   * @param {string} [options.startFileName] - File name to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of files to return (default: 100, max: 10000)
   * @param {string} [options.prefix] - Only return file names that start with this prefix
   * @param {string} [options.delimiter] - Delimiter for grouping file names
   * @returns {Promise<Object>} List of file names response
   */
  async listFileNames(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { bucketId, startFileName, maxFileCount, prefix, delimiter } =
      options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    // Validate optional parameters
    if (maxFileCount !== undefined) {
      if (
        typeof maxFileCount !== 'number' ||
        maxFileCount < 1 ||
        maxFileCount > 10000
      ) {
        throw new Error('maxFileCount must be a number between 1 and 10000');
      }
    }

    if (startFileName !== undefined && typeof startFileName !== 'string') {
      throw new Error('startFileName must be a string');
    }

    if (prefix !== undefined && typeof prefix !== 'string') {
      throw new Error('prefix must be a string');
    }

    if (delimiter !== undefined && typeof delimiter !== 'string') {
      throw new Error('delimiter must be a string');
    }

    const requestData = {
      bucketId: bucketId,
    };

    // Add optional parameters
    if (startFileName !== undefined) {
      requestData.startFileName = startFileName;
    }
    if (maxFileCount !== undefined) {
      requestData.maxFileCount = maxFileCount;
    }
    if (prefix !== undefined) {
      requestData.prefix = prefix;
    }
    if (delimiter !== undefined) {
      requestData.delimiter = delimiter;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListFileNamesUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 list errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.INVALID_BUCKET_ID
      ) {
        const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
        b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * List file versions in a bucket
   * @param {Object} options - List options
   * @param {string} options.bucketId - ID of the bucket to list file versions from
   * @param {string} [options.startFileName] - File name to start listing from
   * @param {string} [options.startFileId] - File ID to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of file versions to return (default: 100, max: 10000)
   * @param {string} [options.prefix] - Only return file names that start with this prefix
   * @param {string} [options.delimiter] - Delimiter for grouping file names
   * @returns {Promise<Object>} List of file versions response
   */
  async listFileVersions(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      bucketId,
      startFileName,
      startFileId,
      maxFileCount,
      prefix,
      delimiter,
    } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    // Validate optional parameters
    if (maxFileCount !== undefined) {
      if (
        typeof maxFileCount !== 'number' ||
        maxFileCount < 1 ||
        maxFileCount > 10000
      ) {
        throw new Error('maxFileCount must be a number between 1 and 10000');
      }
    }

    if (startFileName !== undefined && typeof startFileName !== 'string') {
      throw new Error('startFileName must be a string');
    }

    if (startFileId !== undefined && typeof startFileId !== 'string') {
      throw new Error('startFileId must be a string');
    }

    if (prefix !== undefined && typeof prefix !== 'string') {
      throw new Error('prefix must be a string');
    }

    if (delimiter !== undefined && typeof delimiter !== 'string') {
      throw new Error('delimiter must be a string');
    }

    const requestData = {
      bucketId: bucketId,
    };

    // Add optional parameters
    if (startFileName !== undefined) {
      requestData.startFileName = startFileName;
    }
    if (startFileId !== undefined) {
      requestData.startFileId = startFileId;
    }
    if (maxFileCount !== undefined) {
      requestData.maxFileCount = maxFileCount;
    }
    if (prefix !== undefined) {
      requestData.prefix = prefix;
    }
    if (delimiter !== undefined) {
      requestData.delimiter = delimiter;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListFileVersionsUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 list errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.INVALID_BUCKET_ID
      ) {
        const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
        b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Hide a file (make it invisible in file listings)
   * @param {Object} options - Hide file options
   * @param {string} options.bucketId - ID of the bucket containing the file
   * @param {string} options.fileName - Name of the file to hide
   * @returns {Promise<Object>} Hide file response
   */
  async hideFile(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { bucketId, fileName } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    this.validateFileName(fileName);

    const requestData = {
      bucketId: bucketId,
      fileName: fileName,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getHideFileUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 hide file errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_ID) {
          const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`File not found: ${fileName}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
  }

  /**
   * Download a file by name
   * @param {Object|string} options - Download options or bucket name (for backward compatibility)
   * @param {string} options.bucketName - Name of the bucket containing the file
   * @param {string} options.fileName - Name of the file to download
   * @param {string} [options.responseType] - Response type: 'json', 'text', 'arraybuffer', 'blob', 'stream' (default: 'arraybuffer')
   * @param {Function} [options.onDownloadProgress] - Progress callback function
   * @param {Object} [options.headers] - Additional headers for the request
   * @param {string} [fileName] - File name (for backward compatibility when first param is bucket name)
   * @returns {Promise<Object>} Download response with file data
   */
  async downloadFileByName(options, fileName) {
    this.ensureAuthenticated();

    // Handle backward compatibility: downloadFileByName(bucketName, fileName)
    let bucketName, actualFileName, responseType, onDownloadProgress, headers;

    if (typeof options === 'string') {
      // Legacy format: downloadFileByName(bucketName, fileName)
      bucketName = options;
      actualFileName = fileName;
      responseType = 'arraybuffer';
      onDownloadProgress = undefined;
      headers = {};
    } else if (options && typeof options === 'object') {
      // New format: downloadFileByName({ bucketName, fileName, ... })
      bucketName = options.bucketName;
      actualFileName = options.fileName;
      responseType = options.responseType || 'arraybuffer';
      onDownloadProgress = options.onDownloadProgress;
      headers = options.headers || {};
    } else {
      throw new Error(
        'Invalid arguments. Expected object with bucketName and fileName, or bucketName and fileName as separate strings'
      );
    }

    // Validate required parameters
    if (typeof bucketName !== 'string') {
      throw new Error('bucketName is required and must be a string');
    }

    if (bucketName.trim().length === 0) {
      throw new Error('bucketName cannot be empty');
    }

    this.validateFileName(actualFileName);

    // Validate response type
    const validResponseTypes = [
      'json',
      'text',
      'arraybuffer',
      'blob',
      'stream',
    ];
    if (!validResponseTypes.includes(responseType)) {
      throw new Error(
        `Invalid responseType. Must be one of: ${validResponseTypes.join(', ')}`
      );
    }

    try {
      const downloadUrl = this.endpointBuilder.getDownloadFileByNameUrl(
        bucketName,
        actualFileName
      );

      const response = await this.httpClient.get(downloadUrl, {
        headers: {
          ...this.authManager.getAuthHeaders(),
          ...headers,
        },
        responseType,
        onDownloadProgress,
        timeout: this.config.downloadTimeout || this.config.timeout,
      });

      return response;
    } catch (error) {
      // Handle specific B2 download errors
      if (error.status === 404) {
        const b2Error = new Error(
          `File not found: ${actualFileName} in bucket ${bucketName}`
        );
        b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
        b2Error.status = 404;
        throw b2Error;
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized access to file: ${actualFileName}`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Download a file by ID
   * @param {Object|string} options - Download options or file ID (for backward compatibility)
   * @param {string} options.fileId - ID of the file to download
   * @param {string} [options.responseType] - Response type: 'json', 'text', 'arraybuffer', 'blob', 'stream' (default: 'arraybuffer')
   * @param {Function} [options.onDownloadProgress] - Progress callback function
   * @param {Object} [options.headers] - Additional headers for the request
   * @returns {Promise<Object>} Download response with file data
   */
  async downloadFileById(options) {
    this.ensureAuthenticated();

    // Handle backward compatibility: downloadFileById(fileId)
    let fileId, responseType, onDownloadProgress, headers;

    if (typeof options === 'string') {
      // Legacy format: downloadFileById(fileId)
      fileId = options;
      responseType = 'arraybuffer';
      onDownloadProgress = undefined;
      headers = {};
    } else if (options && typeof options === 'object') {
      // New format: downloadFileById({ fileId, ... })
      fileId = options.fileId;
      responseType = options.responseType || 'arraybuffer';
      onDownloadProgress = options.onDownloadProgress;
      headers = options.headers || {};
    } else {
      throw new Error(
        'Invalid arguments. Expected object with fileId or fileId as string'
      );
    }

    // Validate required parameters
    this.validateFileId(fileId);

    // Validate response type
    const validResponseTypes = [
      'json',
      'text',
      'arraybuffer',
      'blob',
      'stream',
    ];
    if (!validResponseTypes.includes(responseType)) {
      throw new Error(
        `Invalid responseType. Must be one of: ${validResponseTypes.join(', ')}`
      );
    }

    try {
      const downloadUrl = this.endpointBuilder.getDownloadFileByIdUrl(fileId);

      const response = await this.httpClient.get(downloadUrl, {
        headers: {
          ...this.authManager.getAuthHeaders(),
          ...headers,
        },
        responseType,
        onDownloadProgress,
        timeout: this.config.downloadTimeout || this.config.timeout,
      });

      return response;
    } catch (error) {
      // Handle specific B2 download errors
      if (error.status === 404) {
        const b2Error = new Error(`File not found: ${fileId}`);
        b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
        b2Error.status = 404;
        throw b2Error;
      }

      if (error.status === 401) {
        const b2Error = new Error(`Unauthorized access to file: ${fileId}`);
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Get download authorization for private files
   * @param {Object} options - Download authorization options
   * @param {string} options.bucketId - ID of the bucket containing the files
   * @param {string} options.fileNamePrefix - Prefix of file names to authorize (can be empty string for all files)
   * @param {number} [options.validDurationInSeconds] - How long the authorization is valid (default: 604800 = 7 days, max: 604800)
   * @param {string} [options.b2ContentDisposition] - Content-Disposition header value for downloads
   * @returns {Promise<Object>} Download authorization response
   */
  async getDownloadAuthorization(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      bucketId,
      fileNamePrefix,
      validDurationInSeconds = 604800, // 7 days default
      b2ContentDisposition,
    } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    if (typeof fileNamePrefix !== 'string') {
      throw new Error(
        'fileNamePrefix is required and must be a string (can be empty)'
      );
    }

    // Validate optional parameters
    if (validDurationInSeconds !== undefined) {
      if (
        typeof validDurationInSeconds !== 'number' ||
        validDurationInSeconds < 1 ||
        validDurationInSeconds > 604800
      ) {
        throw new Error(
          'validDurationInSeconds must be a number between 1 and 604800 (7 days)'
        );
      }
    }

    if (
      b2ContentDisposition !== undefined &&
      typeof b2ContentDisposition !== 'string'
    ) {
      throw new Error('b2ContentDisposition must be a string');
    }

    const requestData = {
      bucketId: bucketId,
      fileNamePrefix: fileNamePrefix,
      validDurationInSeconds: validDurationInSeconds,
    };

    // Add optional parameters
    if (b2ContentDisposition !== undefined) {
      requestData.b2ContentDisposition = b2ContentDisposition;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getDownloadAuthorizationUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 download authorization errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_ID) {
          const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.NOT_ALLOWED) {
          const b2Error = new Error(
            `Not allowed to get download authorization for bucket: ${bucketId}`
          );
          b2Error.code = B2_ERROR_CODES.NOT_ALLOWED;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for download authorization`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  // ===== LARGE FILE OPERATIONS =====

  /**
   * Start a large file upload
   * @param {Object} options - Start large file options
   * @param {string} options.bucketId - ID of the bucket to upload to
   * @param {string} options.fileName - Name of the file to upload
   * @param {string} [options.contentType] - Content type (defaults to application/octet-stream)
   * @param {Object} [options.fileInfo] - File info metadata
   * @returns {Promise<Object>} Start large file response containing fileId
   */
  async startLargeFile(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      bucketId,
      fileName,
      contentType = CONTENT_TYPES.OCTET_STREAM,
      fileInfo,
    } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    this.validateFileName(fileName);

    // Validate optional parameters
    if (contentType !== undefined && typeof contentType !== 'string') {
      throw new Error('contentType must be a string');
    }

    if (
      fileInfo !== undefined &&
      (typeof fileInfo !== 'object' || fileInfo === null)
    ) {
      throw new Error('fileInfo must be an object');
    }

    const requestData = {
      bucketId: bucketId,
      fileName: fileName,
      contentType: contentType,
    };

    // Add file info if provided
    if (fileInfo) {
      requestData.fileInfo = fileInfo;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getStartLargeFileUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 start large file errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_ID) {
          const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.NOT_ALLOWED) {
          const b2Error = new Error(
            `Not allowed to upload to bucket: ${bucketId}`
          );
          b2Error.code = B2_ERROR_CODES.NOT_ALLOWED;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for large file upload`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Get upload URL for a large file part
   * @param {Object} options - Get upload part URL options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @returns {Promise<Object>} Upload part URL response containing uploadUrl and authorizationToken
   */
  async getUploadPartUrl(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId } = options;

    // Validate required parameters
    this.validateFileId(fileId);

    const requestData = {
      fileId: fileId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getUploadPartUrlEndpoint(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 get upload part URL errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`Large file not found: ${fileId}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for upload part URL`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Upload a part of a large file
   * @param {Object} options - Upload part options
   * @param {string} options.uploadUrl - Upload URL from getUploadPartUrl
   * @param {string} options.authorizationToken - Authorization token from getUploadPartUrl
   * @param {number} options.partNumber - Part number (1-based, must be between 1 and 10000)
   * @param {Buffer|Uint8Array|string} options.data - Part data to upload
   * @param {string} [options.contentSha1] - SHA1 hash of part content (will be calculated if not provided)
   * @param {Function} [options.onUploadProgress] - Progress callback function
   * @returns {Promise<Object>} Upload part response
   */
  async uploadPart(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      uploadUrl,
      authorizationToken,
      partNumber,
      data,
      contentSha1,
      onUploadProgress,
    } = options;

    // Validate required parameters
    if (!uploadUrl || typeof uploadUrl !== 'string') {
      throw new Error('uploadUrl is required and must be a string');
    }

    if (!authorizationToken || typeof authorizationToken !== 'string') {
      throw new Error('authorizationToken is required and must be a string');
    }

    if (
      typeof partNumber !== 'number' ||
      partNumber < 1 ||
      partNumber > 10000
    ) {
      throw new Error('partNumber must be a number between 1 and 10000');
    }

    if (!data) {
      throw new Error('data is required');
    }

    // Calculate content length
    let contentLength;
    if (typeof data === 'string') {
      contentLength = new TextEncoder().encode(data).length;
    } else {
      contentLength = data.length;
    }
    const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

    if (contentLength > MAX_PART_SIZE) {
      throw new Error(`Part size cannot exceed ${MAX_PART_SIZE} bytes (5GB)`);
    }

    // Calculate SHA1 if not provided
    let sha1Hash = contentSha1;
    if (!sha1Hash) {
      sha1Hash = await Sha1Hasher.hash(data);
    }

    // Create upload headers for part
    const headers = {
      Authorization: authorizationToken,
      'Content-Type': CONTENT_TYPES.OCTET_STREAM,
      'Content-Length': contentLength.toString(),
      'X-Bz-Content-Sha1': sha1Hash,
      'X-Bz-Part-Number': partNumber.toString(),
    };

    try {
      const response = await this.httpClient.post(uploadUrl, data, {
        headers,
        timeout: this.config.uploadTimeout || this.config.timeout,
        onUploadProgress,
      });

      return response;
    } catch (error) {
      // Handle specific B2 upload part errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(
            `Large file upload failed: ${error.message}`
          );
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
  }

  /**
   * Finish a large file upload
   * @param {Object} options - Finish large file options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @param {Array<string>} options.partSha1Array - Array of SHA1 hashes for each part in order
   * @returns {Promise<Object>} Finish large file response
   */
  async finishLargeFile(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId, partSha1Array } = options;

    // Validate required parameters
    this.validateFileId(fileId);

    if (!Array.isArray(partSha1Array)) {
      throw new Error('partSha1Array is required and must be an array');
    }

    if (partSha1Array.length === 0) {
      throw new Error('partSha1Array cannot be empty');
    }

    if (partSha1Array.length > DEFAULT_CONFIG.MAX_PARTS_COUNT) {
      throw new Error(
        `partSha1Array cannot have more than ${DEFAULT_CONFIG.MAX_PARTS_COUNT} parts`
      );
    }

    // Validate each SHA1 hash
    partSha1Array.forEach((sha1, index) => {
      if (typeof sha1 !== 'string') {
        throw new Error(`partSha1Array[${index}] must be a string`);
      }
      if (sha1.length !== 40) {
        throw new Error(
          `partSha1Array[${index}] must be a 40-character SHA1 hash`
        );
      }
      if (!/^[a-fA-F0-9]{40}$/.test(sha1)) {
        throw new Error(
          `partSha1Array[${index}] must be a valid hexadecimal SHA1 hash`
        );
      }
    });

    const requestData = {
      fileId: fileId,
      partSha1Array: partSha1Array,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getFinishLargeFileUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 finish large file errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`Large file not found: ${fileId}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for finishing large file`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Cancel a large file upload
   * @param {Object} options - Cancel large file options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @returns {Promise<Object>} Cancel large file response
   */
  async cancelLargeFile(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId } = options;

    // Validate required parameters
    this.validateFileId(fileId);

    const requestData = {
      fileId: fileId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getCancelLargeFileUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 cancel large file errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`Large file not found: ${fileId}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for canceling large file`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * List parts of a large file upload
   * @param {Object} options - List parts options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @param {number} [options.startPartNumber] - Part number to start listing from (1-based)
   * @param {number} [options.maxPartCount] - Maximum number of parts to return (default: 100, max: 10000)
   * @returns {Promise<Object>} List parts response
   */
  async listParts(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId, startPartNumber, maxPartCount } = options;

    // Validate required parameters
    this.validateFileId(fileId);

    // Validate optional parameters
    if (startPartNumber !== undefined) {
      if (
        typeof startPartNumber !== 'number' ||
        startPartNumber < 1 ||
        startPartNumber > DEFAULT_CONFIG.MAX_PARTS_COUNT
      ) {
        throw new Error(
          `startPartNumber must be a number between 1 and ${DEFAULT_CONFIG.MAX_PARTS_COUNT}`
        );
      }
    }

    if (maxPartCount !== undefined) {
      if (
        typeof maxPartCount !== 'number' ||
        maxPartCount < 1 ||
        maxPartCount > 10000
      ) {
        throw new Error('maxPartCount must be a number between 1 and 10000');
      }
    }

    const requestData = {
      fileId: fileId,
    };

    // Add optional parameters
    if (startPartNumber !== undefined) {
      requestData.startPartNumber = startPartNumber;
    }
    if (maxPartCount !== undefined) {
      requestData.maxPartCount = maxPartCount;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListPartsUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 list parts errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`Large file not found: ${fileId}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for listing parts`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * List unfinished large file uploads
   * @param {Object} options - List unfinished large files options
   * @param {string} options.bucketId - ID of the bucket to list unfinished files from
   * @param {string} [options.startFileId] - File ID to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of files to return (default: 100, max: 10000)
   * @returns {Promise<Object>} List unfinished large files response
   */
  async listUnfinishedLargeFiles(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { bucketId, startFileId, maxFileCount } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    // Validate optional parameters
    if (maxFileCount !== undefined) {
      if (
        typeof maxFileCount !== 'number' ||
        maxFileCount < 1 ||
        maxFileCount > 10000
      ) {
        throw new Error('maxFileCount must be a number between 1 and 10000');
      }
    }

    if (startFileId !== undefined && typeof startFileId !== 'string') {
      throw new Error('startFileId must be a string');
    }

    const requestData = {
      bucketId: bucketId,
    };

    // Add optional parameters
    if (startFileId !== undefined) {
      requestData.startFileId = startFileId;
    }
    if (maxFileCount !== undefined) {
      requestData.maxFileCount = maxFileCount;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListUnfinishedLargeFilesUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 list errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.INVALID_BUCKET_ID
      ) {
        const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
        b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }
}

/**
 * Key Manager for B2 API
 * Handles application key CRUD operations
 */


class KeyManager {
  constructor(httpClient, authManager, config = {}) {
    this.httpClient = httpClient;
    this.authManager = authManager;
    this.config = config;
    this.endpointBuilder = new EndpointBuilder();
  }

  /**
   * Validate key name according to B2 requirements
   * @param {string} keyName - Key name to validate
   * @throws {Error} If key name is invalid
   */
  validateKeyName(keyName) {
    if (
      keyName === null ||
      keyName === undefined ||
      typeof keyName !== 'string'
    ) {
      throw new Error('keyName is required and must be a string');
    }

    if (keyName.length < 1 || keyName.length > 100) {
      throw new Error('Key name must be between 1 and 100 characters');
    }

    // Key name can contain letters, numbers, and some special characters
    const validPattern = /^[a-zA-Z0-9\-_\.]+$/;
    if (!validPattern.test(keyName)) {
      throw new Error(
        'Key name can only contain letters, numbers, hyphens, underscores, and periods'
      );
    }
  }

  /**
   * Validate key capabilities
   * @param {Array<string>} capabilities - Array of capabilities to validate
   * @throws {Error} If capabilities are invalid
   */
  validateCapabilities(capabilities) {
    if (!Array.isArray(capabilities)) {
      throw new Error('capabilities must be an array');
    }

    if (capabilities.length === 0) {
      throw new Error('At least one capability is required');
    }

    const validCapabilities = Object.values(KEY_CAPABILITIES);
    for (const capability of capabilities) {
      if (typeof capability !== 'string') {
        throw new Error('All capabilities must be strings');
      }
      if (!validCapabilities.includes(capability)) {
        throw new Error(
          `Invalid capability: ${capability}. Must be one of: ${validCapabilities.join(', ')}`
        );
      }
    }

    // Remove duplicates
    const uniqueCapabilities = [...new Set(capabilities)];
    if (uniqueCapabilities.length !== capabilities.length) {
      throw new Error('Duplicate capabilities are not allowed');
    }
  }

  /**
   * Validate key ID
   * @param {string} applicationKeyId - Key ID to validate
   * @throws {Error} If key ID is invalid
   */
  validateKeyId(applicationKeyId) {
    if (
      applicationKeyId === null ||
      applicationKeyId === undefined ||
      typeof applicationKeyId !== 'string'
    ) {
      throw new Error('applicationKeyId is required and must be a string');
    }

    if (applicationKeyId.trim().length === 0) {
      throw new Error('applicationKeyId cannot be empty');
    }
  }

  /**
   * Validate bucket ID (optional parameter for key restrictions)
   * @param {string} bucketId - Bucket ID to validate
   * @throws {Error} If bucket ID is invalid
   */
  validateBucketId(bucketId) {
    if (bucketId !== null && bucketId !== undefined) {
      if (typeof bucketId !== 'string') {
        throw new Error('bucketId must be a string or null');
      }
      if (bucketId.trim().length === 0) {
        throw new Error('bucketId cannot be empty string');
      }
    }
  }

  /**
   * Validate name prefix (optional parameter for key restrictions)
   * @param {string} namePrefix - Name prefix to validate
   * @throws {Error} If name prefix is invalid
   */
  validateNamePrefix(namePrefix) {
    if (namePrefix !== null && namePrefix !== undefined) {
      if (typeof namePrefix !== 'string') {
        throw new Error('namePrefix must be a string or null');
      }
      // Empty string is allowed for namePrefix
    }
  }

  /**
   * Ensure authentication before making requests
   * @throws {Error} If not authenticated
   */
  ensureAuthenticated() {
    if (!this.authManager.isAuthenticated()) {
      throw new Error('Not authenticated. Call authorize() first.');
    }

    // Update endpoint builder with current auth context
    this.endpointBuilder.setAuthContext(this.authManager.getAuthContext());
  }

  /**
   * Create a new application key
   * @param {Object} options - Key creation options
   * @param {string} options.keyName - Name for the new key
   * @param {Array<string>} options.capabilities - Array of capabilities for the key
   * @param {string} [options.bucketId] - Optional bucket ID to restrict key to specific bucket
   * @param {string} [options.namePrefix] - Optional name prefix to restrict key to files with specific prefix
   * @param {number} [options.validDurationInSeconds] - Optional duration in seconds for key validity
   * @returns {Promise<Object>} Key creation response
   */
  async createKey(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      keyName,
      capabilities,
      bucketId,
      namePrefix,
      validDurationInSeconds,
    } = options;

    // Validate required parameters
    this.validateKeyName(keyName);
    this.validateCapabilities(capabilities);

    // Validate optional parameters
    this.validateBucketId(bucketId);
    this.validateNamePrefix(namePrefix);

    if (validDurationInSeconds !== undefined) {
      if (
        typeof validDurationInSeconds !== 'number' ||
        validDurationInSeconds <= 0
      ) {
        throw new Error('validDurationInSeconds must be a positive number');
      }
      if (validDurationInSeconds > 1000 * 24 * 60 * 60) {
        // 1000 days in seconds
        throw new Error('validDurationInSeconds cannot exceed 1000 days');
      }
    }

    const requestData = {
      accountId: this.authManager.getAccountId(),
      keyName: keyName,
      capabilities: capabilities,
    };

    // Add optional parameters if provided
    if (bucketId) {
      requestData.bucketId = bucketId;
    }
    if (namePrefix !== undefined) {
      requestData.namePrefix = namePrefix;
    }
    if (validDurationInSeconds !== undefined) {
      requestData.validDurationInSeconds = validDurationInSeconds;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getCreateKeyUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 key creation errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_ID) {
          const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.NOT_ALLOWED) {
          const b2Error = new Error(
            'Not allowed to create keys with the specified capabilities'
          );
          b2Error.code = B2_ERROR_CODES.NOT_ALLOWED;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
  }

  /**
   * Delete an application key
   * @param {Object|string} options - Key deletion options or key ID (for backward compatibility)
   * @param {string} options.applicationKeyId - ID of the key to delete
   * @returns {Promise<Object>} Key deletion response
   */
  async deleteKey(options) {
    this.ensureAuthenticated();

    // Handle backward compatibility: deleteKey(applicationKeyId)
    let applicationKeyId;
    if (typeof options === 'string') {
      applicationKeyId = options;
    } else if (options && typeof options === 'object') {
      applicationKeyId = options.applicationKeyId;
    } else {
      throw new Error(
        'Invalid arguments. Expected object with applicationKeyId or applicationKeyId as string'
      );
    }

    // Validate inputs
    this.validateKeyId(applicationKeyId);

    const requestData = {
      applicationKeyId: applicationKeyId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getDeleteKeyUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 key deletion errors
      if (error.status === 400) {
        const b2Error = new Error(
          `Invalid application key ID: ${applicationKeyId}`
        );
        b2Error.code = B2_ERROR_CODES.NOT_ALLOWED;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * List application keys
   * @param {Object} [options={}] - List options
   * @param {number} [options.maxKeyCount] - Maximum number of keys to return (default 100, max 10000)
   * @param {string} [options.startApplicationKeyId] - Key ID to start listing from (for pagination)
   * @returns {Promise<Object>} List of keys response
   */
  async listKeys(options = {}) {
    this.ensureAuthenticated();

    if (options && typeof options !== 'object') {
      throw new Error('options must be an object');
    }

    const { maxKeyCount, startApplicationKeyId } = options;

    // Validate optional parameters
    if (maxKeyCount !== undefined) {
      if (
        typeof maxKeyCount !== 'number' ||
        maxKeyCount <= 0 ||
        maxKeyCount > 10000
      ) {
        throw new Error('maxKeyCount must be a number between 1 and 10000');
      }
    }

    if (startApplicationKeyId !== undefined) {
      this.validateKeyId(startApplicationKeyId);
    }

    const requestData = {
      accountId: this.authManager.getAccountId(),
    };

    // Add optional parameters if provided
    if (maxKeyCount !== undefined) {
      requestData.maxKeyCount = maxKeyCount;
    }
    if (startApplicationKeyId !== undefined) {
      requestData.startApplicationKeyId = startApplicationKeyId;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListKeysUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      throw error;
    }
  }
}

/**
 * B2Client - Main client class for Backblaze B2 API
 * Orchestrates all manager classes and provides the public API interface
 */


class B2Client {
  constructor(options = {}) {
    // Validate options
    if (options && typeof options !== 'object') {
      throw new Error('options must be an object');
    }

    // Handle legacy constructor parameters for backward compatibility
    this.accountId = options.accountId || null;
    this.applicationKeyId = options.applicationKeyId || null;
    this.applicationKey = options.applicationKey || null;
    this.apiUrl = options.apiUrl || B2_API_BASE_URL;

    // Legacy properties for backward compatibility
    this.authorizationToken = null;
    this.downloadUrl = null;

    // Store configuration with proper mapping
    this.config = {
      timeout: options.timeout || DEFAULT_CONFIG.REQUEST_TIMEOUT,
      retries: options.retries || DEFAULT_CONFIG.RETRY_ATTEMPTS,
      retryDelay: options.retryDelay || DEFAULT_CONFIG.RETRY_DELAY,
      retryDelayMultiplier: options.retryDelayMultiplier || DEFAULT_CONFIG.RETRY_DELAY_MULTIPLIER,
      maxRetryDelay: options.maxRetryDelay || DEFAULT_CONFIG.MAX_RETRY_DELAY,
      headers: options.headers || {},
      ...options
    };

    // Initialize HTTP client with retry handler
    const retryOptions = {
      retries: this.config.retries,
      retryDelay: this.config.retryDelay,
      retryDelayMultiplier: this.config.retryDelayMultiplier,
      maxRetryDelay: this.config.maxRetryDelay,
    };

    this.retryHandler = new RetryHandler(retryOptions);

    const httpOptions = {
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: this.config.headers,
    };

    this.httpClient = new HttpClient(httpOptions);

    // Initialize managers
    this.authManager = new AuthManager(this.httpClient, this.config);
    this.bucketManager = new BucketManager(
      this.httpClient,
      this.authManager,
      this.config
    );
    this.fileManager = new FileManager(
      this.httpClient,
      this.authManager,
      this.config
    );
    this.keyManager = new KeyManager(
      this.httpClient,
      this.authManager,
      this.config
    );

    // Store credentials for potential re-authentication
    this.credentials = null;

    // Add backward compatibility constants as instance properties
    this.BUCKET_TYPES = BUCKET_TYPES;
    this.KEY_CAPABILITIES = KEY_CAPABILITIES;
  }

  // ===== AUTHENTICATION METHODS =====

  /**
   * Authorize with B2 API using application credentials
   * @param {Object|string} options - Authentication options or applicationKeyId (for backward compatibility)
   * @param {string} options.applicationKeyId - Application key ID
   * @param {string} options.applicationKey - Application key
   * @param {string} [applicationKey] - Application key (for backward compatibility when first param is string)
   * @returns {Promise<Object>} Authentication response
   */
  async authorize(options, applicationKey) {
    // Handle backward compatibility: authorize(applicationKeyId, applicationKey)
    let credentials;
    if (typeof options === 'string') {
      credentials = {
        applicationKeyId: options,
        applicationKey: applicationKey,
      };
    } else if (options && typeof options === 'object') {
      credentials = {
        applicationKeyId: options.applicationKeyId,
        applicationKey: options.applicationKey,
      };
    } else if (!options && this.applicationKeyId && this.applicationKey) {
      // Use instance properties if no arguments provided (legacy behavior)
      credentials = {
        applicationKeyId: this.applicationKeyId,
        applicationKey: this.applicationKey,
      };
    } else {
      throw new Error(
        'Invalid arguments. Expected object with applicationKeyId and applicationKey, or applicationKeyId and applicationKey as separate strings'
      );
    }

    // Store credentials for potential re-authentication
    this.credentials = credentials;

    // Delegate to auth manager with retry handling
    const response = await this.retryHandler.executeWithRetry(async () => {
      return this.authManager.authorize(credentials, {
        timeout: this.config.timeout,
      });
    });

    // Update legacy instance properties for backward compatibility
    if (response && response.data) {
      this.authorizationToken = response.data.authorizationToken;
      this.apiUrl = response.data.apiUrl;
      this.downloadUrl = response.data.downloadUrl;
    }

    return response;
  }

  // ===== BUCKET METHODS =====

  /**
   * Create a new bucket
   * @param {Object|string} options - Bucket creation options or bucket name (for backward compatibility)
   * @param {string} options.bucketName - Name of the bucket to create
   * @param {string} options.bucketType - Type of bucket (allPublic or allPrivate)
   * @param {string} [bucketType] - Bucket type (for backward compatibility when first param is string)
   * @returns {Promise<Object>} Bucket creation response
   */
  async createBucket(options, bucketType) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.create(options, bucketType);
    });
  }

  /**
   * Delete a bucket
   * @param {Object|string} options - Bucket deletion options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to delete
   * @returns {Promise<Object>} Bucket deletion response
   */
  async deleteBucket(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.delete(options);
    });
  }

  /**
   * List buckets
   * @param {Object} [options={}] - List options
   * @returns {Promise<Object>} List of buckets response
   */
  async listBuckets(options = {}) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.list(options);
    });
  }

  /**
   * Get bucket information by name or ID
   * @param {Object} options - Get bucket options
   * @param {string} [options.bucketName] - Name of the bucket to get
   * @param {string} [options.bucketId] - ID of the bucket to get
   * @returns {Promise<Object>} Bucket information response
   */
  async getBucket(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.get(options);
    });
  }

  /**
   * Update bucket type
   * @param {Object|string} options - Bucket update options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to update
   * @param {string} options.bucketType - New bucket type
   * @param {string} [bucketType] - New bucket type (for backward compatibility when first param is string)
   * @returns {Promise<Object>} Bucket update response
   */
  async updateBucket(options, bucketType) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.update(options, bucketType);
    });
  }

  /**
   * Get upload URL for a bucket
   * @param {Object|string} options - Upload URL options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to get upload URL for
   * @returns {Promise<Object>} Upload URL response
   */
  async getUploadUrl(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.getUploadUrl(options);
    });
  }

  // ===== FILE METHODS =====

  /**
   * Upload a file to B2
   * @param {Object} options - Upload options
   * @param {string} options.uploadUrl - Upload URL from getUploadUrl
   * @param {string} options.uploadAuthToken - Upload authorization token
   * @param {string} options.fileName - Name of the file
   * @param {Buffer|Uint8Array|string} options.data - File data to upload
   * @param {string} [options.contentType] - Content type (defaults to application/octet-stream)
   * @param {string} [options.contentSha1] - SHA1 hash of content (will be calculated if not provided)
   * @param {Object} [options.info] - File info metadata
   * @param {Function} [options.onUploadProgress] - Progress callback function
   * @returns {Promise<Object>} Upload response
   */
  async uploadFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.uploadFile(options);
    });
  }

  /**
   * Download a file by name
   * @param {Object|string} options - Download options or bucket name (for backward compatibility)
   * @param {string} options.bucketName - Name of the bucket containing the file
   * @param {string} options.fileName - Name of the file to download
   * @param {string} [options.responseType] - Response type: 'json', 'text', 'arraybuffer', 'blob', 'stream' (default: 'arraybuffer')
   * @param {Function} [options.onDownloadProgress] - Progress callback function
   * @param {Object} [options.headers] - Additional headers for the request
   * @param {string} [fileName] - File name (for backward compatibility when first param is bucket name)
   * @returns {Promise<Object>} Download response with file data
   */
  async downloadFileByName(options, fileName) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.downloadFileByName(options, fileName);
    });
  }

  /**
   * Download a file by ID
   * @param {Object|string} options - Download options or file ID (for backward compatibility)
   * @param {string} options.fileId - ID of the file to download
   * @param {string} [options.responseType] - Response type: 'json', 'text', 'arraybuffer', 'blob', 'stream' (default: 'arraybuffer')
   * @param {Function} [options.onDownloadProgress] - Progress callback function
   * @param {Object} [options.headers] - Additional headers for the request
   * @returns {Promise<Object>} Download response with file data
   */
  async downloadFileById(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.downloadFileById(options);
    });
  }

  /**
   * List file names in a bucket
   * @param {Object} options - List options
   * @param {string} options.bucketId - ID of the bucket to list files from
   * @param {string} [options.startFileName] - File name to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of files to return (default: 100, max: 10000)
   * @param {string} [options.prefix] - Only return file names that start with this prefix
   * @param {string} [options.delimiter] - Delimiter for grouping file names
   * @returns {Promise<Object>} List of file names response
   */
  async listFileNames(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.listFileNames(options);
    });
  }

  /**
   * List file versions in a bucket
   * @param {Object} options - List options
   * @param {string} options.bucketId - ID of the bucket to list file versions from
   * @param {string} [options.startFileName] - File name to start listing from
   * @param {string} [options.startFileId] - File ID to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of file versions to return (default: 100, max: 10000)
   * @param {string} [options.prefix] - Only return file names that start with this prefix
   * @param {string} [options.delimiter] - Delimiter for grouping file names
   * @returns {Promise<Object>} List of file versions response
   */
  async listFileVersions(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.listFileVersions(options);
    });
  }

  /**
   * Get file information
   * @param {Object|string} options - File info options or file ID (for backward compatibility)
   * @param {string} options.fileId - ID of the file to get info for
   * @returns {Promise<Object>} File information response
   */
  async getFileInfo(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.getFileInfo(options);
    });
  }

  /**
   * Delete a file version
   * @param {Object} options - Delete options
   * @param {string} options.fileId - ID of the file to delete
   * @param {string} options.fileName - Name of the file to delete
   * @returns {Promise<Object>} Delete response
   */
  async deleteFileVersion(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.deleteFileVersion(options);
    });
  }

  /**
   * Hide a file (make it invisible in file listings)
   * @param {Object} options - Hide file options
   * @param {string} options.bucketId - ID of the bucket containing the file
   * @param {string} options.fileName - Name of the file to hide
   * @returns {Promise<Object>} Hide file response
   */
  async hideFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.hideFile(options);
    });
  }

  /**
   * Get download authorization for private files
   * @param {Object} options - Download authorization options
   * @param {string} options.bucketId - ID of the bucket containing the files
   * @param {string} options.fileNamePrefix - Prefix of file names to authorize (can be empty string for all files)
   * @param {number} [options.validDurationInSeconds] - How long the authorization is valid (default: 604800 = 7 days, max: 604800)
   * @param {string} [options.b2ContentDisposition] - Content-Disposition header value for downloads
   * @returns {Promise<Object>} Download authorization response
   */
  async getDownloadAuthorization(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.getDownloadAuthorization(options);
    });
  }

  // ===== LARGE FILE METHODS =====

  /**
   * Start a large file upload
   * @param {Object} options - Start large file options
   * @param {string} options.bucketId - ID of the bucket to upload to
   * @param {string} options.fileName - Name of the file to upload
   * @param {string} [options.contentType] - Content type (defaults to application/octet-stream)
   * @param {Object} [options.fileInfo] - File info metadata
   * @returns {Promise<Object>} Start large file response containing fileId
   */
  async startLargeFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.startLargeFile(options);
    });
  }

  /**
   * Get upload URL for a large file part
   * @param {Object} options - Get upload part URL options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @returns {Promise<Object>} Upload part URL response containing uploadUrl and authorizationToken
   */
  async getUploadPartUrl(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.getUploadPartUrl(options);
    });
  }

  /**
   * Upload a part of a large file
   * @param {Object} options - Upload part options
   * @param {string} options.uploadUrl - Upload URL from getUploadPartUrl
   * @param {string} options.authorizationToken - Authorization token from getUploadPartUrl
   * @param {number} options.partNumber - Part number (1-based, must be between 1 and 10000)
   * @param {Buffer|Uint8Array|string} options.data - Part data to upload
   * @param {string} [options.contentSha1] - SHA1 hash of part content (will be calculated if not provided)
   * @param {Function} [options.onUploadProgress] - Progress callback function
   * @returns {Promise<Object>} Upload part response
   */
  async uploadPart(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.uploadPart(options);
    });
  }

  /**
   * Finish a large file upload
   * @param {Object} options - Finish large file options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @param {Array<string>} options.partSha1Array - Array of SHA1 hashes for each part in order
   * @returns {Promise<Object>} Finish large file response
   */
  async finishLargeFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.finishLargeFile(options);
    });
  }

  /**
   * Cancel a large file upload
   * @param {Object} options - Cancel large file options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @returns {Promise<Object>} Cancel large file response
   */
  async cancelLargeFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.cancelLargeFile(options);
    });
  }

  /**
   * List parts of a large file upload
   * @param {Object} options - List parts options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @param {number} [options.startPartNumber] - Part number to start listing from
   * @param {number} [options.maxPartCount] - Maximum number of parts to return (default: 100, max: 10000)
   * @returns {Promise<Object>} List parts response
   */
  async listParts(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.listParts(options);
    });
  }

  /**
   * List unfinished large file uploads
   * @param {Object} options - List unfinished large files options
   * @param {string} options.bucketId - ID of the bucket to list unfinished files from
   * @param {string} [options.startFileId] - File ID to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of files to return (default: 100, max: 10000)
   * @returns {Promise<Object>} List unfinished large files response
   */
  async listUnfinishedLargeFiles(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.listUnfinishedLargeFiles(options);
    });
  }

  // ===== KEY MANAGEMENT METHODS =====

  /**
   * Create a new application key
   * @param {Object} options - Key creation options
   * @param {string} options.keyName - Name for the new key
   * @param {Array<string>} options.capabilities - Array of capabilities for the key
   * @param {string} [options.bucketId] - Optional bucket ID to restrict key to specific bucket
   * @param {string} [options.namePrefix] - Optional name prefix to restrict key to files with specific prefix
   * @param {number} [options.validDurationInSeconds] - Optional duration in seconds for key validity
   * @returns {Promise<Object>} Key creation response
   */
  async createKey(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.keyManager.createKey(options);
    });
  }

  /**
   * Delete an application key
   * @param {Object|string} options - Key deletion options or key ID (for backward compatibility)
   * @param {string} options.applicationKeyId - ID of the key to delete
   * @returns {Promise<Object>} Key deletion response
   */
  async deleteKey(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.keyManager.deleteKey(options);
    });
  }

  /**
   * List application keys
   * @param {Object} [options={}] - List options
   * @param {number} [options.maxKeyCount] - Maximum number of keys to return (default 100, max 10000)
   * @param {string} [options.startApplicationKeyId] - Key ID to start listing from (for pagination)
   * @returns {Promise<Object>} List of keys response
   */
  async listKeys(options = {}) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.keyManager.listKeys(options);
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Check if currently authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.authManager.isAuthenticated();
  }

  /**
   * Get current authentication context
   * @returns {Object} Current auth context
   */
  getAuthContext() {
    return this.authManager.getAuthContext();
  }

  /**
   * Clear authentication context
   */
  clearAuth() {
    this.authManager.clearAuthContext();
    this.credentials = null;

    // Clear legacy instance properties
    this.authorizationToken = null;
    this.apiUrl = null;
    this.downloadUrl = null;
  }

  /**
   * Refresh authentication using stored credentials
   * @returns {Promise<Object>} New authentication response
   * @throws {Error} If no credentials are stored
   */
  async refreshAuth() {
    if (!this.credentials) {
      throw new Error('No credentials stored. Call authorize() first.');
    }

    return this.authorize(this.credentials);
  }

  /**
   * Manually set authentication context from B2 API response
   * @param {Object} authResponse - Authentication response from B2 API
   * @param {string} authResponse.authorizationToken - Authorization token
   * @param {string} authResponse.apiUrl - API URL for requests
   * @param {string} authResponse.downloadUrl - Download URL for files
   * @param {string} authResponse.accountId - Account ID
   * @param {number} [authResponse.recommendedPartSize] - Recommended part size for large files
   * @param {number} [authResponse.absoluteMinimumPartSize] - Minimum part size for large files
   * @param {Object} [authResponse.allowed] - Allowed capabilities and restrictions
   */
  saveAuthContext(authResponse) {
    // Delegate to auth manager
    this.authManager.saveAuthContext(authResponse);

    // Update legacy instance properties for backward compatibility
    if (authResponse && typeof authResponse === 'object') {
      this.authorizationToken = authResponse.authorizationToken || null;
      this.apiUrl = authResponse.apiUrl || null;
      this.downloadUrl = authResponse.downloadUrl || null;
    }
  }
}

/**
 * Comprehensive error handling system for B2 API
 * Provides error classification, formatting, and B2-specific error handling
 */


/**
 * B2Error class extending Error with additional B2-specific properties
 */
class B2Error extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'B2Error';
    this.status = options.status;
    this.statusText = options.statusText;
    this.code = options.code;
    this.response = options.response;
    this.request = options.request;
    this.isRetryable = options.isRetryable ?? false;
    this.isNetworkError = options.isNetworkError ?? false;
    this.isHttpError = options.isHttpError ?? false;
    this.retryAttempts = options.retryAttempts ?? 0;
    this.isRetryExhausted = options.isRetryExhausted ?? false;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, B2Error);
    }
  }

  /**
   * Convert error to JSON representation
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      code: this.code,
      isRetryable: this.isRetryable,
      isNetworkError: this.isNetworkError,
      isHttpError: this.isHttpError,
      retryAttempts: this.retryAttempts,
      isRetryExhausted: this.isRetryExhausted,
      stack: this.stack,
    };
  }

  /**
   * Get a human-readable description of the error
   * @returns {string} Error description
   */
  getDescription() {
    if (this.isNetworkError) {
      return `Network error: ${this.message}`;
    }

    if (this.status) {
      const statusInfo = this.statusText ? ` ${this.statusText}` : '';
      const codeInfo = this.code ? ` (${this.code})` : '';
      return `HTTP ${this.status}${statusInfo}${codeInfo}: ${this.message}`;
    }

    return this.message;
  }
}

/**
 * Error Handler class for processing and classifying errors
 */
class ErrorHandler {
  constructor(options = {}) {
    this.debug = options.debug ?? false;
    this.logger = options.logger || console;
  }

  /**
   * Determine if an error is retryable based on status code and error code
   * @param {Error} error - Error to check
   * @returns {boolean} Whether the error is retryable
   */
  isRetryable(error) {
    // Network errors are generally retryable
    if (error.isNetworkError) {
      return true;
    }

    // Check HTTP status codes
    if (error.status && RETRYABLE_STATUS_CODES.has(error.status)) {
      return true;
    }

    // Check B2-specific error codes
    if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) {
      return true;
    }

    // Server errors (5xx) are generally retryable
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    return false;
  }

  /**
   * Classify error type based on status code and error properties
   * @param {Error} error - Error to classify
   * @returns {string} Error classification
   */
  classifyError(error) {
    if (error.isNetworkError) {
      return 'NETWORK_ERROR';
    }

    if (!error.status) {
      return 'UNKNOWN_ERROR';
    }

    if (error.status === HTTP_STATUS.UNAUTHORIZED) {
      return 'AUTHENTICATION_ERROR';
    }

    if (error.status === HTTP_STATUS.FORBIDDEN) {
      return 'AUTHORIZATION_ERROR';
    }

    if (error.status === HTTP_STATUS.NOT_FOUND) {
      return 'NOT_FOUND_ERROR';
    }

    if (error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      return 'RATE_LIMIT_ERROR';
    }

    if (error.status === HTTP_STATUS.REQUEST_TIMEOUT) {
      return 'TIMEOUT_ERROR';
    }

    if (error.status >= 400 && error.status < 500) {
      return 'CLIENT_ERROR';
    }

    if (error.status >= 500 && error.status < 600) {
      return 'SERVER_ERROR';
    }

    return 'HTTP_ERROR';
  }

  /**
   * Parse B2 API error response
   * @param {Object} response - HTTP response object
   * @param {any} data - Response data
   * @returns {Object} Parsed error information
   */
  parseB2ErrorResponse(response, data) {
    let errorCode = null;
    let errorMessage = null;

    // Try to extract B2-specific error information
    if (data && typeof data === 'object') {
      errorCode = data.code || data.error_code || null;
      errorMessage = data.message || data.error_message || data.error || null;
    }

    // Fallback to HTTP status information
    if (!errorMessage) {
      errorMessage = response.statusText || `HTTP ${response.status}`;
    }

    return {
      code: errorCode,
      message: errorMessage,
      status: response.status,
      statusText: response.statusText,
    };
  }

  /**
   * Create B2Error from HTTP response
   * @param {Object} response - HTTP response object
   * @param {any} data - Response data
   * @param {Object} request - Original request information
   * @returns {B2Error} Formatted B2Error
   */
  createHttpError(response, data, request = null) {
    const errorInfo = this.parseB2ErrorResponse(response, data);
    const isRetryable = this.isRetryable({
      status: errorInfo.status,
      code: errorInfo.code,
    });

    const error = new B2Error(errorInfo.message, {
      status: errorInfo.status,
      statusText: errorInfo.statusText,
      code: errorInfo.code,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: data,
      },
      request: request,
      isRetryable: isRetryable,
      isHttpError: true,
    });

    if (this.debug) {
      this.logger.error('HTTP Error:', error.toJSON());
    }

    return error;
  }

  /**
   * Create B2Error from network error
   * @param {Error} originalError - Original network error
   * @param {Object} request - Original request information
   * @returns {B2Error} Formatted B2Error
   */
  createNetworkError(originalError, request = null) {
    let message = 'Network error occurred';
    let code = 'NETWORK_ERROR';

    if (originalError.name === 'AbortError') {
      message = 'Request timeout';
      code = 'TIMEOUT';
    } else if (originalError.message) {
      message = `Network error: ${originalError.message}`;
    }

    const error = new B2Error(message, {
      code: code,
      request: request,
      isRetryable: true,
      isNetworkError: true,
    });

    // Add originalError as a separate property
    error.originalError = originalError;

    if (this.debug) {
      this.logger.error('Network Error:', error.toJSON());
    }

    return error;
  }

  /**
   * Create B2Error from authentication failure
   * @param {string} message - Error message
   * @param {Object} response - HTTP response (optional)
   * @returns {B2Error} Formatted B2Error
   */
  createAuthError(message, response = null) {
    const error = new B2Error(message, {
      status: HTTP_STATUS.UNAUTHORIZED,
      statusText: 'Unauthorized',
      code: B2_ERROR_CODES.BAD_AUTH_TOKEN,
      response: response,
      isRetryable: false,
      isHttpError: true,
    });

    if (this.debug) {
      this.logger.error('Authentication Error:', error.toJSON());
    }

    return error;
  }

  /**
   * Create B2Error from validation failure
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation (optional)
   * @returns {B2Error} Formatted B2Error
   */
  createValidationError(message, field = null) {
    const fullMessage = field
      ? `Validation error for ${field}: ${message}`
      : `Validation error: ${message}`;

    const error = new B2Error(fullMessage, {
      status: HTTP_STATUS.BAD_REQUEST,
      statusText: 'Bad Request',
      code: 'VALIDATION_ERROR',
      isRetryable: false,
      isHttpError: false,
    });

    // Add field as a separate property
    if (field) {
      error.field = field;
    }

    if (this.debug) {
      this.logger.error('Validation Error:', error.toJSON());
    }

    return error;
  }

  /**
   * Enhance existing error with additional context
   * @param {Error} error - Original error
   * @param {Object} context - Additional context
   * @returns {B2Error} Enhanced error
   */
  enhanceError(error, context = {}) {
    if (error instanceof B2Error) {
      // Update existing B2Error with additional context
      Object.assign(error, context);
      return error;
    }

    // Convert regular Error to B2Error
    const b2Error = new B2Error(error.message, {
      ...context,
      stack: error.stack,
    });

    // Add originalError as a separate property
    b2Error.originalError = error;

    return b2Error;
  }

  /**
   * Format error for logging or display
   * @param {Error} error - Error to format
   * @param {boolean} includeStack - Whether to include stack trace
   * @returns {Object} Formatted error information
   */
  formatError(error, includeStack = false) {
    const formatted = {
      type: this.classifyError(error),
      message: error.message,
      description:
        error instanceof B2Error ? error.getDescription() : error.message,
    };

    if (error.status) {
      formatted.status = error.status;
      formatted.statusText = error.statusText;
    }

    if (error.code) {
      formatted.code = error.code;
    }

    if (error.isRetryable !== undefined) {
      formatted.isRetryable = error.isRetryable;
    }

    if (error.retryAttempts !== undefined) {
      formatted.retryAttempts = error.retryAttempts;
    }

    if (includeStack && error.stack) {
      formatted.stack = error.stack;
    }

    return formatted;
  }

  /**
   * Log error with appropriate level based on error type
   * @param {Error} error - Error to log
   * @param {Object} context - Additional context for logging
   */
  logError(error, context = {}) {
    if (!this.debug) {
      return;
    }

    const formatted = this.formatError(error, true);
    const logContext = { ...formatted, ...context };

    if (error.isNetworkError || (error.status && error.status >= 500)) {
      this.logger.error('B2 Error:', logContext);
    } else if (error.status && error.status >= 400) {
      this.logger.warn('B2 Client Error:', logContext);
    } else {
      this.logger.info('B2 Info:', logContext);
    }
  }

  /**
   * Check if error indicates expired authentication
   * @param {Error} error - Error to check
   * @returns {boolean} Whether error indicates expired auth
   */
  isAuthExpired(error) {
    return (
      error.status === HTTP_STATUS.UNAUTHORIZED ||
      error.code === B2_ERROR_CODES.EXPIRED_AUTH_TOKEN ||
      error.code === B2_ERROR_CODES.BAD_AUTH_TOKEN
    );
  }

  /**
   * Check if error indicates rate limiting
   * @param {Error} error - Error to check
   * @returns {boolean} Whether error indicates rate limiting
   */
  isRateLimited(error) {
    return (
      error.status === HTTP_STATUS.TOO_MANY_REQUESTS ||
      error.code === B2_ERROR_CODES.TOO_MANY_REQUESTS
    );
  }

  /**
   * Get suggested retry delay for rate limited requests
   * @param {Error} error - Rate limit error
   * @returns {number} Suggested delay in milliseconds
   */
  getRateLimitDelay(error) {
    // Check for Retry-After header
    if (error.response && error.response.headers) {
      const retryAfter = error.response.headers.get('Retry-After');
      if (retryAfter) {
        const delay = parseInt(retryAfter, 10);
        if (!isNaN(delay)) {
          return delay * 1000; // Convert seconds to milliseconds
        }
      }
    }

    // Default rate limit delay
    return 60000; // 1 minute
  }
}

/**
 * Main entry point for the Backblaze B2 Node.js Library
 * Provides ES module exports with CommonJS compatibility
 * Optimized for tree-shaking - only import what you need
 */

export { AuthHeaders, AuthManager, B2Client, B2Error, BUCKET_TYPES, BucketManager, EndpointBuilder, ErrorHandler, FileManager, HeaderUtils, HttpClient, KEY_CAPABILITIES, KeyManager, ProgressHandler, RetryHandler, Sha1Hasher, Validator, B2Client as default };
//# sourceMappingURL=index.js.map
