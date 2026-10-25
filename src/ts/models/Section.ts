/**
 * Модель раздела сметы
 * Содержит список ресурсов и настройки раздела
 */

import { Resource } from './Resource.ts';
import { Project } from './Project.ts';

/**
 * Модель раздела
 * @class
 */
export class Section {
  /**
   * Создает новый раздел
   * @param {string} name - Наименование раздела
   * @returns {Object} Новый раздел
   */
  static create(name = 'Новый раздел') {
    return {
      id: Project.generateId(),
      name: name,
      parentId: null,
      collapsed: false,
      resources: [],
      children: [], // подразделы (главы), см. UI-логику app.js: isChapter/promoteSection
    };
  }

  /**
   * Создает раздел с дефолтными ресурсами
   * @param {string} name - Наименование раздела
   * @returns {Object} Раздел с дефолтными ресурсами
   */
  static createDefaultSection(name) {
    const section = this.create(name);

    // Добавляем дефолтные ресурсы в зависимости от имени раздела
    if (name.toLowerCase().includes('земляные') || name.toLowerCase().includes('земля')) {
      section.resources = [
        Resource.create({
          basis: 'Гэсн 81-02-01-01-01',
          name: 'Разработка грунта экскаватором под фундаменты',
          type: 'labor',
          unit: 'чел.-ч',
          qty: 10.5,
          price: 250,
          note: 'Слесарь 4 разр.',
          days: 3,
        }),
        Resource.create({
          basis: 'Гэснр 81-02-01-01-01',
          name: 'Экскаватор одноковшовый 0,4 м³',
          type: 'machine',
          operator: true,
          unit: 'маш.-ч',
          qty: 5.2,
          price: 1450,
          note: '',
          days: 2,
        }),
        Resource.create({
          basis: '',
          name: 'Песок строительный',
          type: 'material',
          unit: 'т',
          qty: 12,
          price: 890,
          note: 'Прайс поставщика №14',
          days: 1,
        }),
      ];
    } else if (name.toLowerCase().includes('фундамент')) {
      section.resources = [
        Resource.create({
          basis: 'Гэсн 81-02-03-01-01',
          name: 'Устройство бетонных подготовок',
          type: 'labor',
          unit: 'чел.-ч',
          qty: 24,
          price: 275,
          note: '',
          days: 4,
        }),
        Resource.create({
          basis: '',
          name: 'Бетон В22.5 (м300)',
          type: 'material',
          unit: 'м3',
          qty: 18.4,
          price: 6200,
          note: 'ГОСТ 7473-2010',
          days: 2,
        }),
      ];
    }

    return section;
  }

  /**
   * Валидация раздела
   * @param {Object} section - Раздел для валидации
   * @returns {boolean} true если раздел валиден
   */
  static validate(section) {
    if (!section || typeof section !== 'object') {
      return false;
    }

    if (!section.id || typeof section.id !== 'string') {
      return false;
    }

    if (!section.name || typeof section.name !== 'string') {
      return false;
    }

    if (!Array.isArray(section.resources)) {
      return false;
    }

    for (const resource of section.resources) {
      if (!Resource.validate(resource)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Добавляет ресурс в раздел
   * @param {Object} section - Раздел
   * @param {Object} resource - Ресурс для добавления
   * @returns {Object} Обновленный раздел
   */
  static addResource(section, resource) {
    if (!Section.validate(section)) {
      throw new Error('Invalid section');
    }

    if (!Resource.validate(resource)) {
      throw new Error('Invalid resource');
    }

    section.resources.push(resource);
    return section;
  }

  /**
   * Удаляет ресурс из раздела
   * @param {Object} section - Раздел
   * @param {string} resourceId - ID ресурса для удаления
   * @returns {Object} Обновленный раздел
   */
  static removeResource(section, resourceId) {
    if (!Section.validate(section)) {
      throw new Error('Invalid section');
    }

    section.resources = section.resources.filter((r) => r.id !== resourceId);
    return section;
  }

  /**
   * Находит ресурс в разделе по ID
   * @param {Object} section - Раздел
   * @param {string} resourceId - ID ресурса
   * @returns {Object|null} Найденный ресурс или null
   */
  static findResource(section, resourceId) {
    if (!Section.validate(section)) {
      return null;
    }

    return section.resources.find((r) => r.id === resourceId) || null;
  }

  /**
   * Обновляет ресурс в разделе
   * @param {Object} section - Раздел
   * @param {string} resourceId - ID ресурса
   * @param {Object} updates - Обновления
   * @returns {Object} Обновленный раздел
   */
  static updateResource(section, resourceId, updates) {
    const resource = this.findResource(section, resourceId);
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found`);
    }

    Object.assign(resource, updates);
    return section;
  }

  /**
   * Рассчитывает итоги по разделу
   * @param {Object} section - Раздел
   * @param {Object} rates - Ставки
   * @returns {Object} Итоги по разделу
   */
  static calculateTotals(section, rates) {
    if (!Section.validate(section)) {
      return {
        laborTotal: 0,
        machineTotal: 0,
        materialTotal: 0,
        grandTotal: 0,
      };
    }

    let laborTotal = 0;
    let machineTotal = 0;
    let materialTotal = 0;

    for (const resource of section.resources) {
      const total = resource.qty * resource.price;

      switch (resource.type) {
        case 'labor':
          laborTotal += total;
          break;
        case 'machine':
          machineTotal += total;
          break;
        case 'material':
          materialTotal += total;
          break;
      }
    }

    return {
      laborTotal,
      machineTotal,
      materialTotal,
      grandTotal: laborTotal + machineTotal + materialTotal,
    };
  }
}

export default Section;
