/**
 * Сервис расчёта сметы — Каркасный метод v2.0 (единственный метод расчёта).
 *
 * Источник методологии: TOON-спецификация «Сметная стоимость строительства
 * (Каркасный метод)» v2.0 / Полный комплект с нормами отходов и логистикой
 * (анализ от 2026-10-15). Реализация формул — в ../framework.js.
 *
 * Старый классический расчёт (ПЗ → НР → СП → НДС) УДАЛЁН и заменён на:
 *   S = ПЗ + НР + СП + ЛЗ + Нал − Возвр   (без НДС, без дисконтирования)
 *   • ПЗ = Σ(q_факт × p_полн), q_факт = q_нетто × (1 + k_отх)
 *   • НР = Σ(q_j × p_j) или Н_нр × Б_нр;  СП = Н_сп × Б_сп + d_рын
 *   • ЛЗ = ВЗ + ЗУ + Дож + ПП + Т_раб + Гарант + НП;  НП = (ПЗ + НР) × 3%
 *   • Налог — УСН 6% от S без НДС; транспортный налог/страховка — по сроку
 *   • Возвр — металлолом + ликвидационная стоимость ВЗ (вычитается из S)
 *
 * ВАЖНО: округление — единый источник истины в ../rounding.js (Методика 421/пр).
 * Здесь roundMoney/roundGrandTotal только реэкспортируются, чтобы не дублировать логику.
 */

import { Section } from '../models/Section.js';
import { roundMoney, roundGrandTotal } from '../rounding.js';
import { frameworkRowCost, calcFrameworkTotals, defaultFrameworkSettings } from '../framework.js';

export { roundMoney, roundGrandTotal };

/**
 * Совместимое имя: roundValue(value, mode, method) === roundMoney из rounding.js
 * @param {number} value - Значение для округления
 * @param {string} mode - Режим округления ('kopecks' или 'rubles')
 * @param {string} method - Метод округления ('math', 'bank', 'truncate')
 * @returns {number} Округленное значение
 */
export function roundValue(value, mode, method) {
  return roundMoney(value, mode, method);
}

/**
 * Главная формула каркасного метода v2.0:
 *   S = ПЗ + НР + СП + ЛЗ + Нал − Возвр
 * (старый расчёт с НДС удалён — этот метод единственный для всей программы).
 * @param {Object} project - Проект (данные приложения)
 * @returns {Object} Итоги проекта по каркасному методу
 */
export function calculateProjectTotals(project) {
  const totals = calculateFrameworkTotals(project);
  if (totals) return totals;

  // Пустой/некорректный проект — нулевая смета той же структуры.
  return {
    settings: defaultFrameworkSettings(),
    labor: 0,
    machine: 0,
    material: 0,
    laborRaw: 0,
    pz: 0,
    nr: 0,
    sp: 0,
    vat: 0,
    lz: 0,
    lzParts: null,
    tax: 0,
    vehicleTax: 0,
    returnable: { scrap: 0, liquidation: 0, total: 0 },
    sNoTax: 0,
    grand: 0,
    framework: true,
  };
}

/**
 * Рассчитывает итоги по разделу (строки × цены, без надбавок метода).
 * @param {Object} section - Раздел
 * @param {Object} rates - Ставки (не используются; оставлено для совместимости сигнатуры)
 * @returns {Object} Итоги раздела
 */
export function calculateSectionTotals(section, rates) {
  return Section.calculateTotals(section, rates);
}

/**
 * Стоимость строки ресурса по каркасному методу v2.0:
 *   труд:      q × (ЗП_база × 1.20 [× k_ночн при ночь/праздник]);
 *   машины:    q × mach.-ч (без наценки чел-ч, ночь/праздник — множитель);
 *   материалы: q_факт × p_полн (норма отходов + перевозка + разгрузка + П + Х;
 *              тара и погрузка исключены — обязанность поставщика).
 * @param {Object} resource - Ресурс
 * @param {Object|null} project - Проект (settings берутся из project.framework)
 * @returns {number} Стоимость ресурса
 */
export function calculateResourceTotal(resource, project = null) {
  const settings = project && project.framework ? project.framework : null;
  return frameworkRowCost(resource, settings).total;
}

