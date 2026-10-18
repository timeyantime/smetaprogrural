/**
 * Сервис для работы с хранилищем (localStorage)
 * Отвечает за сохранение, загрузку и миграцию данных
 */

import { Project, migrateV3toV4 } from '../models/Project.js';
import {
  encodeValue as toonEncode,
  decodeValue as toonDecode,
  encodeProject as toonEncodeProject,
  decodeProject as toonDecodeProject,
} from '../toon.js';

/**
 * Ключи для localStorage
 */
export const STORAGE_KEYS = {
  DATA: 'smetapro.v4',
  MIGRATE_FROM: 'smetapro.v3',
  NSB: 'smetapro.nsb.v1',
  RESOURCES: 'smetapro.resources.v1',
  UI: 'smetapro.ui.v1',
  HISTORY: 'smetapro.history.v1',
  COLS: 'smetapro.v4.cols',
  PRINT: 'smetapro.print.v1',
};

/**
 * Сохраняет проект в localStorage
 * @param {Object} project - Проект для сохранения
 * @returns {boolean} true если сохранение успешно
 */
export function saveProject(project) {
  try {
    if (!Project.validate(project)) {
      console.error('Invalid project data');
      return false;
    }

    // Компактный блочный формат (TOON): экономия ~50% объёма localStorage.
    // При любой ошибке кодируем как раньше — данные не должны теряться.
    let data;
    try {
      data = toonEncodeProject(project);
      toonDecodeProject(data.slice('TOONP1:'.length)); // self-check roundtrip
    } catch (e) {
      data = JSON.stringify(project);
    }
    localStorage.setItem(STORAGE_KEYS.DATA, data);
    return true;
  } catch (error) {
    console.error('Failed to save project:', error);
    return false;
  }
}

/**
 * Загружает проект из localStorage
 * @returns {Object|null} Загруженный проект или null
 */
export function loadProject() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DATA);

    if (!data) {
      // Пробуем мигрировать из старой версии
      const oldData = localStorage.getItem(STORAGE_KEYS.MIGRATE_FROM);
      if (oldData) {
        const migrated = migrateV3toV4(JSON.parse(oldData));
        saveProject(migrated);
        localStorage.removeItem(STORAGE_KEYS.MIGRATE_FROM);
        return migrated;
      }
      return null;
    }

    // Автоопределение формата: компактный TOON-блок или классический JSON
    const project = data.startsWith('TOONP1:')
      ? toonDecodeProject(data.slice('TOONP1:'.length))
      : JSON.parse(data);

    if (!Project.validate(project)) {
      console.error('Invalid project data in storage');
      return null;
    }

    return project;
  } catch (error) {
    console.error('Failed to load project:', error);
    return null;
  }
}

/**
 * Удаляет проект из localStorage
 * @returns {boolean} true если удаление успешно
 */
export function deleteProject() {
  try {
    localStorage.removeItem(STORAGE_KEYS.DATA);
    return true;
  } catch (error) {
    console.error('Failed to delete project:', error);
    return false;
  }
}

/**
 * Сохраняет настройки UI
 * @param {Object} settings - Настройки UI
 * @returns {boolean} true если сохранение успешно
 */
export function saveUISettings(settings) {
  try {
    const data = JSON.stringify(settings);
    localStorage.setItem(STORAGE_KEYS.UI, data);
    return true;
  } catch (error) {
    console.error('Failed to save UI settings:', error);
    return false;
  }
}

/**
 * Загружает настройки UI
 * @returns {Object} Настройки UI
 */
export function loadUISettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.UI);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load UI settings:', error);
    return {};
  }
}

/**
 * Сохраняет историю действий
 * @param {Array} history - История действий
 * @returns {boolean} true если сохранение успешно
 */
export function saveHistory(history) {
  try {
    const data = toonEncode(STORAGE_KEYS.HISTORY, history);
    localStorage.setItem(STORAGE_KEYS.HISTORY, data);
    return true;
  } catch (error) {
    console.error('Failed to save history:', error);
    return false;
  }
}

/**
 * Загружает историю действий
 * @returns {Array} История действий
 */
export function loadHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? toonDecode(STORAGE_KEYS.HISTORY, data) : [];
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
}

/**
 * Сохраняет настройки печати
 * @param {Object} settings - Настройки печати
 * @returns {boolean} true если сохранение успешно
 */
export function savePrintSettings(settings) {
  try {
    const data = JSON.stringify(settings);
    localStorage.setItem(STORAGE_KEYS.PRINT, data);
    return true;
  } catch (error) {
    console.error('Failed to save print settings:', error);
    return false;
  }
}

/**
 * Загружает настройки печати
 * @returns {Object} Настройки печати
 */
export function loadPrintSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PRINT);
    if (data) {
      const settings = JSON.parse(data);
      if (settings && Array.isArray(settings.cols)) {
        return { cols: settings.cols, titleSheet: !!settings.titleSheet };
      }
    }
    return {
      cols: ['basis', 'name', 'type', 'unit', 'qty', 'price', 'total', 'note'],
      titleSheet: false,
    };
  } catch (error) {
    console.error('Failed to load print settings:', error);
    return {
      cols: ['basis', 'name', 'type', 'unit', 'qty', 'price', 'total', 'note'],
      titleSheet: false,
    };
  }
}

/**
 * Сохраняет ширину колонок
 * @param {Object} widths - Ширины колонок
 * @returns {boolean} true если сохранение успешно
 */
export function saveColumnWidths(widths) {
  try {
    const data = JSON.stringify(widths);
    localStorage.setItem(STORAGE_KEYS.COLS, data);
    return true;
  } catch (error) {
    console.error('Failed to save column widths:', error);
    return false;
  }
}

/**
 * Загружает ширину колонок
 * @returns {Object} Ширины колонок
 */
export function loadColumnWidths() {
  try {
    const data =
      localStorage.getItem(STORAGE_KEYS.COLS) || localStorage.getItem('smetapro.v3.cols');
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load column widths:', error);
    return {};
  }
}

/**
 * Проверяет доступность localStorage
 * @returns {boolean} true если localStorage доступен
 */
export function isLocalStorageAvailable() {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Очищает все данные приложения
 * @returns {boolean} true если очистка успешна
 */
export function clearAllData() {
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    console.error('Failed to clear all data:', error);
    return false;
  }
}

export default {
  saveProject,
  loadProject,
  deleteProject,
  saveUISettings,
  loadUISettings,
  saveHistory,
  loadHistory,
  savePrintSettings,
  loadPrintSettings,
  saveColumnWidths,
  loadColumnWidths,
  isLocalStorageAvailable,
  clearAllData,
};
