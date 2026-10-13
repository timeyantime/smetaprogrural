/**
 * Сервис экспорта данных
 * Отвечает за экспорт в JSON, CSV, Excel
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
  lines.push(cols.map(col => getColumnLabel(col)).join(';'));

  // Данные
  for (const section of project.sections) {
    // Добавляем заголовок раздела
    lines.push(`;${section.name};;;;;;`);

    for (const resource of section.resources) {
      const formatted = Resource.formatForDisplay(resource);
      const row = cols.map(col => {
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
 * Экспортирует проект в Excel (XLSX)
 * Использует SpreadsheetML формат для совместимости
 * @param {Object} project - Проект
 * @param {Array} columns - Колонки для экспорта
 * @returns {Blob} Blob с Excel файлом
 */
export function exportToExcel(project, columns = null) {
  if (!Project.validate(project)) {
    throw new Error('Invalid project data');
  }

  const defaultColumns = ['basis', 'name', 'type', 'unit', 'qty', 'price', 'total', 'note'];
  const cols = columns || defaultColumns;

  // Создаем XML для Excel
  const buildSpreadsheetML = (sheetBlocks) => {
    const parts = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<?mso-application progid="Excel.Sheet"?>');
    parts.push('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
      ' xmlns:o="urn:schemas-microsoft-com:office:office"' +
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">');
    parts.push('<Styles>' +
      '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>' +
      '<Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1"/></Style>' +
      '<Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="10" ss:BOLD="1" ss:Color="#FFFFFF"/><Interior ss:Color="#172B4D" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
      '<Style ss:ID="Money"><NumberFormat ss:Format="#,##0.00"/><Alignment ss:Horizontal="Right"/></Style>' +
      '<Style ss:ID="Num"><NumberFormat ss:Format="#,##0.####"/><Alignment ss:Horizontal="Right"/></Style>' +
      '<Style ss:ID="Section"><Font ss:FontName="Calibri" ss:Size="11" ss:BOLD="1"/><Interior ss:Color="#DEEBFF" ss:Pattern="Solid"/></Style>' +
      '<Style ss:ID="Total"><Font ss:FontName="Calibri" ss:Size="11" ss:BOLD="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
      '</Styles>');

    for (const block of sheetBlocks) {
      parts.push(`<Worksheet ss:Name="${xmlEsc(block.name.slice(0, 31))}"><Table>`);
      for (const row of block.rows) {
        parts.push('<Row>');
        for (const cell of row) {
          if (cell == null) continue;
          const style = cell.s ? ` ss:StyleID="${cell.s}"` : '';
          if (cell.t === 's' || typeof cell.v === 'string') {
            parts.push(`<Cell${style}><Data ss:Type="String">${xmlEsc(cell.v)}</Data></Cell>`);
          } else if (typeof cell.v === 'number') {
            parts.push(`<Cell${style}><Data ss:Type="Number">${cell.v}</Data></Cell>`);
          } else {
            parts.push(`<Cell${style}/>`);
          }
        }
        parts.push('</Row>');
      }
      parts.push('</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"/></Worksheet>');
    }
    parts.push('</Workbook>');
    return parts.join('\n');
  };

  function xmlEsc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  // Создаем данные для Excel
  const sheetBlocks = [];

  // Лист с данными
  const dataRows = [];

  // Заголовок
  dataRows.push([{ v: project.title, s: 'Title', t: 's' }]);
  dataRows.push([]);

  // Заголовки колонок
  const headers = cols.map(col => ({ v: getColumnLabel(col), s: 'Header', t: 's' }));
  dataRows.push(headers);

  // Данные
  for (const section of project.sections) {
    // Заголовок раздела
    dataRows.push([{ v: section.name, s: 'Section', t: 's' }]);

    for (const resource of section.resources) {
      const formatted = Resource.formatForDisplay(resource);
      const row = cols.map(col => {
        const value = formatted[col] !== undefined ? formatted[col] : '';
        const style = ['price', 'total'].includes(col) ? 'Money' : 
                      ['qty', 'days'].includes(col) ? 'Num' : 'Default';
        return { v: value, s: style };
      });
      dataRows.push(row);
    }

    dataRows.push([]); // Пустая строка
  }

  // Итоги
  const totals = calculateTotals(project, cols);
  dataRows.push([{ v: 'ИТОГО', s: 'Total', t: 's' }]);
  dataRows.push(totals.map(val => ({ v: val, s: typeof val === 'number' ? 'Money' : 'Total', t: 's' })));

  sheetBlocks.push({ name: 'Смета', rows: dataRows });

  // Создаем XML
  const xml = buildSpreadsheetML(sheetBlocks);

  // Создаем Blob
  return new Blob([xml], { type: 'application/vnd.ms-excel' });
}

/**
 * Рассчитывает итоги для Excel
 * @param {Object} project - Проект
 * @param {Array} columns - Колонки
 * @returns {Array} Массив значений итогов
 */
function calculateTotals(project, columns) {
  const totals = {
    basis: '',
    name: '',
    type: '',
    unit: '',
    qty: 0,
    price: 0,
    total: 0,
    note: '',
  };

  if (!project.sections) {
    return Object.values(totals);
  }

  let laborTotal = 0;
  let machineTotal = 0;
  let materialTotal = 0;

  for (const section of project.sections) {
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
  }

  totals.total = laborTotal + machineTotal + materialTotal;

  return columns.map(col => {
    if (col === 'total') return totals.total;
    if (col === 'name') return 'ИТОГО';
    return '';
  });
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
  exportToExcel,
  downloadFile,
};
