/**
 * Key Manager for B2 API
 * Handles application key CRUD operations
 */

import { KEY_CAPABILITIES, B2_ERROR_CODES } from '../constants.js';
import { Validator } from '../utils/validation.js';
import { EndpointBuilder } from '../utils/endpoints.js';

export class KeyManager {
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

// Export key capabilities for convenience
export { KEY_CAPABILITIES };

export default KeyManager;
