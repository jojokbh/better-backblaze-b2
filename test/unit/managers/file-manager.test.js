import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileManager } from '../../../src/managers/file-manager.js';
import { B2_ERROR_CODES, CONTENT_TYPES } from '../../../src/constants.js';

describe('FileManager', () => {
  let fileManager;
  let mockHttpClient;
  let mockAuthManager;
  let mockConfig;

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn()
    };

    mockAuthManager = {
      isAuthenticated: vi.fn(() => true),
      getAuthContext: vi.fn(() => ({
        authorizationToken: 'test-token',
        apiUrl: 'https://api.test.com',
        downloadUrl: 'https://download.test.com',
        accountId: 'test-account'
      })),
      getAuthHeaders: vi.fn(() => ({
        'Authorization': 'test-token'
      }))
    };

    mockConfig = {
      timeout: 30000,
      uploadTimeout: 300000
    };

    fileManager = new FileManager(mockHttpClient, mockAuthManager, mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(fileManager.httpClient).toBe(mockHttpClient);
      expect(fileManager.authManager).toBe(mockAuthManager);
      expect(fileManager.config).toBe(mockConfig);
    });

    it('should initialize with empty config if not provided', () => {
      const manager = new FileManager(mockHttpClient, mockAuthManager);
      expect(manager.config).toEqual({});
    });
  });

  describe('ensureAuthenticated', () => {
    it('should not throw when authenticated', () => {
      expect(() => fileManager.ensureAuthenticated()).not.toThrow();
    });

    it('should throw when not authenticated', () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);
      expect(() => fileManager.ensureAuthenticated()).toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('validateFileName', () => {
    it('should accept valid file names', () => {
      expect(() => fileManager.validateFileName('test.txt')).not.toThrow();
      expect(() => fileManager.validateFileName('folder/file.jpg')).not.toThrow();
      expect(() => fileManager.validateFileName('file-with-dashes_and_underscores.pdf')).not.toThrow();
    });

    it('should reject invalid file names', () => {
      expect(() => fileManager.validateFileName(null)).toThrow('fileName is required and must be a string');
      expect(() => fileManager.validateFileName('')).toThrow('File name cannot be empty');
      expect(() => fileManager.validateFileName(123)).toThrow('fileName is required and must be a string');
      expect(() => fileManager.validateFileName('a'.repeat(1025))).toThrow('File name cannot exceed 1024 characters');
      expect(() => fileManager.validateFileName('file\x00name')).toThrow('File name contains invalid characters');
    });
  });

  describe('validateFileId', () => {
    it('should accept valid file IDs', () => {
      expect(() => fileManager.validateFileId('4_z27c88f1d182b150646ff7f19_f200ec485_d20200118_m130258_c000_v0001142_t0000')).not.toThrow();
    });

    it('should reject invalid file IDs', () => {
      expect(() => fileManager.validateFileId(null)).toThrow('fileId is required and must be a string');
      expect(() => fileManager.validateFileId('')).toThrow('fileId cannot be empty');
      expect(() => fileManager.validateFileId('   ')).toThrow('fileId cannot be empty');
      expect(() => fileManager.validateFileId(123)).toThrow('fileId is required and must be a string');
    });
  });

  describe('uploadFile', () => {
    const validUploadOptions = {
      uploadUrl: 'https://upload.test.com',
      uploadAuthToken: 'upload-token',
      fileName: 'test.txt',
      data: 'test content'
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: 'test-file-id',
          fileName: 'test.txt',
          contentType: 'text/plain',
          contentLength: 12,
          contentSha1: 'test-sha1'
        }
      });
    });

    it('should upload file successfully with valid options', async () => {
      const response = await fileManager.uploadFile(validUploadOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://upload.test.com',
        'test content',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'upload-token',
            'X-Bz-File-Name': 'test.txt',
            'Content-Type': 'application/octet-stream',
            'Content-Length': '12'
          }),
          timeout: 300000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.fileId).toBe('test-file-id');
    });

    it('should calculate SHA1 hash if not provided', async () => {
      await fileManager.uploadFile(validUploadOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Bz-Content-Sha1': expect.any(String)
          })
        })
      );
    });

    it('should use provided SHA1 hash', async () => {
      const options = {
        ...validUploadOptions,
        contentSha1: 'provided-sha1-hash'
      };

      await fileManager.uploadFile(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Bz-Content-Sha1': 'provided-sha1-hash'
          })
        })
      );
    });

    it('should use custom content type', async () => {
      const options = {
        ...validUploadOptions,
        contentType: 'text/plain'
      };

      await fileManager.uploadFile(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'text/plain'
          })
        })
      );
    });

    it('should include info headers when provided', async () => {
      const options = {
        ...validUploadOptions,
        info: {
          'custom-key': 'custom-value',
          'another-key': 'another-value'
        }
      };

      await fileManager.uploadFile(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Bz-Info-custom-key': 'custom-value',
            'X-Bz-Info-another-key': 'another-value'
          })
        })
      );
    });

    it('should pass progress callback to http client', async () => {
      const onUploadProgress = vi.fn();
      const options = {
        ...validUploadOptions,
        onUploadProgress
      };

      await fileManager.uploadFile(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          onUploadProgress
        })
      );
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.uploadFile()).rejects.toThrow('options object is required');
    });

    it('should throw error for missing uploadUrl', async () => {
      const options = { ...validUploadOptions };
      delete options.uploadUrl;

      await expect(fileManager.uploadFile(options)).rejects.toThrow('uploadUrl is required and must be a string');
    });

    it('should throw error for missing uploadAuthToken', async () => {
      const options = { ...validUploadOptions };
      delete options.uploadAuthToken;

      await expect(fileManager.uploadFile(options)).rejects.toThrow('uploadAuthToken is required and must be a string');
    });

    it('should throw error for invalid fileName', async () => {
      const options = { ...validUploadOptions, fileName: '' };

      await expect(fileManager.uploadFile(options)).rejects.toThrow('File name cannot be empty');
    });

    it('should throw error for missing data', async () => {
      const options = { ...validUploadOptions };
      delete options.data;

      await expect(fileManager.uploadFile(options)).rejects.toThrow('data is required');
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      error.status = 400;
      error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.uploadFile(validUploadOptions)).rejects.toThrow('File upload failed: Upload failed');
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.uploadFile(validUploadOptions)).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('getFileInfo', () => {
    const validFileId = '4_z27c88f1d182b150646ff7f19_f200ec485_d20200118_m130258_c000_v0001142_t0000';

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: validFileId,
          fileName: 'test.txt',
          contentType: 'text/plain',
          contentLength: 12,
          contentSha1: 'test-sha1'
        }
      });
    });

    it('should get file info successfully with object parameter', async () => {
      const response = await fileManager.getFileInfo({ fileId: validFileId });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_get_file_info'),
        { fileId: validFileId },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.fileId).toBe(validFileId);
    });

    it('should get file info successfully with string parameter (backward compatibility)', async () => {
      const response = await fileManager.getFileInfo(validFileId);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_get_file_info'),
        { fileId: validFileId },
        expect.any(Object)
      );

      expect(response.status).toBe(200);
    });

    it('should throw error for invalid arguments', async () => {
      await expect(fileManager.getFileInfo()).rejects.toThrow('Invalid arguments. Expected object with fileId or fileId as string');
      await expect(fileManager.getFileInfo(123)).rejects.toThrow('Invalid arguments. Expected object with fileId or fileId as string');
    });

    it('should throw error for invalid fileId', async () => {
      await expect(fileManager.getFileInfo({ fileId: '' })).rejects.toThrow('fileId cannot be empty');
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.status = 400;
      error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.getFileInfo({ fileId: validFileId })).rejects.toThrow(`File not found: ${validFileId}`);
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.getFileInfo({ fileId: validFileId })).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('deleteFileVersion', () => {
    const validFileId = '4_z27c88f1d182b150646ff7f19_f200ec485_d20200118_m130258_c000_v0001142_t0000';
    const validFileName = 'test.txt';

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: validFileId,
          fileName: validFileName
        }
      });
    });

    it('should delete file version successfully', async () => {
      const response = await fileManager.deleteFileVersion({
        fileId: validFileId,
        fileName: validFileName
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_delete_file_version'),
        {
          fileId: validFileId,
          fileName: validFileName
        },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.fileId).toBe(validFileId);
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.deleteFileVersion()).rejects.toThrow('options object is required');
    });

    it('should throw error for invalid fileId', async () => {
      await expect(fileManager.deleteFileVersion({
        fileId: '',
        fileName: validFileName
      })).rejects.toThrow('fileId cannot be empty');
    });

    it('should throw error for invalid fileName', async () => {
      await expect(fileManager.deleteFileVersion({
        fileId: validFileId,
        fileName: ''
      })).rejects.toThrow('File name cannot be empty');
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.status = 400;
      error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.deleteFileVersion({
        fileId: validFileId,
        fileName: validFileName
      })).rejects.toThrow(`File not found: ${validFileId}`);
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.deleteFileVersion({
        fileId: validFileId,
        fileName: validFileName
      })).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('listFileNames', () => {
    const validBucketId = 'test-bucket-id';

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          files: [
            {
              fileId: 'file1',
              fileName: 'test1.txt',
              size: 100
            },
            {
              fileId: 'file2',
              fileName: 'test2.txt',
              size: 200
            }
          ],
          nextFileName: null
        }
      });
    });

    it('should list file names successfully with minimal options', async () => {
      const response = await fileManager.listFileNames({ bucketId: validBucketId });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_list_file_names'),
        { bucketId: validBucketId },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.files).toHaveLength(2);
    });

    it('should list file names with all optional parameters', async () => {
      const options = {
        bucketId: validBucketId,
        startFileName: 'start.txt',
        maxFileCount: 50,
        prefix: 'test',
        delimiter: '/'
      };

      await fileManager.listFileNames(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_list_file_names'),
        {
          bucketId: validBucketId,
          startFileName: 'start.txt',
          maxFileCount: 50,
          prefix: 'test',
          delimiter: '/'
        },
        expect.any(Object)
      );
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.listFileNames()).rejects.toThrow('options object is required');
    });

    it('should throw error for missing bucketId', async () => {
      await expect(fileManager.listFileNames({})).rejects.toThrow('bucketId is required and must be a string');
    });

    it('should throw error for empty bucketId', async () => {
      await expect(fileManager.listFileNames({ bucketId: '' })).rejects.toThrow('bucketId cannot be empty');
    });

    it('should throw error for invalid maxFileCount', async () => {
      await expect(fileManager.listFileNames({
        bucketId: validBucketId,
        maxFileCount: 0
      })).rejects.toThrow('maxFileCount must be a number between 1 and 10000');

      await expect(fileManager.listFileNames({
        bucketId: validBucketId,
        maxFileCount: 10001
      })).rejects.toThrow('maxFileCount must be a number between 1 and 10000');
    });

    it('should throw error for invalid parameter types', async () => {
      await expect(fileManager.listFileNames({
        bucketId: validBucketId,
        startFileName: 123
      })).rejects.toThrow('startFileName must be a string');

      await expect(fileManager.listFileNames({
        bucketId: validBucketId,
        prefix: 123
      })).rejects.toThrow('prefix must be a string');

      await expect(fileManager.listFileNames({
        bucketId: validBucketId,
        delimiter: 123
      })).rejects.toThrow('delimiter must be a string');
    });

    it('should handle invalid bucket ID error', async () => {
      const error = new Error('Invalid bucket');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.listFileNames({ bucketId: validBucketId })).rejects.toThrow(`Invalid bucket ID: ${validBucketId}`);
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.listFileNames({ bucketId: validBucketId })).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('listFileVersions', () => {
    const validBucketId = 'test-bucket-id';

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          files: [
            {
              fileId: 'file1-v1',
              fileName: 'test1.txt',
              size: 100,
              action: 'upload'
            },
            {
              fileId: 'file1-v2',
              fileName: 'test1.txt',
              size: 150,
              action: 'upload'
            }
          ],
          nextFileName: null,
          nextFileId: null
        }
      });
    });

    it('should list file versions successfully with minimal options', async () => {
      const response = await fileManager.listFileVersions({ bucketId: validBucketId });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_list_file_versions'),
        { bucketId: validBucketId },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.files).toHaveLength(2);
    });

    it('should list file versions with all optional parameters', async () => {
      const options = {
        bucketId: validBucketId,
        startFileName: 'start.txt',
        startFileId: 'start-file-id',
        maxFileCount: 50,
        prefix: 'test',
        delimiter: '/'
      };

      await fileManager.listFileVersions(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_list_file_versions'),
        {
          bucketId: validBucketId,
          startFileName: 'start.txt',
          startFileId: 'start-file-id',
          maxFileCount: 50,
          prefix: 'test',
          delimiter: '/'
        },
        expect.any(Object)
      );
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.listFileVersions()).rejects.toThrow('options object is required');
    });

    it('should throw error for missing bucketId', async () => {
      await expect(fileManager.listFileVersions({})).rejects.toThrow('bucketId is required and must be a string');
    });

    it('should throw error for invalid parameter types', async () => {
      await expect(fileManager.listFileVersions({
        bucketId: validBucketId,
        startFileId: 123
      })).rejects.toThrow('startFileId must be a string');
    });

    it('should handle invalid bucket ID error', async () => {
      const error = new Error('Invalid bucket');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.listFileVersions({ bucketId: validBucketId })).rejects.toThrow(`Invalid bucket ID: ${validBucketId}`);
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.listFileVersions({ bucketId: validBucketId })).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('hideFile', () => {
    const validBucketId = 'test-bucket-id';
    const validFileName = 'test.txt';

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: 'hidden-file-id',
          fileName: validFileName,
          action: 'hide'
        }
      });
    });

    it('should hide file successfully', async () => {
      const response = await fileManager.hideFile({
        bucketId: validBucketId,
        fileName: validFileName
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_hide_file'),
        {
          bucketId: validBucketId,
          fileName: validFileName
        },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.fileName).toBe(validFileName);
      expect(response.data.action).toBe('hide');
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.hideFile()).rejects.toThrow('options object is required');
    });

    it('should throw error for missing bucketId', async () => {
      await expect(fileManager.hideFile({ fileName: validFileName })).rejects.toThrow('bucketId is required and must be a string');
    });

    it('should throw error for empty bucketId', async () => {
      await expect(fileManager.hideFile({
        bucketId: '',
        fileName: validFileName
      })).rejects.toThrow('bucketId cannot be empty');
    });

    it('should throw error for invalid fileName', async () => {
      await expect(fileManager.hideFile({
        bucketId: validBucketId,
        fileName: ''
      })).rejects.toThrow('File name cannot be empty');
    });

    it('should handle invalid bucket ID error', async () => {
      const error = new Error('Invalid bucket');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.hideFile({
        bucketId: validBucketId,
        fileName: validFileName
      })).rejects.toThrow(`Invalid bucket ID: ${validBucketId}`);
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.status = 400;
      error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.hideFile({
        bucketId: validBucketId,
        fileName: validFileName
      })).rejects.toThrow(`File not found: ${validFileName}`);
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.hideFile({
        bucketId: validBucketId,
        fileName: validFileName
      })).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('downloadFileByName', () => {
    const validBucketName = 'test-bucket';
    const validFileName = 'test.txt';
    const mockFileData = new ArrayBuffer(100);

    beforeEach(() => {
      mockHttpClient.get = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'text/plain',
          'content-length': '100'
        }),
        data: mockFileData
      });
    });

    it('should download file by name successfully with object parameter', async () => {
      const response = await fileManager.downloadFileByName({
        bucketName: validBucketName,
        fileName: validFileName
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining(`/file/${validBucketName}/${validFileName}`),
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          responseType: 'arraybuffer',
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data).toBe(mockFileData);
    });

    it('should download file by name with legacy string parameters', async () => {
      const response = await fileManager.downloadFileByName(validBucketName, validFileName);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining(`/file/${validBucketName}/${validFileName}`),
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          responseType: 'arraybuffer'
        })
      );

      expect(response.status).toBe(200);
    });

    it('should support different response types', async () => {
      const responseTypes = ['json', 'text', 'arraybuffer', 'blob', 'stream'];

      for (const responseType of responseTypes) {
        await fileManager.downloadFileByName({
          bucketName: validBucketName,
          fileName: validFileName,
          responseType
        });

        expect(mockHttpClient.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            responseType
          })
        );
      }
    });

    it('should pass download progress callback', async () => {
      const onDownloadProgress = vi.fn();

      await fileManager.downloadFileByName({
        bucketName: validBucketName,
        fileName: validFileName,
        onDownloadProgress
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          onDownloadProgress
        })
      );
    });

    it('should pass additional headers', async () => {
      const customHeaders = {
        'Range': 'bytes=0-1023',
        'Custom-Header': 'custom-value'
      };

      await fileManager.downloadFileByName({
        bucketName: validBucketName,
        fileName: validFileName,
        headers: customHeaders
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'test-token',
            'Range': 'bytes=0-1023',
            'Custom-Header': 'custom-value'
          })
        })
      );
    });

    it('should throw error for invalid arguments', async () => {
      await expect(fileManager.downloadFileByName()).rejects.toThrow('Invalid arguments');
      await expect(fileManager.downloadFileByName(123)).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for missing bucketName', async () => {
      await expect(fileManager.downloadFileByName({
        fileName: validFileName
      })).rejects.toThrow('bucketName is required and must be a string');
    });

    it('should throw error for empty bucketName', async () => {
      await expect(fileManager.downloadFileByName({
        bucketName: '',
        fileName: validFileName
      })).rejects.toThrow('bucketName cannot be empty');
    });

    it('should throw error for invalid fileName', async () => {
      await expect(fileManager.downloadFileByName({
        bucketName: validBucketName,
        fileName: ''
      })).rejects.toThrow('File name cannot be empty');
    });

    it('should throw error for invalid responseType', async () => {
      await expect(fileManager.downloadFileByName({
        bucketName: validBucketName,
        fileName: validFileName,
        responseType: 'invalid'
      })).rejects.toThrow('Invalid responseType. Must be one of: json, text, arraybuffer, blob, stream');
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.status = 404;
      mockHttpClient.get.mockRejectedValue(error);

      await expect(fileManager.downloadFileByName({
        bucketName: validBucketName,
        fileName: validFileName
      })).rejects.toThrow(`File not found: ${validFileName} in bucket ${validBucketName}`);
    });

    it('should handle unauthorized error', async () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      mockHttpClient.get.mockRejectedValue(error);

      await expect(fileManager.downloadFileByName({
        bucketName: validBucketName,
        fileName: validFileName
      })).rejects.toThrow(`Unauthorized access to file: ${validFileName}`);
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.downloadFileByName({
        bucketName: validBucketName,
        fileName: validFileName
      })).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('downloadFileById', () => {
    const validFileId = '4_z27c88f1d182b150646ff7f19_f200ec485_d20200118_m130258_c000_v0001142_t0000';
    const mockFileData = new ArrayBuffer(100);

    beforeEach(() => {
      mockHttpClient.get = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/octet-stream',
          'content-length': '100'
        }),
        data: mockFileData
      });
    });

    it('should download file by ID successfully with object parameter', async () => {
      const response = await fileManager.downloadFileById({
        fileId: validFileId
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining(`b2_download_file_by_id?fileId=${validFileId}`),
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          responseType: 'arraybuffer',
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data).toBe(mockFileData);
    });

    it('should download file by ID with legacy string parameter', async () => {
      const response = await fileManager.downloadFileById(validFileId);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining(`b2_download_file_by_id?fileId=${validFileId}`),
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          responseType: 'arraybuffer'
        })
      );

      expect(response.status).toBe(200);
    });

    it('should support different response types', async () => {
      const responseTypes = ['json', 'text', 'arraybuffer', 'blob', 'stream'];

      for (const responseType of responseTypes) {
        await fileManager.downloadFileById({
          fileId: validFileId,
          responseType
        });

        expect(mockHttpClient.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            responseType
          })
        );
      }
    });

    it('should pass download progress callback', async () => {
      const onDownloadProgress = vi.fn();

      await fileManager.downloadFileById({
        fileId: validFileId,
        onDownloadProgress
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          onDownloadProgress
        })
      );
    });

    it('should pass additional headers', async () => {
      const customHeaders = {
        'Range': 'bytes=0-1023',
        'Custom-Header': 'custom-value'
      };

      await fileManager.downloadFileById({
        fileId: validFileId,
        headers: customHeaders
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'test-token',
            'Range': 'bytes=0-1023',
            'Custom-Header': 'custom-value'
          })
        })
      );
    });

    it('should throw error for invalid arguments', async () => {
      await expect(fileManager.downloadFileById()).rejects.toThrow('Invalid arguments');
      await expect(fileManager.downloadFileById(123)).rejects.toThrow('Invalid arguments');
    });

    it('should throw error for invalid fileId', async () => {
      await expect(fileManager.downloadFileById({
        fileId: ''
      })).rejects.toThrow('fileId cannot be empty');
    });

    it('should throw error for invalid responseType', async () => {
      await expect(fileManager.downloadFileById({
        fileId: validFileId,
        responseType: 'invalid'
      })).rejects.toThrow('Invalid responseType. Must be one of: json, text, arraybuffer, blob, stream');
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.status = 404;
      mockHttpClient.get.mockRejectedValue(error);

      await expect(fileManager.downloadFileById({
        fileId: validFileId
      })).rejects.toThrow(`File not found: ${validFileId}`);
    });

    it('should handle unauthorized error', async () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      mockHttpClient.get.mockRejectedValue(error);

      await expect(fileManager.downloadFileById({
        fileId: validFileId
      })).rejects.toThrow(`Unauthorized access to file: ${validFileId}`);
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.downloadFileById({
        fileId: validFileId
      })).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('getDownloadAuthorization', () => {
    const validBucketId = 'test-bucket-id';
    const validFileNamePrefix = 'files/';

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          bucketId: validBucketId,
          fileNamePrefix: validFileNamePrefix,
          authorizationToken: 'download-auth-token',
          validDurationInSeconds: 604800
        }
      });
    });

    it('should get download authorization successfully with minimal options', async () => {
      const response = await fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_get_download_authorization'),
        {
          bucketId: validBucketId,
          fileNamePrefix: validFileNamePrefix,
          validDurationInSeconds: 604800
        },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.authorizationToken).toBe('download-auth-token');
    });

    it('should get download authorization with all optional parameters', async () => {
      const options = {
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix,
        validDurationInSeconds: 3600,
        b2ContentDisposition: 'attachment; filename="download.txt"'
      };

      await fileManager.getDownloadAuthorization(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('b2_get_download_authorization'),
        {
          bucketId: validBucketId,
          fileNamePrefix: validFileNamePrefix,
          validDurationInSeconds: 3600,
          b2ContentDisposition: 'attachment; filename="download.txt"'
        },
        expect.any(Object)
      );
    });

    it('should accept empty fileNamePrefix', async () => {
      await fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: ''
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          fileNamePrefix: ''
        }),
        expect.any(Object)
      );
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.getDownloadAuthorization()).rejects.toThrow('options object is required');
    });

    it('should throw error for missing bucketId', async () => {
      await expect(fileManager.getDownloadAuthorization({
        fileNamePrefix: validFileNamePrefix
      })).rejects.toThrow('bucketId is required and must be a string');
    });

    it('should throw error for empty bucketId', async () => {
      await expect(fileManager.getDownloadAuthorization({
        bucketId: '',
        fileNamePrefix: validFileNamePrefix
      })).rejects.toThrow('bucketId cannot be empty');
    });

    it('should throw error for missing fileNamePrefix', async () => {
      await expect(fileManager.getDownloadAuthorization({
        bucketId: validBucketId
      })).rejects.toThrow('fileNamePrefix is required and must be a string');
    });

    it('should throw error for invalid validDurationInSeconds', async () => {
      await expect(fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix,
        validDurationInSeconds: 0
      })).rejects.toThrow('validDurationInSeconds must be a number between 1 and 604800');

      await expect(fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix,
        validDurationInSeconds: 604801
      })).rejects.toThrow('validDurationInSeconds must be a number between 1 and 604800');
    });

    it('should throw error for invalid b2ContentDisposition type', async () => {
      await expect(fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix,
        b2ContentDisposition: 123
      })).rejects.toThrow('b2ContentDisposition must be a string');
    });

    it('should handle invalid bucket ID error', async () => {
      const error = new Error('Invalid bucket');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix
      })).rejects.toThrow(`Invalid bucket ID: ${validBucketId}`);
    });

    it('should handle not allowed error', async () => {
      const error = new Error('Not allowed');
      error.status = 400;
      error.code = B2_ERROR_CODES.NOT_ALLOWED;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix
      })).rejects.toThrow(`Not allowed to get download authorization for bucket: ${validBucketId}`);
    });

    it('should handle unauthorized error', async () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix
      })).rejects.toThrow('Unauthorized: Invalid credentials for download authorization');
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);

      await expect(fileManager.getDownloadAuthorization({
        bucketId: validBucketId,
        fileNamePrefix: validFileNamePrefix
      })).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  // ===== LARGE FILE OPERATIONS TESTS =====

  describe('startLargeFile', () => {
    const validOptions = {
      bucketId: 'test-bucket-id',
      fileName: 'large-file.zip',
      contentType: 'application/zip'
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: 'test-large-file-id',
          fileName: 'large-file.zip',
          accountId: 'test-account',
          bucketId: 'test-bucket-id',
          contentType: 'application/zip',
          uploadTimestamp: Date.now()
        }
      });
    });

    it('should start large file successfully with valid options', async () => {
      const response = await fileManager.startLargeFile(validOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_start_large_file'),
        {
          bucketId: 'test-bucket-id',
          fileName: 'large-file.zip',
          contentType: 'application/zip'
        },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.fileId).toBe('test-large-file-id');
    });

    it('should use default content type if not provided', async () => {
      const options = { ...validOptions };
      delete options.contentType;

      await fileManager.startLargeFile(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          contentType: 'application/octet-stream'
        }),
        expect.any(Object)
      );
    });

    it('should include file info if provided', async () => {
      const options = {
        ...validOptions,
        fileInfo: { customField: 'customValue' }
      };

      await fileManager.startLargeFile(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          fileInfo: { customField: 'customValue' }
        }),
        expect.any(Object)
      );
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.startLargeFile()).rejects.toThrow('options object is required');
    });

    it('should throw error for invalid bucketId', async () => {
      await expect(fileManager.startLargeFile({ ...validOptions, bucketId: '' }))
        .rejects.toThrow('bucketId cannot be empty');
    });

    it('should throw error for invalid fileName', async () => {
      await expect(fileManager.startLargeFile({ ...validOptions, fileName: '' }))
        .rejects.toThrow('File name cannot be empty');
    });

    it('should handle B2 API errors', async () => {
      const error = new Error('Invalid bucket');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.startLargeFile(validOptions)).rejects.toThrow('Invalid bucket ID: test-bucket-id');
    });
  });

  describe('getUploadPartUrl', () => {
    const validOptions = {
      fileId: 'test-large-file-id'
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: 'test-large-file-id',
          uploadUrl: 'https://upload-part.test.com',
          authorizationToken: 'part-upload-token'
        }
      });
    });

    it('should get upload part URL successfully', async () => {
      const response = await fileManager.getUploadPartUrl(validOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_get_upload_part_url'),
        { fileId: 'test-large-file-id' },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.uploadUrl).toBe('https://upload-part.test.com');
      expect(response.data.authorizationToken).toBe('part-upload-token');
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.getUploadPartUrl()).rejects.toThrow('options object is required');
    });

    it('should throw error for invalid fileId', async () => {
      await expect(fileManager.getUploadPartUrl({ fileId: '' }))
        .rejects.toThrow('fileId cannot be empty');
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.status = 400;
      error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.getUploadPartUrl(validOptions)).rejects.toThrow('Large file not found: test-large-file-id');
    });
  });

  describe('uploadPart', () => {
    const validOptions = {
      uploadUrl: 'https://upload-part.test.com',
      authorizationToken: 'part-upload-token',
      partNumber: 1,
      data: 'test part data'
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: 'test-large-file-id',
          partNumber: 1,
          contentLength: 14,
          contentSha1: 'test-part-sha1'
        }
      });
    });

    it('should upload part successfully', async () => {
      const response = await fileManager.uploadPart(validOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://upload-part.test.com',
        'test part data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'part-upload-token',
            'Content-Type': 'application/octet-stream',
            'Content-Length': '14',
            'X-Bz-Part-Number': '1',
            'X-Bz-Content-Sha1': expect.any(String)
          }),
          timeout: 300000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.partNumber).toBe(1);
    });

    it('should use provided SHA1 hash', async () => {
      const options = {
        ...validOptions,
        contentSha1: 'provided-sha1-hash'
      };

      await fileManager.uploadPart(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Bz-Content-Sha1': 'provided-sha1-hash'
          })
        })
      );
    });

    it('should throw error for invalid part number', async () => {
      await expect(fileManager.uploadPart({ ...validOptions, partNumber: 0 }))
        .rejects.toThrow('partNumber must be a number between 1 and 10000');

      await expect(fileManager.uploadPart({ ...validOptions, partNumber: 10001 }))
        .rejects.toThrow('partNumber must be a number between 1 and 10000');
    });

    it('should throw error for missing required fields', async () => {
      await expect(fileManager.uploadPart({ ...validOptions, uploadUrl: '' }))
        .rejects.toThrow('uploadUrl is required and must be a string');

      await expect(fileManager.uploadPart({ ...validOptions, authorizationToken: '' }))
        .rejects.toThrow('authorizationToken is required and must be a string');

      await expect(fileManager.uploadPart({ ...validOptions, data: null }))
        .rejects.toThrow('data is required');
    });

    it('should validate part size limits', async () => {
      // Mock data with large length property to simulate 6GB without actually creating it
      const largeData = { length: 6 * 1024 * 1024 * 1024 }; // 6GB
      await expect(fileManager.uploadPart({ ...validOptions, data: largeData }))
        .rejects.toThrow('Part size cannot exceed');
    });
  });

  describe('finishLargeFile', () => {
    const validOptions = {
      fileId: 'test-large-file-id',
      partSha1Array: ['1234567890abcdef1234567890abcdef12345678', '1234567890abcdef1234567890abcdef12345679']
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: 'test-large-file-id',
          fileName: 'large-file.zip',
          accountId: 'test-account',
          bucketId: 'test-bucket-id',
          contentLength: 1000000,
          contentType: 'application/zip',
          contentSha1: 'final-file-sha1',
          uploadTimestamp: Date.now()
        }
      });
    });

    it('should finish large file successfully', async () => {
      const response = await fileManager.finishLargeFile(validOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_finish_large_file'),
        {
          fileId: 'test-large-file-id',
          partSha1Array: ['1234567890abcdef1234567890abcdef12345678', '1234567890abcdef1234567890abcdef12345679']
        },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.fileId).toBe('test-large-file-id');
    });

    it('should throw error for invalid partSha1Array', async () => {
      await expect(fileManager.finishLargeFile({ ...validOptions, partSha1Array: [] }))
        .rejects.toThrow('partSha1Array cannot be empty');

      await expect(fileManager.finishLargeFile({ ...validOptions, partSha1Array: 'not-array' }))
        .rejects.toThrow('partSha1Array is required and must be an array');

      await expect(fileManager.finishLargeFile({ ...validOptions, partSha1Array: ['invalid-sha1'] }))
        .rejects.toThrow('must be a 40-character SHA1 hash');

      await expect(fileManager.finishLargeFile({ ...validOptions, partSha1Array: ['1234567890abcdef1234567890abcdef1234567X'] }))
        .rejects.toThrow('must be a valid hexadecimal SHA1 hash');
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.status = 400;
      error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.finishLargeFile(validOptions)).rejects.toThrow('Large file not found: test-large-file-id');
    });
  });

  describe('cancelLargeFile', () => {
    const validOptions = {
      fileId: 'test-large-file-id'
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          fileId: 'test-large-file-id',
          fileName: 'large-file.zip',
          accountId: 'test-account'
        }
      });
    });

    it('should cancel large file successfully', async () => {
      const response = await fileManager.cancelLargeFile(validOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_cancel_large_file'),
        { fileId: 'test-large-file-id' },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.fileId).toBe('test-large-file-id');
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.cancelLargeFile()).rejects.toThrow('options object is required');
    });

    it('should throw error for invalid fileId', async () => {
      await expect(fileManager.cancelLargeFile({ fileId: '' }))
        .rejects.toThrow('fileId cannot be empty');
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found');
      error.status = 400;
      error.code = B2_ERROR_CODES.FILE_NOT_PRESENT;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.cancelLargeFile(validOptions)).rejects.toThrow('Large file not found: test-large-file-id');
    });

    it('should handle unauthorized error', async () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.cancelLargeFile(validOptions)).rejects.toThrow('Unauthorized: Invalid credentials for canceling large file');
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);
      await expect(fileManager.cancelLargeFile(validOptions)).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });

  describe('listParts', () => {
    const validOptions = {
      fileId: 'test-large-file-id'
    };

    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          parts: [
            { partNumber: 1, contentLength: 1000000, contentSha1: 'part1-sha1' },
            { partNumber: 2, contentLength: 500000, contentSha1: 'part2-sha1' }
          ],
          nextPartNumber: null
        }
      });
    });

    it('should list parts successfully', async () => {
      const response = await fileManager.listParts(validOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_list_parts'),
        { fileId: 'test-large-file-id' },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.parts).toHaveLength(2);
    });

    it('should include optional parameters', async () => {
      const options = {
        ...validOptions,
        startPartNumber: 5,
        maxPartCount: 50
      };

      await fileManager.listParts(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          fileId: 'test-large-file-id',
          startPartNumber: 5,
          maxPartCount: 50
        },
        expect.any(Object)
      );
    });

    it('should validate optional parameters', async () => {
      await expect(fileManager.listParts({ ...validOptions, startPartNumber: 0 }))
        .rejects.toThrow('startPartNumber must be a number between 1 and 10000');

      await expect(fileManager.listParts({ ...validOptions, maxPartCount: 0 }))
        .rejects.toThrow('maxPartCount must be a number between 1 and 10000');

      await expect(fileManager.listParts({ ...validOptions, maxPartCount: 10001 }))
        .rejects.toThrow('maxPartCount must be a number between 1 and 10000');
    });
  });

  describe('listUnfinishedLargeFiles', () => {
    let validOptions;

    beforeEach(() => {
      validOptions = {
        bucketId: 'test-bucket-id'
      };

      mockHttpClient.post.mockResolvedValue({
        status: 200,
        data: {
          files: [
            {
              fileId: 'unfinished-file-1',
              fileName: 'large-file-1.bin',
              contentType: 'application/octet-stream',
              uploadTimestamp: 1234567890000
            },
            {
              fileId: 'unfinished-file-2', 
              fileName: 'large-file-2.bin',
              contentType: 'application/octet-stream',
              uploadTimestamp: 1234567891000
            }
          ],
          nextFileId: null
        }
      });
    });

    it('should list unfinished large files successfully', async () => {
      const response = await fileManager.listUnfinishedLargeFiles(validOptions);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/b2api/v2/b2_list_unfinished_large_files'),
        { bucketId: 'test-bucket-id' },
        expect.objectContaining({
          headers: { 'Authorization': 'test-token' },
          timeout: 30000
        })
      );

      expect(response.status).toBe(200);
      expect(response.data.files).toHaveLength(2);
    });

    it('should include optional parameters', async () => {
      const options = {
        ...validOptions,
        startFileId: 'start-file-id',
        maxFileCount: 50
      };

      await fileManager.listUnfinishedLargeFiles(options);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          bucketId: 'test-bucket-id',
          startFileId: 'start-file-id',
          maxFileCount: 50
        },
        expect.any(Object)
      );
    });

    it('should throw error for missing options', async () => {
      await expect(fileManager.listUnfinishedLargeFiles()).rejects.toThrow('options object is required');
      await expect(fileManager.listUnfinishedLargeFiles(null)).rejects.toThrow('options object is required');
    });

    it('should throw error for missing bucketId', async () => {
      await expect(fileManager.listUnfinishedLargeFiles({})).rejects.toThrow('bucketId is required and must be a string');
      await expect(fileManager.listUnfinishedLargeFiles({ bucketId: 123 })).rejects.toThrow('bucketId is required and must be a string');
    });

    it('should throw error for empty bucketId', async () => {
      await expect(fileManager.listUnfinishedLargeFiles({ bucketId: '' })).rejects.toThrow('bucketId cannot be empty');
      await expect(fileManager.listUnfinishedLargeFiles({ bucketId: '   ' })).rejects.toThrow('bucketId cannot be empty');
    });

    it('should validate optional parameters', async () => {
      await expect(fileManager.listUnfinishedLargeFiles({ ...validOptions, maxFileCount: 0 }))
        .rejects.toThrow('maxFileCount must be a number between 1 and 10000');

      await expect(fileManager.listUnfinishedLargeFiles({ ...validOptions, maxFileCount: 10001 }))
        .rejects.toThrow('maxFileCount must be a number between 1 and 10000');

      await expect(fileManager.listUnfinishedLargeFiles({ ...validOptions, startFileId: 123 }))
        .rejects.toThrow('startFileId must be a string');
    });

    it('should handle invalid bucket ID error', async () => {
      const error = new Error('Invalid bucket ID');
      error.status = 400;
      error.code = B2_ERROR_CODES.INVALID_BUCKET_ID;
      mockHttpClient.post.mockRejectedValue(error);

      await expect(fileManager.listUnfinishedLargeFiles(validOptions)).rejects.toThrow('Invalid bucket ID: test-bucket-id');
    });

    it('should throw when not authenticated', async () => {
      mockAuthManager.isAuthenticated.mockReturnValue(false);
      await expect(fileManager.listUnfinishedLargeFiles(validOptions)).rejects.toThrow('Not authenticated. Call authorize() first.');
    });
  });
});