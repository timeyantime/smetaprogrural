/**
 * ESLint конфигурация для Сметной программы
 * Запуск: npm run lint
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
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
    'no-unused-vars': 'warn',
    'no-empty': 'warn',
    
    // Стиль кода
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'default-case': 'warn',
    
    // Best practices
    'radix': ['error', 'as-needed'],
    'no-implicit-globals': 'error',
    'no-param-reassign': 'warn',
    
    // Для Alpine.js
    'no-undef': ['error', { typeof: true }],
  },
  overrides: [
    {
      files: ['*.test.js', '*.spec.js'],
      env: {
        jest: true,
      },
      rules: {
        'no-unused-expressions': 'off',
      },
    },
    {
      files: ['vite.config.js', 'vite.config.ts'],
      env: {
        node: true,
      },
    },
  ],
};
