import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { B2Error, ErrorHandler } from '../../../src/core/error-handler.js';
import { HTTP_STATUS, B2_ERROR_CODES } from '../../../src/constants.js';

describe('B2Error', () => {
  describe('constructor', () => {
    it('should create B2Error with basic message', () => {
      const error = new B2Error('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(B2Error);
      expect(error.name).toBe('B2Error');
      expect(error.message).toBe('Test error');
      expect(error.status).toBeUndefined();
      expect(error.code).toBeUndefined();
      expect(error.isRetryable).toBe(false);
      expect(error.isNetworkError).toBe(false);
      expect(error.isHttpError).toBe(false);
    });

    it('should create B2Error with all options', () => {
      const response = { status: 400, data: { error: 'Bad request' } };
      const request = { url: '/test', method: 'GET' };
      
      const error = new B2Error('Test error', {
        status: 400,
        statusText: 'Bad Request',
        code: 'bad_request',
        response: response,
        request: request,
        isRetryable: true,
        isNetworkError: false,
        isHttpError: true,
        retryAttempts: 2,
        isRetryExhausted: true
      });

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.statusText).toBe('Bad Request');
      expect(error.code).toBe('bad_request');
      expect(error.response).toBe(response);
      expect(error.request).toBe(request);
      expect(error.isRetryable).toBe(true);
      expect(error.isNetworkError).toBe(false);
      expect(error.isHttpError).toBe(true);
      expect(error.retryAttempts).toBe(2);
      expect(error.isRetryExhausted).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new B2Error('Test error', {
        status: 500,
        statusText: 'Internal Server Error',
        code: 'server_error',
        isRetryable: true,
        isHttpError: true
      });

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'B2Error',
        message: 'Test error',
        status: 500,
        statusText: 'Internal Server Error',
        code: 'server_error',
        isRetryable: true,
        isNetworkError: false,
        isHttpError: true,
        retryAttempts: 0,
        isRetryExhausted: false,
        stack: expect.any(String)
      });
    });
  });

  describe('getDescription', () => {
    it('should return network error description', () => {
      const error = new B2Error('Connection failed', {
        isNetworkError: true
      });

      expect(error.getDescription()).toBe('Network error: Connection failed');
    });

    it('should return HTTP error description with status and code', () => {
      const error = new B2Error('Bad request', {
        status: 400,
        statusText: 'Bad Request',
        code: 'invalid_input'
      });

      expect(error.getDescription()).toBe('HTTP 400 Bad Request (invalid_input): Bad request');
    });

    it('should return HTTP error description without status text', () => {
      const error = new B2Error('Server error', {
        status: 500,
        code: 'internal_error'
      });

      expect(error.getDescription()).toBe('HTTP 500 (internal_error): Server error');
    });

    it('should return HTTP error description without code', () => {
      const error = new B2Error('Not found', {
        status: 404,
        statusText: 'Not Found'
      });

      expect(error.getDescription()).toBe('HTTP 404 Not Found: Not found');
    });

    it('should return basic message for non-HTTP errors', () => {
      const error = new B2Error('Generic error');

      expect(error.getDescription()).toBe('Generic error');
    });
  });
});

