/**
 * Authentication Manager for B2 API
 * Handles credential validation, authorization, and auth context management
 */

import {
  API_ENDPOINTS,
  B2_API_BASE_URL,
  B2_ERROR_CODES,
} from '../constants.js';
import { AuthHeaders } from '../utils/headers.js';
import { Validator } from '../utils/validation.js';

export class AuthManager {
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

export default AuthManager;
