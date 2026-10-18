/**
 * СметаПро — Каркасный метод ценообразования (framework v2.0)
 *
 * Источник методологии: TOON-спецификация «Сметная стоимость строительства
 * (Каркасный метод)» v2.0 / Полный комплект с нормами отходов и логистикой,
 * анализ от 2026-10-15.
 *
 * Главные отличия от классической цепочки ПЗ → НР → СП → НДС:
 *   S = ПЗ + НР + СП + ЛЗ + Нал − Возвр    (без НДС, без дисконтирования)
 *   • ПЗ считается по ФАКТИЧЕСКИМ объёмам: q_факт = q_нетто × (1 + k_отх)
 *   • Полная цена ресурса p_полн = p_отп + Д_перевозка + Р_разгрузка
 *     + 1per·П + 1hran·Х (тара и погрузка — обязанность поставщика, ИСКЛЮЧЕНЫ)
 *   • Базовая ставка чел-ч автоматически × 1.20; ночь/праздник — доп. множитель
 *   • ЛЗ = ВЗ + ЗУ + Дож + ПП + Т_раб + Гарант + НП (НП = 3% от (ПЗ + НР))
 *   • Налог — УСН 6% от стоимости без НДС; Возвр вычитается из итога
 *   • Оборотные материалы (опалубка, крепёж многократного использования) ИСКЛЮЧЕНЫ
 *
 * Все функции — чистые (без DOM/сториджа), округление — через rounding.js
 * (Методика 421/пр применяется к итоговым статьям).
 */

import { roundMoney } from './rounding.js';

/* ========================================================================
 * 1. МЕТА (meta)
 * ====================================================================== */

export const FRAMEWORK_META = Object.freeze({
  title: 'Сметная стоимость строительства (Каркасный метод)',
  currency: 'RUB (Российский рубль, ₽)',
  method: 'Ресурсный метод / Без базиса / Без НДС / Без дисконтирования',
  duration: '1-3 месяца (инфляция/эскалация не применяются)',
  version: 'v2.0 / Полный комплект с нормами отходов и логистикой',
  analysis_date: '2026-10-15',
});

/* ========================================================================
 * 2. НОРМЫ ОТХОДОВ И ЗАПАСОВ (waste_norms): q_факт = q_нетто * (1 + k_отх)
 * ====================================================================== */

export const WASTE_NORMS = Object.freeze([
  { id: 'block',    material_group: 'Блочные (газобетон, кирпич)',                  k: 0.04, pct: '4%',  explanation: 'Бой при транспортировке, обрезка под размер' },
  { id: 'sheet',    material_group: 'Листовые (ГКЛ, ОСБ, фанера)',                   k: 0.06, pct: '6%',  explanation: 'Раскрой, неликвидные обрезки' },
  { id: 'roll',     material_group: 'Рулонные (гидроизоляция, подложка)',            k: 0.08, pct: '8%',  explanation: 'Технологический нахлест, обрезка краев' },
  { id: 'lumber',   material_group: 'Пиломатериалы (доска, брус, рейка)',            k: 0.08, pct: '8%',  explanation: 'Обзол, торцовка, естественная усушка' },
  { id: 'metal',    material_group: 'Металлоконструкции (ЛСТК, профиль, уголок)',    k: 0.03, pct: '3%',  explanation: 'Обрезки при сверловке и подгонке' },
  { id: 'concrete', material_group: 'Растворы и бетон (готовые смеси)',              k: 0.04, pct: '4%',  explanation: 'Потери при транспортировке, налипание на тару, перерасход' },
  { id: 'paint',    material_group: 'Краски, грунтовки, шпатлевки',                  k: 0.08, pct: '8%',  explanation: 'Остатки в таре, потери при нанесении, очистка инструмента' },
  { id: 'floor',    material_group: 'Чистовые полы (ламинат, плитка, кварцвинил)',   k: 0.07, pct: '7%',  explanation: 'Подрезка у стен, бой плитки, подгонка рисунка' },
  { id: 'insul',    material_group: 'Утеплитель (минвата, ЭППС, PIR)',               k: 0.04, pct: '4%',  explanation: 'Сжатие при монтаже, обрезка под нестандартные узлы' },
  { id: 'roof',     material_group: 'Кровельные (металлочерепица, мягкая кровля)',   k: 0.10, pct: '10%', explanation: 'Средний процент на обрезку скатов (до 15% на сложных крышах)' },
  { id: 'cable',    material_group: 'Кабель и проводка',                             k: 0.08, pct: '8%',  explanation: 'Запас на разделку, подключение в щитах и розетках, изгибы' },
  { id: 'pipe',     material_group: 'Трубы (сантехника, отопление, канализация)',    k: 0.05, pct: '5%',  explanation: 'Нарезка резьбы, фитинговые соединения, обрезки' },
]);

