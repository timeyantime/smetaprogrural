/**
 * Сметная программа — основной модуль приложения
 * 
 * Это основной файл, который инициализирует Alpine.js компонент
 * и связывает все модули вместе.
 * 
 * Зависимости:
 * - Alpine.js (внешний CDN)
 * - models/ (Project, Section, Resource)
 * - services/ (storage, calculation, export, validation)
 * - components/ (будут добавлены позже)
 */

// ============================================
// Импорт модулей
// ============================================

import { Project, migrateV3toV4 } from './models/Project.js';
import { Section } from './models/Section.js';
import { Resource } from './models/Resource.js';
import * as storage from './services/storage.js';
import * as calculation from './services/calculation.js';
import * as exportService from './services/export.js';
import * as validation from './services/validation.js';

// ============================================
// Константы
// ============================================

const PAGE_SIZE = 50;

// Ключи для localStorage (для совместимости)
const LS_KEY = storage.STORAGE_KEYS.DATA;
const LS_MIGRATE_FROM = storage.STORAGE_KEYS.MIGRATE_FROM;
const LS_NSB_KEY = storage.STORAGE_KEYS.NSB;
const LS_RESOURCES_KEY = storage.STORAGE_KEYS.RESOURCES;
const LS_UI_KEY = storage.STORAGE_KEYS.UI;
const LS_HISTORY_KEY = storage.STORAGE_KEYS.HISTORY;
const LS_COLS_KEY = storage.STORAGE_KEYS.COLS;
const LS_PRINT_KEY = storage.STORAGE_KEYS.PRINT;

// ============================================
// Утилиты
// ============================================

/**
 * Генерация уникального ID
 * @returns {string} Уникальный ID
 */
