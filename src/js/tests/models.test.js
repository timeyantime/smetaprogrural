/**
 * Тесты для моделей данных
 * Проверка создания и валидации моделей
 */

import { Project, Section, Resource, migrateV3toV4 } from '../models/Project.js';

describe('Models', () => {
  describe('Project', () => {
    test('should create default project', () => {
      const project = Project.default();
      
      expect(project.title).toBe('Локальная смета № 1');
      expect(Array.isArray(project.sections)).toBe(true);
      expect(project.sections.length).toBe(2);
      expect(project.recalcMode).toBe('auto');
      expect(project.startDate).toBeDefined();
      expect(project.rates).toBeDefined();
      expect(project.rounding).toBeDefined();
    });

    test('should validate valid project', () => {
      const project = Project.default();
      expect(Project.validate(project)).toBe(true);
    });

    test('should reject invalid project', () => {
      expect(Project.validate(null)).toBe(false);
      expect(Project.validate('invalid')).toBe(false);
      expect(Project.validate({})).toBe(false);
    });

    test('should generate unique IDs', () => {
      const id1 = Project.generateId();
      const id2 = Project.generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(10);
    });

    test('should clone project', () => {
      const project = Project.default();
      const clone = Project.clone(project);
      
      expect(clone).not.toBe(project);
      expect(clone.title).toBe(project.title);
      expect(clone.sections).not.toBe(project.sections);
    });

    test('should get current date in ISO format', () => {
      const date = Project.defaultStartDate();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Section', () => {
    test('should create section with name', () => {
      const section = Section.create('Test Section');
      
      expect(section.name).toBe('Test Section');
      expect(section.id).toBeDefined();
      expect(section.parentId).toBeNull();
      expect(section.collapsed).toBe(false);
      expect(Array.isArray(section.resources)).toBe(true);
      expect(section.resources.length).toBe(0);
    });

    test('should create default section with resources', () => {
      const section = Section.createDefaultSection('Земляные работы');
      
      expect(section.name).toBe('Земляные работы');
      expect(section.resources.length).toBeGreaterThan(0);
    });

    test('should validate valid section', () => {
      const section = Section.create('Test Section');
      expect(Section.validate(section)).toBe(true);
    });

    test('should reject invalid section', () => {
      expect(Section.validate(null)).toBe(false);
      expect(Section.validate('invalid')).toBe(false);
      expect(Section.validate({})).toBe(false);
    });

    test('should add resource to section', () => {
      const section = Section.create('Test Section');
      const resource = Resource.create({ name: 'Test Resource' });
      
      Section.addResource(section, resource);
      
      expect(section.resources.length).toBe(1);
      expect(section.resources[0]).toBe(resource);
    });

    test('should remove resource from section', () => {
      const section = Section.create('Test Section');
      const resource = Resource.create({ id: 'test-id', name: 'Test Resource' });
      section.resources.push(resource);
      
      Section.removeResource(section, 'test-id');
      
      expect(section.resources.length).toBe(0);
    });

    test('should find resource in section', () => {
      const section = Section.create('Test Section');
      const resource = Resource.create({ id: 'test-id', name: 'Test Resource' });
      section.resources.push(resource);
      
      const found = Section.findResource(section, 'test-id');
      expect(found).toBe(resource);
    });

    test('should return null for non-existent resource', () => {
      const section = Section.create('Test Section');
      const found = Section.findResource(section, 'non-existent');
      expect(found).toBeNull();
    });

    test('should update resource in section', () => {
      const section = Section.create('Test Section');
      const resource = Resource.create({ id: 'test-id', name: 'Test Resource', qty: 10 });
      section.resources.push(resource);
      
      Section.updateResource(section, 'test-id', { qty: 20 });
      
      expect(section.resources[0].qty).toBe(20);
    });

    test('should calculate section totals', () => {
      const section = Section.create('Test Section');
      section.resources = [
        Resource.create({ type: 'labor', qty: 10, price: 100 }),
        Resource.create({ type: 'material', qty: 5, price: 200 }),
      ];
      
      const totals = Section.calculateTotals(section, {});
      
      expect(totals.laborTotal).toBe(1000);
      expect(totals.materialTotal).toBe(1000);
      expect(totals.grandTotal).toBe(2000);
    });
  });

  describe('Resource', () => {
    test('should create resource with defaults', () => {
      const resource = Resource.create();
      
      expect(resource.id).toBeDefined();
      expect(resource.name).toBe('');
      expect(resource.type).toBe('material');
      expect(resource.qty).toBe(0);
      expect(resource.price).toBe(0);
      expect(resource.unit).toBe('');
      expect(resource.operator).toBe(false);
      expect(resource.days).toBeNull();
      expect(resource.pred).toBe('');
      expect(resource.note).toBe('');
    });

    test('should create resource with partial data', () => {
      const resource = Resource.create({
        name: 'Test Resource',
        type: 'labor',
        qty: 10,
        price: 100,
        unit: 'чел.-ч',
      });
      
      expect(resource.name).toBe('Test Resource');
      expect(resource.type).toBe('labor');
      expect(resource.qty).toBe(10);
      expect(resource.price).toBe(100);
      expect(resource.unit).toBe('чел.-ч');
    });

    test('should validate valid resource', () => {
      const resource = Resource.create({ name: 'Test', type: 'labor' });
      expect(Resource.validate(resource)).toBe(true);
    });

    test('should reject invalid resource', () => {
      expect(Resource.validate(null)).toBe(false);
      expect(Resource.validate('invalid')).toBe(false);
      expect(Resource.validate({})).toBe(false);
    });

    test('should calculate resource total', () => {
      const resource = Resource.create({ qty: 10, price: 100 });
      const total = Resource.calculateTotal(resource);
      expect(total).toBe(1000);
    });

    test('should return 0 for invalid resource', () => {
      const total = Resource.calculateTotal(null);
      expect(total).toBe(0);
    });

    test('should format resource for display', () => {
      const resource = Resource.create({
        name: 'Test Resource',
        type: 'labor',
        qty: 10,
        price: 100,
      });
      
      const formatted = Resource.formatForDisplay(resource);
      
      expect(formatted.name).toBe('Test Resource');
      expect(formatted.typeLabel).toBe('Работа');
      expect(formatted.total).toBe(1000);
    });

    test('should return default for invalid resource', () => {
      const formatted = Resource.formatForDisplay(null);
      expect(formatted.name).toBe('Невалидный ресурс');
    });

    test('should generate key for resource', () => {
      const resource = Resource.create({
        name: 'Test Resource',
        type: 'labor',
        unit: 'чел.-ч',
      });
      
      const key = Resource.getKey(resource);
      expect(key).toBe('l|test resource|чел.-ч');
    });

    test('should return null for invalid resource key', () => {
      const key = Resource.getKey(null);
      expect(key).toBeNull();
    });

    test('should create resource from CSV', () => {
      const csv = 'BASIS-01;Test Resource;material;шт;10;100;Note';
      const resource = Resource.fromCSV(csv);
      
      expect(resource.basis).toBe('BASIS-01');
      expect(resource.name).toBe('Test Resource');
      expect(resource.type).toBe('material');
      expect(resource.unit).toBe('шт');
      expect(resource.qty).toBe(10);
      expect(resource.price).toBe(100);
      expect(resource.note).toBe('Note');
    });

    test('should convert resource to CSV', () => {
      const resource = Resource.create({
        basis: 'BASIS-01',
        name: 'Test Resource',
        type: 'material',
        unit: 'шт',
        qty: 10,
        price: 100,
        note: 'Note',
      });
      
      const csv = Resource.toCSV(resource);
      expect(csv).toContain('BASIS-01');
      expect(csv).toContain('Test Resource');
      expect(csv).toContain('material');
    });
  });

  describe('migrateV3toV4', () => {
    test('should migrate old data to new format', () => {
      const oldData = {
        title: 'Old Smeta',
        sections: [
          {
            id: 'section-1',
            name: 'Section 1',
            resources: [
              {
                id: 'res-1',
                name: 'Resource 1',
                type: 'labor',
                qty: 10,
                price: 100,
              },
            ],
          },
        ],
        rates: {
          overheadPct: 15,
          profitPct: 10,
          vatPct: 20,
        },
      };
      
      const migrated = migrateV3toV4(oldData);
      
      expect(migrated.title).toBe('Old Smeta');
      expect(migrated.sections.length).toBe(1);
      expect(migrated.sections[0].name).toBe('Section 1');
      expect(migrated.sections[0].resources.length).toBe(1);
      expect(migrated.rates.overheadPct).toBe(15);
    });

    test('should return default for null data', () => {
      const migrated = migrateV3toV4(null);
      expect(migrated.title).toBe('Локальная смета № 1');
    });

    test('should add missing fields with defaults', () => {
      const oldData = {
        title: 'Test',
        sections: [],
      };
      
      const migrated = migrateV3toV4(oldData);
      
      expect(migrated.recalcMode).toBe('auto');
      expect(migrated.rates).toBeDefined();
      expect(migrated.rounding).toBeDefined();
    });
  });
});