const WASTE_BY_ID = new Map(WASTE_NORMS.map((w) => [w.id, w]));

/** Коэффициент отходов по id группы (0, если группа не выбрана/неизвестна). */
export function wasteK(groupId) {
  const n = WASTE_BY_ID.get(groupId);
  return n ? n.k : 0;
}

/**
 * q_факт = q_нетто * (1 + k_отх)
 * @param {number} qtyNetto - проектное количество
 * @param {string|null} wasteGroup - id группы материала ('' / null → без запаса)
 * @returns {number} фактическое количество с учётом отходов
 */
export function factQty(qtyNetto, wasteGroup) {
  const q = Number(qtyNetto) || 0;
  return q * (1 + wasteK(wasteGroup));
}

/* ========================================================================
 * 3. ТРУД: наценка 20% на чел-ч и if-условие «ночь/праздник»
 * ====================================================================== */

export const LABOR_MARKUP = 1.2; // ЗП_чел_ч_факт = ЗП_чел_ч_база * 1.20
export const NIGHT_RANGE = [1.2, 1.5]; // типовой диапазон k_ночн

/**
 * Labor_Markup + Labor_Condition:
 *   ЗП_факт = ЗП_база * 1.20; ЕСЛИ (Ночь ИЛИ Праздник) → × k_ночн
 */
export function laborRateFact(baseRate, { night = false, holiday = false, kNight = 1.3 } = {}) {
  let r = (Number(baseRate) || 0) * LABOR_MARKUP;
  if (night || holiday) r *= (Number(kNight) || 1);
  return r;
}

/* ========================================================================
 * 4. ПОЛНАЯ ЦЕНА РЕСУРСА (p_full) и ЛОГИСТИКА (delivery / unloading)
 * ====================================================================== */

/**
 * Full_Price:
 *   p_полн = p_отп + Д_перевозка + Р_разгрузка + 1per·П + 1hran·Х
 * Тара и погрузка ИСКЛЮЧЕНЫ (обязанность поставщика).
 * @param {Object} m - метаданные материала (см. RESOURCE_DEFAULT_META ниже)
 * @param {Object} s - настройки framework (цена топлива и т.п. — для доставки рабочих, не здесь)
 * @returns {{priceFull: number, delivery: number, unloading: number, surchPer: number, surchStore: number}}
 */
export function resourceFullPrice(m, settings = null) {
  const perUnit = Number(m.perUnit) || 0; // p_отп на единицу измерения
  const delivery = deliveryPerUnit(m);
  const unloading = unloadingPerUnit(m);
  const surchPer = perUnit * ((Number(m.perPct) || 0) / 100);      // 1per · П
  const surchStore = perUnit * ((Number(m.storePct) || 0) / 100);  // 1hran · Х
  return {
    priceFull: perUnit + delivery + unloading + surchPer + surchStore,
    delivery,
    unloading,
    surchPer,
    surchStore,
  };
}

/**
 * Delivery:
 *   Д_перевозка = n_рейсов * (C_подачи + L_км * C_тариф_км) * k_габарит
 *   n_рейсов = ОКРУГЛ_ВВЕРХ((q_факт * Масса_ед) / Грузоподъемность_т)
 * Возвращает доставку на ЕДИНИЦУ измерения (стоимость делится на qty).
 */
