import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryHandler } from '../../../src/core/retry-handler.js';
import { HTTP_STATUS, RETRYABLE_STATUS_CODES, RETRYABLE_ERROR_CODES } from '../../../src/constants.js';

describe('RetryHandler', () => {
  let retryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler({
      retries: 3,
      retryDelay: 100,
      retryDelayMultiplier: 2,
      maxRetryDelay: 1000
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const handler = new RetryHandler();
      expect(handler.retries).toBe(3); // DEFAULT_CONFIG.RETRY_ATTEMPTS
      expect(handler.retryDelay).toBe(1000); // DEFAULT_CONFIG.RETRY_DELAY
      expect(handler.retryDelayMultiplier).toBe(2);
      expect(handler.maxRetryDelay).toBe(30000);
    });

    it('should initialize with custom options', () => {
      const customRetryCondition = () => true;
      const customOnRetry = () => {};
      
      const handler = new RetryHandler({
        retries: 5,
        retryDelay: 500,
        retryDelayMultiplier: 3,
        maxRetryDelay: 5000,
        retryCondition: customRetryCondition,
        onRetry: customOnRetry
      });

      expect(handler.retries).toBe(5);
      expect(handler.retryDelay).toBe(500);
      expect(handler.retryDelayMultiplier).toBe(3);
      expect(handler.maxRetryDelay).toBe(5000);
      expect(handler.retryCondition).toBe(customRetryCondition);
      expect(handler.onRetry).toBe(customOnRetry);
    });
  });

  describe('defaultRetryCondition', () => {
    it('should not retry when max attempts exceeded', () => {
      const error = new Error('Test error');
      expect(retryHandler.defaultRetryCondition(error, 3)).toBe(false);
      expect(retryHandler.defaultRetryCondition(error, 4)).toBe(false);
    });

    it('should retry network errors', () => {
      const networkError = new Error('Network error');
      networkError.isNetworkError = true;
      
      expect(retryHandler.defaultRetryCondition(networkError, 0)).toBe(true);
      expect(retryHandler.defaultRetryCondition(networkError, 1)).toBe(true);
      expect(retryHandler.defaultRetryCondition(networkError, 2)).toBe(true);
    });

    it('should retry retryable HTTP status codes', () => {
      const retryableStatuses = [429, 500, 502, 503, 504];
      
      retryableStatuses.forEach(status => {
        const error = new Error('HTTP error');
        error.status = status;
        expect(retryHandler.defaultRetryCondition(error, 0)).toBe(true);
      });
    });

    it('should not retry non-retryable HTTP status codes', () => {
      const nonRetryableStatuses = [400, 401, 403, 404, 409];
      
      nonRetryableStatuses.forEach(status => {
        const error = new Error('HTTP error');
        error.status = status;
        expect(retryHandler.defaultRetryCondition(error, 0)).toBe(false);
      });
    });

    it('should retry retryable B2 error codes', () => {
      const retryableError = new Error('B2 error');
      retryableError.code = 'too_many_requests';
      
      expect(retryHandler.defaultRetryCondition(retryableError, 0)).toBe(true);
    });

    it('should retry server errors (5xx)', () => {
      const serverError = new Error('Server error');
      serverError.status = 500;
      
      expect(retryHandler.defaultRetryCondition(serverError, 0)).toBe(true);
    });

    it('should not retry client errors (4xx except 429)', () => {
      const clientError = new Error('Client error');
      clientError.status = 400;
      
      expect(retryHandler.defaultRetryCondition(clientError, 0)).toBe(false);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff delay', () => {
      // Attempt 0: 100ms base delay
      const delay0 = retryHandler.calculateDelay(0);
      expect(delay0).toBeGreaterThanOrEqual(75); // 100 - 25% jitter
      expect(delay0).toBeLessThanOrEqual(125); // 100 + 25% jitter

      // Attempt 1: 100 * 2^1 = 200ms
      const delay1 = retryHandler.calculateDelay(1);
      expect(delay1).toBeGreaterThanOrEqual(150); // 200 - 25% jitter
      expect(delay1).toBeLessThanOrEqual(250); // 200 + 25% jitter

      // Attempt 2: 100 * 2^2 = 400ms
      const delay2 = retryHandler.calculateDelay(2);
      expect(delay2).toBeGreaterThanOrEqual(300); // 400 - 25% jitter
      expect(delay2).toBeLessThanOrEqual(500); // 400 + 25% jitter
    });

    it('should respect maximum delay limit', () => {
      const handler = new RetryHandler({
        retryDelay: 100,
        retryDelayMultiplier: 10,
        maxRetryDelay: 500
      });

      // This would normally be 100 * 10^5 = 10,000,000ms, but should be capped at 500ms
      const delay = handler.calculateDelay(5);
      expect(delay).toBeLessThanOrEqual(625); // 500 + 25% jitter
    });

    it('should never return negative delay', () => {
      // Test with extreme jitter that could theoretically go negative
      for (let i = 0; i < 100; i++) {
        const delay = retryHandler.calculateDelay(0);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await retryHandler.executeWithRetry(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and eventually succeed', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Network error'), { isNetworkError: true }))
        .mockRejectedValueOnce(Object.assign(new Error('Server error'), { status: 500 }))
        .mockResolvedValue('success');

      const promise = retryHandler.executeWithRetry(mockFn);
      
      // Fast-forward through the delays
      await vi.runAllTimersAsync();
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Client error');
      nonRetryableError.status = 400;
      
      const mockFn = vi.fn().mockRejectedValue(nonRetryableError);
      
      await expect(retryHandler.executeWithRetry(mockFn)).rejects.toThrow('Client error');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw last error', async () => {
      const retryableError = new Error('Network error');
      retryableError.isNetworkError = true;
      
      const mockFn = vi.fn().mockRejectedValue(retryableError);
      
      const promise = retryHandler.executeWithRetry(mockFn);
      
      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow('Network error');
      expect(mockFn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      
      try {
        await promise;
      } catch (error) {
        expect(error.retryAttempts).toBe(4);
        expect(error.isRetryExhausted).toBe(true);
      }
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const handler = new RetryHandler({
        retries: 2,
        retryDelay: 100,
        onRetry
      });

      const retryableError = new Error('Network error');
      retryableError.isNetworkError = true;
      
      const mockFn = vi.fn().mockRejectedValue(retryableError);
      
      const promise = handler.executeWithRetry(mockFn);
      
      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow();
      
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, retryableError, 1, expect.any(Number));
      expect(onRetry).toHaveBeenNthCalledWith(2, retryableError, 2, expect.any(Number));
    });

    it('should respect custom retry options', async () => {
      const retryableError = new Error('Network error');
      retryableError.isNetworkError = true;
      
      const mockFn = vi.fn().mockRejectedValue(retryableError);
      
      const promise = retryHandler.executeWithRetry(mockFn, { retries: 1 });
      
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    });
  });

  describe('wrap', () => {
    it('should create a wrapped function with retry logic', async () => {
      const originalFn = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Network error'), { isNetworkError: true }))
        .mockResolvedValue('success');

      const wrappedFn = retryHandler.wrap(originalFn);
      
      const promise = wrappedFn('arg1', 'arg2');
      
      await vi.runAllTimersAsync();
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('isRetryable', () => {
    it('should check if error is retryable', () => {
      const retryableError = new Error('Network error');
      retryableError.isNetworkError = true;
      
      const nonRetryableError = new Error('Client error');
      nonRetryableError.status = 400;
      
      expect(retryHandler.isRetryable(retryableError)).toBe(true);
      expect(retryHandler.isRetryable(nonRetryableError)).toBe(false);
    });
  });

  describe('getConfig and updateConfig', () => {
    it('should get current configuration', () => {
      const config = retryHandler.getConfig();
      
      expect(config).toEqual({
        retries: 3,
        retryDelay: 100,
        retryDelayMultiplier: 2,
        maxRetryDelay: 1000
      });
    });

    it('should update configuration', () => {
      retryHandler.updateConfig({
        retries: 5,
        retryDelay: 200
      });
      
      expect(retryHandler.retries).toBe(5);
      expect(retryHandler.retryDelay).toBe(200);
      expect(retryHandler.retryDelayMultiplier).toBe(2); // unchanged
      expect(retryHandler.maxRetryDelay).toBe(1000); // unchanged
    });

    it('should update retry condition and onRetry callback', () => {
      const newRetryCondition = vi.fn().mockReturnValue(false);
      const newOnRetry = vi.fn();
      
      retryHandler.updateConfig({
        retryCondition: newRetryCondition,
        onRetry: newOnRetry
      });
      
      expect(retryHandler.retryCondition).toBe(newRetryCondition);
      expect(retryHandler.onRetry).toBe(newOnRetry);
    });
  });

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const sleepPromise = retryHandler.sleep(1000);
      
      // Advance time by 500ms - should not resolve yet
      vi.advanceTimersByTime(500);
      let resolved = false;
      sleepPromise.then(() => { resolved = true; });
      await Promise.resolve(); // Let microtasks run
      expect(resolved).toBe(false);
      
      // Advance time by another 500ms - should resolve now
      vi.advanceTimersByTime(500);
      await sleepPromise;
      expect(resolved).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero retries', async () => {
      const handler = new RetryHandler({ retries: 0 });
      const error = new Error('Network error');
      error.isNetworkError = true;
      
      const mockFn = vi.fn().mockRejectedValue(error);
      
      await expect(handler.executeWithRetry(mockFn)).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle zero delay', async () => {
      const handler = new RetryHandler({ 
        retries: 1, 
        retryDelay: 0 
      });
      
      const error = new Error('Network error');
      error.isNetworkError = true;
      
      const mockFn = vi.fn().mockRejectedValue(error);
      
      await expect(handler.executeWithRetry(mockFn)).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle custom retry condition that always returns false', async () => {
      const handler = new RetryHandler({
        retries: 3,
        retryCondition: () => false
      });
      
      const error = new Error('Any error');
      const mockFn = vi.fn().mockRejectedValue(error);
      
      await expect(handler.executeWithRetry(mockFn)).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});