/**
 * Утилиты для форматирования данных
 * Форматирование чисел, денег, дат и т.д.
 */

/**
 * Форматирует число как деньги
 * @param {number} value - Значение
 * @param {string} currency - Валюта (по умолчанию 'RUB')
 * @param {Object} options - Опции форматирования
 * @returns {string} Форматированная строка
 */
export function formatMoney(value, currency = 'RUB', options = {}) {
  const n = Number(value) || 0;
  const defaultOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    currency: currency,
    ...options,
  };

  try {
    return n.toLocaleString('ru-RU', defaultOptions);
  } catch (e) {
    // Fallback для старых браузеров
    return formatMoneyFallback(n, defaultOptions);
  }
}

/**
 * Fallback для форматирования денег
 * @param {number} value - Значение
 * @param {Object} options - Опции
 * @returns {string} Форматированная строка
 */
function formatMoneyFallback(value, options) {
  const n = Number(value) || 0;
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;

  const parts = n.toFixed(Math.max(minimumFractionDigits, maximumFractionDigits)).split('.');
  let integerPart = parts[0];
  let fractionalPart = parts[1] || '';

  // Форматируем целую часть (тысячи)
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Обрезаем дробную часть
  if (fractionalPart.length > maximumFractionDigits) {
    fractionalPart = fractionalPart.slice(0, maximumFractionDigits);
  }

  // Добавляем нули если нужно
  while (fractionalPart.length < minimumFractionDigits) {
    fractionalPart += '0';
  }

  return fractionalPart ? `${integerPart},${fractionalPart}` : integerPart;
}

/**
 * Форматирует число
 * @param {number} value - Значение
 * @param {Object} options - Опции
 * @returns {string} Форматированная строка
 */
export function formatNumber(value, options = {}) {
  const n = Number(value) || 0;
  const defaultOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
    ...options,
  };

  try {
    return n.toLocaleString('ru-RU', defaultOptions);
  } catch (e) {
    return String(n);
  }
}

/**
 * Форматирует процент
 * @param {number} value - Значение (0-1 или 0-100)
 * @param {boolean} asDecimal - true если значение в диапазоне 0-1
 * @returns {string} Форматированная строка
 */
export function formatPercent(value, asDecimal = false) {
  const n = Number(value) || 0;
  const percent = asDecimal ? n * 100 : n;
  return `${percent.toFixed(2)}%`;
}

/**
 * Форматирует дату
 * @param {Date|string} date - Дата
 * @param {Object} options - Опции
 * @returns {string} Форматированная строка
 */
export function formatDate(date, options = {}) {
  if (!date) return '';

  let dateObj;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return date; // Возвращаем как есть если не удается распарсить
    }
  } else {
    return '';
  }

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  try {
    return dateObj.toLocaleDateString('ru-RU', defaultOptions);
  } catch (e) {
    return dateObj.toISOString().slice(0, 10);
  }
}

/**
 * Форматирует время
 * @param {Date|string} date - Дата/время
 * @returns {string} Форматированная строка
 */
export function formatTime(date) {
  if (!date) return '';

  let dateObj;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return date;
    }
  } else {
    return '';
  }

  try {
    return dateObj.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (e) {
    return dateObj.toTimeString().slice(0, 8);
  }
}

/**
 * Форматирует тип ресурса
 * @param {string} type - Тип ресурса
 * @returns {string} Локализованное название
 */
export function formatResourceType(type) {
  const types = {
    labor: 'Работа',
    machine: 'Машина',
    material: 'Материал',
  };
  return types[type] || type;
}

/**
 * Форматирует единицу измерения
 * @param {string} unit - Единица измерения
 * @returns {string} Форматированная строка
 */
export function formatUnit(unit) {
  if (!unit) return '';

  const units = {
    'чел.-ч': 'чел.-ч',
    'маш.-ч': 'маш.-ч',
    т: 'т',
    м3: 'м³',
    м2: 'м²',
    м: 'м',
    шт: 'шт.',
    кг: 'кг',
    л: 'л',
  };

  return units[unit] || unit;
}

/**
 * Экранирует HTML
 * @param {string} str - Строка
 * @returns {string} Экранированная строка
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Укорочение строки
 * @param {string} str - Строка
 * @param {number} maxLength - Максимальная длина
 * @returns {string} Укороченная строка
 */
export function truncate(str, maxLength = 50) {
  if (!str) return '';
  const s = String(str);
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength - 3) + '...';
}

export default {
  formatMoney,
  formatNumber,
  formatPercent,
  formatDate,
  formatTime,
  formatResourceType,
  formatUnit,
  escapeHtml,
  truncate,
};
