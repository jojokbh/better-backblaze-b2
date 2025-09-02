/**
 * Bundle size and tree-shaking performance tests
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';

describe('Bundle Size Optimization', () => {
  it('should have reasonable bundle size', () => {
    // Build the library
    execSync('npm run build', { stdio: 'pipe' });
    
    // Check ES module bundle size
    const esModulePath = resolve('dist/index.js');
    const esModuleStats = statSync(esModulePath);
    const esModuleSize = esModuleStats.size;
    
    // Check CommonJS bundle size
    const cjsModulePath = resolve('dist/index.cjs');
    const cjsModuleStats = statSync(cjsModulePath);
    const cjsModuleSize = cjsModuleStats.size;
    
    // Bundle should be under 200KB (uncompressed)
    expect(esModuleSize).toBeLessThan(200 * 1024);
    expect(cjsModuleSize).toBeLessThan(200 * 1024);
    
    console.log(`ES Module size: ${(esModuleSize / 1024).toFixed(2)}KB`);
    console.log(`CommonJS size: ${(cjsModuleSize / 1024).toFixed(2)}KB`);
  });

  it('should support tree-shaking for individual imports', async () => {
    // Test that individual imports work without pulling in the entire library
    const { HttpClient } = await import('../../src/core/http-client.js');
    const { Validator } = await import('../../src/utils/validation.js');
    const { BUCKET_TYPES } = await import('../../src/constants.js');
    
    expect(HttpClient).toBeDefined();
    expect(Validator).toBeDefined();
    expect(BUCKET_TYPES).toBeDefined();
    
    // These should be importable without importing the full B2Client
    expect(typeof HttpClient).toBe('function');
    expect(typeof Validator).toBe('function');
    expect(typeof BUCKET_TYPES).toBe('object');
  });

  it('should have optimized exports structure', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    
    // Should have proper exports field for tree-shaking
    expect(packageJson.exports).toBeDefined();
    expect(packageJson.exports['.']).toBeDefined();
    expect(packageJson.exports['.'].import).toBeDefined();
    expect(packageJson.exports['.'].require).toBeDefined();
    expect(packageJson.exports['.'].types).toBeDefined();
    
    // Should be marked as ES module
    expect(packageJson.type).toBe('module');
  });

  it('should not include unnecessary dependencies in bundle', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    
    // Should not have axios or other heavy dependencies
    expect(packageJson.dependencies).toBeUndefined();
    
    // All dependencies should be dev dependencies
    expect(packageJson.devDependencies).toBeDefined();
    expect(packageJson.devDependencies.axios).toBeUndefined();
    expect(packageJson.devDependencies['axios-retry']).toBeUndefined();
  });
});