/**
 * Каркасный метод v2.0: полный расчёт итогов сметы
 *   S = ПЗ + НР + СП + ЛЗ + Нал − Возвр (без НДС)
 * @param {Object} project - Проект
 * @returns {Object} Итоги каркасного метода
 */
export function calculateFrameworkTotals(project) {
  // Каркасный метод v2.0 — единственный расчёт в программе: флаг enabled
  // больше не является выключателем (старый путь с НДС удалён). Нулевые/битые
  // проекты дают нулевую смету вместо null (см. calculateProjectTotals).
  if (!project || !Array.isArray(project.sections)) return null;

  // ПЗ по фактическим объёмам и полным ценам (q_факт, p_полн, наценка труда)
  let laborRaw = 0; // «голый» ФОТ без наценки — не используется, но полезен для отчётов
  let labor = 0,
    machine = 0,
    material = 0;
  const fwSettings = project.framework || {};
  for (const sec of project.sections) {
    const walk = (s) => {
      for (const r of s.resources || []) {
        const c = frameworkRowCost(r, fwSettings);
        if (r.type === 'labor') {
          labor += c.total;
          laborRaw += (Number(r.qty) || 0) * (Number(r.price) || 0);
        } else if (r.type === 'machine') machine += c.total;
        else material += c.total;
      }
      for (const sub of s.children || []) walk(sub);
    };
    walk(sec);
  }

  const mode = project.rounding?.mode || 'kopecks';
  const method = project.rounding?.method || 'math';
  const pz = labor + machine + material;

  // НР и СП: % от базы (ФОТ или ПЗ); к нормативной СП добавляется
  // рыночная надбавка d_рын (framework.dRyn, ₽): СП = Н_сп * Б_сп + d_рын.
  const baseFor = (base) => (base === 'pz' ? pz : labor);
  const nr = roundMoney(
    (baseFor(project.rates?.overheadBase) * (Number(project.rates?.overheadPct) || 0)) / 100,
    mode,
    method
  );
  const sp = roundMoney(
    (baseFor(project.rates?.profitBase) * (Number(project.rates?.profitPct) || 0)) / 100 +
      (Number(fwSettings.dRyn) || 0),
    mode,
    method
  );

  // Срок строительства (дни) — для пропорционального налога на технику
  // (Property_Tax: Н_имущ_авто = (T_стр_мес / 12) * (Н_год + Страх_год)).
  const durationDays = calculateProjectDuration(project);
  const totals = calcFrameworkTotals(
    { ...(project || {}), durationDays },
    { pz, nr, sp, laborTotal: labor, mode, method }
  );
  return { ...totals, labor, machine, material, laborRaw, durationDays, vat: 0, framework: true };
}

/**
 * Рассчитывает длительность работ по разделу
 * Ресурсы внутри раздела выполняются параллельно,
 * поэтому длительность раздела = МАКСИМУМ из длительностей ресурсов
 * (см. тест: [5,10] + [3,7] → 10 + 7 = 17 дней, а не сумма 25)
 * @param {Object} section - Раздел
 * @returns {number} Максимальная длительность в днях
 */
export function calculateSectionDuration(section) {
  if (!Section.validate(section) || !section.resources.length) {
    return 0;
  }

  let maxDay = 0;

  for (const resource of section.resources) {
    const days = Number(resource.days);
    if (resource.days !== null && isFinite(days) && days > maxDay) {
      maxDay = days;
    }
  }

  return maxDay;
}

/**
 * Рассчитывает общую длительность проекта
 * Разделы выполняются последовательно → суммируем длительности разделов
 * @param {Object} project - Проект
 * @returns {number} Общая длительность в днях
 */
export function calculateProjectDuration(project) {
  if (!project || !project.sections) {
    return 0;
  }

  let totalDuration = 0;

  for (const section of project.sections) {
    const sectionDuration = calculateSectionDuration(section);
    totalDuration += sectionDuration;
  }

  return totalDuration;
}

export default {
  calculateProjectTotals,
  calculateSectionTotals,
  calculateResourceTotal,
  calculateFrameworkTotals,
  roundValue,
  roundGrandTotal,
  calculateSectionDuration,
  calculateProjectDuration,
};