export function deliveryPerUnit(m) {
  const qty = Number(m.qty) || 0;
  const mass = Number(m.unitMassT) || 0;      // Масса_ед, т
  const cap = Number(m.vehicleCapT) || 0;     // Грузоподъемность_т
  if (!qty || !cap || mass <= 0) return 0;
  const trips = Math.ceil((qty * mass) / cap);
  const km = Number(m.distanceKm) || 0;
  const tripCost = (Number(m.supplyFee) || 0) + km * (Number(m.tariffPerKm) || 0);
  const total = trips * tripCost * (Number(m.kGabarit) || 1);
  return total / qty;
}

/**
 * Unloading:
 *   Р_разгрузка = (1 - 0.9*Флаг_манипулятор) * (C_маш_ч * t_час + 0.5*C_подачи)
 *                 + C_маш_ч * S_м / V_перем
 * На единицу измерения (t_час и S_м — суммарные на весь объём поставки).
 */
export function unloadingPerUnit(m) {
  const qty = Number(m.qty) || 0;
  if (!qty) return 0;
  const machineHr = Number(m.unloadMachineHr) || 0; // C_маш_ч, ₽/ч
  const hours = Number(m.unloadHours) || 0;         // t_час, ч
  const supply = Number(m.supplyFee) || 0;          // C_подачи, ₽
  const manip = Number(m.manipulatorFlag) ? 1 : 0;  // Флаг_манипулятор 0|1
  const distM = Number(m.moveDistM) || 0;           // S_м, м
  const moveSpeed = Number(m.moveSpeedMh) || 0;     // V_перем, м/ч
  const cranePart = (1 - 0.9 * manip) * (machineHr * hours + 0.5 * supply);
  const movePart = moveSpeed > 0 ? (machineHr * distM) / moveSpeed : 0;
  return (cranePart + movePart) / qty;
}

/** Значения метаданных ресурса по умолчанию (логистика/условия труда). */
export const RESOURCE_DEFAULT_META = Object.freeze({
  wasteGroup: '',        // id группы из WASTE_NORMS ('' = запас не применять)
  perUnit: 0,            // p_отп — отпускная цена за единицу, ₽ (0 → брать resource.price)
  unitMassT: 0,          // Масса_ед, т
  vehicleCapT: 0,        // Грузоподъёмность ТС, т
  distanceKm: 0,         // L_км плечо перевозки
  tariffPerKm: 0,        // C_тариф_км, ₽/км
  supplyFee: 0,          // C_подачи, ₽ (подача ТС)
  kGabarit: 1,           // k_габарит
  manipulatorFlag: false,// Флаг_манипулятор
  unloadMachineHr: 0,    // C_маш_ч разгрузки, ₽/ч
  unloadHours: 0,        // t_час, ч
  moveDistM: 0,          // S_м перемещение после разгрузки, м
  moveSpeedMh: 0,        // V_перем, м/ч
  perPct: 0,             // П — надбавка за сезонность/риски, % (1per ∈ {0,1})
  storePct: 0,           // Х — хранение на складе, % (1hran ∈ {0,1})
  perOn: true,           // 1per
  storeOn: false,        // 1hran
  night: false,          // работа в ночную смену
  holiday: false,        // работа в праздник
});

/** Объединяет метаданные ресурса со значениями по умолчанию. */
export function normalizeResMeta(resource) {
  const out = {};
  for (const k of Object.keys(RESOURCE_DEFAULT_META)) {
    out[k] = resource && resource[k] !== undefined && resource[k] !== null
      ? resource[k]
      : RESOURCE_DEFAULT_META[k];
  }
  return out;
}

/* ========================================================================
 * 5. ЧЕТЫРЕ БЛОКА + ЛИМИТИРОВАННЫЕ ЗАТРАТЫ (four_blocks / amort_limited)
 * ====================================================================== */