describe('ErrorHandler', () => {
  let errorHandler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    };
    
    errorHandler = new ErrorHandler({
      debug: true,
      logger: mockLogger
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const handler = new ErrorHandler();
      expect(handler.debug).toBe(false);
      expect(handler.logger).toBe(console);
    });

    it('should initialize with custom options', () => {
      const handler = new ErrorHandler({
        debug: true,
        logger: mockLogger
      });
      expect(handler.debug).toBe(true);
      expect(handler.logger).toBe(mockLogger);
    });
  });

  describe('isRetryable', () => {
    it('should return true for network errors', () => {
      const error = { isNetworkError: true };
      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    it('should return true for retryable status codes', () => {
      const retryableStatuses = [429, 500, 502, 503, 504];
      
      retryableStatuses.forEach(status => {
        const error = { status };
        expect(errorHandler.isRetryable(error)).toBe(true);
      });
    });

    it('should return true for retryable B2 error codes', () => {
      const error = { code: 'too_many_requests' };
      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    it('should return true for server errors (5xx)', () => {
      const error = { status: 500 };
      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    it('should return false for client errors (4xx except 429)', () => {
      const clientStatuses = [400, 401, 403, 404, 409];
      
      clientStatuses.forEach(status => {
        const error = { status };
        expect(errorHandler.isRetryable(error)).toBe(false);
      });
    });

    it('should return false for non-retryable errors', () => {
      const error = { status: 200 };
      expect(errorHandler.isRetryable(error)).toBe(false);
    });
  });

  describe('classifyError', () => {
    it('should classify network errors', () => {
      const error = { isNetworkError: true };
      expect(errorHandler.classifyError(error)).toBe('NETWORK_ERROR');
    });

    it('should classify authentication errors', () => {
      const error = { status: HTTP_STATUS.UNAUTHORIZED };
      expect(errorHandler.classifyError(error)).toBe('AUTHENTICATION_ERROR');
    });

    it('should classify authorization errors', () => {
      const error = { status: HTTP_STATUS.FORBIDDEN };
      expect(errorHandler.classifyError(error)).toBe('AUTHORIZATION_ERROR');
    });

    it('should classify not found errors', () => {
      const error = { status: HTTP_STATUS.NOT_FOUND };
      expect(errorHandler.classifyError(error)).toBe('NOT_FOUND_ERROR');
    });

    it('should classify rate limit errors', () => {
      const error = { status: HTTP_STATUS.TOO_MANY_REQUESTS };
      expect(errorHandler.classifyError(error)).toBe('RATE_LIMIT_ERROR');
    });

    it('should classify timeout errors', () => {
      const error = { status: HTTP_STATUS.REQUEST_TIMEOUT };
      expect(errorHandler.classifyError(error)).toBe('TIMEOUT_ERROR');
    });

    it('should classify client errors', () => {
      const error = { status: 400 };
      expect(errorHandler.classifyError(error)).toBe('CLIENT_ERROR');
    });

    it('should classify server errors', () => {
      const error = { status: 500 };
      expect(errorHandler.classifyError(error)).toBe('SERVER_ERROR');
    });

    it('should classify unknown errors', () => {
      const error = {};
      expect(errorHandler.classifyError(error)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('parseB2ErrorResponse', () => {
    it('should parse B2 error response with code and message', () => {
      const response = { status: 400, statusText: 'Bad Request' };
      const data = { code: 'invalid_bucket_name', message: 'Bucket name is invalid' };

      const result = errorHandler.parseB2ErrorResponse(response, data);

      expect(result).toEqual({
        code: 'invalid_bucket_name',
        message: 'Bucket name is invalid',
        status: 400,
        statusText: 'Bad Request'
      });
    });

    it('should parse B2 error response with alternative field names', () => {
      const response = { status: 401, statusText: 'Unauthorized' };
      const data = { error_code: 'bad_auth_token', error_message: 'Invalid auth token' };

      const result = errorHandler.parseB2ErrorResponse(response, data);

      expect(result).toEqual({
        code: 'bad_auth_token',
        message: 'Invalid auth token',
        status: 401,
        statusText: 'Unauthorized'
      });
    });

    it('should fallback to HTTP status when no error message', () => {
      const response = { status: 500, statusText: 'Internal Server Error' };
      const data = {};

      const result = errorHandler.parseB2ErrorResponse(response, data);

      expect(result).toEqual({
        code: null,
        message: 'Internal Server Error',
        status: 500,
        statusText: 'Internal Server Error'
      });
    });

    it('should handle non-object response data', () => {
      const response = { status: 404, statusText: 'Not Found' };
      const data = 'Not found';

      const result = errorHandler.parseB2ErrorResponse(response, data);

      expect(result).toEqual({
        code: null,
        message: 'Not Found',
        status: 404,
        statusText: 'Not Found'
      });
    });
  });

  describe('createHttpError', () => {
    it('should create B2Error from HTTP response', () => {
      const response = {
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' })
      };
      const data = { code: 'invalid_input', message: 'Invalid input provided' };
      const request = { url: '/test', method: 'POST' };

      const error = errorHandler.createHttpError(response, data, request);

      expect(error).toBeInstanceOf(B2Error);
      expect(error.message).toBe('Invalid input provided');
      expect(error.status).toBe(400);
      expect(error.statusText).toBe('Bad Request');
      expect(error.code).toBe('invalid_input');
      expect(error.isHttpError).toBe(true);
      expect(error.isRetryable).toBe(false);
      expect(error.request).toBe(request);
      expect(mockLogger.error).toHaveBeenCalledWith('HTTP Error:', expect.any(Object));
    });

    it('should create retryable error for server errors', () => {
      const response = { status: 500, statusText: 'Internal Server Error', headers: new Headers() };
      const data = { message: 'Server error' };

      const error = errorHandler.createHttpError(response, data);

      expect(error.isRetryable).toBe(true);
    });
  });

  describe('createNetworkError', () => {
    it('should create B2Error from network error', () => {
      const originalError = new Error('Connection refused');
      const request = { url: '/test', method: 'GET' };

      const error = errorHandler.createNetworkError(originalError, request);

      expect(error).toBeInstanceOf(B2Error);
      expect(error.message).toBe('Network error: Connection refused');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.isNetworkError).toBe(true);
      expect(error.isRetryable).toBe(true);
      expect(error.request).toBe(request);
      expect(error.originalError).toBe(originalError);
      expect(mockLogger.error).toHaveBeenCalledWith('Network Error:', expect.any(Object));
    });

    it('should handle AbortError as timeout', () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      const error = errorHandler.createNetworkError(abortError);

      expect(error.message).toBe('Request timeout');
      expect(error.code).toBe('TIMEOUT');
    });
  });

  describe('createAuthError', () => {
    it('should create authentication error', () => {
      const response = { status: 401, data: { error: 'Invalid token' } };

      const error = errorHandler.createAuthError('Authentication failed', response);

      expect(error).toBeInstanceOf(B2Error);
      expect(error.message).toBe('Authentication failed');
      expect(error.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(error.code).toBe(B2_ERROR_CODES.BAD_AUTH_TOKEN);
      expect(error.isRetryable).toBe(false);
      expect(error.isHttpError).toBe(true);
      expect(error.response).toBe(response);
      expect(mockLogger.error).toHaveBeenCalledWith('Authentication Error:', expect.any(Object));
    });
  });

  describe('createValidationError', () => {
    it('should create validation error without field', () => {
      const error = errorHandler.createValidationError('Invalid input');

      expect(error).toBeInstanceOf(B2Error);
      expect(error.message).toBe('Validation error: Invalid input');
      expect(error.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.isRetryable).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Validation Error:', expect.any(Object));
    });

    it('should create validation error with field', () => {
      const error = errorHandler.createValidationError('Required field missing', 'bucketName');

      expect(error.message).toBe('Validation error for bucketName: Required field missing');
      expect(error.field).toBe('bucketName');
    });
  });

  describe('enhanceError', () => {
    it('should enhance existing B2Error', () => {
      const originalError = new B2Error('Original message', { status: 400 });
      const enhanced = errorHandler.enhanceError(originalError, { 
        code: 'enhanced_code',
        retryAttempts: 2 
      });

      expect(enhanced).toBe(originalError); // Same instance
      expect(enhanced.code).toBe('enhanced_code');
      expect(enhanced.retryAttempts).toBe(2);
      expect(enhanced.status).toBe(400); // Original property preserved
    });

    it('should convert regular Error to B2Error', () => {
      const originalError = new Error('Regular error');
      const enhanced = errorHandler.enhanceError(originalError, { 
        status: 500,
        isRetryable: true 
      });

      expect(enhanced).toBeInstanceOf(B2Error);
      expect(enhanced.message).toBe('Regular error');
      expect(enhanced.status).toBe(500);
      expect(enhanced.isRetryable).toBe(true);
      expect(enhanced.originalError).toBe(originalError);
    });
  });

  describe('formatError', () => {
    it('should format error without stack trace', () => {
      const error = new B2Error('Test error', {
        status: 400,
        statusText: 'Bad Request',
        code: 'test_error',
        isRetryable: false,
        retryAttempts: 1
      });

      const formatted = errorHandler.formatError(error, false);

      expect(formatted).toEqual({
        type: 'CLIENT_ERROR',
        message: 'Test error',
        description: 'HTTP 400 Bad Request (test_error): Test error',
        status: 400,
        statusText: 'Bad Request',
        code: 'test_error',
        isRetryable: false,
        retryAttempts: 1
      });
      expect(formatted.stack).toBeUndefined();
    });

    it('should format error with stack trace', () => {
      const error = new B2Error('Test error');
      const formatted = errorHandler.formatError(error, true);

      expect(formatted.stack).toBeDefined();
      expect(typeof formatted.stack).toBe('string');
    });

    it('should format regular Error', () => {
      const error = new Error('Regular error');
      const formatted = errorHandler.formatError(error);

      expect(formatted).toEqual({
        type: 'UNKNOWN_ERROR',
        message: 'Regular error',
        description: 'Regular error'
      });
    });
  });

  describe('logError', () => {
    it('should log network errors as error level', () => {
      const error = new B2Error('Network error', { isNetworkError: true });
      
      errorHandler.logError(error, { context: 'test' });

      expect(mockLogger.error).toHaveBeenCalledWith('B2 Error:', expect.objectContaining({
        type: 'NETWORK_ERROR',
        context: 'test'
      }));
    });

    it('should log server errors as error level', () => {
      const error = new B2Error('Server error', { status: 500 });
      
      errorHandler.logError(error);

      expect(mockLogger.error).toHaveBeenCalledWith('B2 Error:', expect.any(Object));
    });

    it('should log client errors as warning level', () => {
      const error = new B2Error('Client error', { status: 400 });
      
      errorHandler.logError(error);

      expect(mockLogger.warn).toHaveBeenCalledWith('B2 Client Error:', expect.any(Object));
    });

    it('should log other errors as info level', () => {
      const error = new B2Error('Info error');
      
      errorHandler.logError(error);

      expect(mockLogger.info).toHaveBeenCalledWith('B2 Info:', expect.any(Object));
    });

    it('should not log when debug is false', () => {
      const handler = new ErrorHandler({ debug: false, logger: mockLogger });
      const error = new B2Error('Test error');
      
      handler.logError(error);

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('isAuthExpired', () => {
    it('should return true for unauthorized status', () => {
      const error = { status: HTTP_STATUS.UNAUTHORIZED };
      expect(errorHandler.isAuthExpired(error)).toBe(true);
    });

    it('should return true for expired auth token code', () => {
      const error = { code: B2_ERROR_CODES.EXPIRED_AUTH_TOKEN };
      expect(errorHandler.isAuthExpired(error)).toBe(true);
    });

    it('should return true for bad auth token code', () => {
      const error = { code: B2_ERROR_CODES.BAD_AUTH_TOKEN };
      expect(errorHandler.isAuthExpired(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = { status: 400 };
      expect(errorHandler.isAuthExpired(error)).toBe(false);
    });
  });

  describe('isRateLimited', () => {
    it('should return true for too many requests status', () => {
      const error = { status: HTTP_STATUS.TOO_MANY_REQUESTS };
      expect(errorHandler.isRateLimited(error)).toBe(true);
    });

    it('should return true for too many requests code', () => {
      const error = { code: B2_ERROR_CODES.TOO_MANY_REQUESTS };
      expect(errorHandler.isRateLimited(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = { status: 400 };
      expect(errorHandler.isRateLimited(error)).toBe(false);
    });
  });

  describe('getRateLimitDelay', () => {
    it('should return delay from Retry-After header', () => {
      const headers = new Headers({ 'Retry-After': '30' });
      const error = { 
        response: { headers }
      };

      const delay = errorHandler.getRateLimitDelay(error);
      expect(delay).toBe(30000); // 30 seconds in milliseconds
    });

    it('should return default delay when no Retry-After header', () => {
      const error = { 
        response: { headers: new Headers() }
      };

      const delay = errorHandler.getRateLimitDelay(error);
      expect(delay).toBe(60000); // 1 minute default
    });

    it('should return default delay when invalid Retry-After header', () => {
      const headers = new Headers({ 'Retry-After': 'invalid' });
      const error = { 
        response: { headers }
      };

      const delay = errorHandler.getRateLimitDelay(error);
      expect(delay).toBe(60000); // 1 minute default
    });

    it('should return default delay when no response', () => {
      const error = {};

      const delay = errorHandler.getRateLimitDelay(error);
      expect(delay).toBe(60000); // 1 minute default
    });
  });
});