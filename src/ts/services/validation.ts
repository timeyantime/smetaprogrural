/**
 * Сервис валидации данных
 * Отвечает за проверку корректности входных данных
 */

import { Project } from '../models/Project.ts';
import { Section } from '../models/Section.ts';
import { Resource } from '../models/Resource.ts';

/**
 * Ошибки валидации
 * @typedef {Object} ValidationError
 * @property {string} field - Поле с ошибкой
 * @property {string} message - Сообщение об ошибке
 * @property {string} type - Тип ошибки
 */

/**
 * Результаты валидации
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Флаг валидности
 * @property {Array<ValidationError>} errors - Массив ошибок
 */

/**
 * Валидирует проект
 * @param {Object} project - Проект для валидации
 * @returns {ValidationResult} Результат валидации
 */
export function validateProject(project) {
  const errors = [];

  if (!project || typeof project !== 'object') {
    errors.push({
      field: 'project',
      message: 'Проект должен быть объектом',
      type: 'type',
    });
    return { valid: false, errors };
  }

  // Валидация заголовка
  if (!project.title || typeof project.title !== 'string') {
    errors.push({
      field: 'title',
      message: 'Заголовок проекта должен быть строкой',
      type: 'required',
    });
  }

  // Валидация разделов
  if (!Array.isArray(project.sections)) {
    errors.push({
      field: 'sections',
      message: 'Разделы должны быть массивом',
      type: 'type',
    });
  } else {
    for (let i = 0; i < project.sections.length; i++) {
      const sectionResult = validateSection(project.sections[i]);
      if (!sectionResult.valid) {
        sectionResult.errors.forEach((error) => {
          errors.push({
            field: `sections[${i}].${error.field}`,
            message: `Раздел "${project.sections[i]?.name || i}": ${error.message}`,
            type: error.type,
          });
        });
      }
    }
  }

  // Валидация ставок
  if (project.rates && typeof project.rates === 'object') {
    const ratesResult = validateRates(project.rates);
    if (!ratesResult.valid) {
      ratesResult.errors.forEach((error) => {
        errors.push({
          field: `rates.${error.field}`,
          message: error.message,
          type: error.type,
        });
      });
    }
  }

  // Валидация настроек округления
  if (project.rounding && typeof project.rounding === 'object') {
    const roundingResult = validateRounding(project.rounding);
    if (!roundingResult.valid) {
      roundingResult.errors.forEach((error) => {
        errors.push({
          field: `rounding.${error.field}`,
          message: error.message,
          type: error.type,
        });
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Валидирует раздел
 * @param {Object} section - Раздел для валидации
 * @returns {ValidationResult} Результат валидации
 */
export function validateSection(section) {
  const errors = [];

  if (!section || typeof section !== 'object') {
    errors.push({
      field: 'section',
      message: 'Раздел должен быть объектом',
      type: 'type',
    });
    return { valid: false, errors };
  }

  // Валидация ID
  if (!section.id || typeof section.id !== 'string') {
    errors.push({
      field: 'id',
      message: 'ID раздела должен быть строкой',
      type: 'required',
    });
  }

  // Валидация названия
  if (!section.name || typeof section.name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Название раздела должно быть строкой',
      type: 'required',
    });
  }

  // Валидация ресурсов
  if (!Array.isArray(section.resources)) {
    errors.push({
      field: 'resources',
      message: 'Ресурсы должны быть массивом',
      type: 'type',
    });
  } else {
    for (let i = 0; i < section.resources.length; i++) {
      const resourceResult = validateResource(section.resources[i]);
      if (!resourceResult.valid) {
        resourceResult.errors.forEach((error) => {
          errors.push({
            field: `resources[${i}].${error.field}`,
            message: `Ресурс ${i + 1}: ${error.message}`,
            type: error.type,
          });
        });
      }
    }
  }

  // Валидация parentId
  if (section.parentId !== null && typeof section.parentId !== 'string') {
    errors.push({
      field: 'parentId',
      message: 'parentId должен быть строкой или null',
      type: 'type',
    });
  }

  // Валидация collapsed
  if (typeof section.collapsed !== 'boolean') {
    errors.push({
      field: 'collapsed',
      message: 'collapsed должен быть булевым значением',
      type: 'type',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Валидирует ресурс
 * @param {Object} resource - Ресурс для валидации
 * @returns {ValidationResult} Результат валидации
 */
export function validateResource(resource) {
  const errors = [];

  if (!resource || typeof resource !== 'object') {
    errors.push({
      field: 'resource',
      message: 'Ресурс должен быть объектом',
      type: 'type',
    });
    return { valid: false, errors };
  }

  // Валидация ID
  if (!resource.id || typeof resource.id !== 'string') {
    errors.push({
      field: 'id',
      message: 'ID ресурса должен быть строкой',
      type: 'required',
    });
  }

  // Валидация названия
  if (typeof resource.name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Название ресурса должно быть строкой',
      type: 'type',
    });
  }

  // Валидация типа
  if (!['labor', 'machine', 'material'].includes(resource.type)) {
    errors.push({
      field: 'type',
      message: 'Тип ресурса должен быть labor, machine или material',
      type: 'enum',
    });
  }

  // Валидация количества
  if (typeof resource.qty !== 'number' || resource.qty < 0) {
    errors.push({
      field: 'qty',
      message: 'Количество должно быть числом >= 0',
      type: 'range',
    });
  }

  // Валидация цены
  if (typeof resource.price !== 'number' || resource.price < 0) {
    errors.push({
      field: 'price',
      message: 'Цена должна быть числом >= 0',
      type: 'range',
    });
  }

  // Валидация единицы измерения
  if (typeof resource.unit !== 'string') {
    errors.push({
      field: 'unit',
      message: 'Единица измерения должна быть строкой',
      type: 'type',
    });
  }

  // Валидация оператора (только для машин)
  if (resource.type === 'machine' && typeof resource.operator !== 'boolean') {
    errors.push({
      field: 'operator',
      message: 'Оператор должен быть булевым значением для машин',
      type: 'type',
    });
  }

  // Валидация дней
  if (resource.days !== null && (typeof resource.days !== 'number' || resource.days < 0)) {
    errors.push({
      field: 'days',
      message: 'Дни должны быть числом >= 0 или null',
      type: 'range',
    });
  }

  // Валидация примечания
  if (typeof resource.note !== 'string') {
    errors.push({
      field: 'note',
      message: 'Примечание должно быть строкой',
      type: 'type',
    });
  }

  // Валидация преемственности
  if (typeof resource.pred !== 'string') {
    errors.push({
      field: 'pred',
      message: 'Преемственность должна быть строкой',
      type: 'type',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Валидирует ставки
 * @param {Object} rates - Ставки для валидации
 * @returns {ValidationResult} Результат валидации
 */
export function validateRates(rates) {
  const errors = [];

  if (!rates || typeof rates !== 'object') {
    errors.push({
      field: 'rates',
      message: 'Ставки должны быть объектом',
      type: 'type',
    });
    return { valid: false, errors };
  }

  // Валидация процента накладных
  if (typeof rates.overheadPct !== 'number' || rates.overheadPct < 0) {
    errors.push({
      field: 'overheadPct',
      message: 'Процент накладных должен быть числом >= 0',
      type: 'range',
    });
  }

  // Валидация базы накладных
  if (!['labor', 'pz'].includes(rates.overheadBase)) {
    errors.push({
      field: 'overheadBase',
      message: 'База накладных должна быть labor или pz',
      type: 'enum',
    });
  }

  // Валидация процента прибыли
  if (typeof rates.profitPct !== 'number' || rates.profitPct < 0) {
    errors.push({
      field: 'profitPct',
      message: 'Процент прибыли должен быть числом >= 0',
      type: 'range',
    });
  }

  // Валидация базы прибыли
  if (!['labor', 'pz'].includes(rates.profitBase)) {
    errors.push({
      field: 'profitBase',
      message: 'База прибыли должна быть labor или pz',
      type: 'enum',
    });
  }

  // Примечание: НДС (rates.vatPct) из валидации исключён — каркасный метод
  // v2.0 работает «Без НДС»; налог — УСН (project.framework.usnPct).

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Валидирует настройки округления
 * @param {Object} rounding - Настройки округления
 * @returns {ValidationResult} Результат валидации
 */
export function validateRounding(rounding) {
  const errors = [];

  if (!rounding || typeof rounding !== 'object') {
    errors.push({
      field: 'rounding',
      message: 'Настройки округления должны быть объектом',
      type: 'type',
    });
    return { valid: false, errors };
  }

  // Валидация режима
  if (!['kopecks', 'rubles'].includes(rounding.mode)) {
    errors.push({
      field: 'mode',
      message: 'Режим округления должен быть kopecks или rubles',
      type: 'enum',
    });
  }

  // Валидация метода
  if (!['math', 'bank', 'truncate'].includes(rounding.method)) {
    errors.push({
      field: 'method',
      message: 'Метод округления должен быть math, bank или truncate',
      type: 'enum',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Валидирует число
 * @param {any} value - Значение для валидации
 * @param {Object} options - Опции валидации
 * @param {number} options.min - Минимальное значение
 * @param {number} options.max - Максимальное значение
 * @param {boolean} options.required - Обязательное поле
 * @returns {boolean} true если число валидно
 */
export function validateNumber(value: unknown, options: { min?: number; max?: number; required?: boolean } = {}) {
  const { min = -Infinity, max = Infinity, required = true } = options;

  if (value === null || value === undefined) {
    return !required;
  }

  if (typeof value !== 'number' || isNaN(value)) {
    return false;
  }

  return value >= min && value <= max;
}

/**
 * Валидирует строку
 * @param {any} value - Значение для валидации
 * @param {Object} options - Опции валидации
 * @param {number} options.minLength - Минимальная длина
 * @param {number} options.maxLength - Максимальная длина
 * @param {boolean} options.required - Обязательное поле
 * @returns {boolean} true если строка валидна
 */
export function validateString(value: unknown, options: { minLength?: number; maxLength?: number; required?: boolean } = {}) {
  const { minLength = 0, maxLength = Infinity, required = true } = options;

  if (value === null || value === undefined) {
    return !required;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return value.length >= minLength && value.length <= maxLength;
}

/**
 * Форматирует ошибки валидации для отображения
 * @param {Array<ValidationError>} errors - Массив ошибок
 * @returns {string} Форматированное сообщение
 */
export function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return '';
  }

  return errors
    .map((error) => {
      const fieldLabel = getFieldLabel(error.field);
      return `${fieldLabel}: ${error.message}`;
    })
    .join('\n');
}

/**
 * Получает метку поля
 * @param {string} field - Поле
 * @returns {string} Метка поля
 */
function getFieldLabel(field) {
  const labels = {
    title: 'Заголовок',
    sections: 'Разделы',
    name: 'Название',
    resources: 'Ресурсы',
    id: 'ID',
    type: 'Тип',
    qty: 'Количество',
    price: 'Цена',
    unit: 'Единица измерения',
    basis: 'Обоснование',
    note: 'Примечание',
    days: 'Длительность',
    pred: 'Преемственность',
    operator: 'Оператор',
    startAt: 'Дата начала',
    parentId: 'Родительский раздел',
    collapsed: 'Свернут',
    recalcMode: 'Режим пересчета',
    overheadPct: 'Процент накладных',
    overheadBase: 'База накладных',
    profitPct: 'Процент прибыли',
    profitBase: 'База прибыли',
    // vatPct убран: каркасный метод v2.0 — «Без НДС» (налог — УСН в framework.usnPct)
    mode: 'Режим округления',
    method: 'Метод округления',
  };
  return labels[field] || field;
}

export default {
  validateProject,
  validateSection,
  validateResource,
  validateRates,
  validateRounding,
  validateNumber,
  validateString,
  formatValidationErrors,
};
