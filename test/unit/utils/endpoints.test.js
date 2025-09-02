import { describe, it, expect, beforeEach } from 'vitest';
import { EndpointBuilder, UrlUtils, endpoints, buildApiUrl, buildDownloadUrl } from '../../../src/utils/endpoints.js';
import { API_ENDPOINTS, B2_API_BASE_URL } from '../../../src/constants.js';

describe('EndpointBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new EndpointBuilder();
  });

  describe('constructor and context management', () => {
    it('should create instance without auth context', () => {
      expect(builder.authContext).toBeNull();
    });

    it('should create instance with auth context', () => {
      const authContext = {
        apiUrl: 'https://api001.backblazeb2.com',
        downloadUrl: 'https://f001.backblazeb2.com'
      };
      const builderWithAuth = new EndpointBuilder(authContext);
      expect(builderWithAuth.authContext).toEqual(authContext);
    });

    it('should update auth context', () => {
      const authContext = {
        apiUrl: 'https://api001.backblazeb2.com',
        downloadUrl: 'https://f001.backblazeb2.com'
      };
      builder.setAuthContext(authContext);
      expect(builder.authContext).toEqual(authContext);
    });
  });

  describe('URL building', () => {
    it('should use default API URL when no auth context', () => {
      expect(builder.getApiUrl()).toBe(B2_API_BASE_URL);
    });

    it('should use auth context API URL when available', () => {
      const authContext = { apiUrl: 'https://api001.backblazeb2.com' };
      builder.setAuthContext(authContext);
      expect(builder.getApiUrl()).toBe('https://api001.backblazeb2.com');
    });

    it('should throw error when download URL not available', () => {
      expect(() => builder.getDownloadUrl()).toThrow('Download URL not available');
    });

    it('should return download URL from auth context', () => {
      const authContext = { downloadUrl: 'https://f001.backblazeb2.com' };
      builder.setAuthContext(authContext);
      expect(builder.getDownloadUrl()).toBe('https://f001.backblazeb2.com');
    });

    it('should build API URL with endpoint', () => {
      const url = builder.buildApiUrl(API_ENDPOINTS.LIST_BUCKETS);
      expect(url).toBe(`${B2_API_BASE_URL}${API_ENDPOINTS.LIST_BUCKETS}`);
    });

    it('should build API URL with query parameters', () => {
      const params = { bucketId: 'test123', maxFileCount: 100 };
      const url = builder.buildApiUrl(API_ENDPOINTS.LIST_FILE_NAMES, params);
      expect(url).toContain('bucketId=test123');
      expect(url).toContain('maxFileCount=100');
    });

    it('should ignore null and undefined parameters', () => {
      const params = { bucketId: 'test123', maxFileCount: null, startFileName: undefined };
      const url = builder.buildApiUrl(API_ENDPOINTS.LIST_FILE_NAMES, params);
      expect(url).toContain('bucketId=test123');
      expect(url).not.toContain('maxFileCount');
      expect(url).not.toContain('startFileName');
    });
  });

  describe('specific endpoint methods', () => {
    beforeEach(() => {
      const authContext = {
        apiUrl: 'https://api001.backblazeb2.com',
        downloadUrl: 'https://f001.backblazeb2.com'
      };
      builder.setAuthContext(authContext);
    });

    it('should build authorize account URL', () => {
      const url = builder.getAuthorizeAccountUrl();
      expect(url).toBe(`https://api001.backblazeb2.com${API_ENDPOINTS.AUTHORIZE_ACCOUNT}`);
    });

    it('should build bucket URLs', () => {
      expect(builder.getCreateBucketUrl()).toContain(API_ENDPOINTS.CREATE_BUCKET);
      expect(builder.getDeleteBucketUrl()).toContain(API_ENDPOINTS.DELETE_BUCKET);
      expect(builder.getListBucketsUrl()).toContain(API_ENDPOINTS.LIST_BUCKETS);
    });

    it('should build file URLs', () => {
      expect(builder.getListFileNamesUrl()).toContain(API_ENDPOINTS.LIST_FILE_NAMES);
      expect(builder.getFileInfoUrl()).toContain(API_ENDPOINTS.GET_FILE_INFO);
    });

    it('should build download file by name URL', () => {
      const url = builder.getDownloadFileByNameUrl('my-bucket', 'test file.txt');
      expect(url).toBe('https://f001.backblazeb2.com/file/my-bucket/test%20file.txt');
    });

    it('should build download file by ID URL', () => {
      const url = builder.getDownloadFileByIdUrl('file123');
      expect(url).toContain('fileId=file123');
    });

    it('should build large file URLs', () => {
      expect(builder.getStartLargeFileUrl()).toContain(API_ENDPOINTS.START_LARGE_FILE);
      expect(builder.getFinishLargeFileUrl()).toContain(API_ENDPOINTS.FINISH_LARGE_FILE);
    });

    it('should build key management URLs', () => {
      expect(builder.getCreateKeyUrl()).toContain(API_ENDPOINTS.CREATE_KEY);
      expect(builder.getDeleteKeyUrl()).toContain(API_ENDPOINTS.DELETE_KEY);
      expect(builder.getListKeysUrl()).toContain(API_ENDPOINTS.LIST_KEYS);
    });
  });
});

