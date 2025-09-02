import { describe, it, expect } from 'vitest';
import { Validator, UrlEncoder, B2Validators } from '../../../src/utils/validation.js';
import { BUCKET_TYPES, KEY_CAPABILITIES } from '../../../src/constants.js';

describe('Validator', () => {
  describe('validateRequired', () => {
    it('should pass for valid parameters', () => {
      const params = { name: 'test', value: 123 };
      expect(() => Validator.validateRequired(params, ['name', 'value'])).not.toThrow();
    });

    it('should throw for missing parameters', () => {
      const params = { name: 'test' };
      expect(() => Validator.validateRequired(params, ['name', 'value'])).toThrow('Missing required parameters: value');
    });

    it('should throw for null parameters', () => {
      const params = { name: 'test', value: null };
      expect(() => Validator.validateRequired(params, ['name', 'value'])).toThrow('Missing required parameters: value');
    });

    it('should throw for empty string parameters', () => {
      const params = { name: 'test', value: '' };
      expect(() => Validator.validateRequired(params, ['name', 'value'])).toThrow('Missing required parameters: value');
    });

    it('should throw for null params object', () => {
      expect(() => Validator.validateRequired(null, ['name'])).toThrow('Parameters object is required');
    });
  });

  describe('validateString', () => {
    it('should pass for valid string', () => {
      expect(() => Validator.validateString('test', 'name')).not.toThrow();
    });

    it('should throw for non-string', () => {
      expect(() => Validator.validateString(123, 'name')).toThrow('name must be a string');
    });

    it('should validate minimum length', () => {
      expect(() => Validator.validateString('ab', 'name', { minLength: 3 })).toThrow('name must be at least 3 characters long');
    });

    it('should validate maximum length', () => {
      expect(() => Validator.validateString('abcdef', 'name', { maxLength: 5 })).toThrow('name must be no more than 5 characters long');
    });

    it('should validate pattern', () => {
      expect(() => Validator.validateString('abc123', 'name', { pattern: /^[a-z]+$/ })).toThrow('name format is invalid');
    });
  });

  describe('validateNumber', () => {
    it('should pass for valid number', () => {
      expect(() => Validator.validateNumber(123, 'count')).not.toThrow();
    });

    it('should throw for non-number', () => {
      expect(() => Validator.validateNumber('123', 'count')).toThrow('count must be a valid number');
    });

    it('should throw for NaN', () => {
      expect(() => Validator.validateNumber(NaN, 'count')).toThrow('count must be a valid number');
    });

    it('should validate minimum value', () => {
      expect(() => Validator.validateNumber(5, 'count', { min: 10 })).toThrow('count must be at least 10');
    });

    it('should validate maximum value', () => {
      expect(() => Validator.validateNumber(15, 'count', { max: 10 })).toThrow('count must be no more than 10');
    });

    it('should validate integer', () => {
      expect(() => Validator.validateNumber(3.14, 'count', { integer: true })).toThrow('count must be an integer');
    });
  });

  describe('validateArray', () => {
    it('should pass for valid array', () => {
      expect(() => Validator.validateArray([1, 2, 3], 'items')).not.toThrow();
    });

    it('should throw for non-array', () => {
      expect(() => Validator.validateArray('not array', 'items')).toThrow('items must be an array');
    });

    it('should validate minimum length', () => {
      expect(() => Validator.validateArray([1], 'items', { minLength: 2 })).toThrow('items must contain at least 2 items');
    });

    it('should validate maximum length', () => {
      expect(() => Validator.validateArray([1, 2, 3], 'items', { maxLength: 2 })).toThrow('items must contain no more than 2 items');
    });
  });

  describe('validateBucketName', () => {
    it('should pass for valid bucket name', () => {
      expect(() => Validator.validateBucketName('my-bucket-123')).not.toThrow();
    });

    it('should throw for too short name', () => {
      expect(() => Validator.validateBucketName('short')).toThrow('bucketName must be at least 6 characters long');
    });

    it('should throw for too long name', () => {
      const longName = 'a'.repeat(51);
      expect(() => Validator.validateBucketName(longName)).toThrow('bucketName must be no more than 50 characters long');
    });

    it('should throw for invalid characters', () => {
      expect(() => Validator.validateBucketName('bucket_name')).toThrow('bucketName format is invalid');
    });

    it('should throw for starting with hyphen', () => {
      expect(() => Validator.validateBucketName('-bucket')).toThrow('Bucket name cannot start or end with a hyphen');
    });

    it('should throw for ending with hyphen', () => {
      expect(() => Validator.validateBucketName('bucket-')).toThrow('Bucket name cannot start or end with a hyphen');
    });

    it('should throw for consecutive hyphens', () => {
      expect(() => Validator.validateBucketName('bucket--name')).toThrow('Bucket name cannot contain consecutive hyphens');
    });
  });

  describe('validateBucketType', () => {
    it('should pass for valid bucket types', () => {
      expect(() => Validator.validateBucketType(BUCKET_TYPES.ALL_PRIVATE)).not.toThrow();
      expect(() => Validator.validateBucketType(BUCKET_TYPES.ALL_PUBLIC)).not.toThrow();
    });

    it('should throw for invalid bucket type', () => {
      expect(() => Validator.validateBucketType('invalid')).toThrow('Invalid bucket type');
    });
  });

  describe('validateFileName', () => {
    it('should pass for valid file name', () => {
      expect(() => Validator.validateFileName('folder/file.txt')).not.toThrow();
    });

    it('should throw for empty file name', () => {
      expect(() => Validator.validateFileName('')).toThrow('fileName must be at least 1 characters long');
    });

    it('should throw for too long file name', () => {
      const longName = 'a'.repeat(1025);
      expect(() => Validator.validateFileName(longName)).toThrow('fileName must be no more than 1024 characters long');
    });

    it('should throw for control characters', () => {
      expect(() => Validator.validateFileName('file\x00name')).toThrow('File name contains invalid control characters');
    });

    it('should throw for starting with slash', () => {
      expect(() => Validator.validateFileName('/file.txt')).toThrow('File name cannot start with a forward slash');
    });
  });

  describe('validateSha1', () => {
    it('should pass for valid SHA1', () => {
      expect(() => Validator.validateSha1('da39a3ee5e6b4b0d3255bfef95601890afd80709')).not.toThrow();
    });

    it('should throw for invalid length', () => {
      expect(() => Validator.validateSha1('short')).toThrow('SHA1 hash must be at least 40 characters long');
    });

    it('should throw for invalid characters', () => {
      expect(() => Validator.validateSha1('gggggggggggggggggggggggggggggggggggggggg')).toThrow('SHA1 hash format is invalid');
    });
  });

  describe('validateContentType', () => {
    it('should pass for valid content type', () => {
      expect(() => Validator.validateContentType('text/plain')).not.toThrow();
      expect(() => Validator.validateContentType('application/json')).not.toThrow();
    });

    it('should throw for invalid format', () => {
      expect(() => Validator.validateContentType('invalid')).toThrow('contentType format is invalid');
    });
  });

  describe('validateKeyCapabilities', () => {
    it('should pass for valid capabilities', () => {
      const capabilities = [KEY_CAPABILITIES.READ_FILES, KEY_CAPABILITIES.WRITE_FILES];
      expect(() => Validator.validateKeyCapabilities(capabilities)).not.toThrow();
    });

    it('should throw for empty array', () => {
      expect(() => Validator.validateKeyCapabilities([])).toThrow('capabilities must contain at least 1 items');
    });

    it('should throw for invalid capabilities', () => {
      expect(() => Validator.validateKeyCapabilities(['invalid'])).toThrow('Invalid key capabilities: invalid');
    });
  });

  describe('validatePartNumber', () => {
    it('should pass for valid part number', () => {
      expect(() => Validator.validatePartNumber(1)).not.toThrow();
      expect(() => Validator.validatePartNumber(10000)).not.toThrow();
    });

    it('should throw for too small part number', () => {
      expect(() => Validator.validatePartNumber(0)).toThrow('partNumber must be at least 1');
    });

    it('should throw for too large part number', () => {
      expect(() => Validator.validatePartNumber(10001)).toThrow('partNumber must be no more than 10000');
    });

    it('should throw for non-integer', () => {
      expect(() => Validator.validatePartNumber(1.5)).toThrow('partNumber must be an integer');
    });
  });

  describe('validateFileSize', () => {
    it('should pass for valid file size', () => {
      expect(() => Validator.validateFileSize(1024)).not.toThrow();
    });

    it('should throw for negative size', () => {
      expect(() => Validator.validateFileSize(-1)).toThrow('file size must be at least 0');
    });

    it('should throw for exceeding max size', () => {
      expect(() => Validator.validateFileSize(2048, { maxSize: 1024 })).toThrow('File size exceeds maximum allowed size');
    });
  });

  describe('validatePagination', () => {
    it('should pass for valid pagination', () => {
      expect(() => Validator.validatePagination({ maxFileCount: 100 })).not.toThrow();
    });

    it('should throw for invalid maxFileCount', () => {
      expect(() => Validator.validatePagination({ maxFileCount: 0 })).toThrow('maxFileCount must be at least 1');
      expect(() => Validator.validatePagination({ maxFileCount: 10001 })).toThrow('maxFileCount must be no more than 10000');
    });
  });

  describe('validateAuthCredentials', () => {
    it('should pass for valid credentials', () => {
      const credentials = { applicationKeyId: 'keyId', applicationKey: 'key' };
      expect(() => Validator.validateAuthCredentials(credentials)).not.toThrow();
    });

    it('should throw for missing credentials', () => {
      expect(() => Validator.validateAuthCredentials({})).toThrow('Missing required parameters');
    });
  });
});

