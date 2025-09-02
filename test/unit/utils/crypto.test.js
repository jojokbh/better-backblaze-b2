import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  Sha1Hasher, 
  Sha1Stream, 
  HashUtils, 
  ProgressiveHasher,
  sha1,
  verifySha1,
  createSha1Stream
} from '../../../src/utils/crypto.js';

// Mock crypto for testing
const mockNodeCrypto = {
  createHash: vi.fn(() => ({
    update: vi.fn(),
    digest: vi.fn(() => 'da39a3ee5e6b4b0d3255bfef95601890afd80709')
  }))
};

const mockWebCrypto = {
  subtle: {
    digest: vi.fn(() => Promise.resolve(new ArrayBuffer(20)))
  }
};

// Mock global crypto and process
vi.stubGlobal('crypto', mockWebCrypto);
vi.stubGlobal('process', { versions: { node: '18.0.0' } });

describe('Sha1Hasher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hash', () => {
    it('should hash string data', async () => {
      const result = await Sha1Hasher.hash('test data');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[a-f0-9]{40}$/);
    });

    it('should hash buffer data', async () => {
      const buffer = new Uint8Array([1, 2, 3, 4]);
      const result = await Sha1Hasher.hash(buffer);
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[a-f0-9]{40}$/);
    });
  });

  describe('verify', () => {
    it('should verify matching hash', async () => {
      const data = 'test data';
      const hash = await Sha1Hasher.hash(data);
      const isValid = await Sha1Hasher.verify(data, hash);
      expect(isValid).toBe(true);
    });

    it('should reject non-matching hash', async () => {
      const data = 'test data';
      const wrongHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const isValid = await Sha1Hasher.verify(data, wrongHash);
      expect(isValid).toBe(false);
    });

    it('should be case insensitive', async () => {
      const data = 'test data';
      const hash = await Sha1Hasher.hash(data);
      const upperHash = hash.toUpperCase();
      const isValid = await Sha1Hasher.verify(data, upperHash);
      expect(isValid).toBe(true);
    });
  });

  describe('createStream', () => {
    it('should create a Sha1Stream instance', () => {
      const stream = Sha1Hasher.createStream();
      expect(stream).toBeInstanceOf(Sha1Stream);
    });
  });
});

describe('Sha1Stream', () => {
  let stream;

  beforeEach(() => {
    stream = new Sha1Stream();
    vi.clearAllMocks();
  });

  describe('update and digest', () => {
    it('should update with string data', () => {
      expect(() => stream.update('test data')).not.toThrow();
    });

    it('should update with buffer data', () => {
      const buffer = new Uint8Array([1, 2, 3, 4]);
      expect(() => stream.update(buffer)).not.toThrow();
    });

    it('should digest hash', async () => {
      stream.update('test data');
      const result = await stream.digest();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[a-f0-9]{40}$/);
    });

    it('should handle multiple updates', async () => {
      stream.update('test');
      stream.update(' ');
      stream.update('data');
      const result = await stream.digest();
      expect(typeof result).toBe('string');
    });
  });
});

