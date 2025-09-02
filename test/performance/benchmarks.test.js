/**
 * Performance benchmarks for critical operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { B2Client } from '../../src/b2-client.js';
import { HttpClient } from '../../src/core/http-client.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Performance Benchmarks', () => {
  let b2Client;
  let httpClient;

  beforeEach(() => {
    httpClient = new HttpClient({
      enablePerformanceMetrics: true
    });
    
    b2Client = new B2Client({
      applicationKeyId: 'test-key-id',
      applicationKey: 'test-key',
      enablePerformanceMetrics: true
    });
    
    fetch.mockReset();
  });

  it('should handle concurrent requests efficiently', async () => {
    // Mock successful responses
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ success: true }),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      text: async () => '{"success": true}'
    });

    const startTime = performance.now();
    
    // Make 10 concurrent requests
    const promises = Array.from({ length: 10 }, (_, i) =>
      httpClient.get(`https://api.example.com/test${i}`)
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // All requests should succeed
    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result.status).toBe(200);
    });
    
    // Concurrent requests should be faster than sequential
    // (This is a rough benchmark - actual timing may vary)
    expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    console.log(`10 concurrent requests completed in ${totalTime.toFixed(2)}ms`);
  });

  it('should handle large file upload simulation efficiently', async () => {
    // Mock upload response
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ fileId: 'test-file-id' }),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      text: async () => '{"fileId": "test-file-id"}'
    });

    const startTime = performance.now();
    
    // Simulate large file upload (15MB - above threshold)
    const largeBuffer = new ArrayBuffer(15 * 1024 * 1024);
    const uint8Array = new Uint8Array(largeBuffer);
    
    // Fill with test data
    for (let i = 0; i < Math.min(1000, uint8Array.length); i++) {
      uint8Array[i] = i % 256;
    }
    
    // Test upload optimization
    const optimizedData = httpClient.optimizeUploadData(largeBuffer);
    const endTime = performance.now();
    const optimizationTime = endTime - startTime;
    
    // Optimization should be fast
    expect(optimizationTime).toBeLessThan(1000); // Should complete within 1 second
    
    // Large files should be optimized to streams
    expect(optimizedData).toBeInstanceOf(ReadableStream);
    
    console.log(`Large file optimization completed in ${optimizationTime.toFixed(2)}ms`);
  });

  it('should handle authentication flow efficiently', async () => {
    // Mock auth response
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        authorizationToken: 'test-token',
        apiUrl: 'https://api.backblaze.com',
        downloadUrl: 'https://download.backblaze.com',
        accountId: 'test-account',
        recommendedPartSize: 100000000
      }),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      text: async () => JSON.stringify({
        authorizationToken: 'test-token',
        apiUrl: 'https://api.backblaze.com',
        downloadUrl: 'https://download.backblaze.com',
        accountId: 'test-account',
        recommendedPartSize: 100000000
      })
    });

    const startTime = performance.now();
    
    // Test authentication
    await b2Client.authorize();
    
    const endTime = performance.now();
    const authTime = endTime - startTime;
    
    // Authentication should be fast
    expect(authTime).toBeLessThan(2000); // Should complete within 2 seconds
    
    console.log(`Authentication completed in ${authTime.toFixed(2)}ms`);
  });

  it('should handle error scenarios efficiently', async () => {
    // Mock error response
    fetch.mockRejectedValue(new Error('Network error'));

    const startTime = performance.now();
    
    // Test error handling
    try {
      await httpClient.get('https://api.example.com/error');
    } catch (error) {
      // Expected to fail
    }
    
    const endTime = performance.now();
    const errorTime = endTime - startTime;
    
    // Error handling should be fast
    expect(errorTime).toBeLessThan(1000); // Should complete within 1 second
    
    console.log(`Error handling completed in ${errorTime.toFixed(2)}ms`);
  });

  it('should handle memory pressure during streaming', async () => {
    const initialMemory = process.memoryUsage();
    
    // Create multiple large streams
    const streams = [];
    for (let i = 0; i < 5; i++) {
      const largeBuffer = new ArrayBuffer(5 * 1024 * 1024); // 5MB each
      const stream = httpClient.optimizeUploadData(largeBuffer);
      if (stream instanceof ReadableStream) {
        streams.push(stream);
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const afterMemory = process.memoryUsage();
    const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be reasonable (less than 50MB for 25MB of data)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    
    console.log(`Memory increase for 5 large streams: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  });

  it('should benchmark request throughput', async () => {
    // Mock fast responses
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ data: 'test' }),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      text: async () => '{"data": "test"}'
    });

    const requestCount = 100;
    const startTime = performance.now();
    
    // Make many sequential requests
    for (let i = 0; i < requestCount; i++) {
      await httpClient.get(`https://api.example.com/test${i}`);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const requestsPerSecond = (requestCount / totalTime) * 1000;
    
    // Should handle at least 10 requests per second
    expect(requestsPerSecond).toBeGreaterThan(10);
    
    console.log(`Request throughput: ${requestsPerSecond.toFixed(2)} requests/second`);
    console.log(`Average request time: ${(totalTime / requestCount).toFixed(2)}ms`);
  });

  it('should benchmark JSON parsing performance', async () => {
    // Create large JSON response
    const largeObject = {
      files: Array.from({ length: 1000 }, (_, i) => ({
        fileId: `file-${i}`,
        fileName: `test-file-${i}.txt`,
        contentType: 'text/plain',
        contentLength: Math.floor(Math.random() * 1000000),
        uploadTimestamp: Date.now() - Math.floor(Math.random() * 86400000)
      }))
    };

    // Mock response with large JSON
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => largeObject,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      text: async () => JSON.stringify(largeObject)
    });

    const startTime = performance.now();
    
    const response = await httpClient.get('https://api.example.com/large-list');
    
    const endTime = performance.now();
    const parseTime = endTime - startTime;
    
    // JSON parsing should be reasonably fast
    expect(parseTime).toBeLessThan(1000); // Should complete within 1 second
    expect(response.data.files).toHaveLength(1000);
    
    console.log(`Large JSON parsing completed in ${parseTime.toFixed(2)}ms`);
  });
});