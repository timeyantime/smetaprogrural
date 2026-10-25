/**
 * ESLint конфигурация для Сметной программы (TypeScript)
 * Запуск: npm run lint
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Возможные ошибки
    'no-console': 'warn',
    'no-debugger': 'warn',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-empty': 'warn',

    // Стиль кода
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'default-case': 'warn',

    // Best practices
    'radix': ['error', 'as-needed'],
    'no-implicit-globals': 'off', // в TS-модулях глобалы объявляются через declare global
    'no-param-reassign': 'warn',

    // no-undef в TS избыточен (символы проверяет tsc) — отключён по рекомендации TS-ESLint
    'no-undef': 'off',

    // Постепенная типизация после миграции с JS
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      files: ['*.test.ts', '*.spec.ts'],
      env: {
        jest: true,
      },
      rules: {
        'no-unused-expressions': 'off',
      },
    },
    {
      files: ['vite.config.js', 'vitest.config.js'],
      env: {
        node: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  ],
};