describe('HashUtils', () => {
  describe('isValidSha1', () => {
    it('should validate correct SHA1 format', () => {
      expect(HashUtils.isValidSha1('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe(true);
      expect(HashUtils.isValidSha1('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709')).toBe(true);
    });

    it('should reject invalid SHA1 format', () => {
      expect(HashUtils.isValidSha1('short')).toBe(false);
      expect(HashUtils.isValidSha1('da39a3ee5e6b4b0d3255bfef95601890afd8070g')).toBe(false); // invalid char
      expect(HashUtils.isValidSha1('da39a3ee5e6b4b0d3255bfef95601890afd8070')).toBe(false); // too short
      expect(HashUtils.isValidSha1(123)).toBe(false); // not string
    });
  });

  describe('normalizeSha1', () => {
    it('should normalize valid SHA1 to lowercase', () => {
      const hash = 'DA39A3EE5E6B4B0D3255BFEF95601890AFD80709';
      expect(HashUtils.normalizeSha1(hash)).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    });

    it('should throw for invalid SHA1', () => {
      expect(() => HashUtils.normalizeSha1('invalid')).toThrow('Invalid SHA1 hash format');
    });
  });

  describe('compareSha1', () => {
    it('should compare valid SHA1 hashes', () => {
      const hash1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
      const hash2 = 'DA39A3EE5E6B4B0D3255BFEF95601890AFD80709';
      expect(HashUtils.compareSha1(hash1, hash2)).toBe(true);
    });

    it('should return false for different hashes', () => {
      const hash1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
      const hash2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      expect(HashUtils.compareSha1(hash1, hash2)).toBe(false);
    });

    it('should return false for invalid hashes', () => {
      expect(HashUtils.compareSha1('invalid', 'da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe(false);
    });
  });

  describe('generateRandomSha1', () => {
    it('should generate valid SHA1 format', () => {
      const hash = HashUtils.generateRandomSha1();
      expect(HashUtils.isValidSha1(hash)).toBe(true);
    });

    it('should generate different hashes', () => {
      const hash1 = HashUtils.generateRandomSha1();
      const hash2 = HashUtils.generateRandomSha1();
      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('ProgressiveHasher', () => {
  let progressCallback;
  let hasher;

  beforeEach(() => {
    progressCallback = vi.fn();
    hasher = new ProgressiveHasher(progressCallback);
  });

  describe('progress tracking', () => {
    it('should track progress with total size set', async () => {
      hasher.setTotalSize(100);
      await hasher.update('test data'); // 9 bytes
      
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 9,
        total: 100,
        progress: 0.09
      });
    });

    it('should not call progress callback without total size', async () => {
      await hasher.update('test data');
      expect(progressCallback).not.toHaveBeenCalled();
    });

    it('should handle string data correctly', async () => {
      hasher.setTotalSize(50);
      await hasher.update('hello'); // 5 bytes
      
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 5,
        total: 50,
        progress: 0.1
      });
    });

    it('should handle buffer data correctly', async () => {
      hasher.setTotalSize(10);
      const buffer = new Uint8Array([1, 2, 3]);
      await hasher.update(buffer); // 3 bytes
      
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 3,
        total: 10,
        progress: 0.3
      });
    });

    it('should cap progress at 1.0', async () => {
      hasher.setTotalSize(5);
      await hasher.update('test data'); // 9 bytes, more than total
      
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 9,
        total: 5,
        progress: 1
      });
    });
  });

  describe('digest', () => {
    it('should return hash result', async () => {
      await hasher.update('test data');
      const result = await hasher.digest();
      expect(typeof result).toBe('string');
    });
  });
});

describe('browser environment', () => {
  it('should handle browser environment for Sha1Hasher', async () => {
    // Mock browser environment
    const originalProcess = global.process;
    delete global.process;
    
    try {
      // Mock Web Crypto API response
      const mockArrayBuffer = new ArrayBuffer(20);
      const mockUint8Array = new Uint8Array(mockArrayBuffer);
      // Fill with test data to create a valid hex string
      for (let i = 0; i < 20; i++) {
        mockUint8Array[i] = i;
      }
      
      mockWebCrypto.subtle.digest.mockResolvedValue(mockArrayBuffer);
      
      // Test the main hash method which should call hashBrowser in browser environment
      const result = await Sha1Hasher.hash('test data');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[a-f0-9]{40}$/);
    } finally {
      global.process = originalProcess;
    }
  });

  it('should handle browser environment for Sha1Stream', async () => {
    // Mock browser environment
    const originalProcess = global.process;
    delete global.process;
    
    try {
      const stream = new Sha1Stream();
      await stream.update('test');
      await stream.update(' data');
      
      // Mock the browser hash calculation
      const mockArrayBuffer = new ArrayBuffer(20);
      const mockUint8Array = new Uint8Array(mockArrayBuffer);
      for (let i = 0; i < 20; i++) {
        mockUint8Array[i] = i;
      }
      mockWebCrypto.subtle.digest.mockResolvedValue(mockArrayBuffer);
      
      const result = await stream.digest();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[a-f0-9]{40}$/);
    } finally {
      global.process = originalProcess;
    }
  });
});

describe('file hashing', () => {
  it('should handle file hashing in Node.js environment', async () => {
    // Mock fs module
    const mockReadStream = {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          // Simulate data chunks
          setTimeout(() => callback(Buffer.from('test')), 0);
          setTimeout(() => callback(Buffer.from(' data')), 5);
        } else if (event === 'end') {
          setTimeout(callback, 10);
        }
      })
    };

    const mockFs = {
      createReadStream: vi.fn(() => mockReadStream)
    };

    // Mock dynamic import for fs
    vi.doMock('fs', () => mockFs);

    const result = await Sha1Hasher.hashFile('/test/file.txt');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[a-f0-9]{40}$/);
    expect(mockFs.createReadStream).toHaveBeenCalledWith('/test/file.txt');
  });

  it('should handle file read errors', async () => {
    // Mock fs module with error
    const mockReadStream = {
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('File not found')), 0);
        }
      })
    };

    const mockFs = {
      createReadStream: vi.fn(() => mockReadStream)
    };

    vi.doMock('fs', () => mockFs);

    await expect(Sha1Hasher.hashFile('/nonexistent/file.txt')).rejects.toThrow('File not found');
  });
});

describe('edge cases and error handling', () => {
  it('should handle empty string input', async () => {
    const result = await Sha1Hasher.hash('');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[a-f0-9]{40}$/);
  });

  it('should handle empty buffer input', async () => {
    const result = await Sha1Hasher.hash(new Uint8Array(0));
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[a-f0-9]{40}$/);
  });

  it('should handle ProgressiveHasher without progress callback', async () => {
    const hasher = new ProgressiveHasher();
    hasher.setTotalSize(100);
    await hasher.update('test data');
    const result = await hasher.digest();
    expect(typeof result).toBe('string');
  });

  it('should handle Sha1Stream initialization in Node.js', async () => {
    const stream = new Sha1Stream();
    await stream.init(); // Test explicit initialization
    await stream.update('test');
    const result = await stream.digest();
    expect(typeof result).toBe('string');
  });
});

describe('convenience functions', () => {
  it('should export sha1 function', async () => {
    const result = await sha1('test');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[a-f0-9]{40}$/);
  });

  it('should export verifySha1 function', async () => {
    const hash = await sha1('test');
    const isValid = await verifySha1('test', hash);
    expect(isValid).toBe(true);
  });

  it('should export createSha1Stream function', () => {
    const stream = createSha1Stream();
    expect(stream).toBeInstanceOf(Sha1Stream);
  });
});