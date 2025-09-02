/**
 * B2Client - Main client class for Backblaze B2 API
 * Orchestrates all manager classes and provides the public API interface
 */

import { HttpClient } from './core/http-client.js';
import { RetryHandler } from './core/retry-handler.js';
import { AuthManager } from './managers/auth-manager.js';
import { BucketManager } from './managers/bucket-manager.js';
import { FileManager } from './managers/file-manager.js';
import { KeyManager } from './managers/key-manager.js';
import { DEFAULT_CONFIG, BUCKET_TYPES, KEY_CAPABILITIES, B2_API_BASE_URL } from './constants.js';

export class B2Client {
  constructor(options = {}) {
    // Validate options
    if (options && typeof options !== 'object') {
      throw new Error('options must be an object');
    }

    // Handle legacy constructor parameters for backward compatibility
    this.accountId = options.accountId || null;
    this.applicationKeyId = options.applicationKeyId || null;
    this.applicationKey = options.applicationKey || null;
    this.apiUrl = options.apiUrl || B2_API_BASE_URL;

    // Legacy properties for backward compatibility
    this.authorizationToken = null;
    this.downloadUrl = null;

    // Store configuration with proper mapping
    this.config = {
      timeout: options.timeout || DEFAULT_CONFIG.REQUEST_TIMEOUT,
      retries: options.retries || DEFAULT_CONFIG.RETRY_ATTEMPTS,
      retryDelay: options.retryDelay || DEFAULT_CONFIG.RETRY_DELAY,
      retryDelayMultiplier: options.retryDelayMultiplier || DEFAULT_CONFIG.RETRY_DELAY_MULTIPLIER,
      maxRetryDelay: options.maxRetryDelay || DEFAULT_CONFIG.MAX_RETRY_DELAY,
      headers: options.headers || {},
      ...options
    };

    // Initialize HTTP client with retry handler
    const retryOptions = {
      retries: this.config.retries,
      retryDelay: this.config.retryDelay,
      retryDelayMultiplier: this.config.retryDelayMultiplier,
      maxRetryDelay: this.config.maxRetryDelay,
    };

    this.retryHandler = new RetryHandler(retryOptions);

    const httpOptions = {
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: this.config.headers,
    };

    this.httpClient = new HttpClient(httpOptions);

    // Initialize managers
    this.authManager = new AuthManager(this.httpClient, this.config);
    this.bucketManager = new BucketManager(
      this.httpClient,
      this.authManager,
      this.config
    );
    this.fileManager = new FileManager(
      this.httpClient,
      this.authManager,
      this.config
    );
    this.keyManager = new KeyManager(
      this.httpClient,
      this.authManager,
      this.config
    );

    // Store credentials for potential re-authentication
    this.credentials = null;

    // Add backward compatibility constants as instance properties
    this.BUCKET_TYPES = BUCKET_TYPES;
    this.KEY_CAPABILITIES = KEY_CAPABILITIES;
  }

  // ===== AUTHENTICATION METHODS =====

  /**
   * Authorize with B2 API using application credentials
   * @param {Object|string} options - Authentication options or applicationKeyId (for backward compatibility)
   * @param {string} options.applicationKeyId - Application key ID
   * @param {string} options.applicationKey - Application key
   * @param {string} [applicationKey] - Application key (for backward compatibility when first param is string)
   * @returns {Promise<Object>} Authentication response
   */
  async authorize(options, applicationKey) {
    // Handle backward compatibility: authorize(applicationKeyId, applicationKey)
    let credentials;
    if (typeof options === 'string') {
      credentials = {
        applicationKeyId: options,
        applicationKey: applicationKey,
      };
    } else if (options && typeof options === 'object') {
      credentials = {
        applicationKeyId: options.applicationKeyId,
        applicationKey: options.applicationKey,
      };
    } else if (!options && this.applicationKeyId && this.applicationKey) {
      // Use instance properties if no arguments provided (legacy behavior)
      credentials = {
        applicationKeyId: this.applicationKeyId,
        applicationKey: this.applicationKey,
      };
    } else {
      throw new Error(
        'Invalid arguments. Expected object with applicationKeyId and applicationKey, or applicationKeyId and applicationKey as separate strings'
      );
    }

    // Store credentials for potential re-authentication
    this.credentials = credentials;

    // Delegate to auth manager with retry handling
    const response = await this.retryHandler.executeWithRetry(async () => {
      return this.authManager.authorize(credentials, {
        timeout: this.config.timeout,
      });
    });

    // Update legacy instance properties for backward compatibility
    if (response && response.data) {
      this.authorizationToken = response.data.authorizationToken;
      this.apiUrl = response.data.apiUrl;
      this.downloadUrl = response.data.downloadUrl;
    }

    return response;
  }

