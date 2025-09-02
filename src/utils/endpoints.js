import { B2_API_BASE_URL, API_ENDPOINTS } from '../constants.js';

/**
 * Utility class for constructing B2 API endpoint URLs
 */
export class EndpointBuilder {
  constructor(authContext = null) {
    this.authContext = authContext;
  }

  /**
   * Update the auth context for dynamic URL construction
   * @param {Object} authContext - Authentication context containing apiUrl and downloadUrl
   */
  setAuthContext(authContext) {
    this.authContext = authContext;
  }

  /**
   * Get the base API URL (either from auth context or default)
   * @returns {string} Base API URL
   */
  getApiUrl() {
    return this.authContext?.apiUrl || B2_API_BASE_URL;
  }

  /**
   * Get the download URL from auth context
   * @returns {string} Download URL
   */
  getDownloadUrl() {
    if (!this.authContext?.downloadUrl) {
      throw new Error('Download URL not available. Please authenticate first.');
    }
    return this.authContext.downloadUrl;
  }

  /**
   * Build a complete API endpoint URL
   * @param {string} endpoint - The endpoint path from API_ENDPOINTS
   * @param {Object} params - Optional query parameters
   * @returns {string} Complete URL
   */
  buildApiUrl(endpoint, params = {}) {
    const baseUrl = this.getApiUrl();
    const url = new URL(endpoint, baseUrl);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  /**
   * Build a download URL
   * @param {string} endpoint - The download endpoint path
   * @param {Object} params - Optional query parameters
   * @returns {string} Complete download URL
   */
  buildDownloadUrl(endpoint, params = {}) {
    const baseUrl = this.getDownloadUrl();
    const url = new URL(endpoint, baseUrl);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  // Authentication endpoints
  getAuthorizeAccountUrl() {
    return this.buildApiUrl(API_ENDPOINTS.AUTHORIZE_ACCOUNT);
  }

  // Bucket endpoints
  getCreateBucketUrl() {
    return this.buildApiUrl(API_ENDPOINTS.CREATE_BUCKET);
  }

  getDeleteBucketUrl() {
    return this.buildApiUrl(API_ENDPOINTS.DELETE_BUCKET);
  }

  getListBucketsUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_BUCKETS);
  }

  getUpdateBucketUrl() {
    return this.buildApiUrl(API_ENDPOINTS.UPDATE_BUCKET);
  }

  getUploadUrl() {
    return this.buildApiUrl(API_ENDPOINTS.GET_UPLOAD_URL);
  }

  // File endpoints
  getListFileNamesUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_FILE_NAMES);
  }

  getListFileVersionsUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_FILE_VERSIONS);
  }

  getFileInfoUrl() {
    return this.buildApiUrl(API_ENDPOINTS.GET_FILE_INFO);
  }

  getDeleteFileVersionUrl() {
    return this.buildApiUrl(API_ENDPOINTS.DELETE_FILE_VERSION);
  }

  getHideFileUrl() {
    return this.buildApiUrl(API_ENDPOINTS.HIDE_FILE);
  }

  /**
   * Get download file by name URL
   * @param {string} bucketName - The bucket name
   * @param {string} fileName - The file name (will be URL encoded)
   * @returns {string} Download URL
   */
  getDownloadFileByNameUrl(bucketName, fileName) {
    const encodedFileName = encodeURIComponent(fileName);
    const endpoint = `${API_ENDPOINTS.DOWNLOAD_FILE_BY_NAME}/${encodeURIComponent(bucketName)}/${encodedFileName}`;
    return this.buildDownloadUrl(endpoint);
  }

  /**
   * Get download file by ID URL
   * @param {string} fileId - The file ID
   * @returns {string} Download URL
   */
  getDownloadFileByIdUrl(fileId) {
    return this.buildDownloadUrl(API_ENDPOINTS.DOWNLOAD_FILE_BY_ID, { fileId });
  }

  // Large file endpoints
  getStartLargeFileUrl() {
    return this.buildApiUrl(API_ENDPOINTS.START_LARGE_FILE);
  }

  getUploadPartUrlEndpoint() {
    return this.buildApiUrl(API_ENDPOINTS.GET_UPLOAD_PART_URL);
  }

  getFinishLargeFileUrl() {
    return this.buildApiUrl(API_ENDPOINTS.FINISH_LARGE_FILE);
  }

  getCancelLargeFileUrl() {
    return this.buildApiUrl(API_ENDPOINTS.CANCEL_LARGE_FILE);
  }

  getListPartsUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_PARTS);
  }

  getListUnfinishedLargeFilesUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_UNFINISHED_LARGE_FILES);
  }

  // Key management endpoints
  getCreateKeyUrl() {
    return this.buildApiUrl(API_ENDPOINTS.CREATE_KEY);
  }

  getDeleteKeyUrl() {
    return this.buildApiUrl(API_ENDPOINTS.DELETE_KEY);
  }

  getListKeysUrl() {
    return this.buildApiUrl(API_ENDPOINTS.LIST_KEYS);
  }

  // Download authorization
  getDownloadAuthorizationUrl() {
    return this.buildApiUrl(API_ENDPOINTS.GET_DOWNLOAD_AUTHORIZATION);
  }
}

/**
 * URL encoding utilities for file names and parameters
 */
export const UrlUtils = {
  /**
   * Encode a file name for use in URLs
   * @param {string} fileName - The file name to encode
   * @returns {string} URL-encoded file name
   */
  encodeFileName(fileName) {
    if (typeof fileName !== 'string') {
      throw new Error('File name must be a string');
    }
    return encodeURIComponent(fileName);
  },

  /**
   * Encode a bucket name for use in URLs
   * @param {string} bucketName - The bucket name to encode
   * @returns {string} URL-encoded bucket name
   */
  encodeBucketName(bucketName) {
    if (typeof bucketName !== 'string') {
      throw new Error('Bucket name must be a string');
    }
    return encodeURIComponent(bucketName);
  },

  /**
   * Encode query parameters for URLs
   * @param {Object} params - Object containing key-value pairs
   * @returns {string} URL-encoded query string
   */
  encodeQueryParams(params) {
    if (!params || typeof params !== 'object') {
      return '';
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  },

  /**
   * Validate and encode a file path for B2
   * @param {string} filePath - The file path to validate and encode
   * @returns {string} Validated and encoded file path
   */
  validateAndEncodeFilePath(filePath) {
    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }

    if (filePath.length === 0) {
      throw new Error('File path cannot be empty');
    }

    if (filePath.length > 1024) {
      throw new Error('File path cannot exceed 1024 characters');
    }

    // B2 doesn't allow certain characters in file names
    const invalidChars = /[\x00-\x1f\x7f]/;
    if (invalidChars.test(filePath)) {
      throw new Error('File path contains invalid characters');
    }

    return encodeURIComponent(filePath);
  },
};

// Create a default instance for convenience
export const endpoints = new EndpointBuilder();

// Export individual functions for backward compatibility
export const buildApiUrl = (endpoint, params, authContext) => {
  const builder = new EndpointBuilder(authContext);
  return builder.buildApiUrl(endpoint, params);
};

export const buildDownloadUrl = (endpoint, params, authContext) => {
  const builder = new EndpointBuilder(authContext);
  return builder.buildDownloadUrl(endpoint, params);
};
