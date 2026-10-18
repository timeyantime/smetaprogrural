/**
 * Контрольные примеры каркасного метода v2.0 (раздел «Проверка расчётов» справочника)
 *
 * Каждая строка — независимый эталонный расчёт, воспроизводимый вручную по
 * формулам TOON-спецификации. Если ядро расчёта изменится не по ТЗ — эти
 * тесты упадут первыми. Числа в комментариях = ручной пересчёт.
 */

import { describe, test, expect } from 'vitest';
import {
  laborRateFact, factQty, deliveryPerUnit, unloadingPerUnit, resourceFullPrice,
  calcWorkerTransport, calcRain, calcTax, calcVehicleTax, calcReturnable,
  frameworkRowCost, defaultFrameworkSettings,
} from '../framework.js';
import { calculateFrameworkTotals } from '../services/calculation.js';

describe('Контрольные примеры (справочник → раздел 13)', () => {
  // ── Строка 1. Труд: наценка 20% и ночь ────────────────────────────────
  test('К1. Труд: 500 ₽/чел-ч база → ×1.20 = 600; ночь ×1.3 = 780', () => {
    expect(laborRateFact(500)).toBeCloseTo(600);                    // ЗП_факт = 500×1.2
    expect(laborRateFact(500, { night: true, kNight: 1.3 })).toBeCloseTo(780);   // ЕСЛИ Ночь
    expect(laborRateFact(500, { holiday: true, kNight: 1.3 })).toBeCloseTo(780); // ЕСЛИ Праздник
    // 100 чел-ч × 600 = 60 000 — ФОТ строки
    const row = frameworkRowCost({ type: 'labor', qty: 100, price: 500 });
    expect(row.total).toBeCloseTo(60000);
  });

  // ── Строка 2. Материал с отходами и логистикой ────────────────────────
  test('К2. ЛСТК 100 шт × 300 ₽, k_отх 3%, доставка 150 км → q_факт 103, p_полн 630', () => {
    expect(factQty(100, 'metal')).toBeCloseTo(103); // q_факт = 100 × 1.03
    const m = {
      qty: 100, perUnit: 300, wasteGroup: 'metal',
      unitMassT: 0.01, vehicleCapT: 10, distanceKm: 150,
      tariffPerKm: 80, supplyFee: 5000, kGabarit: 1,
    };
    // n_рейсов = ОКРУГЛВВЕРХ((q × Масса_ед)/Грузоподъёмность) = ОКРУГЛВВЕРХ(0.1) = 1
    // Д_перевозка = 1 × (5000 + 150×80) / 100 = 170 ₽/шт
    expect(deliveryPerUnit(m)).toBeCloseTo(170);
    // Разгрузка не задана: только подача, без крана (unloadMachineHr=0, unloadHours=0)
    const noUnload = { ...m, unloadMachineHr: 0, unloadHours: 0 };
    expect(unloadingPerUnit(noUnload)).toBeCloseTo(25); // 0.5 × C_подачи / qty = 2500/100
    const fp = resourceFullPrice(noUnload);
    expect(fp.priceFull).toBeCloseTo(495);           // p_полн = 300 + 170 + 25
    // Строка: q_факт × p_полн = 103 × 495 = 50 985 ₽
    const row = frameworkRowCost({ type: 'material', qty: 100, price: 300, ...noUnload });
    expect(row.qtyFact).toBeCloseTo(103);
    expect(row.total).toBeCloseTo(50985);
  });

  // ── Строка 3. Разгрузка: манипулятор экономит 90% крановой части ──────
  test('К3. Р_разгрузка без манипулятора vs с манипулятором', () => {
    const base = {
      qty: 10, unloadMachineHr: 2000, unloadHours: 4, supplyFee: 5000,
      moveDistM: 0, moveSpeedMh: 0, manipulatorFlag: false,
    };
    // Без мапулятора: (1−0)×(2000×4 + 0.5×5000) = 10 500 ₽ → /10 = 1 050 ₽/шт
    expect(unloadingPerUnit(base)).toBeCloseTo(1050);
    // С манипулятором: (1−0.9)×10 500 = 1 050 ₽ → /10 = 105 ₽/шт
    expect(unloadingPerUnit({ ...base, manipulatorFlag: true })).toBeCloseTo(105);
    // Перемещение: C_маш_ч × S_м / V_перем = 2000 × 100 / 50 = 4 000 ₽ → /10 = 400 ₽/шт
    expect(unloadingPerUnit({ ...base, moveDistM: 100, moveSpeedMh: 50 })).toBeCloseTo(1050 + 400);
  });

  // ── Строка 4. Т_раб — транспорт персонала ─────────────────────────────
  test('К4. Т_раб = (10/100) × 40км × 2 × 50₽ × 1.05 × 20дн = 8 400 ₽', () => {
    const s = { fuelPer100: 10, workerDistanceKm: 40, fuelPrice: 50, workDays: 20 };
    expect(calcWorkerTransport(0, s)).toBeCloseTo(8400);
    expect(calcWorkerTransport(0, { ...s, workDays: 0 })).toBe(0); // нет дней — нет затрат
  });

  // ── Строка 5. Дож — только на ФОТ ─────────────────────────────────────
  test('К5. Дож = ЗП × k_потерь × p_вероятн × (d_дождь/D_мес)', () => {
    const s = { rainDays: 6, monthDays: 30, rainKLoss: 0.1, rainProb: 0.5 };
    // 100 000 × 0.1 × 0.5 × (6/30) = 1 000 ₽
    expect(calcRain(100000, s)).toBeCloseTo(1000);
    // Помесячный режим: ФОТ 90 000 / 3 мес = 30 000; м1: 30000×0.2×0.5×(5/30)=500
    const sm = { rainMonths: [
      { kLoss: 0.2, prob: 0.5, rainDays: 5, monthDays: 30 },
      { kLoss: 0.1, prob: 0.4, rainDays: 3, monthDays: 30 },
      { kLoss: 0.0, prob: 0.5, rainDays: 9, monthDays: 30 },
    ] };
    // м2: 30000×0.1×0.4×(3/30)=120; м3: 0 → итого 620
    expect(calcRain(90000, sm)).toBeCloseTo(620);
  });

  // ── Строка 6. НП = 3% от (ПЗ + НР), УСН = 6% ──────────────────────────
  test('К6. НП базируется на ПЗ+НР (без СП); УСН 6% от базы без налога', () => {
    const s = defaultFrameworkSettings();
    expect(s.npPct).toBe(3);
    expect(s.usnPct).toBe(6);
    expect(calcTax(1000000, s)).toBeCloseTo(60000); // Налог_УСН = S_без_НДС × 0.06
    // Полный проект: ПЗ = 60 000 (труд К1), ставки выключены → НП = 60 000 × 3% = 1 800
    const p = ProjectFixture([{ type: 'labor', qty: 100, price: 500 }]);
    const t = calculateFrameworkTotals(p);
    expect(t.pz).toBeCloseTo(60000);
    expect(t.lzParts.np).toBeCloseTo(1800); // (ПЗ+НР)×0.03, НР=0
  });

  // ── Строка 7. Транспортный налог пропорционально сроку ────────────────
  test('К7. Н_имущ_авто = (T_стр/12) × (Н_год + Страх_год)', () => {
    const s = { vehicleTaxYear: 24000, insuranceYear: 12000, buildMonths: 3 };
    expect(calcVehicleTax(s)).toBeCloseTo(9000); // (3/12) × 36 000
    expect(calcVehicleTax(s, 1)).toBeCloseTo(3000); // срок из сметы: 1 мес
    // Срок считается по длительности работ: 60 дней ≈ 2 мес → 6 000 ₽
    const p = ProjectFixture([{ type: "labor", qty: 100, price: 500, days: 60 }], {
      vehicleTaxYear: 24000, insuranceYear: 12000,
    });
    const t = calculateFrameworkTotals(p);
    expect(t.durationDays).toBe(60);
    expect(t.vehicleTax).toBeCloseTo(6000);
  });

  // ── Строка 8. Возвратные: металлолом ──────────────────────────────────
  test('К8. Возвр = Σ(q_факт × Масса_ед × k_отх) × Цена_лома', () => {
    const s = { scrapPricePerTon: 15000, vzLiquidation: 0 };
    // ЛСТК: q_факт 103 × 0.01 т × 0.03 = 0.0309 т × 15 000 = 463.5 ₽
    const r = calcReturnable(
      [{ type: 'material', qty: 100, unitMassT: 0.01, wasteGroup: 'metal' }], s,
    );
    expect(r.scrap).toBeCloseTo(463.5, 1);
    // Не-металло-группы (дерево) в лом не идут
    expect(calcReturnable([{ type: 'material', qty: 10, unitMassT: 1, wasteGroup: 'lumber' }], s).scrap).toBe(0);
    // + ликвидация ВЗ
    const r2 = calcReturnable([], { ...s, vzLiquidation: 50000 });
    expect(r2.total).toBeCloseTo(50000);
  });

  // ── Строка 9. Главная формула целиком ─────────────────────────────────
  test('К9. S = ПЗ + НР + СП + ЛЗ + Нал − Возвр (эталонная смета)', () => {
    const p = ProjectFixture([
      { type: 'labor', qty: 100, price: 500 },                 // 60 000 (наценка ×1.2)
      { type: 'material', qty: 100, price: 300, wasteGroup: 'metal', unitMassT: 0.01 }, // 103×300=30 900
    ], {
      overheadPct: 10, profitPct: 5, dRyn: 0,
      npPct: 3, vzPct: 0, zuPct: 0, ppPct: 0, garantPct: 0,
      rainDays: 0, workerDistanceKm: 0, workDays: 0,
      usnPct: 6, buildMonths: 0, vehicleTaxYear: 0, insuranceYear: 0,
      scrapPricePerTon: 15000, vzLiquidation: 0,
    });
    const t = calculateFrameworkTotals(p);
    // Ручной пересчёт:
    const pz = 60000 + 30900;                       // ПЗ = 90 900
    const nr = 60000 * 0.10;                        // НР от ФОТ = 6 000
    const sp = 60000 * 0.05;                        // СП от ФОТ = 3 000
    const np = (pz + nr) * 0.03;                    // НП = 96 900 × 3% = 2 907
    const lz = np;                                  // остальные ЛЗ = 0
    const sub = pz + nr + sp + lz;                  // 102 807
    const tax = sub * 0.06;                         // УСН = 6 168.42
    const scrap = 103 * 0.01 * 0.03 * 15000;        // Возвр = 463.50
    expect(t.pz).toBeCloseTo(pz);
    expect(t.nr).toBeCloseTo(nr);
    expect(t.sp).toBeCloseTo(sp);
    expect(t.lz).toBeCloseTo(np);
    expect(t.tax).toBeCloseTo(tax, 1);
    expect(t.returnable.total).toBeCloseTo(scrap, 1);
    expect(t.grand).toBeCloseTo(sub + tax - scrap, 1);
    // НДС нигде не появляется:
    expect(t.vat).toBe(0);
  });

  // ── Строка 10. d_рын входит в СП ──────────────────────────────────────
  test('К10. СП = Н_сп × Б_сп + d_рын', () => {
    const p = ProjectFixture([{ type: 'labor', qty: 10, price: 500 }], {
      profitPct: 10, dRyn: 25000,
      overheadPct: 0, npPct: 0, vzPct: 0, zuPct: 0, ppPct: 0, garantPct: 0,
      rainDays: 0, workerDistanceKm: 0, workDays: 0, buildMonths: 0,
      vehicleTaxYear: 0, insuranceYear: 0, scrapPricePerTon: 0, vzLiquidation: 0,
    });
    const t = calculateFrameworkTotals(p);
    // ФОТ = 10 × 600 = 6 000 → СП = 600 + 25 000 = 25 600
    expect(t.pz).toBeCloseTo(6000);
    expect(t.sp).toBeCloseTo(6000 * 0.10 + 25000);
  });
});

/* Хелпер: собрать минимальный проект под каркасный метод. */
function ProjectFixture(resources, fw = {}) {
  const res = resources.map((r, i) => ({ id: `r${i}`, name: 'Р', unit: 'шт', days: null, ...r }));
  return {
    title: 'Контрольный',
    sections: [{ id: 's1', name: 'Тест', resources: res, children: [] }],
    rates: { overheadPct: fw.overheadPct ?? 0, overheadBase: 'labor', profitPct: fw.profitPct ?? 0, profitBase: 'labor' },
    rounding: { mode: 'kopecks', method: 'math' },
    framework: { ...defaultFrameworkSettings(), ...fw },
  };
}
