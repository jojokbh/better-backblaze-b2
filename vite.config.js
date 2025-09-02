import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  build: {
    target: 'esnext', // Support top-level await
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'BackblazeB2',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: ['crypto', 'fs', 'path', 'url'],
      output: {
        exports: 'named', // Fix the named/default export warning
        globals: {
          crypto: 'crypto',
          fs: 'fs',
          path: 'path',
          url: 'url'
        },
        // Enable tree-shaking optimizations
        preserveModules: false,
        // Optimize chunk splitting for better tree-shaking
        manualChunks: undefined
      },
      // Enable tree-shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser', // Enable minification for production
    // Optimize for smaller bundle size
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500
  },
  plugins: [
    {
      name: 'copy-types',
      writeBundle() {
        // Copy TypeScript definitions to dist folder
        mkdirSync('dist/types', { recursive: true });
        copyFileSync('src/types/index.d.ts', 'dist/types/index.d.ts');
      }
    }
  ],
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    }
  }
});