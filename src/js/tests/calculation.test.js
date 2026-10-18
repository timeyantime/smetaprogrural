/**
 * Тесты для модуля calculation
 * Проверка расчетов сметы
 */

import { 
  calculateProjectTotals,
  calculateSectionTotals,
  calculateResourceTotal,
  roundValue,
  roundGrandTotal,
  calculateSectionDuration,
  calculateProjectDuration
} from '../services/calculation.js';
import { Project, Section, Resource } from '../models/Project.js';

describe('Calculation Service', () => {
  describe('calculateResourceTotal', () => {
    test('should calculate total for valid resource', () => {
      const resource = Resource.create({
        qty: 10,
        price: 100,
      });
      
      const total = calculateResourceTotal(resource);
      expect(total).toBe(1000);
    });

    test('should return 0 for zero qty', () => {
      const resource = Resource.create({
        qty: 0,
        price: 100,
      });
      
      const total = calculateResourceTotal(resource);
      expect(total).toBe(0);
    });

    test('should return 0 for zero price', () => {
      const resource = Resource.create({
        qty: 10,
        price: 0,
      });
      
      const total = calculateResourceTotal(resource);
      expect(total).toBe(0);
    });

    test('should handle fractional values', () => {
      const resource = Resource.create({
        qty: 2.5,
        price: 40,
      });
      
      const total = calculateResourceTotal(resource);
      expect(total).toBe(100);
    });
  });

  describe('calculateSectionTotals', () => {
    test('should calculate totals for section with labor resources', () => {
      const section = Section.create('Test Section');
      section.resources = [
        Resource.create({ type: 'labor', qty: 10, price: 100 }),
        Resource.create({ type: 'labor', qty: 5, price: 200 }),
      ];
      
      const rates = { overheadPct: 15, overheadBase: 'labor' };
      const totals = calculateSectionTotals(section, rates);
      
      expect(totals.laborTotal).toBe(2000); // 10*100 + 5*200
      expect(totals.machineTotal).toBe(0);
      expect(totals.materialTotal).toBe(0);
      expect(totals.grandTotal).toBe(2000);
    });

    test('should calculate totals for section with mixed resources', () => {
      const section = Section.create('Test Section');
      section.resources = [
        Resource.create({ type: 'labor', qty: 10, price: 100 }),
        Resource.create({ type: 'machine', qty: 5, price: 200 }),
        Resource.create({ type: 'material', qty: 2, price: 500 }),
      ];
      
      const rates = {};
      const totals = calculateSectionTotals(section, rates);
      
      expect(totals.laborTotal).toBe(1000);
      expect(totals.machineTotal).toBe(1000);
      expect(totals.materialTotal).toBe(1000);
      expect(totals.grandTotal).toBe(3000);
    });

    test('should return zeros for empty section', () => {
      const section = Section.create('Empty Section');
      const totals = calculateSectionTotals(section, {});
      
      expect(totals.laborTotal).toBe(0);
      expect(totals.machineTotal).toBe(0);
      expect(totals.materialTotal).toBe(0);
      expect(totals.grandTotal).toBe(0);
    });
  });

  describe('calculateProjectTotals', () => {
    // Каркасный метод v2.0: S = ПЗ + НР + СП + ЛЗ + Нал − Возвр (без НДС).
    // Дефолтные настройки framework занулены, чтобы изолировать главную формулу;
    // материалы без wasteGroup → k_отх = 0, без полей логистики → p_полн = p_отп.
    function fwProject(resources) {
      const project = Project.default();
      project.framework = {
        ...project.framework,
        npPct: 0, vzPct: 0, zuPct: 0, ppPct: 0, garantPct: 0,
        workDays: 0, rainDays: 0, vehicleTaxYear: 0, insuranceYear: 0,
        scrapPricePerTon: 0, vzLiquidation: 0,
      };
      project.rates = {
        overheadPct: 15,
        overheadBase: 'labor',
        profitPct: 10,
        profitBase: 'labor',
      };
      project.sections = [Section.create('Section 1')];
      project.sections[0].resources = resources;
      return project;
    }

    test('should calculate totals for project with multiple sections', () => {
      // Труд: q × (ЗП_база × 1.20); материалы: q × p_отп (без отходов/логистики)
      const project = fwProject([
        Resource.create({ type: 'labor', qty: 10, price: 100 }),    // 10 × 120 = 1200
        Resource.create({ type: 'material', qty: 5, price: 200 }),  // 5 × 200 = 1000
      ]);

      const totals = calculateProjectTotals(project);

      expect(totals.labor).toBeCloseTo(1200);   // наценка 20% на чел-ч
      expect(totals.material).toBeCloseTo(1000);
      expect(totals.pz).toBeCloseTo(2200);
      expect(totals.nr).toBeCloseTo(180);   // 15% от ФОТ (1200)
      expect(totals.sp).toBeCloseTo(120);   // 10% от ФОТ (d_рын = 0)
      expect(totals.vat).toBe(0);           // НДС удалён (метод «Без НДС»)
      expect(totals.sNoTax).toBeCloseTo(2500); // 2200 + 180 + 120 (ЛЗ = 0)
      expect(totals.tax).toBeCloseTo(150);  // УСН 6% от S без налога
      expect(totals.returnable.total).toBe(0);
      expect(totals.grand).toBeCloseTo(2650); // S = 2500 + 150 − 0
    });

    test('should return zeros for empty project', () => {
      const project = Project.default();
      project.sections = [];

      const totals = calculateProjectTotals(project);

      expect(totals.labor).toBe(0);
      expect(totals.machine).toBe(0);
      expect(totals.material).toBe(0);
      expect(totals.pz).toBe(0);
      expect(totals.nr).toBe(0);
      expect(totals.sp).toBe(0);
      expect(totals.vat).toBe(0);
      expect(totals.grand).toBe(0);
    });

    test('should handle null project', () => {
      const totals = calculateProjectTotals(null);

      expect(totals.labor).toBe(0);
      expect(totals.pz).toBe(0);
      expect(totals.grand).toBe(0);
      expect(totals.framework).toBe(true);
    });
  });

  describe('roundValue', () => {
    test('should round to kopecks (2 decimals) with math method', () => {
      expect(roundValue(100.123, 'kopecks', 'math')).toBe(100.12);
      expect(roundValue(100.125, 'kopecks', 'math')).toBe(100.13);
      expect(roundValue(100.127, 'kopecks', 'math')).toBe(100.13);
    });

    test('should round to rubles (0 decimals) with math method', () => {
      expect(roundValue(100.123, 'rubles', 'math')).toBe(100);
      expect(roundValue(100.5, 'rubles', 'math')).toBe(101);
      expect(roundValue(100.4, 'rubles', 'math')).toBe(100);
    });

    test('should use bank method (half to even)', () => {
      expect(roundValue(100.25, 'kopecks', 'bank')).toBe(100.25); // 0.25 -> 0.25 (четное)
      expect(roundValue(100.35, 'kopecks', 'bank')).toBe(100.35); // 0.35 -> 0.35 (четное)
      expect(roundValue(100.15, 'kopecks', 'bank')).toBe(100.15); // 0.15 -> 0.15 (нечетное -> четное)
    });

    test('should use truncate method', () => {
      expect(roundValue(100.99, 'kopecks', 'truncate')).toBe(100.99);
      expect(roundValue(100.999, 'kopecks', 'truncate')).toBe(100.99);
      expect(roundValue(100.123, 'kopecks', 'truncate')).toBe(100.12);
    });

    test('should handle invalid values', () => {
      expect(roundValue('invalid', 'kopecks', 'math')).toBe(0);
      expect(roundValue(null, 'kopecks', 'math')).toBe(0);
      expect(roundValue(undefined, 'kopecks', 'math')).toBe(0);
      expect(roundValue(NaN, 'kopecks', 'math')).toBe(0);
    });
  });

  describe('roundGrandTotal', () => {
    test('should round to 2 decimals', () => {
      expect(roundGrandTotal(100.123)).toBe(100.12);
      expect(roundGrandTotal(100.125)).toBe(100.13);
      expect(roundGrandTotal(100)).toBe(100);
    });

    test('should handle invalid values', () => {
      expect(roundGrandTotal('invalid')).toBe(0);
      expect(roundGrandTotal(null)).toBe(0);
      expect(roundGrandTotal(undefined)).toBe(0);
    });
  });

  describe('calculateSectionDuration', () => {
    test('should calculate max duration from resources', () => {
      const section = Section.create('Test Section');
      section.resources = [
        Resource.create({ days: 5 }),
        Resource.create({ days: 10 }),
        Resource.create({ days: 3 }),
      ];
      
      const duration = calculateSectionDuration(section);
      expect(duration).toBe(10);
    });

    test('should return 0 for section without days', () => {
      const section = Section.create('Test Section');
      section.resources = [
        Resource.create({ days: null }),
        Resource.create({ days: null }),
      ];
      
      const duration = calculateSectionDuration(section);
      expect(duration).toBe(0);
    });

    test('should return 0 for empty section', () => {
      const section = Section.create('Empty Section');
      const duration = calculateSectionDuration(section);
      expect(duration).toBe(0);
    });
  });

  describe('calculateProjectDuration', () => {
    test('should sum durations of all sections', () => {
      const project = Project.default();
      project.sections = [
        Section.create('Section 1'),
        Section.create('Section 2'),
      ];
      
      project.sections[0].resources = [
        Resource.create({ days: 5 }),
        Resource.create({ days: 10 }),
      ];
      project.sections[1].resources = [
        Resource.create({ days: 3 }),
        Resource.create({ days: 7 }),
      ];
      
      const duration = calculateProjectDuration(project);
      // Внутри раздела ресурсы идут параллельно → max(5,10)=10 и max(3,7)=7;
      // разделы последовательно → 10 + 7 = 17 дней.
      expect(duration).toBe(17);
    });

    test('should return 0 for empty project', () => {
      const project = Project.default();
      project.sections = [];
      
      const duration = calculateProjectDuration(project);
      expect(duration).toBe(0);
    });

    test('should handle null project', () => {
      const duration = calculateProjectDuration(null);
      expect(duration).toBe(0);
    });
  });
});
