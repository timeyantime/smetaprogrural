/**
 * Модель проекта сметы
 * Содержит все данные сметы: разделы, ресурсы, настройки
 */

import { Resource } from './Resource.js';
import { Section } from './Section.js';

// Реэкспорт смежных моделей: тесты и внешний код могут импортировать
// Section/Resource из Project.js (модели связаны и живут в одной папке).
// Это единая точка входа для моделей данных.
export { Section } from './Section.js';
export { Resource } from './Resource.js';

/**
 * Счётчик для генерации уникальных ID (модульная переменная,
 * а не локальная внутри функции — иначе счётчик сбрасывается при каждом вызове)
 */
let uidCounter = 0;

/**
 * Ставки для расчетов (накладные, прибыль, НДС)
 * @typedef {Object} Rates
 * @property {number} overheadPct - Процент накладных расходов
 * @property {string} overheadBase - База для накладных: 'labor' или 'pz'
 * @property {number} profitPct - Процент прибыли
 * @property {string} profitBase - База для прибыли: 'labor' или 'pz'
 * @property {number} vatPct - Процент НДС
 */

/**
 * Настройки округления
 * @typedef {Object} RoundingSettings
 * @property {string} mode - Режим округления: 'kopecks' (2 знака) или 'rubles' (0 знаков)
 * @property {string} method - Метод округления: 'math', 'bank', 'truncate'
 */

/**
 * Данные организации
 * @typedef {Object} CompanyInfo
 * @property {string} customer - Заказчик
 * @property {string} contractor - Подрядчик
 * @property {string} objectName - Наименование объекта
 * @property {string} address - Адрес
 * @property {string} basis - Основание
 * @property {string} chief - Руководитель
 * @property {string} phone - Телефон
 * @property {string} date - Дата
 */

/**
 * Основная модель проекта
 * @class
 */
export class Project {
  /**
   * Создает новый проект с дефолтными значениями
   * @returns {Object} Дефолтный проект
   */
  static default() {
    return {
      title: 'Локальная смета № 1',
      sections: [
        Section.createDefaultSection('Земляные работы'),
        Section.createDefaultSection('Фундаменты'),
      ],
      startDate: this.defaultStartDate(),
      recalcMode: 'auto', // auto | manual
      company: {
        customer: '',
        contractor: '',
        objectName: '',
        address: '',
        basis: '',
        chief: '',
        phone: '',
        date: '',
      },
      rates: {
        overheadPct: 15,
        overheadBase: 'labor',
        profitPct: 10,
        profitBase: 'labor',
        vatPct: 20,
      },
      rounding: {
        mode: 'kopecks',
        method: 'math',
      },
    };
  }

  /**
   * Возвращает текущую дату в формате YYYY-MM-DD
   * @returns {string} Дата в формате ISO
   */
  static defaultStartDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Валидация проекта
   * @param {Object} project - Проект для валидации
   * @returns {boolean} true если проект валиден
   */
  static validate(project) {
    if (!project || typeof project !== 'object') {
      return false;
    }

    if (!project.title || typeof project.title !== 'string') {
      return false;
    }

    if (!Array.isArray(project.sections)) {
      return false;
    }

    for (const section of project.sections) {
      if (!Section.validate(section)) {
        return false;
      }
    }

    if (!project.rates || typeof project.rates !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Создает уникальный ID
   * @returns {string} Уникальный ID
   */
  static generateId() {
    return `id-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;
  }

  /**
   * Глубокое клонирование проекта
   * @param {Object} project - Проект для клонирования
   * @returns {Object} Клонированный проект
   */
  static clone(project) {
    return JSON.parse(JSON.stringify(project));
  }
}

/**
 * Миграция данных из старой версии в новую
 * @param {Object} oldData - Старые данные
 * @returns {Object} Мигрированные данные
 */
export function migrateV3toV4(oldData) {
  const newData = Project.default();

  if (!oldData) {
    return newData;
  }

  // Копируем заголовок
  if (oldData.title) {
    newData.title = oldData.title;
  }

  // Копируем режим пересчета
  newData.recalcMode = oldData.recalcMode || 'auto';

  // Копируем информацию о компании
  if (oldData.company) {
    newData.company = { ...newData.company, ...oldData.company };
  }

  // Копируем ставки
  if (oldData.rates) {
    newData.rates = { ...newData.rates, ...oldData.rates };
  }

  // Копируем настройки округления
  if (oldData.rounding) {
    newData.rounding = { ...newData.rounding, ...oldData.rounding };
  }

  // Копируем дату начала
  if (oldData.startDate) {
    newData.startDate = oldData.startDate;
  }

  // Мигрируем разделы
  if (Array.isArray(oldData.sections)) {
    newData.sections = oldData.sections.map((section) => {
      const newSection = Section.create(section.name || 'Новый раздел');
      newSection.id = section.id || Project.generateId();
      newSection.parentId = section.parentId ?? null;
      newSection.collapsed = !!section.collapsed;

      if (Array.isArray(section.resources)) {
        newSection.resources = section.resources.map((resource) => {
          const newResource = Resource.create({});
          newResource.id = resource.id || Project.generateId();
          newResource.basis = resource.basis || '';
          newResource.name = resource.name || '';
          newResource.type = resource.type || 'material';
          newResource.operator = !!resource.operator;
          newResource.unit = resource.unit || '';
          newResource.qty = Number(resource.qty) || 0;
          newResource.price = Number(resource.price) || 0;
          newResource.note = resource.note || '';
          newResource.days = resource.days !== null ? Number(resource.days) : null;
          newResource.pred = resource.pred || resource.predecessor || '';
          newResource.startAt = resource.startAt || null;
          return newResource;
        });
      }

      return newSection;
    });
  }

  return newData;
}

export default Project;
