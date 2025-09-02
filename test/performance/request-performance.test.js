/**
 * Request performance monitoring tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpClient } from '../../src/core/http-client.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Request Performance Monitoring', () => {
  let httpClient;

  beforeEach(() => {
    httpClient = new HttpClient({
      enablePerformanceMetrics: true
    });
    
    // Reset fetch mock
    fetch.mockReset();
  });

  it('should track performance metrics when enabled', async () => {
    // Mock successful response
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ success: true }),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      text: async () => '{"success": true}'
    });

    // Make a request
    await httpClient.get('https://api.example.com/test');

    // Check metrics
    const metrics = httpClient.getPerformanceMetrics();
    expect(metrics.enabled).toBe(true);
    expect(metrics.requestCount).toBe(1);
    expect(metrics.totalRequestTime).toBeGreaterThan(0);
    expect(metrics.averageRequestTime).toBeGreaterThan(0);
    expect(metrics.errorCount).toBe(0);
  });

  it('should not track metrics when disabled', async () => {
    const httpClientNoMetrics = new HttpClient({
      enablePerformanceMetrics: false
    });

    // Mock successful response
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ success: true }),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      text: async () => '{"success": true}'
    });

    // Make a request
    await httpClient.get('https://api.example.com/test');

    // Check metrics
    const metrics = httpClientNoMetrics.getPerformanceMetrics();
    expect(metrics.enabled).toBe(false);
    expect(metrics.requestCount).toBe(0);
  });

  it('should track error metrics', async () => {
    // Mock error response
    fetch.mockRejectedValueOnce(new Error('Network error'));

    // Make a request that will fail
    try {
      await httpClient.get('https://api.example.com/test');
    } catch (error) {
      // Expected to fail
    }

    // Check metrics
    const metrics = httpClient.getPerformanceMetrics();
    expect(metrics.requestCount).toBe(1);
    expect(metrics.errorCount).toBe(1);
  });

  it('should track slow requests', async () => {
    // Mock fast response but simulate slow timing
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ success: true }),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob([]),
      text: async () => '{"success": true}'
    });

    // Manually create a slow timer to simulate slow request
    const timer = httpClient.startPerformanceTimer('GET', 'https://api.example.com/slow');
    if (timer) {
      timer.startTime = performance.now() - 6000; // Make it appear slow (6 seconds ago)
    }

    // Make the request
    await httpClient.get('https://api.example.com/slow');

    // Manually end the timer as slow
    if (timer) {
      httpClient.endPerformanceTimer(timer, false);
    }

    // Check metrics
    const metrics = httpClient.getPerformanceMetrics();
    expect(metrics.slowRequests).toHaveLength(1);
    expect(metrics.slowRequests[0].duration).toBeGreaterThan(5000);
    expect(metrics.slowRequests[0].method).toBe('GET');
    expect(metrics.slowRequests[0].url).toBe('https://api.example.com/slow');
  });

  it('should limit slow requests tracking', async () => {
    // Mock multiple slow responses
    for (let i = 0; i < 15; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true }),
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([]),
        text: async () => '{"success": true}'
      });

      // Simulate slow request by manipulating the timer
      const timer = httpClient.startPerformanceTimer('GET', `https://api.example.com/slow${i}`);
      if (timer) {
        timer.startTime = performance.now() - 6000; // Make it appear slow
        httpClient.endPerformanceTimer(timer, false);
      }
    }

    // Check that only last 10 slow requests are kept
    const metrics = httpClient.getPerformanceMetrics();
    expect(metrics.slowRequests).toHaveLength(10);
  });

  it('should calculate average request time correctly', async () => {
    // Mock multiple responses with known timing
    for (let i = 0; i < 3; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true }),
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([]),
        text: async () => '{"success": true}'
      });

      // Simulate requests with known timing
      const timer = httpClient.startPerformanceTimer('GET', `https://api.example.com/test${i}`);
      if (timer) {
        timer.startTime = performance.now() - (i + 1) * 1000; // 1s, 2s, 3s
        httpClient.endPerformanceTimer(timer, false);
      }
    }

    const metrics = httpClient.getPerformanceMetrics();
    expect(metrics.requestCount).toBe(3);
    expect(metrics.averageRequestTime).toBeCloseTo(2000, -2); // Should be around 2000ms
  });

  it('should reset metrics correctly', async () => {
    // Make some requests first
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

    await httpClient.get('https://api.example.com/test1');
    await httpClient.get('https://api.example.com/test2');

    // Verify metrics exist
    let metrics = httpClient.getPerformanceMetrics();
    expect(metrics.requestCount).toBe(2);

    // Reset metrics
    httpClient.resetPerformanceMetrics();

    // Verify metrics are reset
    metrics = httpClient.getPerformanceMetrics();
    expect(metrics.requestCount).toBe(0);
    expect(metrics.totalRequestTime).toBe(0);
    expect(metrics.averageRequestTime).toBe(0);
    expect(metrics.slowRequests).toHaveLength(0);
    expect(metrics.errorCount).toBe(0);
    expect(metrics.enabled).toBe(true); // Should remain enabled
  });

  it('should handle performance timer edge cases', () => {
    // Test with null timer
    httpClient.endPerformanceTimer(null, false);
    
    // Test with disabled metrics
    const httpClientNoMetrics = new HttpClient({ enablePerformanceMetrics: false });
    const timer = httpClientNoMetrics.startPerformanceTimer('GET', 'https://example.com');
    expect(timer).toBeNull();
  });
});