  // ===== BUCKET METHODS =====

  /**
   * Create a new bucket
   * @param {Object|string} options - Bucket creation options or bucket name (for backward compatibility)
   * @param {string} options.bucketName - Name of the bucket to create
   * @param {string} options.bucketType - Type of bucket (allPublic or allPrivate)
   * @param {string} [bucketType] - Bucket type (for backward compatibility when first param is string)
   * @returns {Promise<Object>} Bucket creation response
   */
  async createBucket(options, bucketType) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.create(options, bucketType);
    });
  }

  /**
   * Delete a bucket
   * @param {Object|string} options - Bucket deletion options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to delete
   * @returns {Promise<Object>} Bucket deletion response
   */
  async deleteBucket(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.delete(options);
    });
  }

  /**
   * List buckets
   * @param {Object} [options={}] - List options
   * @returns {Promise<Object>} List of buckets response
   */
  async listBuckets(options = {}) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.list(options);
    });
  }

  /**
   * Get bucket information by name or ID
   * @param {Object} options - Get bucket options
   * @param {string} [options.bucketName] - Name of the bucket to get
   * @param {string} [options.bucketId] - ID of the bucket to get
   * @returns {Promise<Object>} Bucket information response
   */
  async getBucket(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.get(options);
    });
  }

  /**
   * Update bucket type
   * @param {Object|string} options - Bucket update options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to update
   * @param {string} options.bucketType - New bucket type
   * @param {string} [bucketType] - New bucket type (for backward compatibility when first param is string)
   * @returns {Promise<Object>} Bucket update response
   */
  async updateBucket(options, bucketType) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.update(options, bucketType);
    });
  }

  /**
   * Get upload URL for a bucket
   * @param {Object|string} options - Upload URL options or bucket ID (for backward compatibility)
   * @param {string} options.bucketId - ID of the bucket to get upload URL for
   * @returns {Promise<Object>} Upload URL response
   */
  async getUploadUrl(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.bucketManager.getUploadUrl(options);
    });
  }

  // ===== FILE METHODS =====

  /**
   * Upload a file to B2
   * @param {Object} options - Upload options
   * @param {string} options.uploadUrl - Upload URL from getUploadUrl
   * @param {string} options.uploadAuthToken - Upload authorization token
   * @param {string} options.fileName - Name of the file
   * @param {Buffer|Uint8Array|string} options.data - File data to upload
   * @param {string} [options.contentType] - Content type (defaults to application/octet-stream)
   * @param {string} [options.contentSha1] - SHA1 hash of content (will be calculated if not provided)
   * @param {Object} [options.info] - File info metadata
   * @param {Function} [options.onUploadProgress] - Progress callback function
   * @returns {Promise<Object>} Upload response
   */
  async uploadFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.uploadFile(options);
    });
  }

  /**
   * Download a file by name
   * @param {Object|string} options - Download options or bucket name (for backward compatibility)
   * @param {string} options.bucketName - Name of the bucket containing the file
   * @param {string} options.fileName - Name of the file to download
   * @param {string} [options.responseType] - Response type: 'json', 'text', 'arraybuffer', 'blob', 'stream' (default: 'arraybuffer')
   * @param {Function} [options.onDownloadProgress] - Progress callback function
   * @param {Object} [options.headers] - Additional headers for the request
   * @param {string} [fileName] - File name (for backward compatibility when first param is bucket name)
   * @returns {Promise<Object>} Download response with file data
   */
  async downloadFileByName(options, fileName) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.downloadFileByName(options, fileName);
    });
  }

  /**
   * Download a file by ID
   * @param {Object|string} options - Download options or file ID (for backward compatibility)
   * @param {string} options.fileId - ID of the file to download
   * @param {string} [options.responseType] - Response type: 'json', 'text', 'arraybuffer', 'blob', 'stream' (default: 'arraybuffer')
   * @param {Function} [options.onDownloadProgress] - Progress callback function
   * @param {Object} [options.headers] - Additional headers for the request
   * @returns {Promise<Object>} Download response with file data
   */
  async downloadFileById(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.downloadFileById(options);
    });
  }

  /**
   * List file names in a bucket
   * @param {Object} options - List options
   * @param {string} options.bucketId - ID of the bucket to list files from
   * @param {string} [options.startFileName] - File name to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of files to return (default: 100, max: 10000)
   * @param {string} [options.prefix] - Only return file names that start with this prefix
   * @param {string} [options.delimiter] - Delimiter for grouping file names
   * @returns {Promise<Object>} List of file names response
   */
  async listFileNames(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.listFileNames(options);
    });
  }

  /**
   * List file versions in a bucket
   * @param {Object} options - List options
   * @param {string} options.bucketId - ID of the bucket to list file versions from
   * @param {string} [options.startFileName] - File name to start listing from
   * @param {string} [options.startFileId] - File ID to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of file versions to return (default: 100, max: 10000)
   * @param {string} [options.prefix] - Only return file names that start with this prefix
   * @param {string} [options.delimiter] - Delimiter for grouping file names
   * @returns {Promise<Object>} List of file versions response
   */
  async listFileVersions(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.listFileVersions(options);
    });
  }

  /**
   * Get file information
   * @param {Object|string} options - File info options or file ID (for backward compatibility)
   * @param {string} options.fileId - ID of the file to get info for
   * @returns {Promise<Object>} File information response
   */
  async getFileInfo(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.getFileInfo(options);
    });
  }

  /**
   * Delete a file version
   * @param {Object} options - Delete options
   * @param {string} options.fileId - ID of the file to delete
   * @param {string} options.fileName - Name of the file to delete
   * @returns {Promise<Object>} Delete response
   */
  async deleteFileVersion(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.deleteFileVersion(options);
    });
  }

  /**
   * Hide a file (make it invisible in file listings)
   * @param {Object} options - Hide file options
   * @param {string} options.bucketId - ID of the bucket containing the file
   * @param {string} options.fileName - Name of the file to hide
   * @returns {Promise<Object>} Hide file response
   */
  async hideFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.hideFile(options);
    });
  }

  /**
   * Get download authorization for private files
   * @param {Object} options - Download authorization options
   * @param {string} options.bucketId - ID of the bucket containing the files
   * @param {string} options.fileNamePrefix - Prefix of file names to authorize (can be empty string for all files)
   * @param {number} [options.validDurationInSeconds] - How long the authorization is valid (default: 604800 = 7 days, max: 604800)
   * @param {string} [options.b2ContentDisposition] - Content-Disposition header value for downloads
   * @returns {Promise<Object>} Download authorization response
   */
  async getDownloadAuthorization(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.getDownloadAuthorization(options);
    });
  }

  // ===== LARGE FILE METHODS =====

  /**
   * Start a large file upload
   * @param {Object} options - Start large file options
   * @param {string} options.bucketId - ID of the bucket to upload to
   * @param {string} options.fileName - Name of the file to upload
   * @param {string} [options.contentType] - Content type (defaults to application/octet-stream)
   * @param {Object} [options.fileInfo] - File info metadata
   * @returns {Promise<Object>} Start large file response containing fileId
   */
  async startLargeFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.startLargeFile(options);
    });
  }

  /**
   * Get upload URL for a large file part
   * @param {Object} options - Get upload part URL options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @returns {Promise<Object>} Upload part URL response containing uploadUrl and authorizationToken
   */
  async getUploadPartUrl(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.getUploadPartUrl(options);
    });
  }

  /**
   * Upload a part of a large file
   * @param {Object} options - Upload part options
   * @param {string} options.uploadUrl - Upload URL from getUploadPartUrl
   * @param {string} options.authorizationToken - Authorization token from getUploadPartUrl
   * @param {number} options.partNumber - Part number (1-based, must be between 1 and 10000)
   * @param {Buffer|Uint8Array|string} options.data - Part data to upload
   * @param {string} [options.contentSha1] - SHA1 hash of part content (will be calculated if not provided)
   * @param {Function} [options.onUploadProgress] - Progress callback function
   * @returns {Promise<Object>} Upload part response
   */
  async uploadPart(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.uploadPart(options);
    });
  }

  /**
   * Finish a large file upload
   * @param {Object} options - Finish large file options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @param {Array<string>} options.partSha1Array - Array of SHA1 hashes for each part in order
   * @returns {Promise<Object>} Finish large file response
   */
  async finishLargeFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.finishLargeFile(options);
    });
  }

  /**
   * Cancel a large file upload
   * @param {Object} options - Cancel large file options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @returns {Promise<Object>} Cancel large file response
   */
  async cancelLargeFile(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.cancelLargeFile(options);
    });
  }

  /**
   * List parts of a large file upload
   * @param {Object} options - List parts options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @param {number} [options.startPartNumber] - Part number to start listing from
   * @param {number} [options.maxPartCount] - Maximum number of parts to return (default: 100, max: 10000)
   * @returns {Promise<Object>} List parts response
   */
  async listParts(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.listParts(options);
    });
  }

  /**
   * List unfinished large file uploads
   * @param {Object} options - List unfinished large files options
   * @param {string} options.bucketId - ID of the bucket to list unfinished files from
   * @param {string} [options.startFileId] - File ID to start listing from
   * @param {number} [options.maxFileCount] - Maximum number of files to return (default: 100, max: 10000)
   * @returns {Promise<Object>} List unfinished large files response
   */
  async listUnfinishedLargeFiles(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.fileManager.listUnfinishedLargeFiles(options);
    });
  }

  // ===== KEY MANAGEMENT METHODS =====

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
    return this.retryHandler.executeWithRetry(async () => {
      return this.keyManager.createKey(options);
    });
  }

  /**
   * Delete an application key
   * @param {Object|string} options - Key deletion options or key ID (for backward compatibility)
   * @param {string} options.applicationKeyId - ID of the key to delete
   * @returns {Promise<Object>} Key deletion response
   */
  async deleteKey(options) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.keyManager.deleteKey(options);
    });
  }

  /**
   * List application keys
   * @param {Object} [options={}] - List options
   * @param {number} [options.maxKeyCount] - Maximum number of keys to return (default 100, max 10000)
   * @param {string} [options.startApplicationKeyId] - Key ID to start listing from (for pagination)
   * @returns {Promise<Object>} List of keys response
   */
  async listKeys(options = {}) {
    return this.retryHandler.executeWithRetry(async () => {
      return this.keyManager.listKeys(options);
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Check if currently authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.authManager.isAuthenticated();
  }

  /**
   * Get current authentication context
   * @returns {Object} Current auth context
   */
  getAuthContext() {
    return this.authManager.getAuthContext();
  }

  /**
   * Clear authentication context
   */
  clearAuth() {
    this.authManager.clearAuthContext();
    this.credentials = null;

    // Clear legacy instance properties
    this.authorizationToken = null;
    this.apiUrl = null;
    this.downloadUrl = null;
  }

  /**
   * Refresh authentication using stored credentials
   * @returns {Promise<Object>} New authentication response
   * @throws {Error} If no credentials are stored
   */
  async refreshAuth() {
    if (!this.credentials) {
      throw new Error('No credentials stored. Call authorize() first.');
    }

    return this.authorize(this.credentials);
  }

  /**
   * Manually set authentication context from B2 API response
   * @param {Object} authResponse - Authentication response from B2 API
   * @param {string} authResponse.authorizationToken - Authorization token
   * @param {string} authResponse.apiUrl - API URL for requests
   * @param {string} authResponse.downloadUrl - Download URL for files
   * @param {string} authResponse.accountId - Account ID
   * @param {number} [authResponse.recommendedPartSize] - Recommended part size for large files
   * @param {number} [authResponse.absoluteMinimumPartSize] - Minimum part size for large files
   * @param {Object} [authResponse.allowed] - Allowed capabilities and restrictions
   */
  saveAuthContext(authResponse) {
    // Delegate to auth manager
    this.authManager.saveAuthContext(authResponse);

    // Update legacy instance properties for backward compatibility
    if (authResponse && typeof authResponse === 'object') {
      this.authorizationToken = authResponse.authorizationToken || null;
      this.apiUrl = authResponse.apiUrl || null;
      this.downloadUrl = authResponse.downloadUrl || null;
    }
  }
}

// Export constants for backward compatibility
export { BUCKET_TYPES, KEY_CAPABILITIES };

export default B2Client;
