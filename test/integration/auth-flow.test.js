/**
 * Integration tests for AuthManager with HttpClient
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthManager } from '../../src/managers/auth-manager.js';
import { HttpClient } from '../../src/core/http-client.js';
import { API_ENDPOINTS, B2_API_BASE_URL, B2_ERROR_CODES } from '../../src/constants.js';

describe('AuthManager Integration with HttpClient', () => {
  let authManager;
  let httpClient;
  let mockFetch;

  const validCredentials = {
    applicationKeyId: 'test-key-id',
    applicationKey: 'test-key'
  };

  const mockAuthResponse = {
    authorizationToken: 'token123',
    apiUrl: 'https://api.example.com',
    downloadUrl: 'https://download.example.com',
    accountId: 'account123',
    recommendedPartSize: 100000000,
    absoluteMinimumPartSize: 5000000,
    allowed: {
      capabilities: ['listBuckets', 'writeFiles'],
      bucketId: null,
      bucketName: null,
      namePrefix: null
    }
  };

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Create real HttpClient and AuthManager instances
    httpClient = new HttpClient();
    authManager = new AuthManager(httpClient);
  });

  describe('successful authentication flow', () => {
    it('should complete full authentication flow with real HTTP client', async () => {
      // Mock successful auth response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockAuthResponse)
      });

      // Perform authentication
      const response = await authManager.authorize(validCredentials);

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        `${B2_API_BASE_URL}${API_ENDPOINTS.AUTHORIZE_ACCOUNT}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /)
          }),
          body: '{}'
        })
      );

      // Verify response structure
      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockAuthResponse);

      // Verify auth context is saved
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getAuthToken()).toBe('token123');
      expect(authManager.getApiUrl()).toBe('https://api.example.com');
      expect(authManager.getDownloadUrl()).toBe('https://download.example.com');
      expect(authManager.getAccountId()).toBe('account123');
      expect(authManager.getRecommendedPartSize()).toBe(100000000);
    });

    it('should generate correct Basic auth header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockAuthResponse)
      });

      await authManager.authorize(validCredentials);

      const [url, options] = mockFetch.mock.calls[0];
      const authHeader = options.headers.Authorization;
      
      expect(authHeader).toMatch(/^Basic /);
      
      // Decode and verify credentials
      const encoded = authHeader.replace('Basic ', '');
      const decoded = atob(encoded);
      expect(decoded).toBe('test-key-id:test-key');
    });

    it('should provide auth headers for subsequent requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockAuthResponse)
      });

      await authManager.authorize(validCredentials);

      const authHeaders = authManager.getAuthHeaders();
      expect(authHeaders).toEqual({
        Authorization: 'token123'
      });
    });
  });

  describe('authentication error handling', () => {
    it('should handle 401 unauthorized error', async () => {
      const errorResponse = {
        code: 'bad_auth_token',
        message: 'Invalid application key',
        status: 401
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(errorResponse)
      });

      await expect(authManager.authorize(validCredentials)).rejects.toThrow('Authentication failed: Invalid application key ID or application key');

      // Verify auth context is cleared
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getAuthToken()).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(authManager.authorize(validCredentials)).rejects.toThrow('Network error: Network error');

      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const error = new Error('Request timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(authManager.authorize(validCredentials, { timeout: 50 })).rejects.toThrow('Request timeout after 50ms');

      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(authManager.authorize(validCredentials)).rejects.toThrow();
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('token refresh functionality', () => {
    it('should refresh authentication when token expires', async () => {
      // Initial authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockAuthResponse)
      });

      await authManager.authorize(validCredentials);
      expect(authManager.getAuthToken()).toBe('token123');

      // Mock refresh with new token
      const refreshedResponse = {
        ...mockAuthResponse,
        authorizationToken: 'new-token456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(refreshedResponse)
      });

      // Refresh authentication
      const response = await authManager.refreshAuth(validCredentials);

      expect(response.data.authorizationToken).toBe('new-token456');
      expect(authManager.getAuthToken()).toBe('new-token456');
      expect(authManager.isAuthenticated()).toBe(true);
    });

    it('should clear context before refreshing', async () => {
      // Initial authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockAuthResponse)
      });

      await authManager.authorize(validCredentials);
      expect(authManager.isAuthenticated()).toBe(true);

      // Mock failed refresh
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ code: 'bad_auth_token', message: 'Invalid key' })
      });

      // Attempt refresh
      await expect(authManager.refreshAuth(validCredentials)).rejects.toThrow();

      // Verify context is cleared
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getAuthToken()).toBeNull();
    });
  });

  describe('error detection', () => {
    it('should correctly identify auth expired errors', () => {
      const error401 = new Error('Unauthorized');
      error401.status = 401;
      expect(authManager.isAuthExpiredError(error401)).toBe(true);

      const errorBadToken = new Error('Bad token');
      errorBadToken.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
      expect(authManager.isAuthExpiredError(errorBadToken)).toBe(true);

      const errorExpiredToken = new Error('Expired token');
      errorExpiredToken.code = B2_ERROR_CODES.EXPIRED_AUTH_TOKEN;
      expect(authManager.isAuthExpiredError(errorExpiredToken)).toBe(true);

      const otherError = new Error('Other error');
      otherError.status = 500;
      expect(authManager.isAuthExpiredError(otherError)).toBe(false);
    });
  });

  describe('request header injection', () => {
    it('should throw error when getting auth headers without authentication', () => {
      expect(() => authManager.getAuthHeaders()).toThrow('Not authenticated. Call authorize() first.');
    });

    it('should provide correct auth headers after authentication', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockAuthResponse)
      });

      await authManager.authorize(validCredentials);

      const headers = authManager.getAuthHeaders();
      expect(headers).toEqual({
        Authorization: 'token123'
      });
    });
  });

  describe('configuration options', () => {
    it('should pass timeout option to HTTP client', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              statusText: 'OK',
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve(mockAuthResponse)
            });
          }, 100);
        });
      });

      const startTime = Date.now();
      await authManager.authorize(validCredentials, { timeout: 5000 });
      const endTime = Date.now();

      // Should complete within reasonable time (not timeout)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle custom configuration in AuthManager', () => {
      const config = { debug: true, customOption: 'value' };
      const customAuthManager = new AuthManager(httpClient, config);

      expect(customAuthManager.config).toEqual(config);
    });
  });

  describe('auth context management', () => {
    it('should return immutable copy of auth context', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockAuthResponse)
      });

      await authManager.authorize(validCredentials);

      const context1 = authManager.getAuthContext();
      const context2 = authManager.getAuthContext();

      // Should be equal but different objects
      expect(context1).toEqual(context2);
      expect(context1).not.toBe(context2);

      // Modifying returned context should not affect internal state
      context1.authorizationToken = 'modified';
      expect(authManager.getAuthToken()).toBe('token123');
    });

    it('should handle missing optional fields in auth response', async () => {
      const minimalResponse = {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123'
        // Missing optional fields
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(minimalResponse)
      });

      await authManager.authorize(validCredentials);

      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getRecommendedPartSize()).toBeNull();

      const context = authManager.getAuthContext();
      expect(context.recommendedPartSize).toBeNull();
      expect(context.absoluteMinimumPartSize).toBeNull();
      expect(context.allowed).toBeNull();
    });
  });
});