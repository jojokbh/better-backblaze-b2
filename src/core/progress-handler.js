/**
 * Progress Handler for tracking upload and download progress
 * Provides progress callbacks for file operations using fetch streams
 */

export class ProgressHandler {
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
    let lastProgressEvent = null;

    return (progressEvent) => {
      const now = Date.now();

      // Always call on first event or completion (100% progress)
      if (
        lastCallTime === 0 ||
        progressEvent.progress >= 1 ||
        now - lastCallTime >= throttleMs
      ) {
        lastCallTime = now;
        lastProgressEvent = progressEvent;
        callback(progressEvent);
      } else {
        // Store the latest event for potential final call
        lastProgressEvent = progressEvent;
      }
    };
  }
}

export default ProgressHandler;
