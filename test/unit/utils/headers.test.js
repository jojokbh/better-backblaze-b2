import { describe, it, expect, beforeEach } from 'vitest';
import { 
  HeaderBuilder, 
  AuthHeaders, 
  InfoHeaders, 
  HeaderUtils, 
  headerBuilder 
} from '../../../src/utils/headers.js';
import { HEADERS, CONTENT_TYPES } from '../../../src/constants.js';

describe('HeaderBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new HeaderBuilder();
  });

  describe('basic operations', () => {
    it('should create empty headers', () => {
      expect(builder.build()).toEqual({});
    });

    it('should set single header', () => {
      builder.setHeader('Content-Type', 'application/json');
      expect(builder.build()).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should set multiple headers', () => {
      const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' };
      builder.setHeaders(headers);
      expect(builder.build()).toEqual(headers);
    });

    it('should ignore null and undefined values', () => {
      builder.setHeader('Valid', 'value');
      builder.setHeader('Null', null);
      builder.setHeader('Undefined', undefined);
      expect(builder.build()).toEqual({ 'Valid': 'value' });
    });

    it('should reset headers', () => {
      builder.setHeader('Test', 'value');
      builder.reset();
      expect(builder.build()).toEqual({});
    });

    it('should support method chaining', () => {
      const result = builder
        .setContentType('application/json')
        .setAuthorization('Bearer token')
        .build();
      
      expect(result).toEqual({
        [HEADERS.CONTENT_TYPE]: 'application/json',
        [HEADERS.AUTHORIZATION]: 'Bearer token'
      });
    });
  });

  describe('specific header methods', () => {
    it('should set content type', () => {
      builder.setContentType('text/plain');
      expect(builder.build()[HEADERS.CONTENT_TYPE]).toBe('text/plain');
    });

    it('should set content length', () => {
      builder.setContentLength(1024);
      expect(builder.build()[HEADERS.CONTENT_LENGTH]).toBe('1024');
    });

    it('should set authorization', () => {
      builder.setAuthorization('Bearer token123');
      expect(builder.build()[HEADERS.AUTHORIZATION]).toBe('Bearer token123');
    });

    it('should set basic auth', () => {
      builder.setBasicAuth('keyId', 'key');
      const auth = builder.build()[HEADERS.AUTHORIZATION];
      expect(auth).toMatch(/^Basic /);
    });

    it('should set bearer auth', () => {
      builder.setBearerAuth('token123');
      expect(builder.build()[HEADERS.AUTHORIZATION]).toBe('token123');
    });

    it('should set file headers', () => {
      const fileOptions = {
        fileName: 'test.txt',
        contentSha1: 'abc123',
        contentType: 'text/plain',
        contentLength: 100
      };
      
      builder.setFileHeaders(fileOptions);
      const headers = builder.build();
      
      expect(headers[HEADERS.FILE_NAME]).toBe('test.txt');
      expect(headers[HEADERS.CONTENT_SHA1]).toBe('abc123');
      expect(headers[HEADERS.CONTENT_TYPE]).toBe('text/plain');
      expect(headers[HEADERS.CONTENT_LENGTH]).toBe('100');
    });

    it('should set part number', () => {
      builder.setPartNumber(5);
      expect(builder.build()[HEADERS.PART_NUMBER]).toBe('5');
    });

    it('should set test mode', () => {
      builder.setTestMode();
      expect(builder.build()[HEADERS.TEST_MODE]).toBe('fail_some_uploads');
    });
  });
});

describe('AuthHeaders', () => {
  describe('createBasicAuth', () => {
    it('should create basic auth header', () => {
      const headers = AuthHeaders.createBasicAuth('keyId', 'key');
      expect(headers[HEADERS.AUTHORIZATION]).toMatch(/^Basic /);
    });

    it('should throw error for missing keyId', () => {
      expect(() => AuthHeaders.createBasicAuth('', 'key')).toThrow('Application key ID and application key are required');
    });

    it('should throw error for missing key', () => {
      expect(() => AuthHeaders.createBasicAuth('keyId', '')).toThrow('Application key ID and application key are required');
    });
  });

  describe('createBearerAuth', () => {
    it('should create bearer auth header', () => {
      const headers = AuthHeaders.createBearerAuth('token123');
      expect(headers[HEADERS.AUTHORIZATION]).toBe('token123');
    });

    it('should throw error for missing token', () => {
      expect(() => AuthHeaders.createBearerAuth('')).toThrow('Token is required for Bearer auth');
    });
  });

  describe('extractAuthToken', () => {
    it('should extract auth token', () => {
      const headers = { [HEADERS.AUTHORIZATION]: 'Bearer token123' };
      expect(AuthHeaders.extractAuthToken(headers)).toBe('Bearer token123');
    });

    it('should return null for missing token', () => {
      expect(AuthHeaders.extractAuthToken({})).toBeNull();
    });

    it('should return null for null headers', () => {
      expect(AuthHeaders.extractAuthToken(null)).toBeNull();
    });
  });
});

