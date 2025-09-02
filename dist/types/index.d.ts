/**
 * TypeScript definitions for Backblaze B2 Node.js Library
 * Comprehensive type definitions for all classes, interfaces, and API methods
 */

// ===== CORE TYPES =====

export type ResponseType = 'json' | 'text' | 'arraybuffer' | 'blob' | 'stream';

export interface ProgressEvent {
  loaded: number;
  total: number;
  lengthComputable: boolean;
  progress: number;
  percentage: number;
}

export type ProgressCallback = (progress: ProgressEvent) => void;

// ===== CONFIGURATION TYPES =====

export interface RetryOptions {
  retries?: number;
  retryDelay?: number;
  retryDelayMultiplier?: number;
  maxRetryDelay?: number;
  retryCondition?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface B2ClientOptions {
  apiUrl?: string;
  applicationKeyId?: string;
  accountId?: string;
  applicationKey?: string;
  retry?: RetryOptions;
  retries?: number;
  retryDelay?: number;
  retryDelayMultiplier?: number;
  maxRetryDelay?: number;
  timeout?: number;
  uploadTimeout?: number;
  downloadTimeout?: number;
  headers?: Record<string, string>;
  debug?: boolean;
}

export interface HttpClientOptions {
  timeout?: number;
  baseURL?: string;
  headers?: Record<string, string>;
  progress?: any;
}

export interface RequestOptions {
  method?: string;
  url?: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  responseType?: ResponseType;
  onUploadProgress?: ProgressCallback;
  onDownloadProgress?: ProgressCallback;
}

// ===== RESPONSE TYPES =====

export interface B2Response<T = any> {
  status: number;
  statusText: string;
  headers: Headers;
  data: T;
  config?: {
    url: string;
    method: string;
  };
}

// ===== ERROR TYPES =====

export interface B2ErrorOptions {
  status?: number;
  statusText?: string;
  code?: string;
  response?: B2Response;
  request?: any;
  isRetryable?: boolean;
  isNetworkError?: boolean;
  isHttpError?: boolean;
  retryAttempts?: number;
  isRetryExhausted?: boolean;
}

export class B2Error extends Error {
  name: string;
  status?: number;
  statusText?: string;
  code?: string;
  response?: B2Response;
  request?: any;
  isRetryable: boolean;
  isNetworkError: boolean;
  isHttpError: boolean;
  retryAttempts: number;
  isRetryExhausted: boolean;
  originalError?: Error;
  field?: string;

