/**
 * Retry Handler with exponential backoff
 * Provides configurable retry logic for HTTP requests
 */

import {
  DEFAULT_CONFIG,
  RETRYABLE_STATUS_CODES,
  RETRYABLE_ERROR_CODES,
  HTTP_STATUS,
} from '../constants.js';

export class RetryHandler {
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

export default RetryHandler;