describe('InfoHeaders', () => {
  describe('addInfoHeaders', () => {
    it('should add info headers', () => {
      const headers = { 'Content-Type': 'application/json' };
      const info = { author: 'test', version: '1.0' };
      
      const result = InfoHeaders.addInfoHeaders(headers, info);
      
      expect(result['X-Bz-Info-author']).toBe('test');
      expect(result['X-Bz-Info-version']).toBe('1.0');
      expect(result['Content-Type']).toBe('application/json');
    });

    it('should encode info values', () => {
      const headers = {};
      const info = { name: 'test file.txt' };
      
      const result = InfoHeaders.addInfoHeaders(headers, info);
      expect(result['X-Bz-Info-name']).toBe('test%20file.txt');
    });

    it('should return original headers for null info', () => {
      const headers = { 'Content-Type': 'application/json' };
      const result = InfoHeaders.addInfoHeaders(headers, null);
      expect(result).toEqual(headers);
    });

    it('should throw error for too many info headers', () => {
      const headers = {};
      const info = {};
      for (let i = 0; i < 11; i++) {
        info[`key${i}`] = `value${i}`;
      }
      
      expect(() => InfoHeaders.addInfoHeaders(headers, info)).toThrow('Too many info headers');
    });

    it('should throw error for invalid header keys', () => {
      const headers = {};
      const info = { 'invalid key!': 'value' };
      
      expect(() => InfoHeaders.addInfoHeaders(headers, info)).toThrow('Info header keys contain invalid characters');
    });
  });

  describe('isValidInfoHeaderKey', () => {
    it('should validate valid keys', () => {
      expect(InfoHeaders.isValidInfoHeaderKey('author')).toBe(true);
      expect(InfoHeaders.isValidInfoHeaderKey('file-name')).toBe(true);
      expect(InfoHeaders.isValidInfoHeaderKey('version_1')).toBe(true);
    });

    it('should reject invalid keys', () => {
      expect(InfoHeaders.isValidInfoHeaderKey('invalid key')).toBe(false);
      expect(InfoHeaders.isValidInfoHeaderKey('invalid!')).toBe(false);
      expect(InfoHeaders.isValidInfoHeaderKey('')).toBe(false);
      expect(InfoHeaders.isValidInfoHeaderKey(123)).toBe(false);
    });
  });

  describe('extractInfoHeaders', () => {
    it('should extract info headers', () => {
      const headers = {
        'x-bz-info-author': 'test%20user',
        'x-bz-info-version': '1.0',
        'Content-Type': 'application/json'
      };
      
      const info = InfoHeaders.extractInfoHeaders(headers);
      expect(info).toEqual({
        author: 'test user',
        version: '1.0'
      });
    });

    it('should handle decoding errors gracefully', () => {
      const headers = {
        'x-bz-info-invalid': '%ZZ'  // Invalid URL encoding
      };
      
      const info = InfoHeaders.extractInfoHeaders(headers);
      expect(info.invalid).toBe('%ZZ');
    });

    it('should return empty object for null headers', () => {
      expect(InfoHeaders.extractInfoHeaders(null)).toEqual({});
    });
  });
});

describe('HeaderUtils', () => {
  describe('createJsonHeaders', () => {
    it('should create JSON headers without auth', () => {
      const headers = HeaderUtils.createJsonHeaders();
      expect(headers[HEADERS.CONTENT_TYPE]).toBe(CONTENT_TYPES.JSON);
      expect(headers[HEADERS.AUTHORIZATION]).toBeUndefined();
    });

    it('should create JSON headers with auth', () => {
      const headers = HeaderUtils.createJsonHeaders('token123');
      expect(headers[HEADERS.CONTENT_TYPE]).toBe(CONTENT_TYPES.JSON);
      expect(headers[HEADERS.AUTHORIZATION]).toBe('token123');
    });
  });

  describe('createUploadHeaders', () => {
    it('should create upload headers', () => {
      const options = {
        authToken: 'token123',
        fileName: 'test.txt',
        contentType: 'text/plain',
        contentSha1: 'abc123',
        contentLength: 100
      };
      
      const headers = HeaderUtils.createUploadHeaders(options);
      
      expect(headers[HEADERS.AUTHORIZATION]).toBe('token123');
      expect(headers[HEADERS.FILE_NAME]).toBe('test.txt');
      expect(headers[HEADERS.CONTENT_TYPE]).toBe('text/plain');
      expect(headers[HEADERS.CONTENT_SHA1]).toBe('abc123');
      expect(headers[HEADERS.CONTENT_LENGTH]).toBe('100');
    });

    it('should include info headers', () => {
      const options = {
        authToken: 'token123',
        fileName: 'test.txt',
        info: { author: 'test' }
      };
      
      const headers = HeaderUtils.createUploadHeaders(options);
      expect(headers['X-Bz-Info-author']).toBe('test');
    });
  });

  describe('createPartUploadHeaders', () => {
    it('should create part upload headers', () => {
      const options = {
        authToken: 'token123',
        partNumber: 1,
        contentSha1: 'abc123',
        contentLength: 100
      };
      
      const headers = HeaderUtils.createPartUploadHeaders(options);
      
      expect(headers[HEADERS.AUTHORIZATION]).toBe('token123');
      expect(headers[HEADERS.PART_NUMBER]).toBe('1');
      expect(headers[HEADERS.CONTENT_SHA1]).toBe('abc123');
      expect(headers[HEADERS.CONTENT_LENGTH]).toBe('100');
    });
  });

  describe('normalizeHeaders', () => {
    it('should normalize header names to lowercase', () => {
      const headers = {
        'Content-Type': 'application/json',
        'AUTHORIZATION': 'Bearer token'
      };
      
      const normalized = HeaderUtils.normalizeHeaders(headers);
      expect(normalized).toEqual({
        'content-type': 'application/json',
        'authorization': 'Bearer token'
      });
    });

    it('should return empty object for null input', () => {
      expect(HeaderUtils.normalizeHeaders(null)).toEqual({});
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(HeaderUtils.toCamelCase('file-name')).toBe('fileName');
      expect(HeaderUtils.toCamelCase('content-type')).toBe('contentType');
      expect(HeaderUtils.toCamelCase('single')).toBe('single');
    });
  });
});

describe('default export', () => {
  it('should export default header builder instance', () => {
    expect(headerBuilder).toBeInstanceOf(HeaderBuilder);
  });
});