  constructor(message: string, options?: B2ErrorOptions);
  toJSON(): object;
  getDescription(): string;
}

// ===== AUTHENTICATION TYPES =====

export interface AuthCredentials {
  applicationKeyId: string;
  applicationKey: string;
}

export interface AuthResponse {
  authorizationToken: string;
  accountId: string;
  applicationKeyExpirationTimestamp?: number | null;
  // New nested structure
  apiInfo?: {
    storageApi: {
      apiUrl: string;
      downloadUrl: string;
      recommendedPartSize: number;
      absoluteMinimumPartSize: number;
      allowed: {
        buckets?: Array<{
          id: string;
          name: string;
        }>;
        capabilities: string[];
        namePrefix?: string | null;
      };
      s3ApiUrl?: string;
    };
  };
  // Legacy flat structure (for backward compatibility)
  apiUrl?: string;
  downloadUrl?: string;
  recommendedPartSize?: number;
  absoluteMinimumPartSize?: number;
  allowed?: any;
}

export interface AuthContext extends AuthResponse {
  isAuthenticated: boolean;
}

// ===== BUCKET TYPES =====

export interface BucketInfo {
  bucketId: string;
  bucketName: string;
  bucketType: string;
  accountId: string;
  revision: number;
  bucketInfo?: Record<string, any>;
  corsRules?: any[];
  lifecycleRules?: any[];
}

export interface CreateBucketOptions {
  bucketName: string;
  bucketType: string;
}

export interface DeleteBucketOptions {
  bucketId: string;
}

export interface GetBucketOptions {
  bucketName?: string;
  bucketId?: string;
}

export interface UpdateBucketOptions {
  bucketId: string;
  bucketType: string;
}

export interface GetUploadUrlOptions {
  bucketId: string;
}

export interface UploadUrlResponse {
  bucketId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export interface ListBucketsResponse {
  buckets: BucketInfo[];
}

// ===== FILE TYPES =====

export interface FileInfo {
  fileId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
  contentSha1: string;
  uploadTimestamp: number;
  fileInfo?: Record<string, any>;
  action?: string;
}

export interface UploadFileOptions {
  uploadUrl: string;
  uploadAuthToken: string;
  fileName: string;
  data: Buffer | Uint8Array | string;
  contentType?: string;
  contentSha1?: string;
  info?: Record<string, any>;
  onUploadProgress?: ProgressCallback;
}

export interface DownloadFileByNameOptions {
  bucketName: string;
  fileName: string;
  responseType?: ResponseType;
  onDownloadProgress?: ProgressCallback;
  headers?: Record<string, string>;
}

export interface DownloadFileByIdOptions {
  fileId: string;
  responseType?: ResponseType;
  onDownloadProgress?: ProgressCallback;
  headers?: Record<string, string>;
}

export interface GetFileInfoOptions {
  fileId: string;
}

export interface DeleteFileVersionOptions {
  fileId: string;
  fileName: string;
}

export interface ListFileNamesOptions {
  bucketId: string;
  startFileName?: string;
  maxFileCount?: number;
  prefix?: string;
  delimiter?: string;
}

export interface ListFileVersionsOptions {
  bucketId: string;
  startFileName?: string;
  startFileId?: string;
  maxFileCount?: number;
  prefix?: string;
  delimiter?: string;
}

export interface HideFileOptions {
  bucketId: string;
  fileName: string;
}

export interface GetDownloadAuthorizationOptions {
  bucketId: string;
  fileNamePrefix: string;
  validDurationInSeconds?: number;
  b2ContentDisposition?: string;
}

export interface ListFileNamesResponse {
  files: FileInfo[];
  nextFileName?: string;
}

export interface ListFileVersionsResponse {
  files: FileInfo[];
  nextFileName?: string;
  nextFileId?: string;
}

export interface DownloadAuthorizationResponse {
  bucketId: string;
  fileNamePrefix: string;
  authorizationToken: string;
}

// ===== LARGE FILE TYPES =====

export interface StartLargeFileOptions {
  bucketId: string;
  fileName: string;
  contentType?: string;
  fileInfo?: Record<string, any>;
}

export interface GetUploadPartUrlOptions {
  fileId: string;
}

export interface UploadPartOptions {
  uploadUrl: string;
  authorizationToken: string;
  partNumber: number;
  data: Buffer | Uint8Array | string;
  contentSha1?: string;
  onUploadProgress?: ProgressCallback;
}

export interface FinishLargeFileOptions {
  fileId: string;
  partSha1Array: string[];
}

export interface CancelLargeFileOptions {
  fileId: string;
}

export interface ListPartsOptions {
  fileId: string;
  startPartNumber?: number;
  maxPartCount?: number;
}

export interface ListUnfinishedLargeFilesOptions {
  bucketId: string;
  startFileId?: string;
  maxFileCount?: number;
}

export interface StartLargeFileResponse {
  fileId: string;
  fileName: string;
  accountId: string;
  bucketId: string;
  contentType: string;
  fileInfo?: Record<string, any>;
}

export interface UploadPartUrlResponse {
  fileId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export interface UploadPartResponse {
  fileId: string;
  partNumber: number;
  contentLength: number;
  contentSha1: string;
}

export interface PartInfo {
  fileId: string;
  partNumber: number;
  contentLength: number;
  contentSha1: string;
  uploadTimestamp: number;
}

export interface ListPartsResponse {
  parts: PartInfo[];
  nextPartNumber?: number;
}

export interface UnfinishedLargeFile {
  fileId: string;
  fileName: string;
  accountId: string;
  bucketId: string;
  contentType: string;
  fileInfo?: Record<string, any>;
  uploadTimestamp: number;
}

export interface ListUnfinishedLargeFilesResponse {
  files: UnfinishedLargeFile[];
  nextFileId?: string;
}

// ===== KEY MANAGEMENT TYPES =====

export interface CreateKeyOptions {
  keyName: string;
  capabilities: string[];
  bucketId?: string;
  namePrefix?: string;
  validDurationInSeconds?: number;
}

export interface DeleteKeyOptions {
  applicationKeyId: string;
}

export interface ListKeysOptions {
  maxKeyCount?: number;
  startApplicationKeyId?: string;
}

export interface KeyInfo {
  applicationKeyId: string;
  keyName: string;
  capabilities: string[];
  accountId: string;
  expirationTimestamp?: number;
  bucketId?: string;
  namePrefix?: string;
}

export interface CreateKeyResponse extends KeyInfo {
  applicationKey: string;
}

export interface ListKeysResponse {
  keys: KeyInfo[];
  nextApplicationKeyId?: string;
}

// ===== CONSTANTS =====

export declare const BUCKET_TYPES: {
  readonly ALL_PRIVATE: 'allPrivate';
  readonly ALL_PUBLIC: 'allPublic';
};

export declare const KEY_CAPABILITIES: {
  readonly LIST_KEYS: 'listKeys';
  readonly WRITE_KEYS: 'writeKeys';
  readonly DELETE_KEYS: 'deleteKeys';
  readonly LIST_BUCKETS: 'listBuckets';
  readonly WRITE_BUCKETS: 'writeBuckets';
  readonly DELETE_BUCKETS: 'deleteBuckets';
  readonly LIST_FILES: 'listFiles';
  readonly READ_FILES: 'readFiles';
  readonly SHARE_FILES: 'shareFiles';
  readonly WRITE_FILES: 'writeFiles';
  readonly DELETE_FILES: 'deleteFiles';
};

// ===== CORE CLASSES =====

export class HttpClient {
  constructor(options?: HttpClientOptions);

