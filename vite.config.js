/**
 * Vite конфигурация для Сметной программы
 * Запуск: npm run dev (разработка) или npm run build (сборка)
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
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
      include: ['src/js/**/*.js'],
      exclude: ['**/*.test.js', '**/*.spec.js'],
    },
  },
  
  // Для совместимости с Alpine.js
  esbuild: {
    jsxFactory: 'Alpine',
    jsxFragment: 'Fragment',
  },
});