let uidCounter = 0;
function uid() {
  return `id-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;
}

/**
 * Безопасный parse JSON
 * @param {string} str - Строка JSON
 * @param {any} defaultValue - Значение по умолчанию
 * @returns {any} Разобраный JSON или defaultValue
 */
function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('JSON parse error:', e);
    return defaultValue;
  }
}

/**
 * Форматирование денег
 * @param {number} value - Значение
 * @returns {string} Форматированная строка
 */
function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* Локальная копия debounce удалена: дублировала simpleDebounce из
   utils/debounce.js и нигде в модуле не вызывалась. При необходимости
   используйте: import { simpleDebounce } from './utils/debounce.js'; */

// ============================================
// Загрузка данных
// ============================================

/**
 * Загрузка проекта
 * @returns {Object} Проект
 */
function loadLocal() {
  try {
    const data = localStorage.getItem(LS_KEY);
    if (data) {
      const project = JSON.parse(data);
      if (validation.validateProject(project).valid) {
        return project;
      }
    }

    // Миграция из старой версии
    const oldData = localStorage.getItem(LS_MIGRATE_FROM);
    if (oldData) {
      const migrated = migrateV3toV4(JSON.parse(oldData));
      storage.saveProject(migrated);
      localStorage.removeItem(LS_MIGRATE_FROM);
      return migrated;
    }

    return null;
  } catch (e) {
    console.error('Failed to load project:', e);
    return null;
  }
}

/**
 * Загрузка ресурсов НСБ
 * @returns {Array} Массив ресурсов НСБ
 */
function loadNsb() {
  try {
    const data = localStorage.getItem(LS_NSB_KEY);
    return data ? JSON.parse(data) : defaultNsb();
  } catch (e) {
    return defaultNsb();
  }
}

/**
 * Загрузка ресурсов
 * @returns {Array} Массив ресурсов
 */
function loadResources() {
  try {
    const data = localStorage.getItem(LS_RESOURCES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Загрузка активности
 * @returns {Array} Массив записей активности
 */
function loadActivity() {
  try {
    const data = localStorage.getItem(LS_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Дефолтные ресурсы НСБ
 * @returns {Array} Массив дефолтных ресурсов
 */
function defaultNsb() {
  return [
    Resource.create({
      id: uid(),
      basis: 'Гэсн 81-02-01-01-01',
      name: 'Разработка грунта экскаватором под фундаменты',
      type: 'labor',
      unit: 'чел.-ч',
      price: 250,
      note: 'Средний разряд рабочих',
    }),
    Resource.create({
      id: uid(),
      basis: 'Гэснр 81-02-01-01-01',
      name: 'Экскаватор одноковшовый 0,4 м³',
      type: 'machine',
      operator: true,
      unit: 'маш.-ч',
      price: 1450,
      note: 'Вкл. Тмр',
    }),
    Resource.create({
      id: uid(),
      basis: 'Гэсн 81-02-03-01-01',
      name: 'Устройство бетонных подготовок',
      type: 'labor',
      unit: 'чел.-ч',
      price: 275,
      note: '',
    }),
    Resource.create({
      id: uid(),
      basis: 'Фер 81-02-05-01-01',
      name: 'Монтаж фундаментных блоков',
      type: 'labor',
      unit: 'чел.-ч',
      price: 310,
      note: '',
    }),
    Resource.create({
      id: uid(),
      basis: 'Ресурс-01',
      name: 'Бетон В22.5 (м300)',
      type: 'material',
      unit: 'м3',
      price: 6200,
      note: 'ГОСТ 7473-2010',
    }),
    Resource.create({
      id: uid(),
      basis: 'Ресурс-02',
      name: 'Песок строительный',
      type: 'material',
      unit: 'т',
      price: 890,
      note: 'Карьер',
    }),
    Resource.create({
      id: uid(),
      basis: 'Ресурс-03',
      name: 'Щебень фр. 5-20 мм',
      type: 'material',
      unit: 'т',
      price: 1650,
      note: '',
    }),
    Resource.create({
      id: uid(),
      basis: 'Ресурс-04',
      name: 'Арматура А500С Ø12',
      type: 'material',
      unit: 'т',
      price: 62000,
      note: '',
    }),
    Resource.create({
      id: uid(),
      basis: 'Гэснм 81-03',
      name: 'Кран стреловой 25 т',
      type: 'machine',
      unit: 'маш.-ч',
      price: 3800,
      note: 'Вкл. Тмр',
    }),
  ];
}

/**
 * Дефолтные данные проекта
 * @returns {Object} Дефолтный проект
 */
function defaultData() {
  return Project.default();
}

// ============================================
// Основной компонент Alpine.js
// ============================================

/**
 * Основной компонент приложения
 * @returns {Object} Состояние компонента
 */
window.smeta = function smeta() {
  return {
    // ==========================================
    // Состояние
    // ==========================================

    // Данные проекта
    data: loadLocal() || defaultData(),

    // UI состояние
    filter: '',
    groupBy: 'none',
    activeTab: null,
    renamingSection: null,
    tabDragFrom: null,
    selectedIds: new Set(),
    editing: null,
    expandedRow: null,
    sidebarCollapsed: false,
    sectionModalOpen: false,
    sectionModalMode: 'create',
    sectionDraft: { name: '', index: null },
    recordModalOpen: false,
    recordDraft: null,
    sortState: { field: null, dir: 1 },
    multiSort: [],
    fieldMenuFor: null,
    savedFlash: false,
    lastSavedAt: null,

    // UI v4
    viewTab: 'table',
    groupCollapsed: {},
    page: 0,
    historyOpen: false,
    activityLog: loadActivity(),
    undoStack: [],
    redoStack: [],
    _histBusy: false,
    ctxMenu: null,
    batchBar: false,
    batchPrice: '',
    batchQty: '',
    batchUnit: '',
    darkTheme: false,
    calcModalOpen: false,
    projModalOpen: false,
    resModalOpen: false,
    resSearch: '',
    resources: loadResources(),
    dirty: false,
    ganttDrag: null,
    ganttLinkFrom: null,
    ganttLinkPath: null,

    // Настройки печати
    printOrientation: 'landscape',
    printModalOpen: false,
    printSettings: storage.loadPrintSettings(),

    // Модальные окна
    helpModalOpen: false,
    nsbModalOpen: false,
    nsbSearch: '',
    nsbItems: loadNsb(),
    nsbEditId: null,
    nsbDraft: null,

    // Колонки таблицы
    columns: [
      { key: 'num', label: '#', width: 44, min: 34, sortable: false },
      { key: 'basis', label: 'Обоснование', width: 120, min: 70, sortable: true },
      { key: 'name', label: 'Наименование работы и затрат', width: 300, min: 140, sortable: true },
      { key: 'type', label: 'Тип затрат', width: 150, min: 110, sortable: true },
      { key: 'unit', label: 'Ед. изм.', width: 90, min: 60, sortable: true },
      { key: 'qty', label: 'Кол-во', width: 100, min: 70, sortable: true },
      { key: 'price', label: 'Текущая цена, руб.', width: 120, min: 80, sortable: true },
      { key: 'total', label: 'Стоимость, руб.', width: 130, min: 90, sortable: true },
      { key: 'note', label: 'Примечание', width: 190, min: 90, sortable: true },
      { key: 'days', label: 'Длит., дни', width: 90, min: 60, sortable: true },
      { key: 'pred', label: 'Преемств.', width: 90, min: 60, sortable: true },
      { key: 'actions', label: '', width: 118, min: 118, sortable: false },
    ],

    // ==========================================
    // Вычисляемые свойства
    // ==========================================

    /**
     * Плоский список ресурсов со ссылками на разделы
     */
    get flatRows() {
      const result = [];
      for (let si = 0; si < this.data.sections.length; si++) {
        const section = this.data.sections[si];
        for (let ri = 0; ri < section.resources.length; ri++) {
          result.push({ si, row: section.resources[ri], section });
        }
      }
      return result;
    },

    /**
     * Отфильтрованные ресурсы
     */
    get filteredRows() {
      const f = this.filter.trim().toLowerCase();
      if (!f) return this.flatRows;

      return this.flatRows.filter(({ row }) => {
        return (
          row.name.toLowerCase().includes(f) ||
          row.basis.toLowerCase().includes(f) ||
          row.unit.toLowerCase().includes(f) ||
          row.note.toLowerCase().includes(f) ||
          String(row.qty).includes(f) ||
          String(row.price).includes(f)
        );
      });
    },

    /**
     * Отсортированные ресурсы
     */
    get sortedRows() {
      const rows = this.filteredRows;
      const sort = this.sortState;

      if (!sort.field) return rows;

      return [...rows].sort((a, b) => {
        const aVal = a.row[sort.field];
        const bVal = b.row[sort.field];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * sort.dir;
        }
        return String(aVal).localeCompare(String(bVal), 'ru') * sort.dir;
      });
    },

    /**
     * Пагинированные ресурсы
     */
    get pagedRows() {
      const start = this.page * PAGE_SIZE;
      return this.sortedRows.slice(start, start + PAGE_SIZE);
    },

    /**
     * Общее количество страниц
     */
    get totalPages() {
      return Math.ceil(this.sortedRows.length / PAGE_SIZE);
    },

    /**
     * Видимые колонки
     */
    visibleColumns() {
      return this.columns.filter((c) => !this.hiddenCols.includes(c.key));
    },

    /**
     * Проверяет, скрыта ли колонка
     */
    colHidden(key) {
      return this.hiddenCols.includes(key);
    },

    /**
     * Получает метку колонки
     */
    colLabel(key) {
      const col = this.columns.find((c) => c.key === key);
      return col ? col.label : key;
    },

    /**
     * Проверяет, отсортирована ли колонка
     */
    colSorted(key) {
      return this.sortState.field === key;
    },

    /**
     * Получает направление сортировки
     */
    sortDir() {
      return this.sortState.dir === 1 ? '↑' : '↓';
    },

    /**
     * Количество выбранных ресурсов
     */
    selectedCount() {
      return this.selectedIds.size;
    },

    /**
     * Проверяет, выбран ли ресурс
     */
    isSelected(rowId) {
      return this.selectedIds.has(rowId);
    },

    /**
     * Количество проблем (для значка)
     */
    problemCount() {
      return 0; // Будет реализовано позже
    },

    /**
     * Текст для кнопки сохранения
     */
    savedTimeText() {
      if (this.savedFlash) return 'Сохранено';
      if (this.lastSavedAt) {
        return `Сохранено: ${new Date(this.lastSavedAt).toLocaleTimeString('ru-RU')}`;
      }
      return 'Сохранить';
    },

    /**
     * Ключ ресурса для группировки
     */
    resKey(r) {
      return Resource.getKey(r);
    },

    /**
     * Уникальные ресурсы
     */
    get resourceIndex() {
      const map = new Map();
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          const k = this.resKey(r);
          if (!k) continue;
          if (!map.has(k)) {
            map.set(k, {
              key: k,
              name: r.name,
              type: r.type,
              unit: r.unit,
              prices: new Set(),
              uses: 0,
              sections: new Set(),
            });
          }
          const e = map.get(k);
          e.uses++;
          e.sections.add(sec.name);
          if (Number(r.price)) e.prices.add(Number(r.price));
        }
      }
      return map;
    },

    get uniqueResources() {
      const arr = [...this.resourceIndex.values()].map((e) => ({
        ...e,
        priceList: [...e.prices].sort((a, b) => a - b),
        sectionNames: [...e.sections],
      }));
      const f = this.resSearch.trim().toLowerCase();
      if (!f) return arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      return arr.filter((r) => 
        r.name.toLowerCase().includes(f) || 
        r.unit.toLowerCase().includes(f)
      );
    },

    // ==========================================
    // Инициализация
    // ==========================================

    init() {
      this.loadColWidths();
      this.loadUI();

      // Автосохранение при изменении данных
      this.$watch('data', () => {
        if (this.data.recalcMode === 'manual') {
          this.dirty = true;
        } else {
          this.saveLocal();
        }
      }, { deep: true });

      this.$watch('columns', () => this.saveColWidths(), { deep: true });
      this.$watch('multiSort', () => this.saveUI());
      this.$watch('hiddenCols', () => this.saveUI());
      this.$watch('darkTheme', () => {
        document.body.classList.toggle('theme-dark', this.darkTheme);
        this.saveUI();
      });
      this.$watch('viewTab', () => this.saveUI());

      document.body.classList.toggle('theme-dark', this.darkTheme);

      // Обработчики клавиш
      window.addEventListener('keydown', (e) => this.handleKeyDown(e));

      // Защита от закрытия с несохраненными изменениями
      window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));
    },

    // ==========================================
    // Обработчики клавиш
    // ==========================================

    handleKeyDown(e) {
      const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);

      // Escape - закрыть все модальные окна
      if (e.key === 'Escape') {
        this.editing = null;
        this.expandedRow = null;
        this.selectedIds = new Set();
        this.sectionModalOpen = false;
        this.fieldMenuFor = null;
        this.ctxMenu = null;
        this.helpModalOpen = false;
        this.printModalOpen = false;
        this.calcModalOpen = false;
        this.projModalOpen = false;
        this.resModalOpen = false;
        this.historyOpen = false;
        this.batchBar = false;
        this.ganttLinkFrom = null;
        this.ganttLinkPath = null;
        if (this.nsbModalOpen) this.cancelNsbEdit();
        this.nsbModalOpen = false;
        if (this.recordModalOpen) this.cancelRecordModal();
      }

      // Ctrl+A - выделить все
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !inField) {
        e.preventDefault();
        this.selectedIds = new Set(this.flatRows.map((i) => i.row.id));
      }

      // Ctrl+D - дублировать выбранный
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && this.selectedIds.size === 1) {
        const item = this.flatRows.find((i) => this.selectedIds.has(i.row.id));
        if (item) this.duplicateRowById(item.si, item.row.id);
      }

      // Ctrl+Z / Ctrl+Y - отмена/повтор
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault();
        e.shiftKey ? this.redoAction() : this.undoAction();
      }

      // Ctrl+Y - повтор
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inField) {
        e.preventDefault();
        this.redoAction();
      }

      // Ctrl+S - сохранить
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.manualSave();
      }

      // Стрелки вверх/вниз - навигация по таблице
      if (!inField && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        this.moveGridCursor(e.key === 'ArrowDown' ? 1 : -1);
      }

      // F2 - редактировать ячейку
      if (!inField && e.key === 'F2' && this.cursor >= 0) {
        e.preventDefault();
        const items = this.pagedRows;
        const item = items[Math.min(this.cursor, items.length - 1)];
        if (item) this.openCell('name', item);
      }

      // Delete - удалить выбранные
      if (!inField && e.key === 'Delete' && this.selectedIds.size) {
        e.preventDefault();
        this.removeSelected();
      }
    },

    handleBeforeUnload(e) {
      if (this.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    },

    // ==========================================
    // Работа с данными
    // ==========================================

    /**
     * Сохранение в localStorage
     */
    saveLocal() {
      try {
        storage.saveProject(this.data);
        this.lastSavedAt = Date.now();
        this.savedFlash = true;
        setTimeout(() => (this.savedFlash = false), 2000);
        this.dirty = false;
      } catch (e) {
        console.error('Failed to save:', e);
      }
    },

    /**
     * Ручное сохранение
     */
    manualSave() {
      this.saveLocal();
      this.logActivity('Сохранение сметы');
    },

    /**
     * Загрузка ширин колонок
     */
    loadColWidths() {
      const widths = storage.loadColumnWidths();
      for (const c of this.columns) {
        if (typeof widths[c.key] === 'number' && widths[c.key] >= c.min) {
          c.width = widths[c.key];
        }
      }
    },

    /**
     * Сохранение ширин колонок
     */
    saveColWidths() {
      const map = {};
      for (const c of this.columns) {
        map[c.key] = c.width;
      }
      storage.saveColumnWidths(map);
    },

    /**
     * Загрузка UI настроек
     */
    loadUI() {
      const ui = storage.loadUISettings();
      if (ui.darkTheme) this.darkTheme = true;
      if (Array.isArray(ui.multiSort)) this.multiSort = ui.multiSort;
      if (Array.isArray(ui.hiddenCols)) this.hiddenCols = ui.hiddenCols;
      if (['table', 'gantt', 'summary'].includes(ui.viewTab)) this.viewTab = ui.viewTab;
      if (ui.groupBy) this.groupBy = ui.groupBy;
    },

    /**
     * Сохранение UI настроек
     */
    saveUI() {
      storage.saveUISettings({
        darkTheme: this.darkTheme,
        multiSort: this.multiSort,
        hiddenCols: this.hiddenCols,
        viewTab: this.viewTab,
        groupBy: this.groupBy,
      });
    },

    // ==========================================
    // Работа с разделами
    // ==========================================

    /**
     * Создание нового раздела
     */
    createSection(name = 'Новый раздел') {
      const section = Section.create(name);
      this.data.sections.push(section);
      this.pushHistory(`Создан раздел "${name}"`);
      return section;
    },

    /**
     * Удаление раздела
     */
    removeSection(si) {
      const section = this.data.sections[si];
      this.data.sections.splice(si, 1);
      this.pushHistory(`Удален раздел "${section.name}"`);
    },

    /**
     * Переименование раздела
     */
    renameSection(si, newName) {
      const section = this.data.sections[si];
      const oldName = section.name;
      section.name = newName;
      this.pushHistory(`Переименован раздел "${oldName}" → "${newName}"`);
    },

    /**
     * Выбор раздела
     */
    selectTab(si) {
      this.activeTab = this.activeTab === si ? null : si;
    },

    // ==========================================
    // Работа с ресурсами
    // ==========================================

    /**
     * Создание нового ресурса
     */
    createResource(partial = {}) {
      return Resource.create(partial);
    },

    /**
     * Добавление ресурса в раздел
     */
    addResourceToSection(si, resource) {
      if (!this.data.sections[si]) return;
      this.data.sections[si].resources.push(resource);
      this.pushHistory(`Добавлен ресурс "${resource.name}" в "${this.data.sections[si].name}"`);
    },

    /**
     * Удаление ресурса
     */
    removeResource(si, ri) {
      const section = this.data.sections[si];
      const resource = section.resources[ri];
      section.resources.splice(ri, 1);
      this.pushHistory(`Удален ресурс "${resource.name}" из "${section.name}"`);
    },

    /**
     * Дублирование ресурса
     */
    duplicateRowById(si, rowId) {
      const section = this.data.sections[si];
      const resource = section.resources.find((r) => r.id === rowId);
      if (!resource) return;

      const duplicate = Resource.create({ ...resource, id: uid(), name: `${resource.name} (копия)` });
      section.resources.push(duplicate);
      this.pushHistory(`Дублирован ресурс "${resource.name}"`);
    },

    /**
     * Обновление ресурса
     */
    updateResource(si, ri, updates) {
      const section = this.data.sections[si];
      const resource = section.resources[ri];
      Object.assign(resource, updates);
      this.pushHistory(`Обновлен ресурс "${resource.name}"`);
    },

    // ==========================================
    // Экспорт/Импорт
    // ==========================================

    /**
     * Экспорт в JSON
     */
    exportJson() {
      const json = exportService.exportToJson(this.data);
      exportService.downloadFile(
        new Blob([json], { type: 'application/json' }),
        `${this.data.title || 'смета'}.json`
      );
      this.logActivity('Экспорт в JSON');
    },

    /**
     * Импорт из JSON
     */
    importJson(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const project = exportService.importFromJson(e.target.result);
          this.data = project;
          this.pushHistory('Импорт из JSON');
          this.logActivity('Импорт из JSON');
        } catch (error) {
          alert('Ошибка импорта: ' + error.message);
        }
      };
      reader.readAsText(file);
    },

    /**
     * Экспорт в CSV
     */
    exportCsv() {
      const csv = exportService.exportToCsv(this.data);
      exportService.downloadFile(
        new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
        `${this.data.title || 'смета'}.csv`
      );
      this.logActivity('Экспорт в CSV');
    },

    /**
     * Экспорт в Excel
     */
    exportXls() {
      const blob = exportService.exportToExcel(this.data);
      exportService.downloadFile(blob, `${this.data.title || 'смета'}.xls`);
      this.logActivity('Экспорт в Excel');
    },

    // ==========================================
    // История и Undo/Redo
    // ==========================================

    /**
     * Добавляет запись в историю
     */
    pushHistory(label) {
      if (this._histBusy) return;
      try {
        this.undoStack.push(JSON.stringify(this.data));
        if (this.undoStack.length > 60) this.undoStack.shift();
        this.redoStack = [];
        this.logActivity(label);
      } catch (e) {
        console.error('Failed to push history:', e);
      }
    },

    /**
     * Отмена действия
     */
    undoAction() {
      if (!this.undoStack.length) return;
      this._histBusy = true;
      this.redoStack.push(JSON.stringify(this.data));
      this.data = JSON.parse(this.undoStack.pop());
      this._histBusy = false;
      this.logActivity('Отмена действия');
    },

    /**
     * Повтор действия
     */
    redoAction() {
      if (!this.redoStack.length) return;
      this._histBusy = true;
      this.undoStack.push(JSON.stringify(this.data));
      this.data = JSON.parse(this.redoStack.pop());
      this._histBusy = false;
      this.logActivity('Повтор действия');
    },

    /**
     * Логирование активности
     */
    logActivity(text) {
      this.activityLog.unshift({ time: new Date().toLocaleTimeString('ru-RU'), text });
      if (this.activityLog.length > 100) this.activityLog.length = 100;
      storage.saveHistory(this.activityLog);
    },

    /**
     * Очистка активности
     */
    clearActivity() {
      this.activityLog = [];
      storage.clearAllData();
    },

    // ==========================================
    // Расчеты
    // ==========================================

    /**
     * Рассчитывает итоги по проекту
     */
    calculateTotals() {
      return calculation.calculateProjectTotals(this.data);
    },

    /**
     * Форматирует деньги
     */
    formatMoney(value) {
      return formatMoney(value);
    },

    // ==========================================
    // Утилиты
    // ==========================================

    /**
     * Переключение темной темы
     */
    toggleDarkTheme() {
      this.darkTheme = !this.darkTheme;
    },

    /**
     * Открытие модального окна помощи
     */
    openHelpModal() {
      this.helpModalOpen = true;
    },

    /**
     * Открытие модального окна НСБ
     */
    openNsb() {
      this.nsbModalOpen = true;
    },

    // ==========================================
    // Скрытые колонки
    // ==========================================

    hiddenCols: [],

    toggleColVisibility(key) {
      if (key === 'num' || key === 'name' || key === 'actions') return;
      this.hiddenCols = this.hiddenCols.includes(key)
        ? this.hiddenCols.filter((k) => k !== key)
        : [...this.hiddenCols, key];
      this.fieldMenuFor = null;
    },

    // ==========================================
    // Печать
    // ==========================================

    printCols() {
      return this.columns.filter((c) => c.key !== 'num' && c.key !== 'actions');
    },

    printColOn(key) {
      return this.printSettings.cols.includes(key);
    },

    togglePrintCol(key) {
      const arr = this.printSettings.cols;
      const i = arr.indexOf(key);
      if (i >= 0) arr.splice(i, 1); else arr.push(key);
      storage.savePrintSettings(this.printSettings);
    },

    savePrintSettings() {
      storage.savePrintSettings(this.printSettings);
    },

    openPrintModal() {
      this.printModalOpen = true;
    },

    // ==========================================
    // Прочие функции (заглушки для совместимости)
    // ==========================================

    // Эти функции будут реализованы позже
    startRenameSection(si) {},
    moveSectionByDrag(si) {},
    startResize(e, col) {},
    moveGridCursor(dir) {},
    openCell(field, item) {},
    removeSelected() {},
    cancelNsbEdit() {},
    cancelRecordModal() {},
    openProjectModal() {},
    openCalc() {},
    openResHub() {},
    openNsb() {},
  };
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  // Проверяем доступность localStorage
  if (!storage.isLocalStorageAvailable()) {
    alert('localStorage не доступен. Некоторые функции могут не работать.');
  }
});

export default smeta;
