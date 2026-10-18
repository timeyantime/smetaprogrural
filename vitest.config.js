/**
 * Vitest конфигурация для тестирования
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/js/**/*.js'],
      exclude: ['**/*.test.js', '**/*.spec.js', '**/node_modules/**'],
    },
    // Для работы с ES modules в тестах
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
  },
});
