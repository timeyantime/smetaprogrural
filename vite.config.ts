/**
 * Vite конфигурация для Сметной программы
 * Запуск: npm run dev (разработка) или npm run build (сборка)
 */

import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "index.html"),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  
  server: {
    port: 8080,
    open: true,
    host: true,
  },
  
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/ts/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
  },
  
  // Для совместимости с Alpine.js
  esbuild: {
    jsxFactory: 'Alpine',
    jsxFragment: 'Fragment',
  },
});