/**
 * Limited:
 *   ЛЗ = ВЗ + ЗУ + Дож + ПП + Т_раб + Гарант + НП
 *   НП = (ПЗ + НР) * 0.03  (для каркасного строительства — 3%)
 *   Гарант = С_СМР * k_удерж (3–5%, влияет на cash flow, НЕ расход — см. прим.)
 * ВЗ/ЗУ/ПП считаются как СУММА(q*p) по строкам res.limited или как Н% × база.
 */
export function calcLimitedCosts(pz, nr, spres, laborTotal, settings, mode, method) {
  const s = settings || defaultFrameworkSettings();
  const rnd = (v) => roundMoney(v, mode, method);
  const smr = pz + nr + spres; // С_СМР = ПЗ + НР + СП

  // ВЗ, ЗУ, ПП: нормативный способ (% от базы) либо прямой (строки limited)
  const norm = (pct, base) => ((Number(pct) || 0) / 100) * base;
  const vz = norm(s.vzPct, smr) + directSum('vz', resOf(settings));
  const zu = norm(s.zuPct, smr) + directSum('zu', resOf(settings));
  const pp = norm(s.ppPct, smr) + directSum('pp', resOf(settings));

  const rain = calcRain(laborTotal, s);
  const workerTransport = calcWorkerTransport(laborTotal, s);
  // Contingency (строго по TOON): НП = (ПЗ + НР) * 0.03 — база без СП
  const np = (pz + nr) * (Number(s.npPct ?? 3) / 100);
  const garant = smr * ((Number(s.garantPct) || 0) / 100);

  return {
    vz: rnd(vz),
    zu: rnd(zu),
    pp: rnd(pp),
    rain: rnd(rain),
    workerTransport: rnd(workerTransport),
    np: rnd(np),
    garant: rnd(garant),
    total: rnd(vz + zu + pp + rain + workerTransport + np + garant),
  };
}

// Строки прямых лимитированных затрат передаются отдельно (см. collect в app.js)
let _limitedRows = [];
function resOf() { return _limitedRows; }
function directSum(kind, rows) {
  let sum = 0;
  for (const r of rows) if (r.kind === kind) sum += (Number(r.qty) || 0) * (Number(r.price) || 0);
  return sum;
}
export function setLimitedRows(rows) { _limitedRows = Array.isArray(rows) ? rows : []; }

/* ========================================================================
 * 6. ТРАНСПОРТ ПЕРСОНАЛА (worker_transport)
 *    Т_раб = (Расход_л_100 / 100) * L_км * 2 * Цена_топл * 1.05 * Дни_раб
 * ====================================================================== */

export function calcWorkerTransport(_laborTotal, s) {
  const consumption = Number(s.fuelPer100) || 0; // Расход_л_100, л/100км
  const km = Number(s.workerDistanceKm) || 0;    // L_км (в одну сторону)
  const fuelPrice = Number(s.fuelPrice) || 0;    // Цена_топл, ₽/л
  const days = Number(s.workDays) || 0;          // Дни_раб — фактические дни бригады
  return (consumption / 100) * km * 2 * fuelPrice * 1.05 * days;
}

/* ========================================================================
 * 7. ДОЖДИ — вероятностные потери ФОТ (rain)
 *    Дож = СУММА_m[ ЗП_m * k_потерь * p_вероятн * (d_дождь / D_мес) ]
 * ====================================================================== */

export function calcRain(laborTotal, s) {
  const months = Array.isArray(s.rainMonths) ? s.rainMonths : [];
  if (!months.length) {
    // Упрощённый режим: один период на всю смету
    const d = Number(s.rainDays) || 0;
    const D = Number(s.monthDays) || 30;
    return laborTotal * (Number(s.rainKLoss) || 0) * (Number(s.rainProb) || 0) * (d / D);
  }
  const share = laborTotal / months.length; // ФОТ распределяется по месяцам равномерно
  let sum = 0;
  for (const m of months) {
    sum += share * (Number(m.kLoss) || 0) * (Number(m.prob) || 0) * ((Number(m.rainDays) || 0) / (Number(m.monthDays) || 30));
  }
  return sum;
}

/* ========================================================================
 * 8. НАЛОГИ (taxes) и ВОЗВРАТНЫЕ СУММЫ (returnable)
 * ====================================================================== */

