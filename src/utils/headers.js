import { HEADERS, CONTENT_TYPES } from '../constants.js';

/**
 * Utility class for constructing HTTP headers for B2 API requests
 */
export class HeaderBuilder {
  constructor() {
    this.headers = {};
  }

  /**
   * Reset headers to empty state
   * @returns {HeaderBuilder} This instance for chaining
   */
  reset() {
    this.headers = {};
    return this;
  }

  /**
   * Set a header value
   * @param {string} name - Header name
   * @param {string} value - Header value
   * @returns {HeaderBuilder} This instance for chaining
   */
  setHeader(name, value) {
    if (value !== undefined && value !== null) {
      this.headers[name] = String(value);
    }
    return this;
  }

  /**
   * Set multiple headers from an object
   * @param {Object} headers - Object containing header key-value pairs
   * @returns {HeaderBuilder} This instance for chaining
   */
  setHeaders(headers) {
    if (headers && typeof headers === 'object') {
      Object.entries(headers).forEach(([name, value]) => {
        this.setHeader(name, value);
      });
    }
    return this;
  }

  /**
   * Set Content-Type header
   * @param {string} contentType - Content type value
   * @returns {HeaderBuilder} This instance for chaining
   */
  setContentType(contentType) {
    return this.setHeader(HEADERS.CONTENT_TYPE, contentType);
  }

  /**
   * Set Content-Length header
   * @param {number} contentLength - Content length in bytes
   * @returns {HeaderBuilder} This instance for chaining
   */
  setContentLength(contentLength) {
    return this.setHeader(HEADERS.CONTENT_LENGTH, contentLength);
  }

  /**
   * Set Authorization header
   * @param {string} token - Authorization token
   * @returns {HeaderBuilder} This instance for chaining
   */
  setAuthorization(token) {
    return this.setHeader(HEADERS.AUTHORIZATION, token);
  }

  /**
   * Set Basic Authorization header
   * @param {string} applicationKeyId - Application key ID
   * @param {string} applicationKey - Application key
   * @returns {HeaderBuilder} This instance for chaining
   */
  setBasicAuth(applicationKeyId, applicationKey) {
    const credentials = btoa(`${applicationKeyId}:${applicationKey}`);
    return this.setAuthorization(`Basic ${credentials}`);
  }

  /**
   * Set Bearer Authorization header
   * @param {string} token - Bearer token
   * @returns {HeaderBuilder} This instance for chaining
   */
  setBearerAuth(token) {
    return this.setAuthorization(token);
  }

  /**
   * Set file-related headers
   * @param {Object} options - File options
   * @param {string} options.fileName - File name
   * @param {string} options.contentSha1 - SHA1 hash of content
   * @param {string} options.contentType - Content type
   * @param {number} options.contentLength - Content length
   * @returns {HeaderBuilder} This instance for chaining
   */
  setFileHeaders({ fileName, contentSha1, contentType, contentLength }) {
    if (fileName) {
      this.setHeader(HEADERS.FILE_NAME, encodeURIComponent(fileName));
    }
    if (contentSha1) {
      this.setHeader(HEADERS.CONTENT_SHA1, contentSha1);
    }
    if (contentType) {
      this.setContentType(contentType);
    }
    if (contentLength !== undefined) {
      this.setContentLength(contentLength);
    }
    return this;
  }

  /**
   * Set part number header for multipart uploads
   * @param {number} partNumber - Part number (1-based)
   * @returns {HeaderBuilder} This instance for chaining
   */
  setPartNumber(partNumber) {
    return this.setHeader(HEADERS.PART_NUMBER, partNumber);
  }

  /**
   * Set test mode header
   * @param {boolean} testMode - Whether to enable test mode
   * @returns {HeaderBuilder} This instance for chaining
   */
  setTestMode(testMode = true) {
    if (testMode) {
      this.setHeader(HEADERS.TEST_MODE, 'fail_some_uploads');
    }
    return this;
  }

  /**
   * Get the built headers object
   * @returns {Object} Headers object
   */
  build() {
    return { ...this.headers };
  }
}

/**
 * Authentication header utilities
 */
export const AuthHeaders = {
  /**
   * Create Basic authentication header
   * @param {string} applicationKeyId - Application key ID
   * @param {string} applicationKey - Application key
   * @returns {Object} Headers object with Authorization header
   */
  createBasicAuth(applicationKeyId, applicationKey) {
    if (!applicationKeyId || !applicationKey) {
      throw new Error(
        'Application key ID and application key are required for Basic auth'
      );
    }

    const credentials = btoa(`${applicationKeyId}:${applicationKey}`);
    return {
      [HEADERS.AUTHORIZATION]: `Basic ${credentials}`,
    };
  },

  /**
   * Create Bearer authentication header
   * @param {string} token - Bearer token
   * @returns {Object} Headers object with Authorization header
   */
  createBearerAuth(token) {
    if (!token) {
      throw new Error('Token is required for Bearer auth');
    }

    return {
      [HEADERS.AUTHORIZATION]: token,
    };
  },

  /**
   * Extract authorization token from headers
   * @param {Object} headers - Headers object
   * @returns {string|null} Authorization token or null if not found
   */
  extractAuthToken(headers) {
    return headers?.[HEADERS.AUTHORIZATION] || null;
  },
};

/**
 * Info header utilities for file metadata
 */