  request(options: RequestOptions): Promise<B2Response>;
  get(
    url: string,
    options?: Omit<RequestOptions, 'method' | 'url'>
  ): Promise<B2Response>;
  post(
    url: string,
    data?: any,
    options?: Omit<RequestOptions, 'method' | 'url' | 'data'>
  ): Promise<B2Response>;
  put(
    url: string,
    data?: any,
    options?: Omit<RequestOptions, 'method' | 'url' | 'data'>
  ): Promise<B2Response>;
  delete(
    url: string,
    options?: Omit<RequestOptions, 'method' | 'url'>
  ): Promise<B2Response>;
}

export class RetryHandler {
  constructor(options?: RetryOptions);

  executeWithRetry<T>(
    requestFn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T>;
  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options?: RetryOptions
  ): T;
  isRetryable(error: Error): boolean;
  getConfig(): Required<Omit<RetryOptions, 'retryCondition' | 'onRetry'>>;
  updateConfig(options: RetryOptions): void;
}

export class ErrorHandler {
  constructor(options?: { debug?: boolean; logger?: any });

  isRetryable(error: Error): boolean;
  classifyError(error: Error): string;
  createHttpError(response: any, data: any, request?: any): B2Error;
  createNetworkError(originalError: Error, request?: any): B2Error;
  createAuthError(message: string, response?: any): B2Error;
  createValidationError(message: string, field?: string): B2Error;
  enhanceError(error: Error, context?: any): B2Error;
  formatError(error: Error, includeStack?: boolean): object;
  logError(error: Error, context?: any): void;
  isAuthExpired(error: Error): boolean;
  isRateLimited(error: Error): boolean;
  getRateLimitDelay(error: Error): number;
}

export class ProgressHandler {
  constructor(options?: any);

  createProgressEvent(
    loaded: number,
    total: number,
    lengthComputable?: boolean
  ): ProgressEvent;
  createUploadProgressTracker(
    onProgress: ProgressCallback,
    totalSize: number
  ): ((chunk: any) => void) | null;
  createDownloadProgressTracker(
    onProgress: ProgressCallback,
    totalSize: number
  ): ((chunk: any) => void) | null;
  processResponseWithProgress(
    response: Response,
    responseType: ResponseType,
    onDownloadProgress?: ProgressCallback
  ): Promise<any>;
  processResponseWithoutProgress(
    response: Response,
    responseType: ResponseType
  ): Promise<any>;
  calculateBodySize(body: any): number;
  validateProgressCallback(callback?: ProgressCallback): void;
  createThrottledProgressCallback(
    callback: ProgressCallback,
    throttleMs?: number
  ): ProgressCallback | null;
}

// ===== MANAGER CLASSES =====

export class AuthManager {
  constructor(httpClient: HttpClient, config?: any);

  authorize(
    credentials: AuthCredentials,
    options?: any
  ): Promise<B2Response<AuthResponse>>;
  saveAuthContext(authResponse: AuthResponse): void;
  getAuthContext(): AuthContext;
  isAuthenticated(): boolean;
  getAuthToken(): string | null;
  getApiUrl(): string | null;
  getDownloadUrl(): string | null;
  getAccountId(): string | null;
  getRecommendedPartSize(): number | null;
  clearAuthContext(): void;
  getAuthHeaders(): Record<string, string>;
  refreshAuth(
    credentials: AuthCredentials,
    options?: any
  ): Promise<B2Response<AuthResponse>>;
  isAuthExpiredError(error: Error): boolean;
}

export class BucketManager {
  constructor(httpClient: HttpClient, authManager: AuthManager, config?: any);