/** Налог_УСН = S_без_НДС * 0.06 (ставка настраивается, по умолчанию 6%). */
export function calcTax(baseWithoutTax, s) {
  return baseWithoutTax * ((Number(s.usnPct ?? 6) / 100));
}

/**
 * Имущественный/транспортный налог на технику:
 *   Н_имущ_авто = (T_стр_мес / 12) * (Н_транспортный_год + Страх_год)
 */
export function calcVehicleTax(s, durationMonths) {
  const months = Number(durationMonths) || Number(s.buildMonths) || 0;
  const yearly = (Number(s.vehicleTaxYear) || 0) + (Number(s.insuranceYear) || 0);
  return (months / 12) * yearly;
}

/**
 * Возвр = С_реализации_металлолома + С_ликвидации_ВЗ_после_демонтажа
 * Металлолом: масса обрезков = Σ(q_факт × Масса_ед × k_отх) по металлогруппам.
 */
export function calcReturnable(resources, s) {
  let scrapMassT = 0;
  for (const r of resources || []) {
    if (r.type !== 'material') continue;
    const wg = r.wasteGroup;
    if (wg !== 'metal' && wg !== 'pipe' && wg !== 'cable') continue; // металлолом-кандидаты
    const mass = Number(r.unitMassT) || 0;
    if (!mass) continue;
    const q = Number(r.qty) || 0;
    scrapMassT += q * (1 + wasteK(wg)) * mass * wasteK(wg);
  }
  const scrapRevenue = scrapMassT * (Number(s.scrapPricePerTon) || 0);
  const liquidation = Number(s.vzLiquidation) || 0; // остаточная стоимость бытовок/лесов
  return {
    scrap: roundMoney(scrapRevenue, 'kopecks', 'math'),
    liquidation,
    total: roundMoney(scrapRevenue + liquidation, 'kopecks', 'math'),
  };
}

/* ========================================================================
 * 9. ГЛАВНАЯ ФОРМУЛА (main_formula)
 *    S = ПЗ + НР + СП + ЛЗ + Нал − Возвр
 * ====================================================================== */

/** Дефолтные настройки каркасного метода (соответствуют блоку structural_info). */
export function defaultFrameworkSettings() {
  return {
    enabled: true,           // каркасный метод v2.0 — единственный расчёт в программе
    npPct: 3,                // НП = 3% (каркас: стандартная предсказуемость)
    usnPct: 6,               // Налог_УСН = 6%
    dRyn: 0,                 // d_рын — рыночная надбавка к сметной прибыли, ₽ (СП = Н_сп*Б_сп + d_рын)
    vzPct: 3,                // ВЗ, % от С_СМР (нормативный способ)
    zuPct: 0,                // ЗУ (для каркаса в тёплый период обычно 0)
    ppPct: 0,                // ПП, % от С_СМР
    garantPct: 0,            // Гарантийное удержание (3–5%), влияет на cash flow
    // Транспорт персонала
    fuelPer100: 12,          // Расход_л_100, л/100км
    fuelPrice: 60,           // Цена_топл, ₽/л
    workerDistanceKm: 0,     // L_км до объекта (в одну сторону)
    workDays: 0,             // Дни_раб — фактические дни присутствия бригады
    // Дожди (упрощённый однофазный режим; для помесячного — rainMonths)
    rainDays: 0,             // d_дождь, дни
    monthDays: 30,           // D_мес, дни
    rainKLoss: 0.1,          // k_потерь ∈ [0.05; 0.30]
    rainProb: 0.5,           // p_вероятн
    rainMonths: [],          // [{kLoss, prob, rainDays, monthDays}, ...]
    // Техника: налоги/страховка
    buildMonths: 2,          // T_стр_мес (1–3)
    vehicleTaxYear: 0,       // Н_транспортный_год, ₽
    insuranceYear: 0,        // ОСАГО/КАСКО, ₽/год
    // Возвратные суммы
    scrapPricePerTon: 15000, // реализация металлолома, ₽/т
    vzLiquidation: 0,        // ликвидационная стоимость ВЗ, ₽
  };
}