describe('UrlEncoder', () => {
  describe('encodeFileName', () => {
    it('should encode file name with path separators', () => {
      expect(UrlEncoder.encodeFileName('folder/file name.txt')).toBe('folder/file%20name.txt');
    });

    it('should throw for non-string input', () => {
      expect(() => UrlEncoder.encodeFileName(123)).toThrow('File name must be a string');
    });
  });

  describe('encodePathSegment', () => {
    it('should encode path segment', () => {
      expect(UrlEncoder.encodePathSegment('file name.txt')).toBe('file%20name.txt');
    });

    it('should throw for non-string input', () => {
      expect(() => UrlEncoder.encodePathSegment(null)).toThrow('Path segment must be a string');
    });
  });

  describe('decodeFileName', () => {
    it('should decode file name', () => {
      expect(UrlEncoder.decodeFileName('folder/file%20name.txt')).toBe('folder/file name.txt');
    });

    it('should throw for invalid encoding', () => {
      expect(() => UrlEncoder.decodeFileName('invalid%ZZ')).toThrow('Failed to decode file name');
    });

    it('should throw for non-string input', () => {
      expect(() => UrlEncoder.decodeFileName(123)).toThrow('Encoded file name must be a string');
    });
  });
});

describe('B2Validators', () => {
  describe('validateCreateBucket', () => {
    it('should pass for valid bucket creation params', () => {
      const params = {
        bucketName: 'my-bucket',
        bucketType: BUCKET_TYPES.ALL_PRIVATE
      };
      expect(() => B2Validators.validateCreateBucket(params)).not.toThrow();
    });

    it('should throw for missing required params', () => {
      expect(() => B2Validators.validateCreateBucket({})).toThrow('Missing required parameters');
    });

    it('should throw for invalid bucketInfo type', () => {
      const params = {
        bucketName: 'my-bucket',
        bucketType: BUCKET_TYPES.ALL_PRIVATE,
        bucketInfo: 'invalid'
      };
      expect(() => B2Validators.validateCreateBucket(params)).toThrow('bucketInfo must be an object');
    });
  });

  describe('validateUploadFile', () => {
    it('should pass for valid upload params', () => {
      const params = {
        uploadUrl: 'https://example.com',
        uploadAuthToken: 'token',
        fileName: 'test.txt',
        data: 'content'
      };
      expect(() => B2Validators.validateUploadFile(params)).not.toThrow();
    });

    it('should throw for missing required params', () => {
      expect(() => B2Validators.validateUploadFile({})).toThrow('Missing required parameters');
    });
  });

  describe('validateStartLargeFile', () => {
    it('should pass for valid large file params', () => {
      const params = {
        bucketId: 'bucket123',
        fileName: 'large-file.zip'
      };
      expect(() => B2Validators.validateStartLargeFile(params)).not.toThrow();
    });

    it('should throw for missing required params', () => {
      expect(() => B2Validators.validateStartLargeFile({})).toThrow('Missing required parameters');
    });
  });

  describe('validateUploadPart', () => {
    it('should pass for valid part upload params', () => {
      const params = {
        uploadUrl: 'https://example.com',
        uploadAuthToken: 'token',
        partNumber: 1,
        data: 'content'
      };
      expect(() => B2Validators.validateUploadPart(params)).not.toThrow();
    });

    it('should throw for missing required params', () => {
      expect(() => B2Validators.validateUploadPart({})).toThrow('Missing required parameters');
    });
  });

  describe('validateCreateKey', () => {
    it('should pass for valid key creation params', () => {
      const params = {
        keyName: 'my-key',
        capabilities: [KEY_CAPABILITIES.READ_FILES]
      };
      expect(() => B2Validators.validateCreateKey(params)).not.toThrow();
    });

    it('should throw for missing required params', () => {
      expect(() => B2Validators.validateCreateKey({})).toThrow('Missing required parameters');
    });

    it('should throw for invalid key name length', () => {
      const params = {
        keyName: 'a'.repeat(101),
        capabilities: [KEY_CAPABILITIES.READ_FILES]
      };
      expect(() => B2Validators.validateCreateKey(params)).toThrow('keyName must be no more than 100 characters long');
    });

    it('should throw for invalid duration', () => {
      const params = {
        keyName: 'my-key',
        capabilities: [KEY_CAPABILITIES.READ_FILES],
        validDurationInSeconds: 0
      };
      expect(() => B2Validators.validateCreateKey(params)).toThrow('validDurationInSeconds must be at least 1');
    });
  });
});