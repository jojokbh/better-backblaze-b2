import { BUCKET_TYPES, KEY_CAPABILITIES } from '../constants.js';

/**
 * Input validation utilities for B2 API parameters
 */
export class Validator {
  /**
   * Validate required parameters
   * @param {Object} params - Parameters object
   * @param {string[]} required - Array of required parameter names
   * @throws {Error} If any required parameter is missing
   */
  static validateRequired(params, required) {
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters object is required');
    }

    const missing = required.filter(
      (param) =>
        params[param] === undefined ||
        params[param] === null ||
        params[param] === ''
    );

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Validate string parameter
   * @param {any} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum length
   * @param {number} options.maxLength - Maximum length
   * @param {RegExp} options.pattern - Pattern to match
   * @throws {Error} If validation fails
   */
  static validateString(value, name, options = {}) {
    if (typeof value !== 'string') {
      throw new Error(`${name} must be a string`);
    }

    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new Error(
        `${name} must be at least ${options.minLength} characters long`
      );
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new Error(
        `${name} must be no more than ${options.maxLength} characters long`
      );
    }

    if (options.pattern && !options.pattern.test(value)) {
      throw new Error(`${name} format is invalid`);
    }
  }

  /**
   * Validate number parameter
   * @param {any} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {Object} options - Validation options
   * @param {number} options.min - Minimum value
   * @param {number} options.max - Maximum value
   * @param {boolean} options.integer - Must be integer
   * @throws {Error} If validation fails
   */
  static validateNumber(value, name, options = {}) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${name} must be a valid number`);
    }

    if (options.integer && !Number.isInteger(value)) {
      throw new Error(`${name} must be an integer`);
    }

    if (options.min !== undefined && value < options.min) {
      throw new Error(`${name} must be at least ${options.min}`);
    }

    if (options.max !== undefined && value > options.max) {
      throw new Error(`${name} must be no more than ${options.max}`);
    }
  }

  /**
   * Validate array parameter
   * @param {any} value - Value to validate
   * @param {string} name - Parameter name for error messages
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum array length
   * @param {number} options.maxLength - Maximum array length
   * @throws {Error} If validation fails
   */
  static validateArray(value, name, options = {}) {
    if (!Array.isArray(value)) {
      throw new Error(`${name} must be an array`);
    }

    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new Error(
        `${name} must contain at least ${options.minLength} items`
      );
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new Error(
        `${name} must contain no more than ${options.maxLength} items`
      );
    }
  }

  /**
   * Validate bucket name
   * @param {string} bucketName - Bucket name to validate
   * @throws {Error} If bucket name is invalid
   */
  static validateBucketName(bucketName) {
    this.validateString(bucketName, 'bucketName', {
      minLength: 6,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9\-]+$/,
    });

    // Additional B2-specific rules
    if (bucketName.startsWith('-') || bucketName.endsWith('-')) {
      throw new Error('Bucket name cannot start or end with a hyphen');
    }

    if (bucketName.includes('--')) {
      throw new Error('Bucket name cannot contain consecutive hyphens');
    }
  }

  /**
   * Validate bucket type
   * @param {string} bucketType - Bucket type to validate
   * @throws {Error} If bucket type is invalid
   */
  static validateBucketType(bucketType) {
    const validTypes = Object.values(BUCKET_TYPES);
    if (!validTypes.includes(bucketType)) {
      throw new Error(
        `Invalid bucket type. Must be one of: ${validTypes.join(', ')}`
      );
    }
  }

  /**
   * Validate file name
   * @param {string} fileName - File name to validate
   * @throws {Error} If file name is invalid
   */
  static validateFileName(fileName) {
    this.validateString(fileName, 'fileName', {
      minLength: 1,
      maxLength: 1024,
    });

    // B2 doesn't allow certain characters in file names
    const invalidChars = /[\x00-\x1f\x7f]/;
    if (invalidChars.test(fileName)) {
      throw new Error('File name contains invalid control characters');
    }

    // File name cannot start with '/'
    if (fileName.startsWith('/')) {
      throw new Error('File name cannot start with a forward slash');
    }
  }

  /**
   * Validate SHA1 hash
   * @param {string} sha1 - SHA1 hash to validate
   * @throws {Error} If SHA1 hash is invalid
   */
  static validateSha1(sha1) {
    this.validateString(sha1, 'SHA1 hash', {
      minLength: 40,
      maxLength: 40,
      pattern: /^[a-fA-F0-9]{40}$/,
    });
  }

  /**
   * Validate content type
   * @param {string} contentType - Content type to validate
   * @throws {Error} If content type is invalid
   */
  static validateContentType(contentType) {
    this.validateString(contentType, 'contentType', {
      minLength: 1,
      maxLength: 1024,
      pattern:
        /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/,
    });
  }

  /**
   * Validate key capabilities
   * @param {string[]} capabilities - Array of capabilities to validate
   * @throws {Error} If any capability is invalid
   */
  static validateKeyCapabilities(capabilities) {
    this.validateArray(capabilities, 'capabilities', { minLength: 1 });

    const validCapabilities = Object.values(KEY_CAPABILITIES);
    const invalid = capabilities.filter(
      (cap) => !validCapabilities.includes(cap)
    );

    if (invalid.length > 0) {
      throw new Error(`Invalid key capabilities: ${invalid.join(', ')}`);
    }
  }

  /**
   * Validate part number for multipart uploads
   * @param {number} partNumber - Part number to validate
   * @throws {Error} If part number is invalid
   */
  static validatePartNumber(partNumber) {
    this.validateNumber(partNumber, 'partNumber', {
      min: 1,
      max: 10000,
      integer: true,
    });
  }

  /**
   * Validate file size
   * @param {number} size - File size in bytes
   * @param {Object} options - Validation options
   * @param {number} options.maxSize - Maximum allowed size
   * @throws {Error} If file size is invalid
   */
  static validateFileSize(size, options = {}) {
    this.validateNumber(size, 'file size', {
      min: 0,
      integer: true,
    });

    if (options.maxSize && size > options.maxSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${options.maxSize} bytes`
      );
    }
  }

  /**
   * Validate pagination parameters
   * @param {Object} params - Pagination parameters
   * @param {number} params.maxFileCount - Maximum number of files to return
   * @param {string} params.startFileName - File name to start listing from
   * @throws {Error} If pagination parameters are invalid
   */
  static validatePagination(params) {
    if (params.maxFileCount !== undefined) {
      this.validateNumber(params.maxFileCount, 'maxFileCount', {
        min: 1,
        max: 10000,
        integer: true,
      });
    }

    if (params.startFileName !== undefined) {
      this.validateFileName(params.startFileName);
    }
  }

  /**
   * Validate authentication credentials
   * @param {Object} credentials - Authentication credentials
   * @param {string} credentials.applicationKeyId - Application key ID
   * @param {string} credentials.applicationKey - Application key
   * @throws {Error} If credentials are invalid
   */
  static validateAuthCredentials(credentials) {
    this.validateRequired(credentials, ['applicationKeyId', 'applicationKey']);

    this.validateString(credentials.applicationKeyId, 'applicationKeyId', {
      minLength: 1,
      maxLength: 1024,
    });

    this.validateString(credentials.applicationKey, 'applicationKey', {
      minLength: 1,
      maxLength: 1024,
    });
  }
}