  create(options: CreateBucketOptions): Promise<B2Response<BucketInfo>>;
  create(
    bucketName: string,
    bucketType: string
  ): Promise<B2Response<BucketInfo>>;

  delete(options: DeleteBucketOptions): Promise<B2Response<BucketInfo>>;
  delete(bucketId: string): Promise<B2Response<BucketInfo>>;

  list(options?: any): Promise<B2Response<ListBucketsResponse>>;
  get(options: GetBucketOptions): Promise<B2Response<ListBucketsResponse>>;

  update(options: UpdateBucketOptions): Promise<B2Response<BucketInfo>>;
  update(bucketId: string, bucketType: string): Promise<B2Response<BucketInfo>>;

  getUploadUrl(
    options: GetUploadUrlOptions
  ): Promise<B2Response<UploadUrlResponse>>;
  getUploadUrl(bucketId: string): Promise<B2Response<UploadUrlResponse>>;
}

export class FileManager {
  constructor(httpClient: HttpClient, authManager: AuthManager, config?: any);

  uploadFile(options: UploadFileOptions): Promise<B2Response<FileInfo>>;

  downloadFileByName(
    options: DownloadFileByNameOptions
  ): Promise<B2Response<any>>;
  downloadFileByName(
    bucketName: string,
    fileName: string
  ): Promise<B2Response<any>>;

  downloadFileById(options: DownloadFileByIdOptions): Promise<B2Response<any>>;
  downloadFileById(fileId: string): Promise<B2Response<any>>;

  getFileInfo(options: GetFileInfoOptions): Promise<B2Response<FileInfo>>;
  getFileInfo(fileId: string): Promise<B2Response<FileInfo>>;

  deleteFileVersion(
    options: DeleteFileVersionOptions
  ): Promise<B2Response<FileInfo>>;

  listFileNames(
    options: ListFileNamesOptions
  ): Promise<B2Response<ListFileNamesResponse>>;
  listFileVersions(
    options: ListFileVersionsOptions
  ): Promise<B2Response<ListFileVersionsResponse>>;
  hideFile(options: HideFileOptions): Promise<B2Response<FileInfo>>;
  getDownloadAuthorization(
    options: GetDownloadAuthorizationOptions
  ): Promise<B2Response<DownloadAuthorizationResponse>>;

  // Large file operations
  startLargeFile(
    options: StartLargeFileOptions
  ): Promise<B2Response<StartLargeFileResponse>>;
  getUploadPartUrl(
    options: GetUploadPartUrlOptions
  ): Promise<B2Response<UploadPartUrlResponse>>;
  uploadPart(
    options: UploadPartOptions
  ): Promise<B2Response<UploadPartResponse>>;
  finishLargeFile(
    options: FinishLargeFileOptions
  ): Promise<B2Response<FileInfo>>;
  cancelLargeFile(
    options: CancelLargeFileOptions
  ): Promise<B2Response<FileInfo>>;
  listParts(options: ListPartsOptions): Promise<B2Response<ListPartsResponse>>;
  listUnfinishedLargeFiles(
    options: ListUnfinishedLargeFilesOptions
  ): Promise<B2Response<ListUnfinishedLargeFilesResponse>>;
}

export class KeyManager {
  constructor(httpClient: HttpClient, authManager: AuthManager, config?: any);

  createKey(options: CreateKeyOptions): Promise<B2Response<CreateKeyResponse>>;

  deleteKey(options: DeleteKeyOptions): Promise<B2Response<KeyInfo>>;
  deleteKey(applicationKeyId: string): Promise<B2Response<KeyInfo>>;

  listKeys(options?: ListKeysOptions): Promise<B2Response<ListKeysResponse>>;
}

// ===== MAIN CLIENT CLASS =====

export class B2Client {
  // Instance properties for backward compatibility
  accountId?: string;
  applicationKeyId?: string;
  applicationKey?: string;
  authorizationToken?: string | null;
  apiUrl?: string | null;
  downloadUrl?: string | null;

  // Constants for backward compatibility
  readonly BUCKET_TYPES: typeof BUCKET_TYPES;
  readonly KEY_CAPABILITIES: typeof KEY_CAPABILITIES;

  constructor(options?: B2ClientOptions);

