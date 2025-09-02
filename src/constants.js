// API constants and configuration values

// B2 API Base URLs
export const B2_API_BASE_URL = 'https://api.backblazeb2.com';
export const B2_API_VERSION = 'v2';

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTHORIZE_ACCOUNT: '/b2api/v4/b2_authorize_account',

  // Bucket operations
  CREATE_BUCKET: '/b2api/v2/b2_create_bucket',
  DELETE_BUCKET: '/b2api/v2/b2_delete_bucket',
  LIST_BUCKETS: '/b2api/v2/b2_list_buckets',
  UPDATE_BUCKET: '/b2api/v2/b2_update_bucket',
  GET_UPLOAD_URL: '/b2api/v2/b2_get_upload_url',

  // File operations
  UPLOAD_FILE: '/b2api/v2/b2_upload_file',
  DOWNLOAD_FILE_BY_ID: '/b2api/v2/b2_download_file_by_id',
  DOWNLOAD_FILE_BY_NAME: '/file',
  LIST_FILE_NAMES: '/b2api/v2/b2_list_file_names',
  LIST_FILE_VERSIONS: '/b2api/v2/b2_list_file_versions',
  GET_FILE_INFO: '/b2api/v2/b2_get_file_info',
  DELETE_FILE_VERSION: '/b2api/v2/b2_delete_file_version',
  HIDE_FILE: '/b2api/v2/b2_hide_file',

  // Large file operations
  START_LARGE_FILE: '/b2api/v2/b2_start_large_file',
  GET_UPLOAD_PART_URL: '/b2api/v2/b2_get_upload_part_url',
  UPLOAD_PART: '/b2api/v2/b2_upload_part',
  FINISH_LARGE_FILE: '/b2api/v2/b2_finish_large_file',
  CANCEL_LARGE_FILE: '/b2api/v2/b2_cancel_large_file',
  LIST_PARTS: '/b2api/v2/b2_list_parts',
  LIST_UNFINISHED_LARGE_FILES: '/b2api/v2/b2_list_unfinished_large_files',

  // Key management
  CREATE_KEY: '/b2api/v2/b2_create_key',
  DELETE_KEY: '/b2api/v2/b2_delete_key',
  LIST_KEYS: '/b2api/v2/b2_list_keys',

  // Download authorization
  GET_DOWNLOAD_AUTHORIZATION: '/b2api/v2/b2_get_download_authorization',
};

// Bucket Types
export const BUCKET_TYPES = {
  ALL_PRIVATE: 'allPrivate',
  ALL_PUBLIC: 'allPublic',
};

// Key Capabilities
export const KEY_CAPABILITIES = {
  LIST_KEYS: 'listKeys',
  WRITE_KEYS: 'writeKeys',
  DELETE_KEYS: 'deleteKeys',
  LIST_BUCKETS: 'listBuckets',
  WRITE_BUCKETS: 'writeBuckets',
  DELETE_BUCKETS: 'deleteBuckets',
  LIST_ALL_BUCKET_NAMES: 'listAllBucketNames',
  LIST_FILES: 'listFiles',
  READ_FILES: 'readFiles',
  SHARE_FILES: 'shareFiles',
  WRITE_FILES: 'writeFiles',
  DELETE_FILES: 'deleteFiles',
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REQUEST_TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

// Default Configuration
export const DEFAULT_CONFIG = {
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  RETRY_DELAY_MULTIPLIER: 2,
  MAX_RETRY_DELAY: 30000, // 30 seconds

  // Request configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds
  UPLOAD_TIMEOUT: 300000, // 5 minutes for uploads

  // Large file configuration
  RECOMMENDED_PART_SIZE: 100 * 1024 * 1024, // 100MB
  MIN_PART_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_PART_SIZE: 5 * 1024 * 1024 * 1024, // 5GB
  MAX_PARTS_COUNT: 10000,

  // Progress reporting
  PROGRESS_REPORT_INTERVAL: 1000, // 1 second
};

// Error Codes
export const B2_ERROR_CODES = {
  BAD_AUTH_TOKEN: 'bad_auth_token',
  EXPIRED_AUTH_TOKEN: 'expired_auth_token',
  UNSUPPORTED_OPERATION: 'unsupported_operation',
  INVALID_BUCKET_ID: 'invalid_bucket_id',
  INVALID_BUCKET_NAME: 'invalid_bucket_name',
  BUCKET_NOT_EMPTY: 'bucket_not_empty',
  DUPLICATE_BUCKET_NAME: 'duplicate_bucket_name',
  FILE_NOT_PRESENT: 'file_not_present',
  NOT_ALLOWED: 'not_allowed',
  REQUEST_TIMEOUT: 'request_timeout',
  TOO_MANY_REQUESTS: 'too_many_requests',
};

// Retryable Error Codes
export const RETRYABLE_ERROR_CODES = new Set([
  B2_ERROR_CODES.REQUEST_TIMEOUT,
  B2_ERROR_CODES.TOO_MANY_REQUESTS,
]);

// Retryable HTTP Status Codes
export const RETRYABLE_STATUS_CODES = new Set([
  HTTP_STATUS.REQUEST_TIMEOUT,
  HTTP_STATUS.TOO_MANY_REQUESTS,
  HTTP_STATUS.INTERNAL_SERVER_ERROR,
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.GATEWAY_TIMEOUT,
]);

// Content Types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  OCTET_STREAM: 'application/octet-stream',
  TEXT_PLAIN: 'text/plain',
};

// Headers
export const HEADERS = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  CONTENT_LENGTH: 'Content-Length',
  CONTENT_SHA1: 'X-Bz-Content-Sha1',
  FILE_NAME: 'X-Bz-File-Name',
  FILE_ID: 'X-Bz-File-Id',
  PART_NUMBER: 'X-Bz-Part-Number',
  TEST_MODE: 'X-Bz-Test-Mode',
};
