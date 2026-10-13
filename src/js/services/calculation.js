/**
 * Сервис для расчетов сметы
 * Отвечает за расчет стоимости, накладных, прибыли, НДС
 *
 * ВАЖНО: округление — единый источник истины в ../rounding.js (Методика 421/пр).
 * Здесь roundValue/roundGrandTotal только реэкспортируются, чтобы не дублировать логику.
 */

import { Resource } from '../models/Resource.js';
import { Section } from '../models/Section.js';
import { roundMoney, roundGrandTotal } from '../rounding.js';

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
 * Рассчитывает итоги по проекту
 * @param {Object} project - Проект
 * @returns {Object} Итоги проекта
 */
export function calculateProjectTotals(project) {
  if (!project || !project.sections) {
    return {
      laborTotal: 0,
      machineTotal: 0,
      materialTotal: 0,
      grandTotal: 0,
      overhead: 0,
      profit: 0,
      vat: 0,
      totalWithVat: 0,
    };
  }

  let laborTotal = 0;
  let machineTotal = 0;
  let materialTotal = 0;

  // Рассчитываем итоги по разделам
  for (const section of project.sections) {
    const sectionTotals = Section.calculateTotals(section, project.rates);
    laborTotal += sectionTotals.laborTotal;
    machineTotal += sectionTotals.machineTotal;
    materialTotal += sectionTotals.materialTotal;
  }

  const grandTotal = laborTotal + machineTotal + materialTotal;

  // Рассчитываем накладные расходы
  const overheadBase = project.rates?.overheadBase || 'labor';
  const overheadPct = project.rates?.overheadPct || 0;
  const overheadBaseAmount = getBaseAmount(overheadBase, laborTotal, machineTotal, materialTotal);
  const overhead = (overheadBaseAmount * overheadPct) / 100;

  // Рассчитываем прибыль
  const profitBase = project.rates?.profitBase || 'labor';
  const profitPct = project.rates?.profitPct || 0;
  const profitBaseAmount = getBaseAmount(profitBase, laborTotal, machineTotal, materialTotal);
  const profit = (profitBaseAmount * profitPct) / 100;

  // Рассчитываем НДС
  const vatPct = project.rates?.vatPct || 0;
  const vatBase = grandTotal + overhead + profit;
  const vat = (vatBase * vatPct) / 100;

  const totalWithVat = vatBase + vat;

  return {
    laborTotal,
    machineTotal,
    materialTotal,
    grandTotal,
    overhead,
    profit,
    vat,
    totalWithVat,
  };
}

/**
 * Получает базовую сумму для расчета накладных/прибыли
 * @param {string} base - База ('labor' или 'pz')
 * @param {number} laborTotal - Итог по работам
 * @param {number} machineTotal - Итог по машинам
 * @param {number} materialTotal - Итог по материалам
 * @returns {number} Базовая сумма
 */
function getBaseAmount(base, laborTotal, machineTotal, materialTotal) {
  switch (base) {
    case 'pz':
      return laborTotal + machineTotal + materialTotal;
    case 'labor':
    default:
      return laborTotal;
  }
}

/**
 * Рассчитывает итоги по разделу
 * @param {Object} section - Раздел
 * @param {Object} rates - Ставки
 * @returns {Object} Итоги раздела
 */
export function calculateSectionTotals(section, rates) {
  return Section.calculateTotals(section, rates);
}

/**
 * Рассчитывает стоимость ресурса
 * @param {Object} resource - Ресурс
 * @returns {number} Стоимость ресурса
 */
export function calculateResourceTotal(resource) {
  return Resource.calculateTotal(resource);
}

/**
 * Рассчитывает стоимость с учетом оператора для машин
 * @param {Object} resource - Ресурс (машина)
 * @returns {number} Стоимость с оператором
 */
export function calculateMachineTotalWithOperator(resource) {
  if (!Resource.validate(resource) || resource.type !== 'machine') {
    return Resource.calculateTotal(resource);
  }

  // Если есть оператор, добавляем его стоимость
  // Пока просто возвращаем базовую стоимость
  // В будущем можно добавить логику для расчета оператора
  return Resource.calculateTotal(resource);
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
  roundValue,
  roundGrandTotal,
  calculateMachineTotalWithOperator,
  calculateSectionDuration,
  calculateProjectDuration,
};
