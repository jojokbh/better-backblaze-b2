/**
 * File Manager for B2 API
 * Handles file upload, download, listing, and management operations
 */

import { B2_ERROR_CODES, CONTENT_TYPES, DEFAULT_CONFIG } from '../constants.js';
import { Validator } from '../utils/validation.js';
import { EndpointBuilder } from '../utils/endpoints.js';
import { HeaderUtils } from '../utils/headers.js';
import { Sha1Hasher } from '../utils/crypto.js';

export class FileManager {
  constructor(httpClient, authManager, config = {}) {
    this.httpClient = httpClient;
    this.authManager = authManager;
    this.config = config;
    this.endpointBuilder = new EndpointBuilder();
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
   * Validate file name according to B2 requirements
   * @param {string} fileName - File name to validate
   * @throws {Error} If file name is invalid
   */
  validateFileName(fileName) {
    if (typeof fileName !== 'string') {
      throw new Error('fileName is required and must be a string');
    }

    if (fileName.length === 0) {
      throw new Error('File name cannot be empty');
    }

    if (fileName.length > 1024) {
      throw new Error('File name cannot exceed 1024 characters');
    }

    // B2 doesn't allow certain characters in file names
    const invalidChars = /[\x00-\x1f\x7f]/;
    if (invalidChars.test(fileName)) {
      throw new Error('File name contains invalid characters');
    }
  }

  /**
   * Validate file ID
   * @param {string} fileId - File ID to validate
   * @throws {Error} If file ID is invalid
   */
  validateFileId(fileId) {
    if (typeof fileId !== 'string') {
      throw new Error('fileId is required and must be a string');
    }

    if (fileId.trim().length === 0) {
      throw new Error('fileId cannot be empty');
    }
  }

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
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      uploadUrl,
      uploadAuthToken,
      fileName,
      data,
      contentType = CONTENT_TYPES.OCTET_STREAM,
      contentSha1,
      info,
      onUploadProgress,
    } = options;

    // Validate required parameters
    if (!uploadUrl || typeof uploadUrl !== 'string') {
      throw new Error('uploadUrl is required and must be a string');
    }

    if (!uploadAuthToken || typeof uploadAuthToken !== 'string') {
      throw new Error('uploadAuthToken is required and must be a string');
    }

    this.validateFileName(fileName);

    if (!data) {
      throw new Error('data is required');
    }

    // Calculate content length
    let contentLength;
    if (typeof data === 'string') {
      contentLength = new TextEncoder().encode(data).length;
    } else {
      contentLength = data.length;
    }

    // Calculate SHA1 if not provided
    let sha1Hash = contentSha1;
    if (!sha1Hash) {
      sha1Hash = await Sha1Hasher.hash(data);
    }

    // Create upload headers
    const headers = HeaderUtils.createUploadHeaders({
      authToken: uploadAuthToken,
      fileName,
      contentType,
      contentSha1: sha1Hash,
      contentLength,
      info,
    });

    try {
      const response = await this.httpClient.post(uploadUrl, data, {
        headers,
        timeout: this.config.uploadTimeout || this.config.timeout,
        onUploadProgress,
      });

      return response;
    } catch (error) {
      // Handle specific B2 upload errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`File upload failed: ${error.message}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
  }

