/**
 * Bucket Manager for B2 API
 * Handles bucket CRUD operations and upload URL generation
 */

import { BUCKET_TYPES, B2_ERROR_CODES } from '../constants.js';
import { Validator } from '../utils/validation.js';
import { EndpointBuilder } from '../utils/endpoints.js';

export class BucketManager {
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

// Export bucket types for convenience
export { BUCKET_TYPES };

export default BucketManager;
