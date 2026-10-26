/**
 * Модель ресурса сметы
 * Представляет строку сметы (работа, машина, материал)
 */

import { Project } from './Project.ts';

/**
 * Типы ресурсов
 * @typedef {string} ResourceType
 * @property {'labor'} - Работа (труд рабочих)
 * @property {'machine'} - Машина (эксплуатация техники)
 * @property {'material'} - Материал
 */

/**
 * Модель ресурса
 * @class
 */
export class Resource {
  /**
   * Создает новый ресурс
   * @param {Object} partial - Частичные данные ресурса
   * @returns {Object} Новый ресурс
   */
  static create(partial = {}) {
    return {
      id: Project.generateId(),
      basis: '', // Обоснование (шифр расценки)
      name: '', // Наименование работы и затрат
      type: 'material', // labor | machine | material
      operator: false, // Для machine: оплата труда машиниста (Тмр)
      unit: '', // Ед. изм.
      qty: 0, // Кол-во
      price: 0, // Текущая цена, руб.
      note: '', // Примечание
      days: null, // Длительность, дни (для диаграммы Ганта)
      pred: '', // Преемственность: «№» или «FS:№», «SS:№», «FF:№», «SF:№» (несколько через запятую)
      startAt: null, // Принудительно начало в днях от старта сметы
      // --- Каркасный метод (framework v2.0): метаданные строки ---
      wasteGroup: '', // группа норм отходов (id из WASTE_NORMS), '' = без запаса
      perUnit: 0, // p_отп отпускная цена ₽/ед. (0 = использовать price)
      unitMassT: 0, // Масса_ед, т (для рейсов доставки и металлолома)
      vehicleCapT: 0, // Грузоподъемность_т
      distanceKm: 0, // L_км плечо перевозки
      tariffPerKm: 0, // C_тариф_км, ₽/км
      supplyFee: 0, // C_подачи, ₽
      kGabarit: 1, // k_габарит
      manipulatorFlag: false, // Флаг_манипулятор (0|1)
      unloadMachineHr: 0, // C_маш_ч разгрузки, ₽/ч
      unloadHours: 0, // t_час, ч
      moveDistM: 0, // S_м перемещение после разгрузки
      moveSpeedMh: 0, // V_перем, м/ч
      perPct: 0, // П — надбавка, % (1per·П)
      storePct: 0, // Х — хранение, % (1hran·Х)
      perOn: true, // 1per ∈ {0,1}
      storeOn: false, // 1hran ∈ {0,1}
      night: false, // работа в ночную смену (k_ночн)
      holiday: false, // работа в праздник (k_ночн)
      ...partial,
    };
  }

  /**
   * Валидация ресурса
   * @param {Object} resource - Ресурс для валидации
   * @returns {boolean} true если ресурс валиден
   */
  static validate(resource) {
    if (!resource || typeof resource !== 'object') {
      return false;
    }

    if (!resource.id || typeof resource.id !== 'string') {
      return false;
    }

    if (typeof resource.name !== 'string') {
      return false;
    }

    if (!['labor', 'machine', 'material'].includes(resource.type)) {
      return false;
    }

    if (typeof resource.qty !== 'number' || resource.qty < 0) {
      return false;
    }

    if (typeof resource.price !== 'number' || resource.price < 0) {
      return false;
    }

    return true;
  }

  /**
   * Рассчитывает стоимость ресурса
   * @param {Object} resource - Ресурс
   * @returns {number} Итоговая стоимость
   */
  static calculateTotal(resource) {
    if (!Resource.validate(resource)) {
      return 0;
    }

    return resource.qty * resource.price;
  }

  /**
   * Форматирует ресурс для отображения
   * @param {Object} resource - Ресурс
   * @returns {Object} Форматированный ресурс
   */
  static formatForDisplay(resource) {
    if (!Resource.validate(resource)) {
      return {
        id: '',
        basis: '',
        name: 'Невалидный ресурс',
        type: 'material',
        typeLabel: 'Материал',
        unit: '',
        qty: 0,
        price: 0,
        total: 0,
        note: '',
      };
    }

    const typeLabels = {
      labor: 'Работа',
      machine: 'Машина',
      material: 'Материал',
    };

    return {
      ...resource,
      typeLabel: typeLabels[resource.type] || resource.type,
      total: Resource.calculateTotal(resource),
    };
  }

  /**
   * Создает ключ для группировки ресурсов
   * Используется для поиска дубликатов
   * @param {Object} resource - Ресурс
   * @returns {string|null} Ключ для группировки
   */
  static getKey(resource) {
    if (!Resource.validate(resource)) {
      return null;
    }

    const name = String(resource.name || '')
      .trim()
      .toLowerCase();
    if (!name) {
      return null;
    }

    const type = resource.type === 'labor' ? 'l' : resource.type === 'machine' ? 'm' : 'c';
    const unit = String(resource.unit || '')
      .trim()
      .toLowerCase();

    return `${type}|${name}|${unit}`;
  }

  /**
   * Создает ресурс из строки (для импорта)
   * @param {string} line - Строка CSV
   * @returns {Object} Ресурс
   */
  static fromCSV(line) {
    const parts = line.split(';');
    return Resource.create({
      basis: parts[0] || '',
      name: parts[1] || '',
      type: parts[2] || 'material',
      unit: parts[3] || '',
      qty: Number(parts[4]) || 0,
      price: Number(parts[5]) || 0,
      note: parts[6] || '',
    });
  }

  /**
   * Конвертирует ресурс в строку CSV
   * @param {Object} resource - Ресурс
   * @returns {string} Строка CSV
   */
  static toCSV(resource) {
    if (!Resource.validate(resource)) {
      return '';
    }

    const escape = (str) => {
      if (typeof str !== 'string') return '';
      return str.includes(';') ? `"${str}"` : str;
    };

    return [
      escape(resource.basis),
      escape(resource.name),
      resource.type,
      escape(resource.unit),
      resource.qty,
      resource.price,
      escape(resource.note),
    ].join(';');
  }
}

export default Resource;
