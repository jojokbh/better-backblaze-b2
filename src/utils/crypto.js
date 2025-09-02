/**
 * Cryptographic utilities for B2 API operations
 * Uses Node.js crypto module and Web Crypto API for browser compatibility
 */

// Check if we're in Node.js or browser environment
const isNode =
  typeof process !== 'undefined' && process.versions && process.versions.node;

// Lazy-load crypto module to avoid top-level await
let crypto;
let cryptoPromise;

function getCrypto() {
  if (crypto) {
    return crypto;
  }

  if (isNode) {
    // Node.js environment - use dynamic import
    if (!cryptoPromise) {
      cryptoPromise = import('crypto').then((cryptoModule) => {
        crypto = cryptoModule;
        return crypto;
      });
    }
    return cryptoPromise;
  } else {
    // Browser environment - use Web Crypto API
    crypto = globalThis.crypto;
    return crypto;
  }
}

/**
 * SHA1 hashing utilities for file integrity verification
 */
export class Sha1Hasher {
  /**
   * Calculate SHA1 hash of data
   * @param {Buffer|Uint8Array|string} data - Data to hash
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  static async hash(data) {
    if (isNode) {
      return this.hashNode(data);
    } else {
      return this.hashBrowser(data);
    }
  }

  /**
   * Calculate SHA1 hash using Node.js crypto module
   * @param {Buffer|string} data - Data to hash
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  static async hashNode(data) {
    const cryptoModule = await getCrypto();
    const hash = cryptoModule.createHash('sha1');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Calculate SHA1 hash using Web Crypto API
   * @param {Uint8Array|string} data - Data to hash
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  static async hashBrowser(data) {
    // Convert string to Uint8Array if needed
    if (typeof data === 'string') {
      data = new TextEncoder().encode(data);
    }

    // Calculate hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);

    // Convert to hex string
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create a streaming SHA1 hasher for large files
   * @returns {Sha1Stream} Streaming hasher instance
   */
  static createStream() {
    return new Sha1Stream();
  }

  /**
   * Verify SHA1 hash matches expected value
   * @param {Buffer|Uint8Array|string} data - Data to verify
   * @param {string} expectedHash - Expected SHA1 hash
   * @returns {Promise<boolean>} True if hash matches
   */
  static async verify(data, expectedHash) {
    const actualHash = await this.hash(data);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Calculate SHA1 hash of a file (Node.js only)
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  static async hashFile(filePath) {
    if (!isNode) {
      throw new Error('File hashing is only available in Node.js environment');
    }

    const fs = await import('fs');
    const stream = fs.createReadStream(filePath);
    const hasher = this.createStream();

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => hasher.update(chunk));
      stream.on('end', () => resolve(hasher.digest()));
      stream.on('error', reject);
    });
  }
}

/**
 * Streaming SHA1 hasher for processing large amounts of data
 */
export class Sha1Stream {
  constructor() {
    this.isNode = isNode;
    if (isNode) {
      this.cryptoPromise = getCrypto();
      this.hash = null;
    } else {
      this.chunks = [];
    }
  }

  /**
   * Initialize the hasher (async for Node.js)
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isNode && !this.hash) {
      const cryptoModule = await this.cryptoPromise;
      this.hash = cryptoModule.createHash('sha1');
    }
  }

  /**
   * Update hash with new data
   * @param {Buffer|Uint8Array|string} data - Data to add to hash
   */
  async update(data) {
    if (this.isNode) {
      await this.init();
      this.hash.update(data);
    } else {
      // Store chunks for browser processing
      if (typeof data === 'string') {
        data = new TextEncoder().encode(data);
      }
      this.chunks.push(data);
    }
  }

  /**
   * Finalize hash and return result
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  async digest() {
    if (this.isNode) {
      await this.init();
      return this.hash.digest('hex');
    } else {
      // Combine all chunks and hash in browser
      const totalLength = this.chunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );
      const combined = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of this.chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return Sha1Hasher.hashBrowser(combined);
    }
  }
}

/**
 * Utility functions for working with hashes and checksums
 */
export const HashUtils = {
  /**
   * Validate SHA1 hash format
   * @param {string} hash - Hash to validate
   * @returns {boolean} True if valid SHA1 format
   */
  isValidSha1(hash) {
    return typeof hash === 'string' && /^[a-fA-F0-9]{40}$/.test(hash);
  },

  /**
   * Normalize SHA1 hash to lowercase
   * @param {string} hash - Hash to normalize
   * @returns {string} Normalized hash
   */
  normalizeSha1(hash) {
    if (!this.isValidSha1(hash)) {
      throw new Error('Invalid SHA1 hash format');
    }
    return hash.toLowerCase();
  },

  /**
   * Compare two SHA1 hashes for equality
   * @param {string} hash1 - First hash
   * @param {string} hash2 - Second hash
   * @returns {boolean} True if hashes are equal
   */
  compareSha1(hash1, hash2) {
    if (!this.isValidSha1(hash1) || !this.isValidSha1(hash2)) {
      return false;
    }
    return hash1.toLowerCase() === hash2.toLowerCase();
  },

  /**
   * Generate a random SHA1-like string for testing
   * @returns {string} Random 40-character hex string
   */
  generateRandomSha1() {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 40; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  },
};

/**
 * Progress tracking utilities for hash calculation
 */
export class ProgressiveHasher {
  constructor(onProgress) {
    this.hasher = new Sha1Stream();
    this.onProgress = onProgress;
    this.totalBytes = 0;
    this.processedBytes = 0;
  }

  /**
   * Set the total size for progress calculation
   * @param {number} totalSize - Total size in bytes
   */
  setTotalSize(totalSize) {
    this.totalBytes = totalSize;
  }

  /**
   * Update hash with data and report progress
   * @param {Buffer|Uint8Array|string} data - Data to hash
   */
  async update(data) {
    await this.hasher.update(data);

    if (typeof data === 'string') {
      this.processedBytes += new TextEncoder().encode(data).length;
    } else {
      this.processedBytes += data.length;
    }

    if (this.onProgress && this.totalBytes > 0) {
      const progress = Math.min(this.processedBytes / this.totalBytes, 1);
      this.onProgress({
        loaded: this.processedBytes,
        total: this.totalBytes,
        progress: progress,
      });
    }
  }

  /**
   * Finalize hash calculation
   * @returns {Promise<string>} SHA1 hash as hex string
   */
  async digest() {
    return await this.hasher.digest();
  }
}

// Export convenience functions
export const sha1 = Sha1Hasher.hash.bind(Sha1Hasher);
export const verifySha1 = Sha1Hasher.verify.bind(Sha1Hasher);
export const createSha1Stream = Sha1Hasher.createStream.bind(Sha1Hasher);