  // Authentication methods
  authorize(
    options: AuthCredentials,
    applicationKey?: never
  ): Promise<B2Response<AuthResponse>>;
  authorize(
    applicationKeyId: string,
    applicationKey: string
  ): Promise<B2Response<AuthResponse>>;
  authorize(): Promise<B2Response<AuthResponse>>;

  // Bucket methods
  createBucket(options: CreateBucketOptions): Promise<B2Response<BucketInfo>>;
  createBucket(
    bucketName: string,
    bucketType: string
  ): Promise<B2Response<BucketInfo>>;

  deleteBucket(options: DeleteBucketOptions): Promise<B2Response<BucketInfo>>;
  deleteBucket(bucketId: string): Promise<B2Response<BucketInfo>>;

  listBuckets(options?: any): Promise<B2Response<ListBucketsResponse>>;
  getBucket(
    options: GetBucketOptions
  ): Promise<B2Response<ListBucketsResponse>>;

  updateBucket(options: UpdateBucketOptions): Promise<B2Response<BucketInfo>>;
  updateBucket(
    bucketId: string,
    bucketType: string
  ): Promise<B2Response<BucketInfo>>;

  getUploadUrl(
    options: GetUploadUrlOptions
  ): Promise<B2Response<UploadUrlResponse>>;
  getUploadUrl(bucketId: string): Promise<B2Response<UploadUrlResponse>>;

  // File methods
  uploadFile(options: UploadFileOptions): Promise<B2Response<FileInfo>>;

  downloadFileByName(
    options: DownloadFileByNameOptions
  ): Promise<B2Response<any>>;
  downloadFileByName(
    bucketName: string,
    fileName: string
  ): Promise<B2Response<any>>;

  downloadFileById(options: DownloadFileByIdOptions): Promise<B2Response<any>>;
  downloadFileById(fileId: string): Promise<B2Response<any>>;

  listFileNames(
    options: ListFileNamesOptions
  ): Promise<B2Response<ListFileNamesResponse>>;
  listFileVersions(
    options: ListFileVersionsOptions
  ): Promise<B2Response<ListFileVersionsResponse>>;

  getFileInfo(options: GetFileInfoOptions): Promise<B2Response<FileInfo>>;
  getFileInfo(fileId: string): Promise<B2Response<FileInfo>>;

  deleteFileVersion(
    options: DeleteFileVersionOptions
  ): Promise<B2Response<FileInfo>>;
  hideFile(options: HideFileOptions): Promise<B2Response<FileInfo>>;
  getDownloadAuthorization(
    options: GetDownloadAuthorizationOptions
  ): Promise<B2Response<DownloadAuthorizationResponse>>;

  // Large file methods
  startLargeFile(
    options: StartLargeFileOptions
  ): Promise<B2Response<StartLargeFileResponse>>;
  getUploadPartUrl(
    options: GetUploadPartUrlOptions
  ): Promise<B2Response<UploadPartUrlResponse>>;
  uploadPart(
    options: UploadPartOptions
  ): Promise<B2Response<UploadPartResponse>>;
  finishLargeFile(
    options: FinishLargeFileOptions
  ): Promise<B2Response<FileInfo>>;
  cancelLargeFile(
    options: CancelLargeFileOptions
  ): Promise<B2Response<FileInfo>>;
  listParts(options: ListPartsOptions): Promise<B2Response<ListPartsResponse>>;
  listUnfinishedLargeFiles(
    options: ListUnfinishedLargeFilesOptions
  ): Promise<B2Response<ListUnfinishedLargeFilesResponse>>;

  // Key management methods
  createKey(options: CreateKeyOptions): Promise<B2Response<CreateKeyResponse>>;

  deleteKey(options: DeleteKeyOptions): Promise<B2Response<KeyInfo>>;
  deleteKey(applicationKeyId: string): Promise<B2Response<KeyInfo>>;

  listKeys(options?: ListKeysOptions): Promise<B2Response<ListKeysResponse>>;

  // Utility methods
  isAuthenticated(): boolean;
  getAuthContext(): AuthContext;
  clearAuth(): void;
  refreshAuth(): Promise<B2Response<AuthResponse>>;
  saveAuthContext(authResponse: AuthResponse): void;
}

// ===== DEFAULT EXPORT =====

export default B2Client;

// ===== NAMED EXPORTS FOR BACKWARD COMPATIBILITY =====

export { B2Client, BUCKET_TYPES, KEY_CAPABILITIES };