  /**
   * Get file information
   * @param {Object|string} options - File info options or file ID (for backward compatibility)
   * @param {string} options.fileId - ID of the file to get info for
   * @returns {Promise<Object>} File information response
   */
  async getFileInfo(options) {
    this.ensureAuthenticated();

    // Handle backward compatibility: getFileInfo(fileId)
    let fileId;
    if (typeof options === 'string') {
      fileId = options;
    } else if (options && typeof options === 'object') {
      fileId = options.fileId;
    } else {
      throw new Error(
        'Invalid arguments. Expected object with fileId or fileId as string'
      );
    }

    // Validate inputs
    this.validateFileId(fileId);

    const requestData = {
      fileId: fileId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getFileInfoUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 file info errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.FILE_NOT_PRESENT
      ) {
        const b2Error = new Error(`File not found: ${fileId}`);
        b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Delete a file version
   * @param {Object} options - Delete options
   * @param {string} options.fileId - ID of the file to delete
   * @param {string} options.fileName - Name of the file to delete
   * @returns {Promise<Object>} Delete response
   */
  async deleteFileVersion(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId, fileName } = options;

    // Validate inputs
    this.validateFileId(fileId);
    this.validateFileName(fileName);

    const requestData = {
      fileId: fileId,
      fileName: fileName,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getDeleteFileVersionUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 delete errors
      if (
        error.status === 400 &&
        error.code === B2_ERROR_CODES.FILE_NOT_PRESENT
      ) {
        const b2Error = new Error(`File not found: ${fileId}`);
        b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
        b2Error.status = 400;
        throw b2Error;
      }

      throw error;
    }
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
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { bucketId, startFileName, maxFileCount, prefix, delimiter } =
      options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    // Validate optional parameters
    if (maxFileCount !== undefined) {
      if (
        typeof maxFileCount !== 'number' ||
        maxFileCount < 1 ||
        maxFileCount > 10000
      ) {
        throw new Error('maxFileCount must be a number between 1 and 10000');
      }
    }

    if (startFileName !== undefined && typeof startFileName !== 'string') {
      throw new Error('startFileName must be a string');
    }

    if (prefix !== undefined && typeof prefix !== 'string') {
      throw new Error('prefix must be a string');
    }

    if (delimiter !== undefined && typeof delimiter !== 'string') {
      throw new Error('delimiter must be a string');
    }

    const requestData = {
      bucketId: bucketId,
    };

    // Add optional parameters
    if (startFileName !== undefined) {
      requestData.startFileName = startFileName;
    }
    if (maxFileCount !== undefined) {
      requestData.maxFileCount = maxFileCount;
    }
    if (prefix !== undefined) {
      requestData.prefix = prefix;
    }
    if (delimiter !== undefined) {
      requestData.delimiter = delimiter;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListFileNamesUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 list errors
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
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      bucketId,
      startFileName,
      startFileId,
      maxFileCount,
      prefix,
      delimiter,
    } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    // Validate optional parameters
    if (maxFileCount !== undefined) {
      if (
        typeof maxFileCount !== 'number' ||
        maxFileCount < 1 ||
        maxFileCount > 10000
      ) {
        throw new Error('maxFileCount must be a number between 1 and 10000');
      }
    }

    if (startFileName !== undefined && typeof startFileName !== 'string') {
      throw new Error('startFileName must be a string');
    }

    if (startFileId !== undefined && typeof startFileId !== 'string') {
      throw new Error('startFileId must be a string');
    }

    if (prefix !== undefined && typeof prefix !== 'string') {
      throw new Error('prefix must be a string');
    }

    if (delimiter !== undefined && typeof delimiter !== 'string') {
      throw new Error('delimiter must be a string');
    }

    const requestData = {
      bucketId: bucketId,
    };

    // Add optional parameters
    if (startFileName !== undefined) {
      requestData.startFileName = startFileName;
    }
    if (startFileId !== undefined) {
      requestData.startFileId = startFileId;
    }
    if (maxFileCount !== undefined) {
      requestData.maxFileCount = maxFileCount;
    }
    if (prefix !== undefined) {
      requestData.prefix = prefix;
    }
    if (delimiter !== undefined) {
      requestData.delimiter = delimiter;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListFileVersionsUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 list errors
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
   * Hide a file (make it invisible in file listings)
   * @param {Object} options - Hide file options
   * @param {string} options.bucketId - ID of the bucket containing the file
   * @param {string} options.fileName - Name of the file to hide
   * @returns {Promise<Object>} Hide file response
   */
  async hideFile(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { bucketId, fileName } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    this.validateFileName(fileName);

    const requestData = {
      bucketId: bucketId,
      fileName: fileName,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getHideFileUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 hide file errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_ID) {
          const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`File not found: ${fileName}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
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
    this.ensureAuthenticated();

    // Handle backward compatibility: downloadFileByName(bucketName, fileName)
    let bucketName, actualFileName, responseType, onDownloadProgress, headers;

    if (typeof options === 'string') {
      // Legacy format: downloadFileByName(bucketName, fileName)
      bucketName = options;
      actualFileName = fileName;
      responseType = 'arraybuffer';
      onDownloadProgress = undefined;
      headers = {};
    } else if (options && typeof options === 'object') {
      // New format: downloadFileByName({ bucketName, fileName, ... })
      bucketName = options.bucketName;
      actualFileName = options.fileName;
      responseType = options.responseType || 'arraybuffer';
      onDownloadProgress = options.onDownloadProgress;
      headers = options.headers || {};
    } else {
      throw new Error(
        'Invalid arguments. Expected object with bucketName and fileName, or bucketName and fileName as separate strings'
      );
    }

    // Validate required parameters
    if (typeof bucketName !== 'string') {
      throw new Error('bucketName is required and must be a string');
    }

    if (bucketName.trim().length === 0) {
      throw new Error('bucketName cannot be empty');
    }

    this.validateFileName(actualFileName);

    // Validate response type
    const validResponseTypes = [
      'json',
      'text',
      'arraybuffer',
      'blob',
      'stream',
    ];
    if (!validResponseTypes.includes(responseType)) {
      throw new Error(
        `Invalid responseType. Must be one of: ${validResponseTypes.join(', ')}`
      );
    }

    try {
      const downloadUrl = this.endpointBuilder.getDownloadFileByNameUrl(
        bucketName,
        actualFileName
      );

      const response = await this.httpClient.get(downloadUrl, {
        headers: {
          ...this.authManager.getAuthHeaders(),
          ...headers,
        },
        responseType,
        onDownloadProgress,
        timeout: this.config.downloadTimeout || this.config.timeout,
      });

      return response;
    } catch (error) {
      // Handle specific B2 download errors
      if (error.status === 404) {
        const b2Error = new Error(
          `File not found: ${actualFileName} in bucket ${bucketName}`
        );
        b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
        b2Error.status = 404;
        throw b2Error;
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized access to file: ${actualFileName}`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
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
    this.ensureAuthenticated();

    // Handle backward compatibility: downloadFileById(fileId)
    let fileId, responseType, onDownloadProgress, headers;

    if (typeof options === 'string') {
      // Legacy format: downloadFileById(fileId)
      fileId = options;
      responseType = 'arraybuffer';
      onDownloadProgress = undefined;
      headers = {};
    } else if (options && typeof options === 'object') {
      // New format: downloadFileById({ fileId, ... })
      fileId = options.fileId;
      responseType = options.responseType || 'arraybuffer';
      onDownloadProgress = options.onDownloadProgress;
      headers = options.headers || {};
    } else {
      throw new Error(
        'Invalid arguments. Expected object with fileId or fileId as string'
      );
    }

    // Validate required parameters
    this.validateFileId(fileId);

    // Validate response type
    const validResponseTypes = [
      'json',
      'text',
      'arraybuffer',
      'blob',
      'stream',
    ];
    if (!validResponseTypes.includes(responseType)) {
      throw new Error(
        `Invalid responseType. Must be one of: ${validResponseTypes.join(', ')}`
      );
    }

    try {
      const downloadUrl = this.endpointBuilder.getDownloadFileByIdUrl(fileId);

      const response = await this.httpClient.get(downloadUrl, {
        headers: {
          ...this.authManager.getAuthHeaders(),
          ...headers,
        },
        responseType,
        onDownloadProgress,
        timeout: this.config.downloadTimeout || this.config.timeout,
      });

      return response;
    } catch (error) {
      // Handle specific B2 download errors
      if (error.status === 404) {
        const b2Error = new Error(`File not found: ${fileId}`);
        b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
        b2Error.status = 404;
        throw b2Error;
      }

      if (error.status === 401) {
        const b2Error = new Error(`Unauthorized access to file: ${fileId}`);
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
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
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      bucketId,
      fileNamePrefix,
      validDurationInSeconds = 604800, // 7 days default
      b2ContentDisposition,
    } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    if (typeof fileNamePrefix !== 'string') {
      throw new Error(
        'fileNamePrefix is required and must be a string (can be empty)'
      );
    }

    // Validate optional parameters
    if (validDurationInSeconds !== undefined) {
      if (
        typeof validDurationInSeconds !== 'number' ||
        validDurationInSeconds < 1 ||
        validDurationInSeconds > 604800
      ) {
        throw new Error(
          'validDurationInSeconds must be a number between 1 and 604800 (7 days)'
        );
      }
    }

    if (
      b2ContentDisposition !== undefined &&
      typeof b2ContentDisposition !== 'string'
    ) {
      throw new Error('b2ContentDisposition must be a string');
    }

    const requestData = {
      bucketId: bucketId,
      fileNamePrefix: fileNamePrefix,
      validDurationInSeconds: validDurationInSeconds,
    };

    // Add optional parameters
    if (b2ContentDisposition !== undefined) {
      requestData.b2ContentDisposition = b2ContentDisposition;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getDownloadAuthorizationUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 download authorization errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_ID) {
          const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.NOT_ALLOWED) {
          const b2Error = new Error(
            `Not allowed to get download authorization for bucket: ${bucketId}`
          );
          b2Error.code = B2_ERROR_CODES.NOT_ALLOWED;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for download authorization`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  // ===== LARGE FILE OPERATIONS =====

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
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      bucketId,
      fileName,
      contentType = CONTENT_TYPES.OCTET_STREAM,
      fileInfo,
    } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    this.validateFileName(fileName);

    // Validate optional parameters
    if (contentType !== undefined && typeof contentType !== 'string') {
      throw new Error('contentType must be a string');
    }

    if (
      fileInfo !== undefined &&
      (typeof fileInfo !== 'object' || fileInfo === null)
    ) {
      throw new Error('fileInfo must be an object');
    }

    const requestData = {
      bucketId: bucketId,
      fileName: fileName,
      contentType: contentType,
    };

    // Add file info if provided
    if (fileInfo) {
      requestData.fileInfo = fileInfo;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getStartLargeFileUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 start large file errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.INVALID_BUCKET_ID) {
          const b2Error = new Error(`Invalid bucket ID: ${bucketId}`);
          b2Error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
          b2Error.status = 400;
          throw b2Error;
        }
        if (error.code === B2_ERROR_CODES.NOT_ALLOWED) {
          const b2Error = new Error(
            `Not allowed to upload to bucket: ${bucketId}`
          );
          b2Error.code = B2_ERROR_CODES.NOT_ALLOWED;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for large file upload`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Get upload URL for a large file part
   * @param {Object} options - Get upload part URL options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @returns {Promise<Object>} Upload part URL response containing uploadUrl and authorizationToken
   */
  async getUploadPartUrl(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId } = options;

    // Validate required parameters
    this.validateFileId(fileId);

    const requestData = {
      fileId: fileId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getUploadPartUrlEndpoint(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 get upload part URL errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`Large file not found: ${fileId}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for upload part URL`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
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
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const {
      uploadUrl,
      authorizationToken,
      partNumber,
      data,
      contentSha1,
      onUploadProgress,
    } = options;

    // Validate required parameters
    if (!uploadUrl || typeof uploadUrl !== 'string') {
      throw new Error('uploadUrl is required and must be a string');
    }

    if (!authorizationToken || typeof authorizationToken !== 'string') {
      throw new Error('authorizationToken is required and must be a string');
    }

    if (
      typeof partNumber !== 'number' ||
      partNumber < 1 ||
      partNumber > 10000
    ) {
      throw new Error('partNumber must be a number between 1 and 10000');
    }

    if (!data) {
      throw new Error('data is required');
    }

    // Calculate content length
    let contentLength;
    if (typeof data === 'string') {
      contentLength = new TextEncoder().encode(data).length;
    } else {
      contentLength = data.length;
    }

    // Validate part size (minimum 5MB except for last part)
    const MIN_PART_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

    if (contentLength > MAX_PART_SIZE) {
      throw new Error(`Part size cannot exceed ${MAX_PART_SIZE} bytes (5GB)`);
    }

    // Calculate SHA1 if not provided
    let sha1Hash = contentSha1;
    if (!sha1Hash) {
      sha1Hash = await Sha1Hasher.hash(data);
    }

    // Create upload headers for part
    const headers = {
      Authorization: authorizationToken,
      'Content-Type': CONTENT_TYPES.OCTET_STREAM,
      'Content-Length': contentLength.toString(),
      'X-Bz-Content-Sha1': sha1Hash,
      'X-Bz-Part-Number': partNumber.toString(),
    };

    try {
      const response = await this.httpClient.post(uploadUrl, data, {
        headers,
        timeout: this.config.uploadTimeout || this.config.timeout,
        onUploadProgress,
      });

      return response;
    } catch (error) {
      // Handle specific B2 upload part errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(
            `Large file upload failed: ${error.message}`
          );
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      throw error;
    }
  }

  /**
   * Finish a large file upload
   * @param {Object} options - Finish large file options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @param {Array<string>} options.partSha1Array - Array of SHA1 hashes for each part in order
   * @returns {Promise<Object>} Finish large file response
   */
  async finishLargeFile(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId, partSha1Array } = options;

    // Validate required parameters
    this.validateFileId(fileId);

    if (!Array.isArray(partSha1Array)) {
      throw new Error('partSha1Array is required and must be an array');
    }

    if (partSha1Array.length === 0) {
      throw new Error('partSha1Array cannot be empty');
    }

    if (partSha1Array.length > DEFAULT_CONFIG.MAX_PARTS_COUNT) {
      throw new Error(
        `partSha1Array cannot have more than ${DEFAULT_CONFIG.MAX_PARTS_COUNT} parts`
      );
    }

    // Validate each SHA1 hash
    partSha1Array.forEach((sha1, index) => {
      if (typeof sha1 !== 'string') {
        throw new Error(`partSha1Array[${index}] must be a string`);
      }
      if (sha1.length !== 40) {
        throw new Error(
          `partSha1Array[${index}] must be a 40-character SHA1 hash`
        );
      }
      if (!/^[a-fA-F0-9]{40}$/.test(sha1)) {
        throw new Error(
          `partSha1Array[${index}] must be a valid hexadecimal SHA1 hash`
        );
      }
    });

    const requestData = {
      fileId: fileId,
      partSha1Array: partSha1Array,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getFinishLargeFileUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 finish large file errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`Large file not found: ${fileId}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for finishing large file`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * Cancel a large file upload
   * @param {Object} options - Cancel large file options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @returns {Promise<Object>} Cancel large file response
   */
  async cancelLargeFile(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId } = options;

    // Validate required parameters
    this.validateFileId(fileId);

    const requestData = {
      fileId: fileId,
    };

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getCancelLargeFileUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 cancel large file errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`Large file not found: ${fileId}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for canceling large file`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
  }

  /**
   * List parts of a large file upload
   * @param {Object} options - List parts options
   * @param {string} options.fileId - ID of the large file from startLargeFile
   * @param {number} [options.startPartNumber] - Part number to start listing from (1-based)
   * @param {number} [options.maxPartCount] - Maximum number of parts to return (default: 100, max: 10000)
   * @returns {Promise<Object>} List parts response
   */
  async listParts(options) {
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { fileId, startPartNumber, maxPartCount } = options;

    // Validate required parameters
    this.validateFileId(fileId);

    // Validate optional parameters
    if (startPartNumber !== undefined) {
      if (
        typeof startPartNumber !== 'number' ||
        startPartNumber < 1 ||
        startPartNumber > DEFAULT_CONFIG.MAX_PARTS_COUNT
      ) {
        throw new Error(
          `startPartNumber must be a number between 1 and ${DEFAULT_CONFIG.MAX_PARTS_COUNT}`
        );
      }
    }

    if (maxPartCount !== undefined) {
      if (
        typeof maxPartCount !== 'number' ||
        maxPartCount < 1 ||
        maxPartCount > 10000
      ) {
        throw new Error('maxPartCount must be a number between 1 and 10000');
      }
    }

    const requestData = {
      fileId: fileId,
    };

    // Add optional parameters
    if (startPartNumber !== undefined) {
      requestData.startPartNumber = startPartNumber;
    }
    if (maxPartCount !== undefined) {
      requestData.maxPartCount = maxPartCount;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListPartsUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 list parts errors
      if (error.status === 400) {
        if (error.code === B2_ERROR_CODES.FILE_NOT_PRESENT) {
          const b2Error = new Error(`Large file not found: ${fileId}`);
          b2Error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
          b2Error.status = 400;
          throw b2Error;
        }
      }

      if (error.status === 401) {
        const b2Error = new Error(
          `Unauthorized: Invalid credentials for listing parts`
        );
        b2Error.code = B2_ERROR_CODES.BAD_AUTH_TOKEN;
        b2Error.status = 401;
        throw b2Error;
      }

      throw error;
    }
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
    this.ensureAuthenticated();

    if (!options || typeof options !== 'object') {
      throw new Error('options object is required');
    }

    const { bucketId, startFileId, maxFileCount } = options;

    // Validate required parameters
    if (typeof bucketId !== 'string') {
      throw new Error('bucketId is required and must be a string');
    }

    if (bucketId.trim().length === 0) {
      throw new Error('bucketId cannot be empty');
    }

    // Validate optional parameters
    if (maxFileCount !== undefined) {
      if (
        typeof maxFileCount !== 'number' ||
        maxFileCount < 1 ||
        maxFileCount > 10000
      ) {
        throw new Error('maxFileCount must be a number between 1 and 10000');
      }
    }

    if (startFileId !== undefined && typeof startFileId !== 'string') {
      throw new Error('startFileId must be a string');
    }

    const requestData = {
      bucketId: bucketId,
    };

    // Add optional parameters
    if (startFileId !== undefined) {
      requestData.startFileId = startFileId;
    }
    if (maxFileCount !== undefined) {
      requestData.maxFileCount = maxFileCount;
    }

    try {
      const response = await this.httpClient.post(
        this.endpointBuilder.getListUnfinishedLargeFilesUrl(),
        requestData,
        {
          headers: this.authManager.getAuthHeaders(),
          timeout: this.config.timeout,
        }
      );

      return response;
    } catch (error) {
      // Handle specific B2 list errors
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

export default FileManager;
