/**
 * Сервис для расчетов сметы
 * Отвечает за расчет стоимости, накладных, прибыли, НДС
 */

import { Resource } from '../models/Resource.js';
import { Section } from '../models/Section.js';

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
 * Применяет округление к значению
 * @param {number} value - Значение для округления
 * @param {string} mode - Режим округления ('kopecks' или 'rubles')
 * @param {string} method - Метод округления ('math', 'bank', 'truncate')
 * @returns {number} Округленное значение
 */
export function roundValue(value, mode, method) {
  const v = Number(value) || 0;
  if (!isFinite(v)) {
    return 0;
  }

  const digits = mode === 'rubles' ? 0 : 2;
  const factor = Math.pow(10, digits);
  const scaled = v * factor;

  let result;

  switch (method) {
    case 'bank':
      // Банковское округление (half to even)
      {
        const floor = Math.floor(scaled);
        const diff = scaled - floor;
        if (Math.abs(diff - 0.5) < 1e-9) {
          result = floor % 2 === 0 ? floor : floor + 1;
        } else {
          result = Math.round(scaled);
        }
      }
      break;
    case 'truncate':
      result = Math.floor(scaled);
      break;
    case 'math':
    default:
      // Математическое округление
      result = Math.sign(scaled) * Math.round(Math.abs(scaled));
  }

  return result / factor;
}

/**
 * Округляет итоговую сумму
 * @param {number} value - Значение
 * @returns {number} Округленное значение
 */
export function roundGrandTotal(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
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
 * @param {Object} section - Раздел
 * @returns {number} Максимальная длительность в днях
 */
export function calculateSectionDuration(section) {
  if (!Section.validate(section) || !section.resources.length) {
    return 0;
  }

  let maxDay = 0;

  for (const resource of section.resources) {
    if (resource.days !== null && resource.days > maxDay) {
      maxDay = resource.days;
    }
  }

  return maxDay;
}

/**
 * Рассчитывает общую длительность проекта
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