/**
 * Полный расчёт по каркасному методу.
 * @param {Object} project - проект (data приложения)
 * @param {Object} helpers - { pz, nr, sp, laborTotal, mode, method } из слоя UI/сервиса
 * @returns {Object} { pz, nr, sp, lzParts, lz, tax, vehicleTax, returnable, sNoTax, grand }
 */
export function calcFrameworkTotals(project, { pz, nr, sp, laborTotal, mode, method }) {
  const s = { ...defaultFrameworkSettings(), ...(project?.framework || {}) };
  const rnd = (v) => roundMoney(v, mode, method);

  const lz = calcLimitedCosts(pz, nr, sp, laborTotal, s, mode, method);
  const vehicleTax = rnd(calcVehicleTax(s));
  const subtotal = pz + nr + sp + lz.total + vehicleTax; // S без налога и возвратных
  const tax = rnd(calcTax(subtotal, s));
  const returnable = calcReturnable(flatResources(project), s);
  const grand = roundMoney(subtotal + tax - returnable.total, mode, method);

  return {
    settings: s,
    pz, nr, sp,
    lzParts: lz,
    lz: lz.total,
    vehicleTax,
    tax,
    returnable,
    sNoTax: rnd(subtotal),
    grand,
  };
}

function flatResources(project) {
  const out = [];
  for (const sec of project?.sections || []) {
    for (const r of sec.resources || []) out.push(r);
    for (const sub of sec.children || []) {
      for (const r of sub.resources || []) out.push(r);
    }
  }
  return out;
}

/**
 * Позиционный расчёт строки ресурса по каркасному методу:
 *   q_факт, p_полн (для материалов), ставка труда с наценкой/ночью, итог.
 * Используется и в гриде (столбец «Итого»), и в сервисе расчёта.
 */
export function frameworkRowCost(resource, settings = null) {
  const q = Number(resource.qty) || 0;
  const meta = normalizeResMeta(resource);
  const s = settings || defaultFrameworkSettings();

  if (resource.type === 'labor') {
    const rate = laborRateFact(resource.price, {
      night: !!meta.night, holiday: !!meta.holiday, kNight: Number(s.kNight) || 1.3,
    });
    return { qtyFact: q, priceFull: rate, total: q * rate, parts: { markup: rate - (Number(resource.price) || 0) } };
  }

  if (resource.type === 'machine') {
    // Машины: наценка не применяется (это не чел-ч), но учитываются ночь/праздник
    const rate = (meta.night || meta.holiday)
      ? q * (Number(resource.price) || 0) * (Number(s.kNight) || 1.3) / q
      : (Number(resource.price) || 0);
    return { qtyFact: q, priceFull: rate, total: q * rate, parts: {} };
  }

  // Материалы: q_факт = q_нетто*(1+k_отх); p_полн = p_отп + доставка + разгрузка + П + Х
  const qtyFact = factQty(q, meta.wasteGroup);
  const m = { ...meta, qty: q, perUnit: meta.perUnit || (Number(resource.price) || 0) };
  const fp = resourceFullPrice(m, s);
  return {
    qtyFact,
    priceFull: fp.priceFull,
    total: qtyFact * fp.priceFull,
    parts: { delivery: fp.delivery * qtyFact, unloading: fp.unloading * qtyFact, surchPer: fp.surchPer * qtyFact, surchStore: fp.surchStore * qtyFact },
  };
}

export default {
  FRAMEWORK_META, WASTE_NORMS, LABOR_MARKUP, NIGHT_RANGE, RESOURCE_DEFAULT_META,
  wasteK, factQty, laborRateFact, resourceFullPrice, deliveryPerUnit, unloadingPerUnit,
  normalizeResMeta, calcLimitedCosts, setLimitedRows, calcWorkerTransport, calcRain,
  calcTax, calcVehicleTax, calcReturnable, calcFrameworkTotals, frameworkRowCost,
  defaultFrameworkSettings,
};
