/**
 * Тесты для модуля validation
 * Проверка валидации данных
 */

import {
  validateProject,
  validateSection,
  validateResource,
  validateRates,
  validateRounding,
  validateNumber,
  validateString,
  formatValidationErrors,
} from '../services/validation.js';
import { Project, Section, Resource } from '../models/Project.js';

describe('Validation Service', () => {
  describe('validateNumber', () => {
    test('should validate positive numbers', () => {
      expect(validateNumber(10)).toBe(true);
      expect(validateNumber(0)).toBe(true);
      expect(validateNumber(100.5)).toBe(true);
    });

    test('should validate negative numbers when allowed', () => {
      expect(validateNumber(-10)).toBe(true);
      expect(validateNumber(-10, { min: -20 })).toBe(true);
    });

    test('should reject non-numbers', () => {
      expect(validateNumber('10')).toBe(false);
      expect(validateNumber(null)).toBe(false);
      expect(validateNumber(undefined)).toBe(false);
      expect(validateNumber(NaN)).toBe(false);
    });

    test('should respect min/max boundaries', () => {
      expect(validateNumber(5, { min: 10 })).toBe(false);
      expect(validateNumber(15, { max: 10 })).toBe(false);
      expect(validateNumber(10, { min: 5, max: 15 })).toBe(true);
    });

    test('should handle required option', () => {
      expect(validateNumber(null, { required: false })).toBe(true);
      expect(validateNumber(null, { required: true })).toBe(false);
    });
  });

  describe('validateString', () => {
    test('should validate non-empty strings', () => {
      expect(validateString('test')).toBe(true);
      expect(validateString('')).toBe(true);
    });

    test('should reject non-strings', () => {
      expect(validateString(123)).toBe(false);
      expect(validateString(null)).toBe(false);
      expect(validateString(undefined)).toBe(false);
    });

    test('should respect min/max length', () => {
      expect(validateString('test', { minLength: 10 })).toBe(false);
      expect(validateString('test', { maxLength: 2 })).toBe(false);
      expect(validateString('test', { minLength: 1, maxLength: 10 })).toBe(true);
    });

    test('should handle required option', () => {
      expect(validateString(null, { required: false })).toBe(true);
      expect(validateString(null, { required: true })).toBe(false);
    });
  });

  describe('validateResource', () => {
    test('should validate valid resource', () => {
      const resource = Resource.create({
        name: 'Test Resource',
        type: 'material',
        qty: 10,
        price: 100,
        unit: 'шт',
      });

      const result = validateResource(resource);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid resource type', () => {
      const resource = Resource.create({
        name: 'Test Resource',
        type: 'invalid',
      });

      const result = validateResource(resource);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'type')).toBe(true);
    });

    test('should reject negative qty', () => {
      const resource = Resource.create({
        name: 'Test Resource',
        type: 'material',
        qty: -5,
      });

      const result = validateResource(resource);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'qty')).toBe(true);
    });

    test('should reject negative price', () => {
      const resource = Resource.create({
        name: 'Test Resource',
        type: 'material',
        price: -100,
      });

      const result = validateResource(resource);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'price')).toBe(true);
    });
  });

  describe('validateSection', () => {
    test('should validate valid section', () => {
      const section = Section.create('Test Section');
      section.resources = [Resource.create({ name: 'Resource 1', type: 'material' })];

      const result = validateSection(section);
      expect(result.valid).toBe(true);
    });

    test('should reject section without name', () => {
      const section = Section.create('');
      section.name = '';

      const result = validateSection(section);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    });

    test('should reject section with invalid resources', () => {
      const section = Section.create('Test Section');
      section.resources = [
        { id: '1', name: 'Invalid' }, // Missing type
      ];

      const result = validateSection(section);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateRates', () => {
    test('should validate valid rates', () => {
      const rates = {
        overheadPct: 15,
        overheadBase: 'labor',
        profitPct: 10,
        profitBase: 'pz',
        vatPct: 20,
      };

      const result = validateRates(rates);
      expect(result.valid).toBe(true);
    });

    test('should reject negative percentages', () => {
      const rates = {
        overheadPct: -15,
        overheadBase: 'labor',
        profitPct: 10,
        profitBase: 'pz',
        vatPct: 20,
      };

      const result = validateRates(rates);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'overheadPct')).toBe(true);
    });

    test('should reject invalid base', () => {
      const rates = {
        overheadPct: 15,
        overheadBase: 'invalid',
        profitPct: 10,
        profitBase: 'pz',
        vatPct: 20,
      };

      const result = validateRates(rates);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'overheadBase')).toBe(true);
    });
  });

  describe('validateRounding', () => {
    test('should validate valid rounding settings', () => {
      const rounding = {
        mode: 'kopecks',
        method: 'math',
      };

      const result = validateRounding(rounding);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid mode', () => {
      const rounding = {
        mode: 'invalid',
        method: 'math',
      };

      const result = validateRounding(rounding);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'mode')).toBe(true);
    });

    test('should reject invalid method', () => {
      const rounding = {
        mode: 'kopecks',
        method: 'invalid',
      };

      const result = validateRounding(rounding);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'method')).toBe(true);
    });
  });

  describe('validateProject', () => {
    test('should validate valid project', () => {
      const project = Project.default();
      const result = validateProject(project);
      expect(result.valid).toBe(true);
    });

    test('should reject project without title', () => {
      const project = Project.default();
      project.title = '';

      const result = validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'title')).toBe(true);
    });

    test('should reject project with invalid sections', () => {
      const project = Project.default();
      project.sections = [
        { id: '1', name: 'Invalid' }, // Missing resources
      ];

      const result = validateProject(project);
      expect(result.valid).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    test('should format single error', () => {
      const errors = [{ field: 'name', message: 'Required', type: 'required' }];

      const result = formatValidationErrors(errors);
      expect(result).toContain('Название');
      expect(result).toContain('Required');
    });

    test('should format multiple errors', () => {
      const errors = [
        { field: 'name', message: 'Required', type: 'required' },
        { field: 'qty', message: 'Invalid', type: 'range' },
      ];

      const result = formatValidationErrors(errors);
      expect(result).toContain('Название');
      expect(result).toContain('Количество');
      expect(result).toContain('\n');
    });

    test('should return empty string for no errors', () => {
      const result = formatValidationErrors([]);
      expect(result).toBe('');
    });

    test('should return empty string for null errors', () => {
      const result = formatValidationErrors(null);
      expect(result).toBe('');
    });
  });
});
