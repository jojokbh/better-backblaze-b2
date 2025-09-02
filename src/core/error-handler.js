/**
 * Comprehensive error handling system for B2 API
 * Provides error classification, formatting, and B2-specific error handling
 */

import {
  HTTP_STATUS,
  B2_ERROR_CODES,
  RETRYABLE_STATUS_CODES,
  RETRYABLE_ERROR_CODES,
} from '../constants.js';

/**
 * B2Error class extending Error with additional B2-specific properties
 */
export class B2Error extends Error {
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
export class ErrorHandler {
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

export default ErrorHandler;