export const InfoHeaders = {
  /**
   * Maximum number of info headers allowed by B2
   */
  MAX_INFO_HEADERS: 10,

  /**
   * Add info headers to existing headers object
   * @param {Object} headers - Existing headers object
   * @param {Object} info - Info object with metadata
   * @returns {Object} Updated headers object
   */
  addInfoHeaders(headers, info) {
    if (!info || typeof info !== 'object') {
      return headers;
    }

    const keys = Object.keys(info);

    if (keys.length > this.MAX_INFO_HEADERS) {
      throw new Error(
        `Too many info headers: maximum of ${this.MAX_INFO_HEADERS} allowed`
      );
    }

    const invalidKeys = [];
    const updatedHeaders = { ...headers };

    keys.forEach((key) => {
      if (this.isValidInfoHeaderKey(key)) {
        const headerName = `X-Bz-Info-${key}`;
        updatedHeaders[headerName] = encodeURIComponent(String(info[key]));
      } else {
        invalidKeys.push(key);
      }
    });

    if (invalidKeys.length > 0) {
      throw new Error(
        `Info header keys contain invalid characters: ${invalidKeys.join(', ')}`
      );
    }

    return updatedHeaders;
  },

  /**
   * Validate info header key
   * @param {string} key - Header key to validate
   * @returns {boolean} True if valid
   */
  isValidInfoHeaderKey(key) {
    return typeof key === 'string' && /^[a-zA-Z0-9\-_]+$/.test(key);
  },

  /**
   * Extract info headers from response headers
   * @param {Object} headers - Response headers
   * @returns {Object} Extracted info headers
   */
  extractInfoHeaders(headers) {
    const info = {};

    if (!headers || typeof headers !== 'object') {
      return info;
    }

    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase().startsWith('x-bz-info-')) {
        const infoKey = key.substring(10); // Remove 'x-bz-info-' prefix (10 characters)
        try {
          info[infoKey] = decodeURIComponent(value);
        } catch (error) {
          // If decoding fails, use the raw value
          info[infoKey] = value;
        }
      }
    });

    return info;
  },
};

/**
 * Common header utilities
 */
export const HeaderUtils = {
  /**
   * Create headers for JSON requests
   * @param {string} authToken - Authorization token
   * @returns {Object} Headers object
   */
  createJsonHeaders(authToken) {
    const headers = {
      [HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    };

    if (authToken) {
      headers[HEADERS.AUTHORIZATION] = authToken;
    }

    return headers;
  },

  /**
   * Create headers for file upload
   * @param {Object} options - Upload options
   * @param {string} options.authToken - Authorization token
   * @param {string} options.fileName - File name
   * @param {string} options.contentType - Content type
   * @param {string} options.contentSha1 - SHA1 hash
   * @param {number} options.contentLength - Content length
   * @param {Object} options.info - File info metadata
   * @returns {Object} Headers object
   */
  createUploadHeaders({
    authToken,
    fileName,
    contentType,
    contentSha1,
    contentLength,
    info,
  }) {
    let headers = {};

    if (authToken) {
      headers[HEADERS.AUTHORIZATION] = authToken;
    }

    if (fileName) {
      headers[HEADERS.FILE_NAME] = encodeURIComponent(fileName);
    }

    if (contentType) {
      headers[HEADERS.CONTENT_TYPE] = contentType;
    }

    if (contentSha1) {
      headers[HEADERS.CONTENT_SHA1] = contentSha1;
    }

    if (contentLength !== undefined) {
      headers[HEADERS.CONTENT_LENGTH] = String(contentLength);
    }

    // Add info headers if provided
    if (info) {
      headers = InfoHeaders.addInfoHeaders(headers, info);
    }

    return headers;
  },

  /**
   * Create headers for part upload
   * @param {Object} options - Part upload options
   * @param {string} options.authToken - Authorization token
   * @param {number} options.partNumber - Part number
   * @param {string} options.contentSha1 - SHA1 hash of part
   * @param {number} options.contentLength - Content length
   * @returns {Object} Headers object
   */
  createPartUploadHeaders({
    authToken,
    partNumber,
    contentSha1,
    contentLength,
  }) {
    const headers = {};

    if (authToken) {
      headers[HEADERS.AUTHORIZATION] = authToken;
    }

    if (partNumber !== undefined) {
      headers[HEADERS.PART_NUMBER] = String(partNumber);
    }

    if (contentSha1) {
      headers[HEADERS.CONTENT_SHA1] = contentSha1;
    }

    if (contentLength !== undefined) {
      headers[HEADERS.CONTENT_LENGTH] = String(contentLength);
    }

    return headers;
  },

  /**
   * Normalize header names to lowercase
   * @param {Object} headers - Headers object
   * @returns {Object} Normalized headers object
   */
  normalizeHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
      return {};
    }

    const normalized = {};
    Object.entries(headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value;
    });

    return normalized;
  },

  /**
   * Convert B2 response headers to camelCase object
   * @param {Object} headers - Response headers
   * @returns {Object} Converted headers object
   */
  convertBzHeaders(headers) {
    const result = {};

    if (!headers || typeof headers !== 'object') {
      return result;
    }

    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase().startsWith('x-bz-')) {
        let camelKey;

        if (key.toLowerCase().startsWith('x-bz-info-')) {
          // Handle info headers specially
          camelKey = 'info' + this.toCamelCase(key.substring(11));
        } else {
          // Handle other B2 headers
          camelKey = this.toCamelCase(key.substring(5)); // Remove 'x-bz-' prefix
        }

        result[camelKey] = value;
      }
    });

    return result;
  },

  /**
   * Convert kebab-case to camelCase
   * @param {string} str - String to convert
   * @returns {string} CamelCase string
   */
  toCamelCase(str) {
    return str
      .split('-')
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  },
};

// Create a default header builder instance for convenience
export const headerBuilder = new HeaderBuilder();
