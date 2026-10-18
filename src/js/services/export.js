/**
 * Сервис экспорта данных
 * Отвечает за экспорт в JSON и CSV (Excel удалён по требованию)
 */

import { Project } from '../models/Project.js';
import { Resource } from '../models/Resource.js';
/**
 * Экспортирует проект в JSON
 * @param {Object} project - Проект
 * @returns {string} JSON строка
 */
export function exportToJson(project) {
  if (!Project.validate(project)) {
    throw new Error('Invalid project data');
  }

  return JSON.stringify(project, null, 2);
}

/**
 * Импортирует проект из JSON
 * @param {string} jsonString - JSON строка
 * @returns {Object} Проект
 */
export function importFromJson(jsonString) {
  try {
    const project = JSON.parse(jsonString);
    if (!Project.validate(project)) {
      throw new Error('Invalid project data in JSON');
    }
    return project;
  } catch (error) {
    console.error('Failed to import JSON:', error);
    throw error;
  }
}

/**
 * Экспортирует проект в CSV
 * @param {Object} project - Проект
 * @param {Array} columns - Колонки для экспорта
 * @returns {string} CSV строка
 */
export function exportToCsv(project, columns = null) {
  if (!Project.validate(project)) {
    throw new Error('Invalid project data');
  }

  const defaultColumns = ['basis', 'name', 'type', 'unit', 'qty', 'price', 'total', 'note'];
  const cols = columns || defaultColumns;

  const lines = [];

  // Заголовок
  lines.push(cols.map((col) => getColumnLabel(col)).join(';'));

  // Данные
  for (const section of project.sections) {
    // Добавляем заголовок раздела
    lines.push(`;${section.name};;;;;;`);

    for (const resource of section.resources) {
      const formatted = Resource.formatForDisplay(resource);
      const row = cols.map((col) => {
        const value = formatted[col] !== undefined ? formatted[col] : '';
        return formatCsvValue(value);
      });
      lines.push(row.join(';'));
    }

    // Пустая строка между разделами
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Импортирует ресурсы из CSV
 * @param {string} csvString - CSV строка
 * @returns {Array} Массив ресурсов
 */
export function importFromCsv(csvString) {
  const resources = [];
  const lines = csvString.split('\n');

  // Пропускаем заголовок
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    try {
      const resource = Resource.fromCSV(line);
      resources.push(resource);
    } catch (error) {
      console.error(`Failed to parse CSV line ${i}:`, error);
    }
  }

  return resources;
}

/**
 * Получает метку колонки
 * @param {string} key - Ключ колонки
 * @returns {string} Метка колонки
 */
function getColumnLabel(key) {
  const labels = {
    basis: 'Обоснование',
    name: 'Наименование работы и затрат',
    type: 'Тип затрат',
    unit: 'Ед. изм.',
    qty: 'Кол-во',
    price: 'Текущая цена, руб.',
    total: 'Стоимость, руб.',
    note: 'Примечание',
    days: 'Длит., дни',
    pred: 'Преемств.',
  };
  return labels[key] || key;
}

/**
 * Форматирует значение для CSV
 * @param {any} value - Значение
 * @returns {string} Форматированное значение
 */
function formatCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Скачивает файл
 * @param {Blob} blob - Blob для скачивания
 * @param {string} filename - Имя файла
 */
export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  exportToJson,
  importFromJson,
  exportToCsv,
  importFromCsv,
  downloadFile,
};
