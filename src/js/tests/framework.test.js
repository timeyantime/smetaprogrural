/**
 * Тесты каркасного метода ценообразования v2.0 (framework.js)
 * Спецификация: TOON «Сметная стоимость строительства (Каркасный метод)»
 */

import {
  WASTE_NORMS, wasteK, factQty,
  LABOR_MARKUP, laborRateFact,
  deliveryPerUnit, unloadingPerUnit, resourceFullPrice,
  calcWorkerTransport, calcRain, calcTax, calcVehicleTax, calcReturnable,
  defaultFrameworkSettings, frameworkRowCost, calcFrameworkTotals, FRAMEWORK_META,
} from '../framework.js';
import { calculateFrameworkTotals } from '../services/calculation.js';
import { encodeProject, decodeProject } from '../toon.js';
import { Project, Section, Resource } from '../models/Project.js';

describe('Каркасный метод v2.0 (framework)', () => {
  test('meta соответствует спецификации', () => {
    expect(FRAMEWORK_META.method).toContain('Без НДС');
    expect(FRAMEWORK_META.version).toContain('v2.0');
  });

  describe('Нормы отходов (waste_norms)', () => {
    test('12 групп с корректными коэффициентами', () => {
      expect(WASTE_NORMS).toHaveLength(12);
      expect(wasteK('block')).toBe(0.04);
      expect(wasteK('sheet')).toBe(0.06);
      expect(wasteK('roll')).toBe(0.08);
      expect(wasteK('lumber')).toBe(0.08);
      expect(wasteK('metal')).toBe(0.03);
      expect(wasteK('concrete')).toBe(0.04);
      expect(wasteK('paint')).toBe(0.08);
      expect(wasteK('floor')).toBe(0.07);
      expect(wasteK('insul')).toBe(0.04);
      expect(wasteK('roof')).toBe(0.10);
      expect(wasteK('cable')).toBe(0.08);
      expect(wasteK('pipe')).toBe(0.05);
      expect(wasteK('unknown')).toBe(0);
      expect(wasteK('')).toBe(0);
    });

    test('q_факт = q_нетто * (1 + k_отх)', () => {
      expect(factQty(100, 'lumber')).toBeCloseTo(108); // 100 * 1.08
      expect(factQty(10, 'roof')).toBeCloseTo(11);     // 10 * 1.10
      expect(factQty(50, '')).toBe(50);                // без запаса
    });
  });

  describe('Труд: наценка 20% и ночь/праздник', () => {
    test('ЗП_чел_ч_факт = ЗП_база * 1.20', () => {
      expect(LABOR_MARKUP).toBe(1.2);
      expect(laborRateFact(250)).toBeCloseTo(300);
    });
    test('ЕСЛИ Ночь ИЛИ Праздник → × k_ночн', () => {
      expect(laborRateFact(250, { night: true, kNight: 1.3 })).toBeCloseTo(390);
      expect(laborRateFact(250, { holiday: true, kNight: 1.5 })).toBeCloseTo(450);
      expect(laborRateFact(250, { night: false, holiday: false })).toBeCloseTo(300);
    });
  });

  describe('Логистика материала (p_полн без тары/погрузки)', () => {
    test('Д_перевозка: n_рейсов = ОКРУГЛ_ВВЕРХ(q*масса/грузоподъемность)', () => {
      const m = { qty: 10, unitMassT: 0.5, vehicleCapT: 4, distanceKm: 50, tariffPerKm: 80, supplyFee: 500, kGabarit: 1 };
      // 10*0.5=5 т / 4 т = 1.25 → ceil = 2 рейса; 2*(500+50*80)=9000 → /10 ед = 900
      expect(deliveryPerUnit(m)).toBeCloseTo(900);
      // k_габарит 1.2 → 1080
      expect(deliveryPerUnit({ ...m, kGabarit: 1.2 })).toBeCloseTo(1080);
      // нет массы/грузоподъёмности — доставка 0
      expect(deliveryPerUnit({ ...m, unitMassT: 0 })).toBe(0);
    });

    test('Р_разгрузка с манипулятором дешевле на 90% крановой части', () => {
      const base = { qty: 10, unloadMachineHr: 2000, unloadHours: 2, supplyFee: 500, moveDistM: 0, moveSpeedMh: 0 };
      const without = unloadingPerUnit({ ...base, manipulatorFlag: false }); // 1*(2000*2+0.5*500)/10 = 425
      const withM = unloadingPerUnit({ ...base, manipulatorFlag: true });    // 0.1*4250/10 = 42.5
      expect(without).toBeCloseTo(425);
      expect(withM).toBeCloseTo(42.5);
      // перемещение S_м / V_перем добавляется
      const moved = unloadingPerUnit({ ...base, moveDistM: 100, moveSpeedMh: 50 }); // +2000*100/50=4000 → /10
      expect(moved).toBeCloseTo(425 + 400);
    });

    test('p_полн = p_отп + Д + Р + 1per·П + 1hran·Х (тара/погрузка исключены)', () => {
      const m = { perUnit: 1000, qty: 10, unitMassT: 0, vehicleCapT: 0, unloadHours: 0, unloadMachineHr: 0,
        perPct: 5, storePct: 2 };
      const fp = resourceFullPrice(m);
      expect(fp.priceFull).toBeCloseTo(1000 + 50 + 20);
    });
  });

  describe('Т_раб — транспорт персонала', () => {
    test('(Расход/100) * L * 2 * Цена * 1.05 * Дни', () => {
      const s = { fuelPer100: 10, workerDistanceKm: 40, fuelPrice: 50, workDays: 20 };
      // (10/100)*40*2*50*1.05*20 = 8400
      expect(calcWorkerTransport(0, s)).toBeCloseTo(8400);
      expect(calcWorkerTransport(0, { ...s, workDays: 0 })).toBe(0);
    });
  });

  describe('Дож — вероятностные потери только ФОТ', () => {
    test('Дож = ЗП * k_потерь * p_вероятн * (d_дождь / D_мес)', () => {
      const s = { rainDays: 6, monthDays: 30, rainKLoss: 0.1, rainProb: 0.5, rainMonths: [] };
      // 100000 * 0.1 * 0.5 * (6/30) = 1000
      expect(calcRain(100000, s)).toBeCloseTo(1000);
    });
    test('помесячный режим: сумма по месяцам', () => {
      const s = { rainMonths: [
        { kLoss: 0.2, prob: 0.5, rainDays: 10, monthDays: 30 },
        { kLoss: 0.1, prob: 0.5, rainDays: 3, monthDays: 30 },
      ] };
      // ФОТ 90000 → share 45000: 45000*0.2*0.5*(10/30)=1500; 45000*0.1*0.5*(3/30)=225
      expect(calcRain(90000, s)).toBeCloseTo(1725);
    });
  });

  describe('Налоги и возвратные суммы', () => {
    test('Налог_УСН = S_без_НДС * 0.06', () => {
      expect(calcTax(1000000, defaultFrameworkSettings())).toBeCloseTo(60000);
      expect(calcTax(1000000, { usnPct: 5 })).toBeCloseTo(50000);
    });
    test('Н_имущ_авто = (T_стр_мес/12) * (налог_год + страховка_год)', () => {
      const s = { buildMonths: 3, vehicleTaxYear: 12000, insuranceYear: 24000 };
      expect(calcVehicleTax(s)).toBeCloseTo((3 / 12) * 36000);
    });
    test('Возвр: металлолом из обрезков metal/pipe/cable + ликвидация ВЗ', () => {
      const s = { scrapPricePerTon: 15000, vzLiquidation: 20000 };
      const rows = [
        { type: 'material', wasteGroup: 'metal', qty: 100, unitMassT: 0.01 }, // 100*1.03*0.01*0.03=0.0309 т
        { type: 'material', wasteGroup: 'lumber', qty: 50, unitMassT: 0.5 },  // не металл — игнор
      ];
      const r = calcReturnable(rows, s);
      expect(r.scrap).toBeCloseTo(0.0309 * 15000);
      expect(r.total).toBeCloseTo(0.0309 * 15000 + 20000);
    });
  });

  describe('Позиционный расчёт строки (frameworkRowCost)', () => {
    test('материал: q_факт × p_полн', () => {
      const res = Resource.create({ type: 'material', qty: 100, price: 10, wasteGroup: 'block' });
      const c = frameworkRowCost(res);
      expect(c.qtyFact).toBeCloseTo(104);
      expect(c.total).toBeCloseTo(1040); // без логистики: p_полн = 10
    });
    test('труд: ставка × 1.2', () => {
      const res = Resource.create({ type: 'labor', qty: 10, price: 250 });
      const c = frameworkRowCost(res);
      expect(c.priceFull).toBeCloseTo(300);
      expect(c.total).toBeCloseTo(3000);
    });
    test('машина: без наценки, с ночным множителем если night', () => {
      const s = defaultFrameworkSettings();
      const res = Resource.create({ type: 'machine', qty: 5, price: 1000 });
      expect(frameworkRowCost(res, s).total).toBeCloseTo(5000);
      const night = Resource.create({ type: 'machine', qty: 5, price: 1000, night: true });
      expect(frameworkRowCost(night, s).total).toBeCloseTo(5000 * 1.3);
    });
  });

  describe('Главная формула S = ПЗ + НР + СП + ЛЗ + Нал − Возвр', () => {
    function project() {
      const p = Project.default();
      p.framework = { ...defaultFrameworkSettings(), enabled: true, npPct: 0, usnPct: 6,
        vzPct: 0, zuPct: 0, ppPct: 0, garantPct: 0, rainDays: 0, workDays: 0,
        vehicleTaxYear: 0, insuranceYear: 0, scrapPricePerTon: 0, vzLiquidation: 0 };
      p.rates = { overheadPct: 0, overheadBase: 'labor', profitPct: 0, profitBase: 'labor', vatPct: 20 };
      p.rounding = { mode: 'kopecks', method: 'math' };
      p.sections = [Section.create('S1')];
      return p;
    }

    test('выключенный метод → null (обратная совместимость)', () => {
      const p = project();
      p.framework.enabled = false;
      expect(calculateFrameworkTotals(p)).toBeNull();
      expect(calculateFrameworkTotals(null)).toBeNull();
    });

    test('минимальная смета: ПЗ → УСН 6% → итог', () => {
      const p = project();
      p.sections[0].resources = [Resource.create({ type: 'material', qty: 100, price: 10 })];
      const t = calculateFrameworkTotals(p);
      expect(t.pz).toBeCloseTo(1000);
      expect(t.nr).toBe(0);
      expect(t.sp).toBe(0);
      expect(t.lz).toBeCloseTo(0);
      expect(t.tax).toBeCloseTo(60); // 6% от 1000
      expect(t.grand).toBeCloseTo(1060);
      expect(t.vat ?? 0).toBe(0); // НДС нет
    });

    test('НП = 3% входит в ЛЗ; возвратные вычитаются', () => {
      const p = project();
      p.sections[0].resources = [
        Resource.create({ type: 'material', qty: 1000, price: 10, wasteGroup: 'metal', unitMassT: 0.01 }),
      ];
      p.framework.scrapPricePerTon = 15000;
      p.framework.npPct = 3; // НП = (ПЗ + НР) * 0.03
      const t = calculateFrameworkTotals(p);
      // ПЗ = 1000*1.03*10 = 10300; НП = 3% → 309; Нал = 6%*(10300+309)=636.54
      expect(t.pz).toBeCloseTo(10300);
      expect(t.lzParts.np).toBeCloseTo(309);
      expect(t.returnable.scrap).toBeCloseTo(1000 * 1.03 * 0.01 * 0.03 * 15000); // ~46.35
      expect(t.grand).toBeCloseTo(10300 + 309 + 636.54 - t.returnable.total);
    });

    test('НР/СП считаются от выбранной базы', () => {
      const p = project();
      p.rates.overheadPct = 15; p.rates.overheadBase = 'labor';
      p.rates.profitPct = 10; p.rates.profitBase = 'labor';
      p.sections[0].resources = [Resource.create({ type: 'labor', qty: 10, price: 250 })];
      const t = calculateFrameworkTotals(p);
      // труд: 10 * 250*1.2 = 3000 → НР 450, СП 300
      expect(t.pz).toBeCloseTo(3000);
      expect(t.nr).toBeCloseTo(450);
      expect(t.sp).toBeCloseTo(300);
    });

    test('calcFrameworkTotals напрямую (низкий уровень)', () => {
      const p = project();
      p.framework.npPct = 3; // НП = (ПЗ + НР) * 0.03 — строго по TOON, база без СП
      const fw = calcFrameworkTotals(p, { pz: 100000, nr: 15000, sp: 10000, laborTotal: 50000, mode: 'kopecks', method: 'math' });
      // НП = (100000+15000)*0.03 = 3450; ЛЗ=3450; Нал = 6%*(125000+3450)=7707
      expect(fw.lzParts.np).toBeCloseTo(3450);
      expect(fw.tax).toBeCloseTo(7707);
      expect(fw.grand).toBeCloseTo(125000 + 3450 + 7707);
    });
  });

  describe('Сохранение/TOON-roundtrip с framework', () => {
    test('проект с каркасными настройками восстанавливается 1-в-1', () => {
      const p = Project.default();
      p.framework = { ...defaultFrameworkSettings(), enabled: true, workerDistanceKm: 35, rainKLoss: 0.25 };
      p.sections[0].resources = [
        Resource.create({ type: 'material', name: 'Профиль ЛСТК', qty: 50, price: 300, wasteGroup: 'metal', unitMassT: 0.008, night: true }),
      ];
      const encoded = encodeProject(p);
      expect(encoded.startsWith('TOONP1:')).toBe(true);
      const decoded = decodeProject(encoded.slice('TOONP1:'.length));
      expect(decoded.framework.enabled).toBe(true);
      expect(decoded.framework.workerDistanceKm).toBe(35);
      expect(decoded.framework.rainKLoss).toBe(0.25);
      const row = decoded.sections[0].resources[0];
      expect(row.wasteGroup).toBe('metal');
      expect(row.unitMassT).toBe(0.008);
      expect(row.night).toBe(true);
    });

    test('старый проект без framework декодируется без поля (миграция добавит дефолты)', () => {
      const p = Project.default();
      delete p.framework;
      const encoded = encodeProject(p);
      const decoded = decodeProject(encoded.slice('TOONP1:'.length));
      expect(decoded.framework).toBeUndefined();
    });
  });
});