describe('UrlUtils', () => {
  describe('encodeFileName', () => {
    it('should encode file name', () => {
      expect(UrlUtils.encodeFileName('test file.txt')).toBe('test%20file.txt');
    });

    it('should throw error for non-string input', () => {
      expect(() => UrlUtils.encodeFileName(123)).toThrow('File name must be a string');
    });
  });

  describe('encodeBucketName', () => {
    it('should encode bucket name', () => {
      expect(UrlUtils.encodeBucketName('my-bucket')).toBe('my-bucket');
    });

    it('should throw error for non-string input', () => {
      expect(() => UrlUtils.encodeBucketName(null)).toThrow('Bucket name must be a string');
    });
  });

  describe('encodeQueryParams', () => {
    it('should encode query parameters', () => {
      const params = { key1: 'value1', key2: 'value with spaces' };
      const result = UrlUtils.encodeQueryParams(params);
      expect(result).toBe('?key1=value1&key2=value+with+spaces');
    });

    it('should return empty string for null params', () => {
      expect(UrlUtils.encodeQueryParams(null)).toBe('');
    });

    it('should ignore null and undefined values', () => {
      const params = { key1: 'value1', key2: null, key3: undefined };
      const result = UrlUtils.encodeQueryParams(params);
      expect(result).toBe('?key1=value1');
    });
  });

  describe('validateAndEncodeFilePath', () => {
    it('should validate and encode valid file path', () => {
      const result = UrlUtils.validateAndEncodeFilePath('folder/file name.txt');
      expect(result).toBe('folder%2Ffile%20name.txt');
    });

    it('should throw error for non-string input', () => {
      expect(() => UrlUtils.validateAndEncodeFilePath(123)).toThrow('File path must be a string');
    });

    it('should throw error for empty path', () => {
      expect(() => UrlUtils.validateAndEncodeFilePath('')).toThrow('File path cannot be empty');
    });

    it('should throw error for path too long', () => {
      const longPath = 'a'.repeat(1025);
      expect(() => UrlUtils.validateAndEncodeFilePath(longPath)).toThrow('File path cannot exceed 1024 characters');
    });

    it('should throw error for invalid characters', () => {
      expect(() => UrlUtils.validateAndEncodeFilePath('file\x00name')).toThrow('File path contains invalid characters');
    });
  });
});

describe('convenience functions', () => {
  it('should export buildApiUrl function', () => {
    const url = buildApiUrl(API_ENDPOINTS.LIST_BUCKETS);
    expect(url).toBe(`${B2_API_BASE_URL}${API_ENDPOINTS.LIST_BUCKETS}`);
  });

  it('should export buildDownloadUrl function', () => {
    const authContext = { downloadUrl: 'https://f001.backblazeb2.com' };
    const url = buildDownloadUrl('/file/bucket/file.txt', {}, authContext);
    expect(url).toBe('https://f001.backblazeb2.com/file/bucket/file.txt');
  });

  it('should export default endpoints instance', () => {
    expect(endpoints).toBeInstanceOf(EndpointBuilder);
  });
});