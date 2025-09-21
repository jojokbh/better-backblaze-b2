import { B2Client } from './src/index.js';

// Replace these with your actual B2 application credentials
const APPLICATION_KEY_ID = '003a6915e1161c70000000009';
const APPLICATION_KEY = 'K003P168qypiBuhT6x+wGqkYL9ni5SU';

async function testB2Client() {
  try {
    // Initialize the B2 client
    const b2 = new B2Client();
    
    console.log('🔐 Authorizing with B2...');
    
    // Authorize with your credentials
    const authResponse = await b2.authorize({
      applicationKeyId: APPLICATION_KEY_ID,
      applicationKey: APPLICATION_KEY
    });
    
    console.log('✅ Authorization successful!');
    console.log('Account ID:', authResponse.data.accountId);
    console.log('API URL:', authResponse.data.apiUrl);
    
    // List all buckets
    console.log('\n📦 Listing buckets...');
    const bucketsResponse = await b2.listBuckets();
    
    console.log(`Found ${bucketsResponse.data.buckets.length} bucket(s):`);
    bucketsResponse.data.buckets.forEach((bucket: any, index: number) => {
      console.log(`  ${index + 1}. ${bucket.bucketName} (${bucket.bucketType}) - ID: ${bucket.bucketId}`);
    });
    
    // If there are buckets, list files in the first one
    if (bucketsResponse.data.buckets.length > 0) {
      const firstBucket = bucketsResponse.data.buckets[0];
      console.log(`\n📄 Listing files in bucket "${firstBucket.bucketName}"...`);
      
      try {
        const filesResponse = await b2.listFileNames({
          bucketId: firstBucket.bucketId,
          maxFileCount: 10 // Limit to first 10 files
        });
        
        if (filesResponse.data.files.length > 0) {
          console.log(`Found ${filesResponse.data.files.length} file(s):`);
          filesResponse.data.files.forEach((file: any, index: number) => {
            console.log(`  ${index + 1}. ${file.fileName} (${file.size} bytes) - ID: ${file.fileId}`);
          });
        } else {
          console.log('  No files found in this bucket.');
        }
      } catch (error) {
        console.log('  Error listing files:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testB2Client();