/**
 * URL encoding utilities
 */
export const UrlEncoder = {
  /**
   * Encode a file name for use in URLs, preserving path separators
   * @param {string} fileName - File name to encode
   * @returns {string} URL-encoded file name
   */
  encodeFileName(fileName) {
    if (typeof fileName !== 'string') {
      throw new Error('File name must be a string');
    }

    return fileName
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  },

  /**
   * Encode a single path segment
   * @param {string} segment - Path segment to encode
   * @returns {string} URL-encoded segment
   */
  encodePathSegment(segment) {
    if (typeof segment !== 'string') {
      throw new Error('Path segment must be a string');
    }

    return encodeURIComponent(segment);
  },

  /**
   * Decode a URL-encoded file name
   * @param {string} encodedFileName - Encoded file name
   * @returns {string} Decoded file name
   */
  decodeFileName(encodedFileName) {
    if (typeof encodedFileName !== 'string') {
      throw new Error('Encoded file name must be a string');
    }

    try {
      return encodedFileName
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/');
    } catch (error) {
      throw new Error(`Failed to decode file name: ${error.message}`);
    }
  },
};

/**
 * Parameter validation helpers for specific B2 operations
 */
export const B2Validators = {
  /**
   * Validate bucket creation parameters
   * @param {Object} params - Bucket creation parameters
   * @throws {Error} If parameters are invalid
   */
  validateCreateBucket(params) {
    Validator.validateRequired(params, ['bucketName', 'bucketType']);
    Validator.validateBucketName(params.bucketName);
    Validator.validateBucketType(params.bucketType);

    if (params.bucketInfo && typeof params.bucketInfo !== 'object') {
      throw new Error('bucketInfo must be an object');
    }

    if (params.corsRules && !Array.isArray(params.corsRules)) {
      throw new Error('corsRules must be an array');
    }

    if (params.lifecycleRules && !Array.isArray(params.lifecycleRules)) {
      throw new Error('lifecycleRules must be an array');
    }
  },

  /**
   * Validate file upload parameters
   * @param {Object} params - File upload parameters
   * @throws {Error} If parameters are invalid
   */
  validateUploadFile(params) {
    Validator.validateRequired(params, [
      'uploadUrl',
      'uploadAuthToken',
      'fileName',
      'data',
    ]);
    Validator.validateFileName(params.fileName);

    if (params.contentType) {
      Validator.validateContentType(params.contentType);
    }

    if (params.contentSha1) {
      Validator.validateSha1(params.contentSha1);
    }

    if (params.info && typeof params.info !== 'object') {
      throw new Error('info must be an object');
    }
  },

  /**
   * Validate large file start parameters
   * @param {Object} params - Large file start parameters
   * @throws {Error} If parameters are invalid
   */
  validateStartLargeFile(params) {
    Validator.validateRequired(params, ['bucketId', 'fileName']);
    Validator.validateFileName(params.fileName);

    if (params.contentType) {
      Validator.validateContentType(params.contentType);
    }

    if (params.info && typeof params.info !== 'object') {
      throw new Error('info must be an object');
    }
  },

  /**
   * Validate part upload parameters
   * @param {Object} params - Part upload parameters
   * @throws {Error} If parameters are invalid
   */
  validateUploadPart(params) {
    Validator.validateRequired(params, [
      'uploadUrl',
      'uploadAuthToken',
      'partNumber',
      'data',
    ]);
    Validator.validatePartNumber(params.partNumber);

    if (params.contentSha1) {
      Validator.validateSha1(params.contentSha1);
    }
  },

  /**
   * Validate key creation parameters
   * @param {Object} params - Key creation parameters
   * @throws {Error} If parameters are invalid
   */
  validateCreateKey(params) {
    Validator.validateRequired(params, ['keyName', 'capabilities']);

    Validator.validateString(params.keyName, 'keyName', {
      minLength: 1,
      maxLength: 100,
    });

    Validator.validateKeyCapabilities(params.capabilities);

    if (params.validDurationInSeconds !== undefined) {
      Validator.validateNumber(
        params.validDurationInSeconds,
        'validDurationInSeconds',
        {
          min: 1,
          max: 1000 * 24 * 60 * 60, // 1000 days in seconds
          integer: true,
        }
      );
    }

    if (params.bucketId) {
      Validator.validateString(params.bucketId, 'bucketId');
    }

    if (params.namePrefix) {
      Validator.validateString(params.namePrefix, 'namePrefix');
    }
  },
};
