/**
 * Integration tests for module compatibility
 * Tests that both ES modules and CommonJS work correctly after build
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

describe('Module Compatibility', () => {
  beforeAll(() => {
    // Ensure the build exists
    if (!existsSync('dist/index.js') || !existsSync('dist/index.cjs')) {
      execSync('npm run build', { stdio: 'inherit' });
    }
  });

  describe('ES Module Build', () => {
    it('should export B2Client as default', async () => {
      const { default: B2Client } = await import('../../dist/index.js');
      
      expect(B2Client).toBeDefined();
      expect(typeof B2Client).toBe('function');
      expect(B2Client.name).toBe('B2Client');
      
      const client = new B2Client();
      expect(client).toBeInstanceOf(B2Client);
    });

    it('should export B2Client as named export', async () => {
      const { B2Client } = await import('../../dist/index.js');
      
      expect(B2Client).toBeDefined();
      expect(typeof B2Client).toBe('function');
      
      const client = new B2Client();
      expect(client).toBeInstanceOf(B2Client);
    });

    it('should export constants', async () => {
      const { BUCKET_TYPES, KEY_CAPABILITIES } = await import('../../dist/index.js');
      
      expect(BUCKET_TYPES).toBeDefined();
      expect(BUCKET_TYPES.ALL_PRIVATE).toBe('allPrivate');
      expect(BUCKET_TYPES.ALL_PUBLIC).toBe('allPublic');
      
      expect(KEY_CAPABILITIES).toBeDefined();
      expect(KEY_CAPABILITIES.READ_FILES).toBe('readFiles');
      expect(KEY_CAPABILITIES.WRITE_FILES).toBe('writeFiles');
    });

    it('should export core classes', async () => {
      const { HttpClient, RetryHandler, B2Error } = await import('../../dist/index.js');
      
      expect(HttpClient).toBeDefined();
      expect(typeof HttpClient).toBe('function');
      
      expect(RetryHandler).toBeDefined();
      expect(typeof RetryHandler).toBe('function');
      
      expect(B2Error).toBeDefined();
      expect(typeof B2Error).toBe('function');
    });
  });

  describe('TypeScript Definitions', () => {
    it('should have TypeScript definitions file', () => {
      expect(existsSync('dist/types/index.d.ts')).toBe(true);
    });

    it('should compile TypeScript without errors', () => {
      // This test verifies that the built module works with TypeScript
      try {
        execSync('npx tsc --noEmit --skipLibCheck test/types/type-tests.ts', { 
          stdio: 'pipe' 
        });
      } catch (error) {
        throw new Error(`TypeScript compilation failed: ${error.stdout || error.message}`);
      }
    });
  });

  describe('Package.json Configuration', () => {
    it('should have correct module exports configuration', async () => {
      const pkg = await import('../../package.json', { assert: { type: 'json' } });
      
      expect(pkg.default.type).toBe('module');
      expect(pkg.default.main).toBe('./dist/index.js');
      expect(pkg.default.module).toBe('./dist/index.js');
      expect(pkg.default.types).toBe('./dist/types/index.d.ts');
      
      expect(pkg.default.exports).toBeDefined();
      expect(pkg.default.exports['.']).toBeDefined();
      expect(pkg.default.exports['.'].import).toBe('./dist/index.js');
      expect(pkg.default.exports['.'].require).toBe('./dist/index.cjs');
      expect(pkg.default.exports['.'].types).toBe('./dist/types/index.d.ts');
    });
  });

  describe('Build Output Validation', () => {
    it('should have ES module build', () => {
      expect(existsSync('dist/index.js')).toBe(true);
      expect(existsSync('dist/index.js.map')).toBe(true);
    });

    it('should have CommonJS build', () => {
      expect(existsSync('dist/index.cjs')).toBe(true);
      expect(existsSync('dist/index.cjs.map')).toBe(true);
    });

    it('should have TypeScript definitions', () => {
      expect(existsSync('dist/types/index.d.ts')).toBe(true);
    });
  });
});