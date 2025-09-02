/**
 * Type tests to validate TypeScript definitions
 * These tests ensure that the TypeScript definitions are correct and complete
 */

import { 
  B2Client, 
  B2Error,
  BUCKET_TYPES, 
  KEY_CAPABILITIES,
  type B2ClientOptions,
  type AuthCredentials,
  type CreateBucketOptions,
  type UploadFileOptions,
  type DownloadFileByNameOptions,
  type CreateKeyOptions,
  type ProgressEvent,
  type B2Response
} from '../../src/types/index.js';

// Test B2Client constructor
const client1 = new B2Client();
const client2 = new B2Client({
  applicationKeyId: 'test-key-id',
  applicationKey: 'test-key',
  timeout: 30000,
  retry: {
    retries: 3,
    retryDelay: 1000
  }
});

// Test authentication
async function testAuth() {
  const credentials: AuthCredentials = {
    applicationKeyId: 'test-key-id',
    applicationKey: 'test-key'
  };

  // Test different authorize signatures
  await client1.authorize(credentials);
  await client1.authorize('key-id', 'key');
  await client1.authorize();
}

// Test bucket operations
async function testBuckets() {
  const createOptions: CreateBucketOptions = {
    bucketName: 'test-bucket',
    bucketType: BUCKET_TYPES.ALL_PRIVATE
  };

  // Test different method signatures
  await client1.createBucket(createOptions);
  await client1.createBucket('bucket-name', 'allPrivate');
  
  await client1.deleteBucket({ bucketId: 'bucket-id' });
  await client1.deleteBucket('bucket-id');
  
  const buckets = await client1.listBuckets();
  const bucket = await client1.getBucket({ bucketName: 'test-bucket' });
  
  await client1.updateBucket({ bucketId: 'id', bucketType: 'allPublic' });
  await client1.updateBucket('id', 'allPublic');
  
  await client1.getUploadUrl({ bucketId: 'id' });
  await client1.getUploadUrl('id');
}

// Test file operations
async function testFiles() {
  const uploadOptions: UploadFileOptions = {
    uploadUrl: 'https://upload.url',
    uploadAuthToken: 'token',
    fileName: 'test.txt',
    data: Buffer.from('test data'),
    contentType: 'text/plain',
    onUploadProgress: (progress: ProgressEvent) => {
      console.log(`Upload progress: ${progress.percentage}%`);
    }
  };

  await client1.uploadFile(uploadOptions);

  const downloadOptions: DownloadFileByNameOptions = {
    bucketName: 'test-bucket',
    fileName: 'test.txt',
    responseType: 'arraybuffer',
    onDownloadProgress: (progress: ProgressEvent) => {
      console.log(`Download progress: ${progress.percentage}%`);
    }
  };

  // Test different download signatures
  await client1.downloadFileByName(downloadOptions);
  await client1.downloadFileByName('bucket', 'file.txt');
  
  await client1.downloadFileById({ fileId: 'file-id' });
  await client1.downloadFileById('file-id');

  await client1.listFileNames({
    bucketId: 'bucket-id',
    maxFileCount: 100,
    prefix: 'photos/'
  });

  await client1.getFileInfo({ fileId: 'file-id' });
  await client1.getFileInfo('file-id');

  await client1.deleteFileVersion({
    fileId: 'file-id',
    fileName: 'file.txt'
  });
}

// Test large file operations
async function testLargeFiles() {
  const startResponse = await client1.startLargeFile({
    bucketId: 'bucket-id',
    fileName: 'large-file.zip',
    contentType: 'application/zip'
  });

  const partUrlResponse = await client1.getUploadPartUrl({
    fileId: startResponse.data.fileId
  });

  await client1.uploadPart({
    uploadUrl: partUrlResponse.data.uploadUrl,
    authorizationToken: partUrlResponse.data.authorizationToken,
    partNumber: 1,
    data: Buffer.from('part data')
  });

  await client1.finishLargeFile({
    fileId: startResponse.data.fileId,
    partSha1Array: ['sha1-hash']
  });
}

// Test key management
async function testKeys() {
  const createKeyOptions: CreateKeyOptions = {
    keyName: 'test-key',
    capabilities: [KEY_CAPABILITIES.READ_FILES, KEY_CAPABILITIES.WRITE_FILES],
    bucketId: 'bucket-id'
  };

  await client1.createKey(createKeyOptions);
  
  await client1.deleteKey({ applicationKeyId: 'key-id' });
  await client1.deleteKey('key-id');
  
  await client1.listKeys({
    maxKeyCount: 100
  });
}

// Test error handling
function testErrors() {
  const error = new B2Error('Test error', {
    status: 400,
    code: 'bad_request',
    isRetryable: false
  });

  console.log(error.getDescription());
  console.log(error.toJSON());
}

// Test utility methods
function testUtilities() {
  const isAuth = client1.isAuthenticated();
  const authContext = client1.getAuthContext();
  client1.clearAuth();
}

// Test constants
function testConstants() {
  const bucketType = BUCKET_TYPES.ALL_PUBLIC;
  const capability = KEY_CAPABILITIES.LIST_FILES;
  
  // Test that constants are readonly
  // @ts-expect-error - Should not be able to modify readonly properties
  BUCKET_TYPES.ALL_PUBLIC = 'modified';
  
  // @ts-expect-error - Should not be able to modify readonly properties  
  KEY_CAPABILITIES.READ_FILES = 'modified';
}

// Test response types
async function testResponseTypes() {
  const authResponse: B2Response<any> = await client1.authorize('key-id', 'key');
  
  // Test that response has correct structure
  console.log(authResponse.status);
  console.log(authResponse.data);
  console.log(authResponse.headers);
}

// Test backward compatibility
function testBackwardCompatibility() {
  // Test instance properties
  client1.accountId = 'account-id';
  client1.applicationKeyId = 'key-id';
  client1.applicationKey = 'key';
  
  // Test constants as instance properties
  const bucketTypes = client1.BUCKET_TYPES;
  const keyCapabilities = client1.KEY_CAPABILITIES;
}

// Export functions to prevent unused variable warnings
export {
  testAuth,
  testBuckets,
  testFiles,
  testLargeFiles,
  testKeys,
  testErrors,
  testUtilities,
  testConstants,
  testResponseTypes,
  testBackwardCompatibility
};