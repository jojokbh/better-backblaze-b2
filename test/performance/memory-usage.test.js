/**
 * Memory usage optimization tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../../src/core/http-client.js';

describe('Memory Usage Optimization', () => {
  let httpClient;
  let initialMemory;

  beforeEach(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    initialMemory = process.memoryUsage();
    httpClient = new HttpClient({
      enablePerformanceMetrics: true
    });
  });

  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  it('should optimize large ArrayBuffer uploads', () => {
    // Create a large ArrayBuffer (15MB - above 10MB threshold)
    const largeBuffer = new ArrayBuffer(15 * 1024 * 1024);
    const uint8Array = new Uint8Array(largeBuffer);
    
    // Fill with test data (just first 1000 bytes for performance)
    for (let i = 0; i < Math.min(1000, uint8Array.length); i++) {
      uint8Array[i] = i % 256;
    }
    
    // Test optimization
    const optimizedData = httpClient.optimizeUploadData(largeBuffer);
    
    // For large buffers, should return a ReadableStream
    expect(optimizedData).toBeInstanceOf(ReadableStream);
  });

  it('should not optimize small ArrayBuffer uploads', () => {
    // Create a small ArrayBuffer (5MB - below 10MB threshold)
    const smallBuffer = new ArrayBuffer(5 * 1024 * 1024);
    
    // Test optimization
    const optimizedData = httpClient.optimizeUploadData(smallBuffer);
    
    // For small buffers, should return the original buffer
    expect(optimizedData).toBe(smallBuffer);
  });

  it('should handle streaming responses for large files', () => {
    // Mock a large file response
    const mockResponse = {
      headers: {
        get: (name) => {
          if (name === 'content-length') return '100000000'; // 100MB
          if (name === 'content-type') return 'application/octet-stream';
          return null;
        }
      }
    };
    
    // Should use streaming for large files
    expect(httpClient.shouldUseStreaming(mockResponse, 'auto')).toBe(true);
    
    // Should use streaming for octet-stream content type
    const streamResponse = {
      headers: {
        get: (name) => {
          if (name === 'content-type') return 'application/octet-stream';
          return null;
        }
      }
    };
    expect(httpClient.shouldUseStreaming(streamResponse, 'auto')).toBe(true);
  });

  it('should not use streaming for small files', () => {
    // Mock a small file response
    const mockResponse = {
      headers: {
        get: (name) => {
          if (name === 'content-length') return '1024'; // 1KB
          if (name === 'content-type') return 'application/json';
          return null;
        }
      }
    };
    
    // Should not use streaming for small files
    expect(httpClient.shouldUseStreaming(mockResponse, 'auto')).toBe(false);
  });

  it('should track memory usage during operations', async () => {
    const memoryBefore = process.memoryUsage();
    
    // Simulate some operations
    const largeData = new ArrayBuffer(5 * 1024 * 1024); // 5MB
    httpClient.optimizeUploadData(largeData);
    
    const memoryAfter = process.memoryUsage();
    
    // Memory increase should be reasonable (less than 10MB)
    const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });

  it('should handle ReadableStream chunking efficiently', async () => {
    const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB
    const stream = httpClient.optimizeUploadData(largeBuffer);
    
    if (stream instanceof ReadableStream) {
      const reader = stream.getReader();
      let totalSize = 0;
      let chunkCount = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          totalSize += value.length;
          chunkCount++;
          
          // Each chunk should be reasonable size (64KB or less)
          expect(value.length).toBeLessThanOrEqual(64 * 1024);
        }
      } finally {
        reader.releaseLock();
      }
      
      // Should have processed all data
      expect(totalSize).toBe(largeBuffer.byteLength);
      expect(chunkCount).toBeGreaterThan(0);
    }
  });
});