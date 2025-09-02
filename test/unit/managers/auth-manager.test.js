/**
 * Unit tests for AuthManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthManager } from '../../../src/managers/auth-manager.js';
import { API_ENDPOINTS, B2_API_BASE_URL, B2_ERROR_CODES } from '../../../src/constants.js';

describe('AuthManager', () => {
  let authManager;
  let mockHttpClient;

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn()
    };
    authManager = new AuthManager(mockHttpClient);
  });

  describe('constructor', () => {
    it('should initialize with default auth context', () => {
      const context = authManager.getAuthContext();
      
      expect(context.authorizationToken).toBeNull();
      expect(context.apiUrl).toBeNull();
      expect(context.downloadUrl).toBeNull();
      expect(context.accountId).toBeNull();
      expect(context.isAuthenticated).toBe(false);
    });

    it('should store http client and config', () => {
      const config = { timeout: 5000 };
      const manager = new AuthManager(mockHttpClient, config);
      
      expect(manager.httpClient).toBe(mockHttpClient);
      expect(manager.config).toBe(config);
    });
  });

  describe('validateCredentials', () => {
    it('should validate valid credentials', () => {
      const credentials = {
        applicationKeyId: 'test-key-id',
        applicationKey: 'test-key'
      };

      expect(() => authManager.validateCredentials(credentials)).not.toThrow();
    });

    it('should throw error for missing credentials object', () => {
      expect(() => authManager.validateCredentials(null)).toThrow('credentials is required');
      expect(() => authManager.validateCredentials(undefined)).toThrow('credentials is required');
    });

    it('should throw error for missing applicationKeyId', () => {
      const credentials = { applicationKey: 'test-key' };
      expect(() => authManager.validateCredentials(credentials)).toThrow('applicationKeyId is required');
    });

    it('should throw error for missing applicationKey', () => {
      const credentials = { applicationKeyId: 'test-key-id' };
      expect(() => authManager.validateCredentials(credentials)).toThrow('applicationKey is required');
    });

    it('should throw error for empty applicationKeyId', () => {
      const credentials = {
        applicationKeyId: '   ',
        applicationKey: 'test-key'
      };
      expect(() => authManager.validateCredentials(credentials)).toThrow('Application key ID cannot be empty');
    });

    it('should throw error for empty applicationKey', () => {
      const credentials = {
        applicationKeyId: 'test-key-id',
        applicationKey: '   '
      };
      expect(() => authManager.validateCredentials(credentials)).toThrow('Application key cannot be empty');
    });

    it('should throw error for non-string applicationKeyId', () => {
      const credentials = {
        applicationKeyId: 123,
        applicationKey: 'test-key'
      };
      expect(() => authManager.validateCredentials(credentials)).toThrow('applicationKeyId must be a string');
    });

    it('should throw error for non-string applicationKey', () => {
      const credentials = {
        applicationKeyId: 'test-key-id',
        applicationKey: 123
      };
      expect(() => authManager.validateCredentials(credentials)).toThrow('applicationKey must be a string');
    });
  });

  describe('generateBasicAuthHeader', () => {
    it('should generate valid Basic auth header', () => {
      const header = authManager.generateBasicAuthHeader('keyId', 'key');
      
      expect(header).toHaveProperty('Authorization');
      expect(header.Authorization).toMatch(/^Basic /);
      
      // Decode and verify the credentials
      const encoded = header.Authorization.replace('Basic ', '');
      const decoded = atob(encoded);
      expect(decoded).toBe('keyId:key');
    });

    it('should handle special characters in credentials', () => {
      const header = authManager.generateBasicAuthHeader('key:id', 'key@value');
      
      expect(header).toHaveProperty('Authorization');
      expect(header.Authorization).toMatch(/^Basic /);
      
      const encoded = header.Authorization.replace('Basic ', '');
      const decoded = atob(encoded);
      expect(decoded).toBe('key:id:key@value');
    });

    it('should throw error for empty credentials', () => {
      expect(() => authManager.generateBasicAuthHeader('', 'key')).toThrow();
      expect(() => authManager.generateBasicAuthHeader('keyId', '')).toThrow();
    });
  });

  describe('saveAuthContext', () => {
    it('should save valid auth response', () => {
      const authResponse = {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123',
        recommendedPartSize: 100000000,
        absoluteMinimumPartSize: 5000000,
        allowed: { capabilities: ['listBuckets'] }
      };

      authManager.saveAuthContext(authResponse);
      const context = authManager.getAuthContext();

      expect(context.authorizationToken).toBe('token123');
      expect(context.apiUrl).toBe('https://api.example.com');
      expect(context.downloadUrl).toBe('https://download.example.com');
      expect(context.accountId).toBe('account123');
      expect(context.recommendedPartSize).toBe(100000000);
      expect(context.absoluteMinimumPartSize).toBe(5000000);
      expect(context.allowed).toEqual({ capabilities: ['listBuckets'] });
      expect(context.isAuthenticated).toBe(true);
    });

    it('should save auth response with minimal required fields', () => {
      const authResponse = {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123'
      };

      authManager.saveAuthContext(authResponse);
      const context = authManager.getAuthContext();

      expect(context.authorizationToken).toBe('token123');
      expect(context.apiUrl).toBe('https://api.example.com');
      expect(context.downloadUrl).toBe('https://download.example.com');
      expect(context.accountId).toBe('account123');
      expect(context.recommendedPartSize).toBeNull();
      expect(context.absoluteMinimumPartSize).toBeNull();
      expect(context.allowed).toBeNull();
      expect(context.isAuthenticated).toBe(true);
    });

    it('should throw error for invalid auth response', () => {
      expect(() => authManager.saveAuthContext(null)).toThrow('Invalid authentication response');
      expect(() => authManager.saveAuthContext(undefined)).toThrow('Invalid authentication response');
      expect(() => authManager.saveAuthContext('string')).toThrow('Invalid authentication response');
    });

    it('should throw error for missing required fields', () => {
      const incompleteResponse = {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com'
        // Missing downloadUrl and accountId
      };

      expect(() => authManager.saveAuthContext(incompleteResponse)).toThrow('Missing required field in auth response: downloadUrl');
    });

    it('should throw error for each missing required field', () => {
      const requiredFields = ['authorizationToken', 'apiUrl', 'downloadUrl', 'accountId'];
      
      requiredFields.forEach(field => {
        const response = {
          authorizationToken: 'token123',
          apiUrl: 'https://api.example.com',
          downloadUrl: 'https://download.example.com',
          accountId: 'account123'
        };
        delete response[field];

        expect(() => authManager.saveAuthContext(response)).toThrow(`Missing required field in auth response: ${field}`);
      });
    });
  });

  describe('authentication state methods', () => {
    beforeEach(() => {
      const authResponse = {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123',
        recommendedPartSize: 100000000
      };
      authManager.saveAuthContext(authResponse);
    });

    describe('isAuthenticated', () => {
      it('should return true when authenticated', () => {
        expect(authManager.isAuthenticated()).toBe(true);
      });

      it('should return false when not authenticated', () => {
        authManager.clearAuthContext();
        expect(authManager.isAuthenticated()).toBe(false);
      });

      it('should return false when token is missing', () => {
        authManager.authContext.authorizationToken = null;
        expect(authManager.isAuthenticated()).toBe(false);
      });
    });

    describe('getAuthToken', () => {
      it('should return auth token when authenticated', () => {
        expect(authManager.getAuthToken()).toBe('token123');
      });

      it('should return null when not authenticated', () => {
        authManager.clearAuthContext();
        expect(authManager.getAuthToken()).toBeNull();
      });
    });

    describe('getApiUrl', () => {
      it('should return API URL when authenticated', () => {
        expect(authManager.getApiUrl()).toBe('https://api.example.com');
      });

      it('should return null when not authenticated', () => {
        authManager.clearAuthContext();
        expect(authManager.getApiUrl()).toBeNull();
      });
    });

    describe('getDownloadUrl', () => {
      it('should return download URL when authenticated', () => {
        expect(authManager.getDownloadUrl()).toBe('https://download.example.com');
      });

      it('should return null when not authenticated', () => {
        authManager.clearAuthContext();
        expect(authManager.getDownloadUrl()).toBeNull();
      });
    });

    describe('getAccountId', () => {
      it('should return account ID when authenticated', () => {
        expect(authManager.getAccountId()).toBe('account123');
      });

      it('should return null when not authenticated', () => {
        authManager.clearAuthContext();
        expect(authManager.getAccountId()).toBeNull();
      });
    });

    describe('getRecommendedPartSize', () => {
      it('should return recommended part size when available', () => {
        expect(authManager.getRecommendedPartSize()).toBe(100000000);
      });

      it('should return null when not available', () => {
        authManager.clearAuthContext();
        expect(authManager.getRecommendedPartSize()).toBeNull();
      });
    });
  });

  describe('clearAuthContext', () => {
    it('should clear all auth context', () => {
      // First set some auth context
      const authResponse = {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123'
      };
      authManager.saveAuthContext(authResponse);

      // Verify it's set
      expect(authManager.isAuthenticated()).toBe(true);

      // Clear it
      authManager.clearAuthContext();

      // Verify it's cleared
      const context = authManager.getAuthContext();
      expect(context.authorizationToken).toBeNull();
      expect(context.apiUrl).toBeNull();
      expect(context.downloadUrl).toBeNull();
      expect(context.accountId).toBeNull();
      expect(context.recommendedPartSize).toBeNull();
      expect(context.absoluteMinimumPartSize).toBeNull();
      expect(context.allowed).toBeNull();
      expect(context.isAuthenticated).toBe(false);
    });
  });

  describe('authorize', () => {
    const validCredentials = {
      applicationKeyId: 'test-key-id',
      applicationKey: 'test-key'
    };

    const mockAuthResponse = {
      status: 200,
      data: {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123',
        recommendedPartSize: 100000000
      }
    };

    it('should successfully authorize with valid credentials', async () => {
      mockHttpClient.post.mockResolvedValue(mockAuthResponse);

      const response = await authManager.authorize(validCredentials);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        `${B2_API_BASE_URL}${API_ENDPOINTS.AUTHORIZE_ACCOUNT}`,
        {},
        {
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /)
          }),
          timeout: undefined
        }
      );

      expect(response).toBe(mockAuthResponse);
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getAuthToken()).toBe('token123');
    });

    it('should pass timeout option to http client', async () => {
      mockHttpClient.post.mockResolvedValue(mockAuthResponse);

      await authManager.authorize(validCredentials, { timeout: 5000 });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 5000
        })
      );
    });

    it('should throw validation error for invalid credentials', async () => {
      const invalidCredentials = { applicationKeyId: 'test' };

      await expect(authManager.authorize(invalidCredentials)).rejects.toThrow('applicationKey is required');
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });

    it('should handle 401 authentication error', async () => {
      const authError = new Error('Unauthorized');
      authError.status = 401;
      mockHttpClient.post.mockRejectedValue(authError);

      await expect(authManager.authorize(validCredentials)).rejects.toThrow('Authentication failed: Invalid application key ID or application key');
      
      const thrownError = await authManager.authorize(validCredentials).catch(err => err);
      expect(thrownError.code).toBe(B2_ERROR_CODES.BAD_AUTH_TOKEN);
      expect(thrownError.status).toBe(401);
      expect(thrownError.isAuthError).toBe(true);
      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should clear auth context on authentication failure', async () => {
      // First set some auth context
      authManager.saveAuthContext(mockAuthResponse.data);
      expect(authManager.isAuthenticated()).toBe(true);

      // Then fail authentication
      const authError = new Error('Unauthorized');
      authError.status = 401;
      mockHttpClient.post.mockRejectedValue(authError);

      await expect(authManager.authorize(validCredentials)).rejects.toThrow();
      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should re-throw non-401 errors', async () => {
      const networkError = new Error('Network error');
      networkError.status = 500;
      mockHttpClient.post.mockRejectedValue(networkError);

      await expect(authManager.authorize(validCredentials)).rejects.toThrow('Network error');
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe('getAuthHeaders', () => {
    it('should return auth headers when authenticated', () => {
      const authResponse = {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123'
      };
      authManager.saveAuthContext(authResponse);

      const headers = authManager.getAuthHeaders();
      expect(headers).toEqual({
        Authorization: 'token123'
      });
    });

    it('should throw error when not authenticated', () => {
      expect(() => authManager.getAuthHeaders()).toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('refreshAuth', () => {
    const validCredentials = {
      applicationKeyId: 'test-key-id',
      applicationKey: 'test-key'
    };

    const mockAuthResponse = {
      status: 200,
      data: {
        authorizationToken: 'new-token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123'
      }
    };

    it('should clear context and re-authenticate', async () => {
      // Set initial auth context
      const initialResponse = {
        authorizationToken: 'old-token',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123'
      };
      authManager.saveAuthContext(initialResponse);
      expect(authManager.getAuthToken()).toBe('old-token');

      // Mock successful refresh
      mockHttpClient.post.mockResolvedValue(mockAuthResponse);

      const response = await authManager.refreshAuth(validCredentials);

      expect(response).toBe(mockAuthResponse);
      expect(authManager.getAuthToken()).toBe('new-token123');
    });

    it('should pass options to authorize method', async () => {
      mockHttpClient.post.mockResolvedValue(mockAuthResponse);

      await authManager.refreshAuth(validCredentials, { timeout: 5000 });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 5000
        })
      );
    });
  });

  describe('isAuthExpiredError', () => {
    it('should return true for 401 status', () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      
      expect(authManager.isAuthExpiredError(error)).toBe(true);
    });

    it('should return true for bad auth token error code', () => {
      const error = new Error('Bad auth token');
      error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
      
      expect(authManager.isAuthExpiredError(error)).toBe(true);
    });

    it('should return true for expired auth token error code', () => {
      const error = new Error('Expired auth token');
      error.code = B2_ERROR_CODES.EXPIRED_AUTH_TOKEN;
      
      expect(authManager.isAuthExpiredError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new Error('Some other error');
      error.status = 500;
      
      expect(authManager.isAuthExpiredError(error)).toBe(false);
    });

    it('should return false for errors without status or code', () => {
      const error = new Error('Generic error');
      
      expect(authManager.isAuthExpiredError(error)).toBe(false);
    });
  });

  describe('getAuthContext', () => {
    it('should return a copy of auth context', () => {
      const authResponse = {
        authorizationToken: 'token123',
        apiUrl: 'https://api.example.com',
        downloadUrl: 'https://download.example.com',
        accountId: 'account123'
      };
      authManager.saveAuthContext(authResponse);

      const context1 = authManager.getAuthContext();
      const context2 = authManager.getAuthContext();

      // Should be equal but not the same object
      expect(context1).toEqual(context2);
      expect(context1).not.toBe(context2);
      expect(context1).not.toBe(authManager.authContext);
    });
  });
});