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

import { Project, migrateV3toV4 } from './models/Project.ts';
import { Section } from './models/Section.ts';
import { Resource } from './models/Resource.ts';
import * as storage from './services/storage.ts';
import * as calculation from './services/calculation.ts';
import * as framework from './framework.ts';
import * as exportService from './services/export.ts';
import * as validation from './services/validation.ts';
import { roundMoney, ROUND_MODES, ROUND_METHODS } from './rounding.ts';
import { xmlEsc, svgToPng } from './office.ts';
import {
  encodeValue as toonEncode,
  decodeValue as toonDecode,
  toFile as toonToFile,
  fromFile as toonFromFile,
} from './toon.ts';
import { formatMoney } from './utils/formatters.ts';

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

// Форматирование денег — единая реализация в utils/formatters.js (см. импорт выше).

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
      const project = toonDecode(LS_KEY, data);
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
    return data ? toonDecode(LS_NSB_KEY, data) : defaultNsb();
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
    return data ? toonDecode(LS_RESOURCES_KEY, data) : [];
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
    return data ? toonDecode(LS_HISTORY_KEY, data) : [];
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
      basis: 'ФЕРр-81-02-14-01-01',
      name: 'Монтаж каркаса ЛСТК (стенки, перекрытия)',
      type: 'labor',
      unit: 'чел.-ч',
      price: 320,
      note: 'ЗП_база; в расчёте применяется наценка ×1.20 (k_ночн — при ночь/праздник)',
    }),
    Resource.create({
      id: uid(),
      basis: 'НСБ-МТЛ-ЛСТК-01',
      name: 'Профиль ЛСТК C90x50x3 мм',
      type: 'material',
      unit: 'м.п.',
      price: 410,
      wasteGroup: 'metal',
      perUnit: 385,
      unitMassT: 0.0043,
      vehicleCapT: 10,
      distanceKm: 45,
      tariffPerKm: 95,
      supplyFee: 1500,
      manipulatorFlag: true,
      unloadMachineHr: 1200,
      unloadHours: 0.5,
      perPct: 4,
      storePct: 2,
      storeOn: true,
      note: 'p_полн = p_отп + перевозка + разгрузка + П + Х (тара/погрузка — поставщик)',
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
// Фабрики записей (используются методами smeta())
// ============================================

/** Ключ ресурса для дедупликации в справочнике ресурсов (тонкая обёртка над Resource.getKey) */
function resKey(r) {
  return Resource.getKey(r);
}

/** Новый пустой раздел (модель Section + поле children для глав) */
function newSection(name) {
  return Section.create(name);
}

/** Новая запись ресурса с полями планирования (days/pred/startAt/operator) */
function newRow(partial = {}) {
  return Object.assign(
    Resource.create({}),
    {
      days: null,
      pred: '',
      startAt: null,
      operator: false,
    },
    partial
  );
}

/** Копирует каркасные метаданные (нормы отходов, логистика, ночь/праздник) из записи НСБ в строку сметы. */
function copyFrameworkFields(from, to) {
  const KEYS = [
    'wasteGroup',
    'perUnit',
    'unitMassT',
    'vehicleCapT',
    'distanceKm',
    'tariffPerKm',
    'supplyFee',
    'kGabarit',
    'manipulatorFlag',
    'unloadMachineHr',
    'unloadHours',
    'moveDistM',
    'moveSpeedMh',
    'perPct',
    'storePct',
    'perOn',
    'storeOn',
    'night',
    'holiday',
  ];
  for (const k of KEYS) {
    if (from[k] !== undefined && from[k] !== null) to[k] = from[k];
  }
}

/**
 * Разбор строки предшественников в формате MS Project: «2», «FS:2», «SS:3,FF:5».
 * Тип по умолчанию — FS (Finish-to-Start). Нераспознанные токены игнорируются.
 */
export function parsePredRefs(text) {
  const out = [];
  for (const part of String(text || '').split(/[,\s;]+/)) {
    if (!part) continue;
    const m = part.match(/^(?:(FS|SS|FF|SF):)?(\d+)$/i);
    if (m) out.push({ type: (m[1] || 'FS').toUpperCase(), num: parseInt(m[2]) });
  }
  return out;
}

/** Обратная сериализация связей в строку поля pred («3» для FS — компактно, как в MS Project) */
function formatPredRefs(refs) {
  return refs.map((r) => (r.type === 'FS' ? String(r.num) : `${r.type}:${r.num}`)).join(',');
}

/** Стартовая дата сметы по умолчанию (сегодня) */
function defaultStartDate() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================
// Основной компонент Alpine.js
// ============================================

/**
 * Основной компонент приложения
 * @returns {Object} Состояние компонента
 */
// Реестр инструментов главного экрана («Home»).
// Пока здесь только «Смета»; будущие инструменты добавляются в конец массива.
export const TOOLS = [
  {
    id: 'smeta',
    icon: '📋',
    name: 'Смета',
    description:
      'Таблица разделов и записей, сводная ведомость ресурсов, диаграмма Ганта. Данные хранятся локально в браузере.',
    meta: 'Основной инструмент',
  },
];

window.smeta = function smeta() {
  return {
    // ==========================================
    // Состояние
    // ==========================================

    // Главный экран: 'home' (карточки инструментов) | 'app' (смета)
    screen: 'home',
    tools: TOOLS,

    // Данные проекта
    data: loadLocal() || defaultData(),

    // Сводная ведомость ресурсов (вид «Сводка»)
    // Группировки и сортировки запрещены — сводка всегда плоская.
    summarySearch: '',

    // Гант: подсветка критического пути (#49)
    ganttCritical: false,

    // Боковая панель истории: problems | log
    historyTab: 'problems',

    // UI состояние
    filter: '',
    activeTab: null,
    renamingSection: null,
    tabDragFrom: null,
    tabDragOver: null, // si вкладки-цели при drag&drop разделов (подсветка drop-зоны)
    selectedIds: new Set(),
    editing: null,
    expandedRow: null,
    sidebarCollapsed: true, // по умолчанию свёрнута — панель прячется полностью (кнопка «Показать сводку» / ручка ◀)
    sectionModalOpen: false,
    sectionModalMode: 'create',
    sectionDraft: { name: '', index: null },
    recordModalOpen: false,
    recordDraft: null,
    fieldMenuFor: null,
    savedFlash: false,
    lastSavedAt: null,

    // UI v4
    viewTab: 'table',
    page: 0,
    historyOpen: false,
    dragRow: null, // drag&drop строк между разделами (#26)
    activityLog: loadActivity(),
    undoStack: [],
    redoStack: [],
    _histBusy: false,
    ctxMenu: null,
    batchBar: false,
    batchPrice: '',
    batchQty: '',
    batchUnit: '',
    cursor: -1,
    calcTab: 'labor',
    calc: {
      volume: 100, // объём работ в единице из сметы
      normTime: 1.2, // чел-ч (или machine-часы) на единицу объёма
      crewSize: 3, // бригада, чел. (для машин — звено механизаторов)
      shiftsPerDay: 1, // смен в день
      hoursPerShift: 8, // часов в смене
      ratePerHour: 250, // стоимость одного чел-ч / маш-ч, руб.
      days: null, // обратный расчёт: задан срок → подобрать состав
    },
    calcModalOpen: false,
    projModalOpen: false,
    resModalOpen: false,
    resSearch: '',
    resources: loadResources(),
    dirty: false,
    ganttDrag: null,
    ganttLinkFromId: null as number | string | null, // id строки-источника рисования связи (id, а не прокси-объект — сравнение через === с Alpine-прокси было ненадёжным)
    ganttHoverTargetId: null as number | string | null, // id работы под курсором при рисовании (подсветка цели)
    ganttLinkPath: null as string | null,
    ganttLinkType: 'FS' as 'FS' | 'SS' | 'FF' | 'SF', // тип создаваемой связи (переключатель в тулбаре Ганта, как в MS Project)
    rowDropTarget: null, // { key: 'si|id', pos: 'above'|'below' } — подсветка drop-зоны строки
    droppedRowId: null, // id переставленной строки — зелёная вспышка row-dropped после drop

    // Настройки печати
    printOrientation: 'landscape',
    printModalOpen: false,
    printSettings: storage.loadPrintSettings(),

    // Модальные окна
    helpModalOpen: false,
    topMenuOpen: false, // выпадающее меню «Меню» в шапке (GitHub-style)
    sectionDropdownOpen: false, // список разделов «раскрыть вверх» (AutoCAD-листы, внизу таблицы)
    nsbModalOpen: false,
    nsbSearch: '',
    nsbItems: loadNsb(),
    nsbEditId: null,
    nsbDraft: null,

    // Колонки таблицы (сортировка запрещена — порядок ручной / разделами)
    columns: [
      { key: 'num', label: '#', width: 44, min: 34 },
      { key: 'basis', label: 'Обоснование', width: 120, min: 70 },
      { key: 'name', label: 'Наименование работы и затрат', width: 300, min: 140 },
      { key: 'type', label: 'Тип затрат', width: 150, min: 110 },
      { key: 'unit', label: 'Ед. изм.', width: 90, min: 60 },
      { key: 'qty', label: 'Кол-во', width: 100, min: 70 },
      { key: 'price', label: 'Текущая цена, руб.', width: 120, min: 80 },
      { key: 'total', label: 'Стоимость, руб.', width: 130, min: 90 },
      { key: 'note', label: 'Примечание', width: 190, min: 90 },
      { key: 'days', label: 'Длит., дни', width: 90, min: 60 },
      { key: 'pred', label: 'Преемств.', width: 90, min: 60 },
      { key: 'actions', label: '', width: 118, min: 118 },
    ],

    // ==========================================
    // Вычисляемые свойства
    // ==========================================

    /**
     * Плоский список ресурсов со ссылками на разделы
     */
    get flatRows() {
      const result = [];
      // Область просмотра: активный раздел (или все разделы при activeTab === null)
      const scope = this.scopedSections;
      for (const { sec, si } of scope) {
        for (let ri = 0; ri < sec.resources.length; ri++) {
          result.push({ si, row: sec.resources[ri], section: sec });
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
     * Плоский список ресурсов текущей области просмотра.
     * ⛔ Сортировки и группировки запрещены (см. README «⛔ Запрещено»):
     *    порядок только ручной (перетаскивание/↑↓) и разделами сметы.
     */
    get flatViewRows() {
      return this.filteredRows;
    },

    /**
     * Пагинированные ресурсы (50 строк на страницу)
     */
    get pagedRows() {
      const start = this.page * PAGE_SIZE;
      return this.flatViewRows.slice(start, start + PAGE_SIZE);
    },

    /**
     * Общее количество страниц
     */
    get totalPages() {
      return Math.ceil(this.flatViewRows.length / PAGE_SIZE);
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

    /* ---------- проблемы сметы (#10, перенос legacy — фаза 1) ---------- */

    get problems() {
      const list = [];
      let n = 0;
      for (let si = 0; si < this.data.sections.length; si++) {
        const sec = this.data.sections[si];
        if (!sec.name.trim())
          list.push({ sev: 'warn', text: `Раздел ${si + 1}: пустое название`, si });
        for (const r of sec.resources) {
          n++;
          const label = `№${n} «${(r.name || '').trim() || 'без наименования'}»`;
          if (!(String(r.name).trim() || String(r.basis).trim()))
            list.push({
              sev: 'err',
              text: `${label}: пустая запись (нет ни наименования, ни обоснования)`,
              si,
              id: r.id,
            });
          else {
            if (!String(r.basis).trim())
              list.push({
                sev: 'warn',
                text: `${label}: нет обоснования (шифра расценки)`,
                si,
                id: r.id,
              });
            if ((Number(r.price) || 0) <= 0)
              list.push({
                sev: 'err',
                text: `${label}: цена ≤ 0 — стоимость не формируется`,
                si,
                id: r.id,
              });
            if ((Number(r.qty) || 0) <= 0)
              list.push({ sev: 'warn', text: `${label}: количество ≤ 0`, si, id: r.id });
            if (!String(r.unit).trim())
              list.push({
                sev: 'warn',
                text: `${label}: не указана единица измерения`,
                si,
                id: r.id,
              });
          }
        }
      }
      return list;
    },

    /**
     * Количество проблем (для значка), опционально с фильтром по severity
     */
    problemCount(sev) {
      return this.problems.filter((p) => !sev || p.sev === sev).length;
    },

    goToProblem(p) {
      this.activeTab = null;
      this.page = 0;
      if (p.si !== null && p.si !== undefined) {
        // модульный selectTab переключает вкладку — в legacy здесь прямое присваивание
        this.activeTab = p.si;
        this.selectedIds = new Set();
      }
      if (p.id) this.selectedIds = new Set([p.id]);
      this.historyOpen = false;
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
      return arr.filter(
        (r) => r.name.toLowerCase().includes(f) || r.unit.toLowerCase().includes(f)
      );
    },

    // ==========================================
    // Инициализация
    // ==========================================

    init() {
      this.loadColWidths();
      this.loadUI();

      // Автосохранение при изменении данных
      this.$watch(
        'data',
        () => {
          // любое изменение сметы (работы, длительности, связи pred, даты) —
          // пересчитываем диаграмму Ганта при следующем обращении (см. _ganttCache)
          this.invalidateGantt();
          if (this.data.recalcMode === 'manual') {
            this.dirty = true;
          } else {
            this.saveLocal();
          }
        },
        { deep: true }
      );

      this.$watch('activeTab', () => this.invalidateGantt());
      this.$watch('viewTab', () => this.invalidateGantt());
      this.$watch('ganttCritical', () => this.invalidateGantt());
      this.$watch('columns', () => this.saveColWidths(), { deep: true });
      this.$watch('hiddenCols', () => this.saveUI());
      this.$watch('sidebarCollapsed', () => this.saveUI());
      // загрузка/замена проекта целиком (deep-подписка на 'data' не срабатывает
      // при замене ссылки на объект) — тоже инвалидируем кэш диаграммы
      this.$watch('data', () => this.invalidateGantt());

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
        this.ganttLinkFromId = null;
        this.ganttHoverTargetId = null;
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
      // Запоминаем, в каком экране находился пользователь (home | app)
      if (ui.screen === 'home' || ui.screen === 'app') this.screen = ui.screen;
      if (Array.isArray(ui.hiddenCols)) this.hiddenCols = ui.hiddenCols;
      if (['table', 'gantt', 'summary'].includes(ui.viewTab)) this.viewTab = ui.viewTab;
      // Состояние сводной панели: запоминаем; на первый запуск — открыта на широких экранах
      if (typeof ui.sidebarCollapsed === 'boolean') this.sidebarCollapsed = ui.sidebarCollapsed;
      else if (typeof window !== 'undefined') this.sidebarCollapsed = !(window.innerWidth >= 1200);
    },

    /**
     * Сохранение UI настроек
     */
    saveUI() {
      storage.saveUISettings({
        screen: this.screen,
        hiddenCols: this.hiddenCols,
        viewTab: this.viewTab,
        sidebarCollapsed: this.sidebarCollapsed,
      });
    },

    // ==========================================
    // Главный экран (карточки инструментов)
    // ==========================================

    openTool(id) {
      if (!this.tools.some((t) => t.id === id)) return;
      this.screen = 'app';
      this.saveUI();
    },

    goHome() {
      this.manualSave();
      this.screen = 'home';
      this.saveUI();
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
      // Клик по активной вкладке — возврат к списку «Все разделы» (Airtable-поведение).
      // Смена раздела = мгновенная смена области просмотра таблицы + сброс пагинации.
      this.activeTab = this.activeTab === si ? null : si;
      this.page = 0;
    },

    /**
     * Выбор раздела из выпадающего списка (как листы в AutoCAD):
     * всегда переключает на выбранный, без «тоггла» при повторном клике.
     */
    selectSection(si) {
      this.activeTab = si;
      this.page = 0;
      this.sectionDropdownOpen = false;
    },

    /** Количество записей в разделе (для бейджей в списке разделов). */
    sectionRecordCount(si) {
      const sec = this.data.sections[si];
      if (!sec) return 0;
      return sec.resources.length;
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

      const duplicate = Resource.create({
        ...resource,
        id: uid(),
        name: `${resource.name} (копия)`,
      });
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
     * Экспорт в TOON (.toon — компактный табличный формат вместо JSON)
     */
    exportJson() {
      const toon = toonToFile(this.data);
      exportService.downloadFile(
        new Blob([toon], { type: 'text/plain;charset=utf-8;' }),
        `${this.data.title || 'смета'}.toon`
      );
      this.logActivity('Экспорт в TOON');
    },

    /**
     * Импорт из TOON (.toon; legacy .json с объектом внутри тоже принимается)
     */
    importJson(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const project = toonFromFile(e.target.result);
          if (!Project.validate(project)) throw new Error('некорректные данные проекта');
          this.data = project;
          this.pushHistory('Импорт из TOON');
          this.logActivity('Импорт из TOON');
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

    /** Округление итоговой статьи согласно правилам модели округления (#11) */
    rnd(v) {
      const r = this.data.rounding || { mode: 'kopecks', method: 'math' };
      return roundMoney(v, r.mode, r.method);
    },

    /**
     * Итоги сметы с применением округления по Методике № 421/пр (п. 58).
     * Расчёты идут с полной точностью; округляются только итоговые статьи.
     * Каркасный метод v2.0 — единственный расчёт в программе (старый путь с НДС удалён):
     * S = ПЗ + НР + СП + ЛЗ + Нал − Возвр (без НДС).
     */
    get sums() {
      const fw = calculation.calculateFrameworkTotals(this.data);
      return {
        labor: fw.labor,
        machine: fw.machine,
        operator: 0,
        material: fw.material,
        pz: fw.pz,
        nr: fw.nr,
        sp: fw.sp,
        lz: fw.lz,
        lzParts: fw.lzParts,
        tax: fw.tax,
        vehicleTax: fw.vehicleTax,
        returnable: fw.returnable,
        sNoTax: fw.sNoTax,
        grand: fw.grand,
        framework: true,
      };
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
     * Открытие модального окна помощи
     */
    openHelpModal() {
      this.helpModalOpen = true;
    },

    /** Открытие справочника НСБ (сброс состояния редактирования) */
    openNsb() {
      this.nsbModalOpen = true;
      this.nsbEditId = null;
      this.nsbDraft = null;
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
      if (i >= 0) arr.splice(i, 1);
      else arr.push(key);
      storage.savePrintSettings(this.printSettings);
    },

    savePrintSettings() {
      storage.savePrintSettings(this.printSettings);
    },

    openPrintModal() {
      this.printModalOpen = true;
    },

    // ==========================================
    // Прочие UI-функции (перенесены из legacy js/app.js)
    // ==========================================

    /** Переименование раздела inline (F2/клик по имени вкладки) */
    startRenameSection(si) {
      this.renamingSection = si;
      this.$nextTick(() => {
        const el = document.querySelector<HTMLInputElement>('.at-tab-wrap .at-tab-rename');
        if (el) {
          el.focus();
          el.select();
        }
      });
    },

    /** Перемещение вкладки раздела drag&drop */
    moveSectionByDrag(targetSi) {
      if (this.tabDragFrom === null || this.tabDragFrom === targetSi) return;
      const arr = this.data.sections;
      const [moved] = arr.splice(this.tabDragFrom, 1);
      arr.splice(targetSi, 0, moved);
      this.activeTab = null;
      this.tabDragFrom = null;
    },

    /** Ресайз колонки таблицы за край заголовка */
    startResize(e, col) {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = col.width;
      document.body.style.userSelect = 'none';
      const onMove = (ev) => {
        col.width = Math.max(col.min, startW + ev.clientX - startX);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },

    /** Перемещение курсора таблицы стрелками ↑/↓ */
    moveGridCursor(delta) {
      const items = this.pagedRows;
      if (!items.length) return;
      this.cursor = Math.max(0, Math.min(items.length - 1, this.cursor + delta));
      const item = items[this.cursor];
      if (item) this.selectedIds = new Set([item.row.id]);
    },

    /** Открытие ячейки на редактирование */
    openCell(field, item) {
      this.editing = { key: item.row.id + '|' + field };
    },

    /** Стоимость всех выделенных записей (показывается в сайдбаре, SPEC «UI v2») */
    selectedCost() {
      let s = 0;
      if (!this.selectedIds.size) return 0;
      for (const sec of this.data.sections)
        for (const r of sec.resources) if (this.selectedIds.has(r.id)) s += this.rowTotal(r);
      return s;
    },

    /** Удаление выделенных записей */
    removeSelected() {
      if (!this.selectedIds.size) return;
      if (!confirm(`Удалить выделенные записи (${this.selectedIds.size})?`)) return;
      this.pushHistory(`Удалено записей: ${this.selectedIds.size}`);
      for (const sec of this.data.sections)
        sec.resources = sec.resources.filter((r) => !this.selectedIds.has(r.id));
      this.selectedIds = new Set();
    },

    /** Отмена редактирования элемента НСБ (пустая новая запись удаляется) */
    cancelNsbEdit() {
      if (this.nsbEditId && this.nsbDraft && !String(this.nsbDraft.name || '').trim()) {
        const idx = this.nsbItems.findIndex((n) => n.id === this.nsbEditId);
        if (idx >= 0) {
          this.nsbItems.splice(idx, 1);
          this.saveNsb();
        }
      }
      this.nsbEditId = null;
      this.nsbDraft = null;
    },

    /** Сохранение базы НСБ в localStorage */
    saveNsb() {
      try {
        localStorage.setItem(LS_NSB_KEY, toonEncode(LS_NSB_KEY, this.nsbItems));
      } catch (e) {
        /* ignore */
      }
    },

    /** Текущая строка формы записи (для модалки редактирования) */
    get recordRow() {
      if (!this.recordModalOpen || !this.recordDraft) return null;
      const sec = this.data.sections[this.recordDraft.si];
      if (!sec) return null;
      return sec.resources.find((r) => r.id === this.recordDraft.rowId) || null;
    },

    /** Открытие модалки формы новой записи */
    openAddRecordModal() {
      let si =
        this.activeTab === null
          ? this.data.sections.length
            ? this.data.sections.length - 1
            : null
          : this.activeTab;
      if (si === null || !this.data.sections[si]) {
        this.addSection();
        si = this.data.sections.length - 1;
      }
      this.pushHistory('Новая запись (форма)');
      const row = Resource.create({ type: 'material' });
      this.data.sections[si].resources.push(row);
      this.recordDraft = { si, rowId: row.id };
      this.recordModalOpen = true;
    },

    /** Отмена модалки записи (пустая новая запись удаляется) */
    cancelRecordModal() {
      const row = this.recordRow;
      if (
        row &&
        !(
          String(row.name).trim() ||
          String(row.basis).trim() ||
          Number(row.qty) ||
          Number(row.price)
        )
      ) {
        const sec = this.data.sections[this.recordDraft.si];
        const idx = sec.resources.indexOf(row);
        if (idx >= 0) sec.resources.splice(idx, 1);
      }
      this.recordModalOpen = false;
      this.recordDraft = null;
    },

    /** Синхронизация цены ресурса во всех записях с тем же ключом */
    syncResourcePrice(row) {
      if (this.data.recalcMode === 'manual') return; // ручной режим — не трогаем остальные (#48)
      const k = this.resKey(row);
      if (!k) return;
      for (const sec of this.data.sections)
        for (const r of sec.resources) if (r !== row && this.resKey(r) === k) r.price = row.price;
    },

    /** Обработка правки цены в ячейке */
    onPriceEdited(row) {
      this.syncResourcePrice(row);
      this.logActivity(`Цена «${(row.name || '').slice(0, 40)}» → ${row.price}`);
    },

    /** Сквозной номер записи по flatRows (для предшественника по номеру) */
    rowNumber(rowId) {
      const i = this.flatRows.findIndex((it) => it.row.id === rowId);
      return i >= 0 ? i + 1 : null;
    },

    /** Установка предшественника по его номеру (#49) */
    setPredByNumber(row, numText) {
      // Разрешаем несколько связей и типы: «2», «FS:2», «SS:3,FF:5» (формат MS Project)
      const refs = parsePredRefs(numText);
      if (!refs.length) {
        row.pred = '';
        return;
      }
      const parts = [];
      for (const ref of refs) {
        const target = this.flatRows[ref.num - 1];
        if (!target || target.row.id === row.id) continue;
        const n = this.rowNumber(target.row.id);
        if (n === null || n === undefined) continue;
        parts.push(ref.type === 'FS' ? String(n) : `${ref.type}:${n}`);
      }
      row.pred = parts.join(',');
    },

    /** Добавить тип связи к существующему предшественнику строки (цикл FS→SS→FF→SF, как в drawio/MS Project) */
    cyclePredType(row) {
      const refs = parsePredRefs(row.pred);
      if (!refs.length) return false;
      const order = ['FS', 'SS', 'FF', 'SF'];
      const r = refs[0];
      r.type = order[(order.indexOf(r.type) + 1) % 4];
      row.pred = formatPredRefs(refs);
      return true;
    },

    // ==========================================
    // Перенесено из legacy — фаза 1 (см. docs/MIGRATION.md)
    // ==========================================

    /* ---------- форматирование ---------- */

    fmtNum(v) {
      const n = Number(v) || 0;
      return n.toLocaleString('ru-RU', { maximumFractionDigits: 6 });
    },

    fmtMoney(v) {
      return (Number(v) || 0).toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    typeLabel(row) {
      if (row.type === 'labor') return 'ЗТ · труд';
      if (row.type === 'machine') return row.operator ? 'ОМ · Тмр' : 'ОМ · машины';
      return 'М · материал';
    },

    setType(row, t) {
      row.type = t;
      if (t !== 'machine') row.operator = false;
    },

    /* ---------- снапшот данных для сохранения ---------- */

    exportable() {
      return JSON.parse(JSON.stringify(this.data));
    },

    /* ---------- вычисления (#11) — каркасный метод v2.0 ---------- */

    rowTotal(row) {
      if (!row) return 0;
      try {
        const fw = this.data && this.data.framework ? this.data.framework : null;
        return framework.frameworkRowCost(row, fw).total;
      } catch (e) {
        // fallback для строк без каркасовых метаданных
        return (Number(row.qty) || 0) * (Number(row.price) || 0);
      }
    },

    /** Детализация стоимости строки: q_факт, p_полн и состав (для проверки расчётов). */
    rowBreakdown(row) {
      const fw = this.data && this.data.framework ? this.data.framework : null;
      return framework.frameworkRowCost(row, fw);
    },

    /** Список групп норм отходов (для select в модалке записей). */
    wasteNorms() {
      return framework.WASTE_NORMS;
    },

    /** Название группы норм отходов + k для отображения в проверке расчёта. */
    wasteLabel(groupId) {
      const g = framework.WASTE_NORMS.find((w) => w.id === groupId);
      return g ? `${g.material_group} · +${g.pct}` : 'без запаса';
    },

    /** Контрольная сверка: Σ стоимостей строк грида == ПЗ из свода (расхождение, ₽). */
    checkPzConvergence() {
      let gridSum = 0;
      for (const sec of this.data.sections || []) {
        for (const r of sec.resources || []) gridSum += this.rowTotal(r);
      }
      const pz = Number(this.sums && this.sums.pz) || 0;
      return { gridSum, pz, diff: gridSum - pz };
    },

    sectionTotal(section) {
      return section.resources.reduce((s, r) => s + this.rowTotal(r), 0);
    },

    roundingLabel() {
      const r = this.data.rounding || {};
      return (
        (ROUND_MODES[r.mode] || ROUND_MODES.kopecks).label + ' · ' + (ROUND_METHODS[r.method] || '')
      );
    },

    setRecalcMode(mode) {
      this.data.recalcMode = mode;
      if (mode === 'auto' && this.dirty) this.saveLocal();
      this.logActivity('Режим пересчёта: ' + (mode === 'auto' ? 'автоматический' : 'ручной'));
    },

    forceRecalc() {
      this.saveLocal();
      this.savedFlash = true;
      setTimeout(() => (this.savedFlash = false), 1500);
    },

    goPage(delta) {
      this.page = Math.max(0, Math.min(this.pageCount - 1, this.page + delta));
      this.cursor = -1;
    },

    gotoLastPage() {
      this.page = this.pageCount - 1;
    },

    pageLabel() {
      return `${Math.min(this.page + 1, this.pageCount)} / ${this.pageCount}`;
    },

    /* ---------- таблица: ширины и служебные ---------- */

    totalTableWidth() {
      return this.visibleColumns().reduce((s, c) => s + c.width, 0);
    },

    colSpanFor(key) {
      // ячейка-разделитель на всю ширину таблицы: суммарный colspan видимых колонок
      const vis = this.visibleColumns();
      const idx = vis.findIndex((c) => c.key === key);
      if (idx < 0) return 0;
      let span = 0;
      for (let i = idx; i < vis.length; i++) span += vis[i].key === 'name' ? 2 : 1;
      return span;
    },

    colIcon(key) {
      return (
        {
          num: '#',
          basis: 'T',
          name: 'T',
          type: '⬡',
          unit: 'T',
          qty: '#',
          price: '$',
          total: '∑',
          note: 'T',
          days: '🗓',
          pred: '→',
          actions: '',
        }[key] || ''
      );
    },

    resetColWidths() {
      localStorage.removeItem(LS_COLS_KEY);
      location.reload();
    },

    /* ---------- редактирование ячеек (#37) ---------- */

    commitEdit(ev, field, item) {
      const row = item.row;
      if (ev && ev.key === 'Escape') {
        this.editing = null;
        return;
      }
      const input = ev && ev.target;
      let val = input ? input.value : row[field];
      if (['qty', 'price', 'days'].includes(field)) {
        val = String(val).replace(',', '.');
        const n = parseFloat(val);
        row[field] = isFinite(n) ? n : 0;
      } else if (field === 'pred') {
        this.setPredByNumber(row, val);
      } else {
        row[field] = String(val).trim();
      }
      if (field === 'price') this.onPriceEdited(row);
      this.pushHistory(`Правка поля «${field}»`);
      this.editing = null;
      // Tab — переход к следующей редактируемой ячейке строки (#37)
      if (ev && ev.key === 'Tab') {
        ev.preventDefault();
        const order = ['basis', 'name', 'unit', 'qty', 'price', 'note', 'days', 'pred'];
        const i = order.indexOf(field);
        const next = order[(i + 1) % order.length];
        this.$nextTick(() => this.openCell(next, item));
      }
    },

    /* ---------- модальное окно записи ---------- */

    openRowModal(item) {
      this.expandedRow = { ...item };
    },

    addRow(si) {
      if (si === null || si < 0 || !this.data.sections[si]) {
        this.createSection();
        this.activeTab = this.data.sections.length - 1;
        return;
      }
      this.pushHistory('Добавлена запись');
      this.data.sections[si].resources.push(Resource.create());
      const list = this.data.sections[si].resources;
      const created = list[list.length - 1];
      this.openCell('name', { row: created });
    },

    saveRecordModal() {
      const row = this.recordRow;
      if (row && !(String(row.name).trim() || String(row.basis).trim())) {
        // пустая запись — удалить
        const idx = this.data.sections[this.recordDraft.si].resources.indexOf(row);
        if (idx >= 0) this.data.sections[this.recordDraft.si].resources.splice(idx, 1);
      } else if (row) {
        this.syncResourcePrice(row);
      }
      this.recordModalOpen = false;
      this.recordDraft = null;
    },

    removeRowById(si, id) {
      this.pushHistory('Удалена запись');
      const arr = this.data.sections[si].resources;
      const idx = arr.findIndex((r) => r.id === id);
      if (idx >= 0) arr.splice(idx, 1);
      this.selectedIds.delete(id);
    },

    moveRow(item, delta) {
      const sec = this.data.sections[item.si];
      const from = sec.resources.findIndex((r) => r.id === item.row.id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= sec.resources.length) return;
      this.pushHistory('Перемещение записи');
      const [moved] = sec.resources.splice(from, 1);
      sec.resources.splice(to, 0, moved);
    },

    /* drag&drop строк между разделами (#26) */
    startRowDrag(e, item) {
      this.dragRow = { si: item.si, id: item.row.id };
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', item.row.id);
        // Аккуратный «призрак» строки вместо снимка всей таблицы со скроллом
        const tr = e.target && e.target.closest ? e.target.closest('tr') : null;
        if (tr) {
          const r = tr.getBoundingClientRect();
          e.dataTransfer.setDragImage(tr, 12, r.height / 2);
        }
      } catch (err) {
        /* ignore */
      }
    },

    endRowDrag() {
      this.dragRow = null;
    },

    dropOnSection(si) {
      if (!this.dragRow || this.dragRow.si === si) return;
      this.pushHistory('Запись перенесена в другой раздел');
      const fromArr = this.data.sections[this.dragRow.si].resources;
      const idx = fromArr.findIndex((r) => r.id === this.dragRow.id);
      if (idx < 0) return;
      const [moved] = fromArr.splice(idx, 1);
      this.data.sections[si].resources.push(moved);
      this.dragRow = null;
    },

    /** Открытие модалки реквизитов проекта */
    openProjectModal() {
      this.projModalOpen = true;
    },

    /** Открытие калькулятора трудозатрат / маш-часов (#48) */
    openCalc(prefillRow) {
      this.calcTab = prefillRow && prefillRow.type === 'machine' ? 'machine' : 'labor';
      if (prefillRow) {
        this.calc.volume = Number(prefillRow.qty) || 100;
        this.calc.ratePerHour = Number(prefillRow.price) || 250;
      }
      this.calc.days = null;
      this.calcModalOpen = true;
    },

    /** Результат расчёта калькулятора */
    get calcResult() {
      const c = this.calc;
      const V = Number(c.volume) || 0;
      const N = Number(c.normTime) || 0;
      const totalHours = V * N; // всего чел-ч / маш-ч
      const dayHours =
        Math.max(1, Number(c.crewSize) || 1) *
        Math.max(1, Number(c.shiftsPerDay) || 1) *
        Math.max(1, Number(c.hoursPerShift) || 8);
      const days = totalHours > 0 ? totalHours / dayHours : 0;
      const cost = totalHours * (Number(c.ratePerHour) || 0);
      // обратная задача: срок задан → минимальный состав бригады
      const needCrew =
        Number(c.days) > 0
          ? Math.ceil(
              totalHours /
                (Math.max(1, Number(c.days)) *
                  Math.max(1, Number(c.shiftsPerDay) || 1) *
                  Math.max(1, Number(c.hoursPerShift) || 8))
            )
          : null;
      return { totalHours, days: Math.ceil(days), exactDays: days, cost, needCrew, dayHours };
    },

    /** Применение результата калькулятора к записи */
    applyCalcToRow(item) {
      const res = this.calcResult;
      const row = item ? item.row : this.recordRow;
      if (!row) {
        alert('Сначала выделите запись в таблице.');
        this.calcModalOpen = false;
        return;
      }
      this.pushHistory('Калькулятор применён к записи');
      row.type = this.calcTab === 'labor' ? 'labor' : 'machine';
      row.price = Number(this.calc.ratePerHour) || 0;
      row.unit = row.unit || (this.calcTab === 'labor' ? 'чел-ч' : 'маш-ч');
      row.qty = Number(res.totalHours.toFixed(2));
      if (res.days > 0) row.days = res.days;
      this.calcModalOpen = false;
    },

    /** Открытие хаба ресурсов */
    openResHub() {
      this.resModalOpen = true;
    },
    // ==========================================
    // Методы UI (портировано из legacy js/app.js)
    // ==========================================

    applyResourcePrice(entry, price) {
      const p = Number(price);
      if (!isFinite(p) || p < 0) return;
      let n = 0;
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          if (resKey(r) === entry.key) {
            r.price = p;
            n++;
          }
        }
      }
      this.pushHistory(`Цена ресурса «${entry.name}» → ${p} ₽ (${n} записей)`);
    },

    findResourceByName(name) {
      const f = String(name || '')
        .trim()
        .toLowerCase();
      if (!f) return null;
      for (const sec of this.data.sections)
        for (const r of sec.resources) if (String(r.name).trim().toLowerCase() === f) return r;
      return null;
    },

    /** Показать все скрытые колонки (пункт меню «👁 Показать все колонки») */
    showAllCols() {
      this.hiddenCols = [];
      this.saveUI();
    },

    /** Число колонок после последней видимой — для colspan-заглушек таблицы */
    tailCols() {
      const vis = this.visibleColumns();
      const lastIdx = vis.length ? this.columns.indexOf(vis[vis.length - 1]) : -1;
      return Math.max(0, this.columns.length - 1 - lastIdx);
    },

    /* ---------- Каркасный метод v2.0: строки считаются по frameworkRowCost ---------- */

    selectionTotal() {
      let s = 0;
      for (const sec of this.data.sections)
        for (const r of sec.resources) if (this.selectedIds.has(r.id)) s += this.rowTotal(r);
      return s;
    },

    isChapter(sec) {
      return Array.isArray(sec.children) && sec.children.length > 0;
    },

    chapterTotal(sec) {
      return sec.children.reduce((s, c) => s + this.sectionTotal(c), 0);
    },

    chapterRowTotal(sec) {
      return this.sectionTotal(sec) + this.chapterTotal(sec);
    },

    toggleCollapse(si) {
      const sec = this.data.sections[si];
      if (this.isChapter(sec)) {
        sec.collapsed = !sec.collapsed;
      } else {
        sec.collapsed = !sec.collapsed;
      }
    },

    makeChapter(index) {
      this.pushHistory('Создание главы');
      const name = prompt('Название главы:', 'Глава 1');
      if (name === null || name === undefined) return;
      this.data.sections.splice(index, 0, {
        id: uid(),
        name: name.trim() || 'Глава',
        parentId: null,
        collapsed: false,
        resources: [],
        children: [],
      });
    },

    promoteSection(si) {
      if (si <= 0) return;
      const arr = this.data.sections;
      const prev = arr[si - 1];
      if (this.isChapter(prev)) {
        this.pushHistory('Раздел сделан подразделом');
        prev.children.push(arr[si]);
        arr.splice(si, 1);
        this.activeTab = null;
      } else {
        this.pushHistory('Создана глава над разделом');
        const chapter = {
          id: uid(),
          name: prev.name + ' (глава)',
          parentId: null,
          collapsed: false,
          resources: [],
          children: [prev, arr[si]],
        };
        arr.splice(si - 1, 2, chapter);
        this.activeTab = null;
      }
    },

    demoteSection(si) {
      const arr = this.data.sections;
      const idx = arr.findIndex((s) => this.isChapter(s) && s.children.includes(arr[si]));
      if (idx < 0) return;
      this.pushHistory('Подраздел поднят в разделы');
      arr[idx].children.splice(arr[idx].children.indexOf(arr[si]), 1);
      if (arr[idx].children.length === 0) {
        // от главы остался только один ребёнок — убираем главу
        const ch = arr[idx];
        const single = ch.children[0];
        arr.splice(idx, 1, single);
        this.activeTab = null;
      } else {
        this.activeTab = null;
      }
    },

    findChapterOf(secId) {
      return this.data.sections.findIndex(
        (s) => this.isChapter(s) && s.children.some((c) => c.id === secId)
      );
    },

    get tabSections() {
      const out = [];
      this.data.sections.forEach((sec, si) => {
        out.push({ sec, si, child: false });
        if (this.isChapter(sec) && !sec.collapsed) {
          sec.children.forEach((c) => out.push({ sec: c, si, child: true }));
        }
      });
      return out;
    },

    get scopedSections() {
      if (this.activeTab !== null) {
        const sec = this.data.sections[this.activeTab];
        if (!sec) return [];
        if (this.isChapter(sec)) {
          if (sec.collapsed) return [];
          return [
            { sec, si: this.activeTab },
            ...sec.children.map((c) => ({ sec: c, si: this.activeTab })),
          ];
        }
        return [{ sec, si: this.activeTab }];
      }
      const out = [];
      this.data.sections.forEach((sec, si) => {
        out.push({ sec, si });
        if (this.isChapter(sec) && !sec.collapsed) {
          sec.children.forEach((c) => out.push({ sec: c, si }));
        }
      });
      return out;
    },

    get pageCount() {
      return Math.max(1, Math.ceil(this.flatRows.length / PAGE_SIZE));
    },

    // Групповые итоги удалены: группировки запрещены (см. README «⛔ Запрещено»).
    // Итог раздела остаётся доступным через sectionTotal(sec).

    get summaryResources() {
      const map = new Map();
      this.data.sections.forEach((sec, si) => {
        const secs = this.isChapter(sec) ? sec.children : [sec];
        for (const s of secs) {
          for (const r of s.resources) {
            const k = resKey(r);
            if (!k) continue;
            if (!map.has(k))
              map.set(k, {
                name: r.name,
                type: r.type,
                unit: r.unit,
                qty: 0,
                cost: 0,
                bases: new Set(),
                uses: 0,
                sections: new Set(), // имя раздела(ов), где встречается ресурс (указатель №6)
              });
            const e = map.get(k);
            e.qty += Number(r.qty) || 0;
            e.cost += this.rowTotal(r);
            e.uses++;
            if (String(r.basis).trim()) e.bases.add(String(r.basis).trim());
            e.sections.add(`${si + 1}. ${s.name || '(без названия)'}`);
          }
        }
      });
      return [...map.values()].sort((a, b) => b.cost - a.cost);
    },

    summaryTotalCost() {
      return this.summaryResources.reduce((s, e) => s + e.cost, 0);
    },

    matchesFilter(row) {
      const f = this.filter.trim().toLowerCase();
      if (!f) return true;
      return (
        (row.name || '').toLowerCase().includes(f) ||
        (row.basis || '').toLowerCase().includes(f) ||
        (row.note || '').toLowerCase().includes(f)
      );
    },

    hiddenCount() {
      let hidden = 0;
      for (const sec of this.data.sections)
        for (const r of sec.resources) if (!this.matchesFilter(r)) hidden++;
      return hidden;
    },

    visibleCount() {
      return this.flatRows.length;
    },

    totalCount() {
      return this.data.sections.reduce((s, sec) => s + sec.resources.length, 0);
    },

    selectOnly(id) {
      this.selectedIds = new Set([id]);
    },

    toggleSelect(id) {
      const s = new Set(this.selectedIds);
      s.has(id) ? s.delete(id) : s.add(id);
      this.selectedIds = s;
    },

    openAddSectionModal() {
      this.sectionModalMode = 'create';
      this.sectionDraft = { name: '', index: null };
      this.sectionModalOpen = true;
    },

    openEditSectionModal(si) {
      this.sectionModalMode = 'edit';
      this.sectionDraft = { name: this.data.sections[si].name, index: si };
      this.sectionModalOpen = true;
    },

    saveSectionModal() {
      const name = (this.sectionDraft.name || '').trim();
      if (!name) {
        this.sectionModalOpen = false;
        return;
      }
      if (this.sectionModalMode === 'create') {
        this.data.sections.push(newSection(name));
        this.activeTab = this.data.sections.length - 1;
      } else if (
        this.sectionDraft.index !== null &&
        this.sectionDraft.index !== undefined &&
        this.data.sections[this.sectionDraft.index]
      ) {
        this.data.sections[this.sectionDraft.index].name = name;
      }
      this.sectionModalOpen = false;
    },

    addSection() {
      // Быстрое добавление через ＋ на панели вкладок — сразу с переименованием inline
      this.data.sections.push(newSection('Новый раздел'));
      this.activeTab = this.data.sections.length - 1;
      this.startRenameSection(this.activeTab);
    },

    removeSectionByTab(si) {
      const sec = this.data.sections[si];
      if (confirm(`Удалить раздел «${sec.name}» со всеми записями?`)) {
        this.data.sections.splice(si, 1);
        this.activeTab = null;
      }
    },

    deleteSectionFromModal() {
      const si = this.sectionDraft.index;
      if (si === null || !this.data.sections[si]) return;
      const sec = this.data.sections[si];
      const cnt = sec.resources.length;
      if (confirm(`Удалить раздел «${sec.name}» и ${cnt} записей в нём?`)) {
        this.data.sections.splice(si, 1);
        this.activeTab = null;
        this.sectionModalOpen = false;
      }
    },

    duplicateSection(si) {
      const src = this.data.sections[si];
      const copy = newSection(src.name + ' (копия)');
      copy.resources = src.resources.map((r) => {
        const { id: _drop, ...rest } = r;
        return newRow(rest);
      });
      this.data.sections.splice(si + 1, 0, copy);
      this.activeTab = si + 1;
    },

    toggleFieldMenu(col) {
      this.fieldMenuFor = this.fieldMenuFor === col ? null : col;
    },

    currentTargetSection() {
      return this.activeTab === null ? this.data.sections.length - 1 : this.activeTab;
    },

    /** Завершение перетаскивания строки — сброс состояния drag/drop-подсветки. */
    rowDragEnd(item, e) {
      // Если drop произошёл на строку того же раздела — reorder внутри раздела.
      const target = this.rowDropTarget;
      if (
        this.dragRow &&
        target &&
        this.dragRow.si === item.si &&
        this.dragRow.id !== item.row.id
      ) {
        this._reorderInSection(this.dragRow.si, this.dragRow.id, item.row.id, target.pos);
      }
      this.dragRow = null;
      this.rowDropTarget = null;
      this._flipRows();
    },

    /**
     * FLIP-анимация перестановки строк (как в Airtable): до перерисовки DOM запоминаем
     * позиции видимых строк, после — проигрываем «прилёт» сдвигаемых соседей и самой
     * перемещённой строки. Без этого строки мгновенно телепортируются, и непонятно,
     * куда именно встал перенесённый элемент.
     */
    _flipRows() {
      const sel = 'tr.at-row[data-row-id]';
      const prev = this._rowRects || new Map();
      requestAnimationFrame(() => {
        const anims = [];
        document.querySelectorAll<HTMLTableRowElement>(sel).forEach((tr) => {
          const id = tr.dataset.rowId;
          const now = tr.getBoundingClientRect();
          const before = prev.get(id);
          if (!before) return;
          const dy = before.top - now.top;
          if (Math.abs(dy) < 2) return;
          tr.style.transition = 'none';
          tr.style.transform = `translateY(${dy}px)`;
          anims.push(tr);
        });
        requestAnimationFrame(() => {
          for (const tr of anims) {
            tr.style.transition = 'transform .28s cubic-bezier(.2,.8,.3,1)';
            tr.style.transform = '';
            const done = () => {
              tr.style.transition = '';
              tr.removeEventListener('transitionend', done);
            };
            tr.addEventListener('transitionend', done);
          }
        });
        this._rowRects = null;
      });
    },

    /** Перемещение строки внутри одного раздела относительно целевой (up/down). */
    _reorderInSection(si, movedId, targetId, pos) {
      const arr = this.data.sections[si].resources;
      const from = arr.findIndex((r) => r.id === movedId);
      if (from < 0) return;
      let to = arr.findIndex((r) => r.id === targetId);
      if (to < 0) return;
      if (pos === 'below') to += 1;
      if (from < to) to -= 1; // учёт удаления элемента из начала
      if (to === from) return;
      this.pushHistory('Перемещение записи');
      this._rowRects = this._captureRowRects(); // FLIP: позиции ДО изменения модели
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      this._flashDroppedRow(movedId);
    },

    /** Снимок вертикальных позиций строк таблицы (для FLIP-анимации). */
    _captureRowRects() {
      const map = new Map();
      document.querySelectorAll<HTMLTableRowElement>('tr.at-row[data-row-id]').forEach((tr) => {
        map.set(tr.dataset.rowId, tr.getBoundingClientRect());
      });
      return map;
    },

    /** Подсветка строки после переноса — визуальное подтверждение нового места (указатель №7). */
    _flashDroppedRow(rowId) {
      this.droppedRowId = rowId;
      setTimeout(() => {
        if (this.droppedRowId === rowId) this.droppedRowId = null;
      }, 650);
    },

    /**
     * Наведение на строку во время drag&drop: определяем половину цели
     * (вставить перед строкой или после неё) и подсвечиваем drop-зону.
     * Работает и перенос между разделами, и reorder внутри раздела.
     */
    rowDragOver(e, item) {
      if (!this.dragRow || this.dragRow.id === item.row.id) {
        if (this.rowDropTarget) this.rowDropTarget = null;
        return;
      }
      const pos = this._rowDropPos(e);
      const key = item.si + '|' + item.row.id;
      if (this.rowDropTarget && this.rowDropTarget.key === key && this.rowDropTarget.pos === pos)
        return;
      this.rowDropTarget = { key, pos };
      // Живой preview как в Airtable: при наведении меняем место перетаскиваемой строки
      // в модели ещё до отпускания кнопки мыши — соседи плавно расходятся (FLIP),
      // а сама строка-«призрак» остаётся полупрозрачной на новой позиции.
      if (this.dragRow.si === item.si) {
        const arr = this.data.sections[item.si].resources;
        const from = arr.findIndex((r) => r.id === this.dragRow.id);
        let to = arr.findIndex((r) => r.id === item.row.id);
        if (from >= 0 && to >= 0 && from !== to) {
          if (pos === 'below') to += 1;
          if (from < to) to -= 1;
          if (to !== from) {
            this._rowRects = this._captureRowRects();
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            this._flipRows();
          }
        }
      }
    },

    /** Вычислить верхнюю/нижнюю половину строки по координате курсора. */
    _rowDropPos(e) {
      const tr = e && e.target ? e.target.closest('tr') : null;
      if (!tr) return 'above';
      const r = tr.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2 ? 'above' : 'below';
    },

    /** Drop строки на другую строку: перенос в раздел цели перед/после целевой записи. */
    rowDrop(item) {
      const target = this.rowDropTarget;
      // Перенос между разделами (reorder внутри раздела обрабатывается в rowDragEnd).
      if (!this.dragRow || this.dragRow.si === item.si) return;
      const fromSi = this.dragRow.si;
      const movedId = this.dragRow.id;
      const fromArr = this.data.sections[fromSi].resources;
      const idx = fromArr.findIndex((r) => r.id === movedId);
      if (idx < 0) return;
      this.pushHistory('Запись перенесена в другой раздел');
      const [moved] = fromArr.splice(idx, 1);
      const toArr = this.data.sections[item.si].resources;
      let to = toArr.findIndex((r) => r.id === item.row.id);
      if (to < 0) to = toArr.length;
      else if (target && target.pos === 'below') to += 1;
      toArr.splice(to, 0, moved);
      this.dragRow = null;
      this._flashDroppedRow(movedId);
    },

    openCtxMenu(e, item) {
      e.preventDefault();
      if (!this.selectedIds.has(item.row.id)) this.selectOnly(item.row.id);
      this.ctxMenu = {
        x: Math.min(e.clientX, window.innerWidth - 220),
        y: Math.min(e.clientY, window.innerHeight - 260),
        item,
      };
    },

    closeCtxMenu() {
      this.ctxMenu = null;
    },

    ctxAction(fn) {
      const m = this.ctxMenu;
      if (!m) return;
      this.ctxMenu = null;
      fn(m.item);
    },

    ctxEditRow() {
      this.ctxAction((item) => {
        this.expandedRow = { ...item };
      });
    },

    ctxDuplicate() {
      this.ctxAction((item) => this.duplicateRowById(item.si, item.row.id));
    },

    ctxMoveUp() {
      this.ctxAction((item) => this.moveRow(item, -1));
    },

    ctxMoveDown() {
      this.ctxAction((item) => this.moveRow(item, 1));
    },

    ctxDeleteRow() {
      this.ctxAction((item) => this.removeRowById(item.si, item.row.id));
    },

    ctxApplyNsb() {
      this.ctxAction((item) => {
        const hit = this.nsbItems.find(
          (n) =>
            (n.basis &&
              n.basis.trim().toLowerCase() === String(item.row.basis).trim().toLowerCase()) ||
            (n.name && n.name.trim().toLowerCase() === String(item.row.name).trim().toLowerCase())
        );
        if (hit) {
          this.pushHistory('Применена расценка НСБ');
          item.row.basis = hit.basis;
          item.row.name = hit.name;
          item.row.type = hit.type;
          item.row.unit = hit.unit;
          item.row.price = hit.price;
          copyFrameworkFields(hit, item.row);
        } else {
          alert('В НСБ нет расценки с таким шифром или наименованием.');
        }
      });
    },

    ctxCopyName() {
      this.ctxAction((item) => {
        const t = `${item.row.basis} ${item.row.name}`.trim();
        if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
      });
    },

    /** Пункт контекстного меню: открыть калькулятор для этой строки */
    ctxCalc() {
      this.ctxAction((item) => this.openCalc(item.row));
    },

    rangeSelect(toIndex) {
      const items = this.flatRows;
      const last = items[items.length - 1];
      const anchor = last ? last.row.id : null;
      const target = items.find((i) => i.index === toIndex);
      if (!anchor || !target) return;
      const a = items.findIndex((i) => i.row.id === anchor);
      const b = items.indexOf(target);
      const s = new Set(this.selectedIds);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) s.add(items[i].row.id);
      this.selectedIds = s;
    },

    clearSelection() {
      this.selectedIds = new Set();
      this.batchBar = false;
    },

    openBatchBar() {
      this.batchBar = true;
      this.ctxMenu = null;
      this.batchPrice = '';
      this.batchQty = '';
      this.batchUnit = '';
    },

    batchApply() {
      if (!this.selectedIds.size) return;
      this.pushHistory('Батч-редактирование выделения');
      for (const sec of this.data.sections)
        for (const r of sec.resources)
          if (this.selectedIds.has(r.id)) {
            if (this.batchPrice !== '') r.price = Number(this.batchPrice) || 0;
            if (this.batchQty !== '') r.qty = Number(this.batchQty) || 0;
            if (this.batchUnit !== '') r.unit = this.batchUnit;
          }
      this.batchBar = false;
    },

    setAllSelectedPriceFromNsb() {
      this.nsbApplyToSelected();
    },

    download(filename, text, mime) {
      const blob = new Blob([text], { type: mime + ';charset=utf-8' });
      this.downloadBlob(filename, blob);
    },

    downloadBlob(filename, blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    exportGanttPng(svgIn) {
      const svg = svgIn || this.buildGanttSVG();
      if (!svg) {
        alert('Нет работ для экспорта: задайте длительность хотя бы одной записи.');
        return;
      }
      svgToPng(svg, 2, (blob) => {
        if (!blob) {
          alert('Не удалось создать изображение.');
          return;
        }
        this.downloadBlob('gantt.png', blob);
        this.logActivity('Экспорт диаграммы Ганта (PNG)');
      });
    },

    exportGanttSvg(svgIn) {
      const svg = svgIn || this.buildGanttSVG();
      if (!svg) {
        alert('Нет работ для экспорта.');
        return;
      }
      this.download('gantt.svg', svg, 'image/svg+xml');
      this.logActivity('Экспорт диаграммы Ганта (SVG)');
    },

    buildGanttSVG() {
      const g = this.ganttData;
      if (!g.rows.length && !g.sections.length) return null;
      const DAYW = 34,
        ROWH = 26,
        SECH = 30,
        NAMEW = 260,
        TOP = 46;
      const width = NAMEW + g.totalDays * DAYW + 40;
      const height = TOP + g.sections.length * SECH + g.rows.length * ROWH + 30;
      const colors = {
        labor: '#0052cc',
        machine: '#ff8b00',
        material: '#36b37e',
        section: '#4c9aff',
      };
      const parts = [];
      parts.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
      );
      parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
      parts.push(
        `<text x="12" y="24" font-family="Arial" font-size="15" font-weight="bold" fill="#172b4d">${xmlEsc(this.data.title)} — график работ</text>`
      );
      // шкала
      for (let d = 0; d <= g.totalDays; d++) {
        const x = NAMEW + d * DAYW;
        parts.push(
          `<line x1="${x}" y1="${TOP - 8}" x2="${x}" y2="${height - 10}" stroke="#eaebf0" stroke-width="1"/>`
        );
        if (d % 5 === 0)
          parts.push(
            `<text x="${x + 2}" y="${TOP - 12}" font-family="Arial" font-size="10" fill="#7a8699">${this.ganttDateLabel(d)}</text>`
          );
      }
      let y = TOP;
      for (const s of g.sections) {
        parts.push(
          `<text x="8" y="${y + 18}" font-family="Arial" font-size="12" font-weight="bold" fill="#172b4d">${xmlEsc(s.si + 1 + '. ' + s.name).slice(0, 34)}</text>`
        );
        parts.push(
          `<rect x="${NAMEW + s.leftDays * DAYW}" y="${y + 8}" width="${Math.max(6, s.spanDays * DAYW - 4)}" height="12" rx="3" fill="${colors.section}"/>`
        );
        y += SECH;
      }
      for (const r of g.rows) {
        parts.push(
          `<text x="22" y="${y + 17}" font-family="Arial" font-size="11" fill="#344563">${xmlEsc(r.name).slice(0, 40)}</text>`
        );
        parts.push(
          `<rect x="${NAMEW + r.leftDays * DAYW}" y="${y + 5}" width="${Math.max(6, r.spanDays * DAYW - 4)}" height="16" rx="4" fill="${colors[r.type] || colors.material}"/>`
        );
        parts.push(
          `<text x="${NAMEW + r.leftDays * DAYW + 6}" y="${y + 17}" font-family="Arial" font-size="10" fill="#fff">${r.days} дн.</text>`
        );
        y += ROWH;
      }
      parts.push('</svg>');
      return parts.join('');
    },

    doPrint() {
      // применяем ориентацию через @page (переопределяем правило в <style>)
      const style = document.getElementById('print-orientation-style');
      if (style) {
        style.textContent = `@media print { @page { size: A4 ${this.printOrientation}; margin: 10mm; } }`;
      }
      document.body.classList.add('printing');
      if (this.viewTab === 'gantt') document.body.classList.add('printing-gantt');
      this.printModalOpen = false;
      this.logActivity('Отправлено на печать (' + this.printOrientation + ')');
      // небольшая задержка — чтобы стиль успел примениться
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing');
          document.body.classList.remove('printing-gantt');
        }, 300);
      }, 60);
    },

    projectFilled() {
      const c = this.data.company || {};
      return !!(c.objectName || c.customer || c.contractor || c.chief);
    },

    saveProjectModal() {
      this.projModalOpen = false;
      this.pushHistory('Сохранены реквизиты объекта');
    },

    toggleGantt() {
      this.viewTab = this.viewTab === 'gantt' ? 'table' : 'gantt';
    },

    /* Кэш диаграммы (Wix-подход: тяжёлый пересчёт — только по событию данных).
       Геттер ganttData раньше рекурсивно вызывался из ganttLinkLines,
       ganttLinksSize, ganttDayWidth и т.д. на каждое движение мыши → вкладка
       Ганта «не жила». Теперь расчёт выполняется один раз, а при любом
       изменении сметы/связей/масштаба кэш сбрасывается ($watch в init). */
    _ganttCache: null as any,
    _ganttEpoch: 0,
    _layoutTick: 0,
    _ganttIndexById: new Map(),
    _ganttIndexSig: '',

    invalidateGantt() {
      this._ganttCache = null;
      this._ganttEpoch++;
    },

    get ganttData() {
      if (this._ganttCache) return this._ganttCache;
      const cache = this._computeGanttData();
      this._ganttCache = cache;
      return cache;
    },

    _computeGanttData() {
      const DAY = 86400000;
      const start = new Date(this.data.startDate || defaultStartDate()).getTime();
      // если активна вкладка раздела — диаграмма строится только по работам этого раздела
      const scoped =
        this.activeTab === null
          ? (() => {
              const out = [];
              this.data.sections.forEach((sec, si) => {
                out.push({ sec, si });
                if (this.isChapter(sec) && !sec.collapsed)
                  sec.children.forEach((c) => out.push({ sec: c, si }));
              });
              return out;
            })()
          : [{ sec: this.data.sections[this.activeTab], si: this.activeTab }].filter((x) => x.sec);
      const rows = [];
      const skipped = []; // записи без длительности — не попадают на диаграмму
      let prevEnd = start;
      let maxEnd = start;
      for (const { sec, si } of scoped) {
        // разделы идут последовательно: каждый следующий начинается после конца предыдущего
        const secStart = Math.max(start, prevEnd);
        let cur = secStart;
        for (const r of sec.resources) {
          // Длительность 0 или не задана → запись НЕ отображается на диаграмме
          // (в том числе дробная < 1 дня округляется до 0 и скрывается).
          const raw = Number(r.days);
          if (!isFinite(raw) || raw <= 0) {
            skipped.push(r);
            continue;
          }
          const dur = Math.round(raw);
          if (dur <= 0) {
            skipped.push(r);
            continue;
          }
          const from = cur;
          const to = from + dur * DAY;
          rows.push({
            row: r,
            si,
            name: r.name || '(без наименования)',
            type: r.type,
            total: this.rowTotal(r),
            days: dur,
            leftDays: Math.round((from - start) / DAY),
            spanDays: dur,
          });
          cur = to;
          if (to > maxEnd) maxEnd = to;
        }
        if (cur > prevEnd) prevEnd = cur;
      }
      /* связи предшественник → преемник и перемещённые полосы (#49):
         сдвиг относительно автоплана, затем каскад по зависимостям */
      // Ключ карты — номер строки в ТАБЛИЦЕ (flatRows), т.к. row.pred хранится в этой нумерации.
      const numByRowId = new Map<string, number>(this.flatRows.map((it, i) => [it.row.id, i + 1]));
      const byNum = new Map<number, any>(
        rows
          .map((g): [number, any] | null => {
            const n = numByRowId.get(g.row.id);
            return n === undefined || n === null ? null : [n, g];
          })
          .filter((e): e is [number, any] => e !== null)
      );
      const origLeft = rows.map((g) => g.leftDays);
      // startAt — «закреплённая дата» (constraint Start No Earlier Than, как в MS Project):
      // полоса стартует не раньше указанной позиции, но связи могут сдвинуть её позже.
      if (rows.some((g) => Number(g.row.startAt) >= 0)) {
        rows.forEach((g) => {
          if (Number(g.row.startAt) >= 0)
            g.leftDays = Math.max(0, Math.round(Number(g.row.startAt)));
        });
      }
      const links = [];
      // Собираем все связи (несколько предшественников на строку допустимы, как в MS Project)
      for (const g of rows) {
        const selfNum = numByRowId.get(g.row.id);
        for (const ref of parsePredRefs(g.row.pred)) {
          if (ref.num === selfNum) continue;
          const pred = byNum.get(ref.num);
          if (!pred) continue;
          links.push({ from: pred, to: g, type: ref.type });
        }
      }
      /* ── Движок планирования (Wix/MS Project-style) ────────────────────────
         1) Топологический порядок по DAG связей (Kahn). Связи, участвующие в
            цикле, исключаются из каскада и помечаются красными — так же, как
            MS Project отказывается считать зацикленные зависимости.
         2) В топологическом порядке старт каждой работы = максимум из её
            «закреплённой даты» (ручной сдвиг startAt — constraint SNET) и
            ограничений всех активных предшественников (FS/SS/FF/SF).
            Одна гарантия: каскад всегда сходится, полос никогда не «застревает».
         3) Прямые обратные вызовы геттера запрещены: ganttData кэшируется
            (см. _ganttCache) и инвалидируется при любом изменении данных —
            это убирает рекурсивные циклы вычислений, из-за которых вкладка
            раньше «не жила». */
      const constraintStart = (l) => {
        const f = l.from,
          t = l.to;
        switch (l.type) {
          case 'SS':
            return f.leftDays; // старт от старта
          case 'FF':
            return f.leftDays + f.spanDays - t.spanDays; // финиш от финиша
          case 'SF':
            return f.leftDays - t.spanDays; // старт от финиша (экзотика, но из набора MS Project)
          default:
            return f.leftDays + f.spanDays; // FS: старт сразу после финиша
        }
      };
      // степени входа + граф предшественников (только связи внутри диаграммы)
      const indeg = new Map();
      const predsOf = new Map();
      for (const g of rows) {
        indeg.set(g, 0);
        predsOf.set(g, []);
      }
      for (const l of links) {
        indeg.set(l.to, indeg.get(l.to) + 1);
        predsOf.get(l.to).push(l);
      }
      const queue = rows.filter((g) => indeg.get(g) === 0);
      const topo = [];
      while (queue.length) {
        const g = queue.shift();
        topo.push(g);
        for (const l of links) {
          if (l.from !== g) continue;
          indeg.set(l.to, indeg.get(l.to) - 1);
          if (indeg.get(l.to) === 0) queue.push(l.to);
        }
      }
      const inTopo = new Set(topo);
      for (const l of links) l.cyclic = !inTopo.has(l.from) || !inTopo.has(l.to);
      const activeLinks = links.filter((l) => !l.cyclic);
      // детерминированный старт каскада: автоплан + закреплённые даты
      rows.forEach((g, i) => {
        g.leftDays = origLeft[i];
        if (Number(g.row.startAt) >= 0)
          g.leftDays = Math.max(origLeft[i], Math.round(Number(g.row.startAt)));
      });
      const posInTopo = new Map(topo.map((g, i) => [g, i]));
      // обрабатываем вершины DAG в топологическом порядке; хвост (циклы) — как есть
      const order = rows.slice().sort((a, b) => {
        const ia = posInTopo.has(a) ? posInTopo.get(a) : Number.MAX_SAFE_INTEGER;
        const ib = posInTopo.has(b) ? posInTopo.get(b) : Number.MAX_SAFE_INTEGER;
        return ia - ib;
      });
      for (const g of order) {
        let minStart = g.leftDays;
        for (const l of activeLinks) {
          if (l.to !== g) continue;
          const c = Math.max(0, constraintStart(l));
          if (c > minStart) minStart = c;
        }
        g.leftDays = minStart;
      }
      const workedDays = rows.reduce((m, g) => Math.max(m, g.leftDays + g.spanDays), 0);
      const totalDays = Math.max(7, workedDays); // минимум — неделя шкалы
      /* ── Критический путь (CPM, longest path в DAG с весами по типу связи):
         ES(g) = max по предшественникам нижней границ старта; EF = ES + dur.
         Путь критичен, когда его длина равна длине самой длинной цепочки. */
      const esMemo = new Map();
      const efOf = (g) => {
        if (esMemo.has(g)) return esMemo.get(g);
        esMemo.set(g, Infinity); // защита от повторов (циклы уже исключены из DAG)
        let es = 0;
        for (const l of predsOf.get(g) || []) {
          if (l.cyclic) continue;
          const c = Math.max(0, constraintStartLike(l, efOf(l.from)));
          if (c > es) es = c;
        }
        const ef = es + g.spanDays;
        esMemo.set(g, ef);
        return ef;
      };
      function constraintStartLike(l, predEf) {
        // ограничение старта через FINISH предшественника (для рекурсивного CPM)
        switch (l.type) {
          case 'SS':
            return predEf - l.from.spanDays; // старт предшественника
          case 'FF':
            return predEf - l.to.spanDays; // финиш = финишу предш.
          case 'SF':
            return predEf - l.to.spanDays; // старт = финишу предш. (консервативно)
          default:
            return predEf; // FS: сразу после финиша
        }
      }
      const projectFinish = rows.reduce((m, g) => Math.max(m, efOf(g)), 0);
      rows.forEach((g) => {
        g.isCritical = this.ganttCritical && efOf(g) === projectFinish;
      });
      const sections = [];
      for (const { sec, si } of scoped) {
        const gr = rows.filter((g) => g.row && sec.resources.includes(g.row));
        if (!gr.length) continue;
        const left = Math.min(...gr.map((g) => g.leftDays));
        const right = Math.max(...gr.map((g) => g.leftDays + g.spanDays));
        sections.push({
          id: sec.id,
          si,
          name: sec.name,
          leftDays: left,
          spanDays: right - left,
          total: this.sectionTotal(sec),
        });
      }
      return { rows, sections, skipped, links, totalDays, workedDays, start, origLeft };
    },

    get ganttLinkLines() {
      const w = this.ganttDayWidth();
      // Фолбэк-геометрия (используется только вне браузера / до первой отрисовки):
      // должна совпадать с CSS: TOP=34 (шкала), SECH=38 (.at-gantt-secrow), ROWH=34 (.at-gantt-row).
      const ROWH = 34,
        SECH = 38,
        TOP = 34;
      const rows = this.ganttData.rows;
      const secCount = this.ganttData.sections.length;
      // Инкремент при изменении раскладки (ResizeObserver в ganttLinks): заставляет
      // Alpine пересчитать линии связей после того, как DOM уже отрисован.
      void this.layoutTick;
      const tracks = document.querySelectorAll('.at-gantt .at-gantt-track');
      // Точки крепления зависят от типа связи (как в MS Project):
      // FS/SF — выход справа у предшественника; SS/SS — вход слева в преемник.
      const anchorX = (g, side) => {
        if (side === 'right') return g.leftDays * w + Math.max(6, g.spanDays * w - 4);
        return g.leftDays * w;
      };
      return this.ganttData.links
        .map((l) => {
          const fi = this._ganttRowIndex(l.from);
          const ti = this._ganttRowIndex(l.to);
          if (fi < 0 || ti < 0) return null;
          const fromRight = l.type === 'FS' || l.type === 'SF'; // выход из финиша предш.
          const toLeft = l.type === 'FS' || l.type === 'SS'; // вход в старт преемника
          // Координаты: из DOM (точно), фолбэк — формульная геометрия (вне браузера).
          let x1, y1, x2, y2;
          const trackT = tracks[ti];
          const barF = trackT && tracks[fi] ? tracks[fi].querySelector('.at-gantt-bar') : null;
          const barT = trackT ? trackT.querySelector('.at-gantt-bar') : null;
          if (barF && barT) {
            const rf = barF.getBoundingClientRect();
            const rt = barT.getBoundingClientRect();
            const rc = trackT.getBoundingClientRect();
            x1 = fromRight ? rf.right - rc.left : rf.left - rc.left;
            y1 = rf.top + rf.height / 2 - rc.top;
            x2 = toLeft ? rt.left - rc.left : rt.right - rc.left;
            y2 = rt.top + rt.height / 2 - rc.top;
          } else {
            x1 = anchorX(l.from, fromRight ? 'right' : 'left');
            y1 = TOP + secCount * SECH + fi * ROWH + ROWH / 2;
            x2 = anchorX(l.to, toLeft ? 'left' : 'right');
            y2 = TOP + secCount * SECH + ti * ROWH + ROWH / 2;
          }
          // drawio-style: ортогональный маршрутер со скруглёнными углами
          // (точка выхода предшественника → вправо → вертикаль → стрелка в цель).
          const r = 6;
          const midX = Math.max(x1 + 12, x2 - 16);
          const dy = y2 - y1;
          const ady = Math.abs(dy);
          let d;
          if (x2 > x1 + 14 && ady > 2) {
            // цель правее и ниже/выше — S-образная кривая с горизонтальными касательными (drawio)
            const mx = (x1 + x2) / 2;
            d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 7},${y2}`;
          } else {
            // классический Гант: «ступенька» со скруглениями
            const rr = Math.min(
              r,
              ady / 2,
              Math.max(0, (midX - x1) / 2),
              Math.max(0, (x2 - 7 - midX) / 2)
            );
            const sgn = dy >= 0 ? 1 : -1;
            d =
              `M${x1},${y1} H${midX - rr}` +
              (rr > 0.5 ? ` Q${midX},${y1} ${midX},${y1 + sgn * rr}` : '') +
              ` V${y2 - sgn * rr}` +
              (rr > 0.5 ? ` Q${midX},${y2} ${midX + rr},${y2}` : ` H${midX}`) +
              ` H${Math.max(midX, x2 - 7)}`;
          }
          return { d, cls: 'lt-' + (l.type || 'FS') + (l.cyclic ? ' cyclic' : '') };
        })
        .filter(Boolean);
    },

    /** Индекс строки диаграммы по объекту g. Кэш-сигнатура хранит id ВСЕХ строк
        текущего кадра: при инвалидации кэша (любoloм изменении данных/раскладки)
        сигнатура меняется и карта перестраивается заново. Раньше «сигнатура»
        сверялась с id одной произвольной строки — карта устаревала молча,
        индексы связей съезжали и каскад «не работал». */
    _ganttRowIndex(g) {
      if (!g) return -1;
      const rows = this.ganttData.rows;
      const sig = rows.map((r) => r.row.id).join('|');
      if (this._ganttIndexSig !== sig) {
        this._ganttIndexSig = sig;
        this._ganttIndexById = new Map(rows.map((r, i) => [r.row.id, i]));
      }
      const byId = this._ganttIndexById.get(g.row.id);
      if (byId !== undefined) return byId;
      return rows.findIndex((r) => r.row && r.row.id === g.row.id);
    },

    /** Строка диаграммы по id записи (поиск без привязки к прокси-объектам Alpine) */
    _ganttRowById(id) {
      if (id === null || id === undefined) return null;
      return this.ganttData.rows.find((r) => r.row && r.row.id === id) || null;
    },

    /** Отрисовать превью связи от источника до точки курсора (координаты слоя = координаты .at-gantt) */
    _drawLinkPreview(clientX, clientY) {
      const fromG = this._ganttRowById(this.ganttLinkFromId);
      if (!fromG) {
        this.ganttLinkPath = null;
        return;
      }
      const grid = document.querySelector('.at-gantt');
      if (!grid) return;
      const rectG = grid.getBoundingClientRect();
      const w = this.ganttDayWidth();
      // Точка выхода зависит от типа создаваемой связи (MS Project):
      // FS/SF — из правого края предшественника, SS/FF — из левого.
      const fromRight = this.ganttLinkType === 'FS' || this.ganttLinkType === 'SF';
      let x1, y1;
      const fi = this._ganttRowIndex(fromG);
      const tracks = grid.querySelectorAll('.at-gantt-track');
      const barF = fi >= 0 && tracks[fi] ? tracks[fi].querySelector('.at-gantt-bar') : null;
      if (barF) {
        const rf = barF.getBoundingClientRect();
        x1 = (fromRight ? rf.right : rf.left) - rectG.left;
        y1 = rf.top + rf.height / 2 - rectG.top;
      } else {
        x1 = fromRight
          ? fromG.leftDays * w + Math.max(6, fromG.spanDays * w - 4)
          : fromG.leftDays * w;
        y1 = 34 + this.ganttData.sections.length * 38 + fi * 34 + 17;
      }
      // Цель под курсором — тянем стрелку ровно в полосу цели (Wix-style snap)
      let x2 = clientX - rectG.left;
      let y2 = clientY - rectG.top;
      const toG = this.ganttHoverTargetId
        ? this._ganttRowById(this.ganttHoverTargetId)
        : null;
      if (toG) {
        const ti = this._ganttRowIndex(toG);
        const trackT = ti >= 0 ? tracks[ti] : null;
        const barT = trackT ? trackT.querySelector('.at-gantt-bar') : null;
        if (barT) {
          const rt = barT.getBoundingClientRect();
          const toLeft = this.ganttLinkType === 'FS' || this.ganttLinkType === 'SS';
          x2 = (toLeft ? rt.left : rt.right) - rectG.left;
          y2 = rt.top + rt.height / 2 - rectG.top;
        }
      }
      const mx = (x1 + x2) / 2;
      this.ganttLinkPath = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    },

    /** Клик по пустому месту дорожки — отменить рисование связи */
    cancelGanttLink() {
      this.ganttLinkFromId = null;
      this.ganttHoverTargetId = null;
      this.ganttLinkPath = null;
    },

    /* ── Live-каскад при перетаскивании (Wix/MS Project-style) ───────────────
       Полоса двигается синхронно с мышью, а все её зависимые работы
       «проталкиваются» сразу же — пользователь видит результат до отпускания.
       Работает поверх кэша ganttData: позиции меняются напрямую в объекте
       диаграммы, без пересмотра данных сметы.
       ВАЖНО: ссылки на строки хранятся в Map по id объекта (не indexOf!) —
       это исключает ложные индексы -1, из-за которых каскад и связи раньше
       «не работали». */
    _ganttPushDown(g, desiredLeft, seen = new Set()) {
      if (seen.has(g)) return; // защита от зацикливания
      seen.add(g);
      if (desiredLeft === g.leftDays) return;
      g.leftDays = Math.max(0, desiredLeft);
      for (const l of this.ganttData.links) {
        if (l.from !== g || l.cyclic) continue;
        let req;
        switch (l.type) {
          case 'SS':
            req = g.leftDays;
            break;
          case 'FF':
            req = g.leftDays + g.spanDays - l.to.spanDays;
            break;
          case 'SF':
            req = g.leftDays - l.to.spanDays;
            break;
          default: // FS
            req = g.leftDays + g.spanDays;
        }
        req = Math.max(0, req);
        if (l.to.leftDays < req) this._ganttPushDown(l.to, req, seen);
      }
    },

    /** Пересчёт итогов раскладки после live-движения (без полного пересмотра) */
    _ganttRelayout() {
      const g = this.ganttData;
      g.workedDays = g.rows.reduce((m, r) => Math.max(m, r.leftDays + r.spanDays), 0);
      g.totalDays = Math.max(7, g.workedDays);
      for (const s of g.sections) {
        const gr = g.rows.filter((r) => r.si === s.si);
        if (!gr.length) continue;
        s.leftDays = Math.min(...gr.map((r) => r.leftDays));
        s.spanDays = Math.max(...gr.map((r) => r.leftDays + r.spanDays)) - s.leftDays;
      }
      this.layoutTick++;
    },

    /* layoutTick: счётчик перерисовки раскладки. Хранится в приватном поле
       _layoutTick (инициализировано выше) — геттер/сеттер без отдельного
       ключа-поля, чтобы не создавать дубль в объекте smeta(). */
    get layoutTick() {
      return this._layoutTick || 0;
    },
    set layoutTick(v) {
      this._layoutTick = v;
    },

    ganttBarStyle(g) {
      const w = this.ganttDayWidth();
      void this.layoutTick; // перерисовать при live-движении полос (см. _ganttRelayout)
      return `left:${g.leftDays * w}px;width:${Math.max(6, g.spanDays * w - 4)}px`;
    },

    ganttSecBarStyle(s) {
      const w = this.ganttDayWidth();
      void this.layoutTick;
      return `left:${s.leftDays * w}px;width:${Math.max(6, s.spanDays * w - 4)}px`;
    },

    startGanttDrag(e, g) {
      e.preventDefault();
      e.stopPropagation();
      // если идёт рисование связи — не мешаем ему
      if (this.ganttLinkFromId !== null && this.ganttLinkFromId !== undefined) {
        this.cancelGanttLink();
        return;
      }
      const startX = e.clientX;
      const startLeft = g.leftDays;
      const w = this.ganttDayWidth();
      this.ganttDrag = { row: g.row, days: g.leftDays };
      let lastLeft = startLeft;
      const onMove = (ev) => {
        const d = Math.round((ev.clientX - startX) / w);
        const desired = Math.max(0, startLeft + d);
        if (desired === lastLeft) return;
        lastLeft = desired;
        // live-каскад: тянем полосу и мгновенно толкаем зависимые (Wix-style)
        this._ganttPushDown(g, desired);
        this.ganttDrag.days = g.leftDays;
        this._ganttRelayout();
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (g.leftDays !== startLeft) {
          this.pushHistory('Сдвиг работы на диаграмме');
          g.row.startAt = g.leftDays; // фиксация в данные → deep-$watch инвалидирует кэш
          this.logActivity(`«${(g.name || '').slice(0, 30)}» начнётся на ${g.leftDays}-й день`);
        }
        this.ganttDrag = null;
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },

    resetGanttShift(row) {
      row.startAt = null;
      this.logActivity('Сброс ручного сдвига работы');
    },

    /** Ядро создания связи: fromRow → toRow (тип из переключателя тулбара).
        Единая точка для обоих жестов (drag-drag и клик-по-клику): валидация,
        история, запись в pred в нумерации ТАБЛИЦЫ (rowNumber), лог. */
    _createLink(fromRow, toRow) {
      if (!fromRow || !toRow || fromRow.id === toRow.id) return false;
      const fromNum = this.rowNumber(fromRow.id);
      if (fromNum === null || fromNum === undefined) {
        this.logActivity('Предшественник не виден в таблице (фильтр?) — связь не создана');
        return false;
      }
      const toNum = this.rowNumber(toRow.id);
      if (toNum === null || toNum === undefined) {
        this.logActivity('Преемник не виден в таблице (фильтр?) — связь не создана');
        return false;
      }
      this.pushHistory('Создана связь Ганта');
      // несколько связей на строку + тип: «SS:3,5» (MS Project-style);
      // повторная связь между теми же работами перезаписывает тип, а не дублируется
      const refs = parsePredRefs(toRow.pred).filter((r) => r.num !== fromNum);
      refs.push({ type: this.ganttLinkType || 'FS', num: fromNum });
      toRow.pred = formatPredRefs(refs);
      this.logActivity(`Связь ${this.ganttLinkType}: №${fromNum} → №${toNum}`);
      return true;
    },

    /** Клик по полосе в режиме рисования связи (клик-по-клику): первый клик — источник,
        второй — цель. Источник хранится по id строки: ссылки на прокси-объекты Alpine
        ненадёжны (после пересмотра x-for это другие объекты) — сравнение только по id. */
    ganttLinkClick(e, g) {
      e.stopPropagation();
      const active = this.ganttLinkFromId !== null && this.ganttLinkFromId !== undefined;
      if (!active) {
        this.ganttLinkFromId = g.row.id;
        this.layoutTick++;
        this.logActivity('Выбран предшественник — кликните по работе-преемнику');
        return;
      }
      if (this.ganttLinkFromId !== g.row.id) {
        const fromG = this._ganttRowById(this.ganttLinkFromId);
        this._createLink(fromG ? fromG.row : null, g.row);
      }
      this.cancelGanttLink();
    },

    /** Клик по полосе: в режиме рисования — завершить связь на этой работе;
        иначе ничего (перемещение делает mousedown-драг). */
    ganttBarClick(e, g) {
      e.stopPropagation();
      if (this.ganttLinkFromId !== null && this.ganttLinkFromId !== undefined) {
        this.ganttLinkClick(e, g);
      }
    },

    /** Движение мыши по дорожке: обновляет цель подсветки и живое превью связи */
    ganttTrackMove(e) {
      if (this.ganttLinkFromId === null || this.ganttLinkFromId === undefined) return;
      const t = e.target && e.target.closest ? e.target.closest('.at-gantt-bar') : null;
      let hoverId = null;
      if (t) {
        const tracks = document.querySelectorAll('.at-gantt .at-gantt-track');
        const idx = Array.prototype.findIndex.call(tracks, (tr) => tr.contains(t));
        const gr = idx >= 0 ? this.ganttData.rows[idx] : null;
        if (gr && gr.row.id !== this.ganttLinkFromId) hoverId = gr.row.id;
      }
      this.ganttHoverTargetId = hoverId;
      this._drawLinkPreview(e.clientX, e.clientY);
    },

    /** Подсветка цели при наведении полосы во время рисования связи */
    ganttBarHoverEnter(g) {
      if (this.ganttLinkFromId !== null && this.ganttLinkFromId !== undefined) {
        this.ganttHoverTargetId = g.row.id;
      }
    },
    ganttBarHoverLeave() {
      this.ganttHoverTargetId = null;
    },

    /** Начало рисования связи перетаскиванием (drawio/Wix-style): зажать ручку ⤳
        и тянуть к другой работе. На движении — snap-превью к цели; на отпускании —
        связь создаётся, только если курсор над полосой другой работы. Иначе режим
        остаётся активным (можно завершить вторым кликом). */
    startLinkDrag(e, g) {
      e.preventDefault();
      e.stopPropagation();
      const active = this.ganttLinkFromId !== null && this.ganttLinkFromId !== undefined;
      if (active && this.ganttLinkFromId !== g.row.id) {
        // уже рисуем другую связь — завершаем её на источнике нового mousedown
        const fromG = this._ganttRowById(this.ganttLinkFromId);
        this._createLink(fromG ? fromG.row : null, g.row);
        this.cancelGanttLink();
        return;
      }
      if (!active) this.ganttLinkFromId = g.row.id;
      const trackAt = (target) => {
        const tracks = document.querySelectorAll('.at-gantt .at-gantt-track');
        return Array.prototype.findIndex.call(tracks, (tr) => tr.contains(target));
      };
      const onMove = (ev) => {
        const t = ev.target && ev.target.closest ? ev.target.closest('.at-gantt-bar') : null;
        let hoverId = null;
        if (t) {
          const idx = trackAt(t);
          const gr = idx >= 0 ? this.ganttData.rows[idx] : null;
          if (gr && gr.row.id !== this.ganttLinkFromId) hoverId = gr.row.id;
        }
        this.ganttHoverTargetId = hoverId;
        this._drawLinkPreview(ev.clientX, ev.clientY);
      };
      const onUp = (ev) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        const target = ev.target && ev.target.closest ? ev.target.closest('.at-gantt-bar') : null;
        let created = false;
        if (target) {
          const idx = trackAt(target);
          const gTo = idx >= 0 ? this.ganttData.rows[idx] : null;
          if (gTo && gTo.row.id !== this.ganttLinkFromId) {
            const fromG = this._ganttRowById(this.ganttLinkFromId);
            created = this._createLink(fromG ? fromG.row : null, gTo.row);
          }
        }
        if (created) {
          this.cancelGanttLink();
        } else {
          this.ganttHoverTargetId = null;
          this.ganttLinkPath = null;
          if (this.ganttLinkFromId !== null && this.ganttLinkFromId !== undefined) {
            this.logActivity('Отпустите стрелку на другой работе — или кликните по ней');
          }
        }
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },

    /** Удалить одну связь предшественника (по номеру строки-источника) */
    removePredRef(row, num) {
      const refs = parsePredRefs(row.pred).filter((r) => r.num !== num);
      row.pred = formatPredRefs(refs);
    },

    removePred(row) {
      row.pred = '';
    },

    ganttDateLabel(offsetDays) {
      const d = new Date(this.ganttData.start + offsetDays * 86400000);
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    },

    ganttTicks() {
      // редкие подписи, чтобы шкала не сливалась
      const step = this.ganttData.totalDays <= 15 ? 1 : this.ganttData.totalDays <= 40 ? 5 : 10;
      const ticks = [];
      for (let i = 0; i < this.ganttData.totalDays; i += step) ticks.push(i);
      return ticks;
    },

    ganttDayWidth() {
      return Math.max(26, Math.min(64, Math.floor(980 / this.ganttData.totalDays)));
    },

    /** Размер SVG-слоя связей (ширина/высота сетки диаграммы) */
    get ganttLinksSize() {
      const g = this.ganttData;
      void this.layoutTick; // пересчитать после изменения раскладки (ResizeObserver в ganttLinks)
      // Ширина: правый край самой правой полосы + отступ. Иначе SVG-слой не дотягивается
      // до дальних полос и связи там обрезаются (выглядит как «связи не отображаются»).
      const w = this.ganttDayWidth();
      const maxRight = g.rows.reduce((m, r) => Math.max(m, (r.leftDays + r.spanDays) * w), 0);
      let h = 34 + g.sections.length * 38 + g.rows.length * 34;
      if (g.rows.length) {
        const grid = document.querySelector('.at-gantt');
        if (grid) h = Math.max(h, grid.getBoundingClientRect().height);
      }
      return {
        w: Math.max(g.totalDays * w, maxRight + 24),
        h,
      };
    },

    /** Правый клик по полосе: убрать связь или ручной сдвиг */
    onBarContext(g) {
      if (g.row.pred) {
        // Клик по стрелке связи — переключить тип FS→SS→FF→SF (жест из draw.io/MS Project),
        // правый клик — удалить связь целиком.
        this.pushHistory('Удалена связь Ганта');
        g.row.pred = '';
        this.logActivity(`Снята связь у «${(g.name || '').slice(0, 30)}»`);
      } else if (Number(g.row.startAt) >= 0) {
        this.resetGanttShift(g.row);
      }
    },

    /** Переключатель типа создаваемой связи в тулбаре Ганта */
    setGanttLinkType(t) {
      this.ganttLinkType = t;
    },

    /** Чип предшественника: клик — сменить тип связи (FS→SS→FF→SF), alt+клик — удалить одну связь */
    predChipClick(e, row) {
      e.stopPropagation();
      const refs = parsePredRefs(row.pred);
      if (!refs.length) return;
      if (e.altKey) {
        this.pushHistory('Удалена связь Ганта');
        refs.shift();
        row.pred = formatPredRefs(refs);
        return;
      }
      this.pushHistory('Изменён тип связи Ганта');
      const order = ['FS', 'SS', 'FF', 'SF'];
      const r = refs[0];
      r.type = order[(order.indexOf(r.type) + 1) % 4];
      row.pred = formatPredRefs(refs);
    },

    /** Экспорт Ганта в PNG (указатель №5: PNG/SVG слиты в одну кнопку — выбор формата в диалоге) */
    exportGantt() {
      const svg = this.buildGanttSVG();
      const choice = confirm(
        'Экспорт диаграммы Ганта.\n\nOK — сохранить как PNG (растровое изображение)\nОтмена — сохранить как SVG (векторный файл)'
      );
      if (choice) this.exportGanttPng(svg);
      else this.exportGanttSvg(svg);
    },

    ganttHasShifts() {
      return this.ganttData.rows.some((g) => Number(g.row.startAt) >= 0);
    },

    resetAllGanttShifts() {
      this.pushHistory('Сброшены все ручные сдвиги Ганта');
      for (const sec of this.data.sections) {
        const secs = this.isChapter(sec) ? sec.children : [sec];
        for (const s of secs) for (const r of s.resources) r.startAt = null;
      }
      this.logActivity('Все работы возвращены в автоплан');
    },

    groupTypeLabel(type) {
      return this.typeLabel({ type });
    },

    /** Строки сводной ведомости (плоские: группировки и сортировки запрещены) */
    get summaryRows() {
      const f = this.summarySearch.trim().toLowerCase();
      const all = this.summaryResources.filter(
        (e) =>
          !f || String(e.name).toLowerCase().includes(f) || String(e.unit).toLowerCase().includes(f)
      );
      return all.map((e, i) => ({
        key: 'r' + i,
        num: i + 1,
        e,
        avgPrice: e.qty > 0 ? e.cost / e.qty : e.price || 0,
      }));
    },

    exportSummaryCsv() {
      const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const lines = ['№;Наименование;Раздел;Тип;Ед.;Кол-во;Средняя цена;Стоимость;Расценки'];
      let n = 0;
      for (const e of this.summaryResources) {
        lines.push(
          [
            ++n,
            e.name,
            [...e.sections].join(', '),
            this.groupTypeLabel(e.type),
            e.unit,
            e.qty,
            (e.qty > 0 ? e.cost / e.qty : 0).toFixed(2),
            e.cost.toFixed(2),
            [...e.bases].join(' / '),
          ]
            .map(esc)
            .join(';')
        );
      }
      this.download('svod-resursy.csv', '\ufeff' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    },

    get nsbFiltered() {
      const f = this.nsbSearch.trim().toLowerCase();
      if (!f) return this.nsbItems;
      return this.nsbItems.filter(
        (n) =>
          (n.name || '').toLowerCase().includes(f) ||
          (n.basis || '').toLowerCase().includes(f) ||
          (n.unit || '').toLowerCase().includes(f)
      );
    },

    nsbAddNew() {
      const item = {
        id: uid(),
        basis: '',
        name: '',
        type: 'material',
        unit: '',
        price: 0,
        note: '',
      };
      this.nsbItems.unshift(item);
      this.nsbEditId = item.id;
      this.nsbDraft = { ...item };
      this.saveNsb();
    },

    nsbEdit(item) {
      this.nsbEditId = item.id;
      this.nsbDraft = { ...item };
    },

    nsbSaveEdit() {
      if (!this.nsbDraft) return;
      const idx = this.nsbItems.findIndex((n) => n.id === this.nsbEditId);
      if (idx >= 0) {
        this.nsbItems[idx] = { ...this.nsbItems[idx], ...this.nsbDraft };
        this.saveNsb();
      }
      this.nsbEditId = null;
      this.nsbDraft = null;
    },

    nsbDelete(id) {
      const item = this.nsbItems.find((n) => n.id === id);
      if (!item) return;
      if (!confirm(`Удалить из НСБ «${item.name || item.basis}»?`)) return;
      this.nsbItems = this.nsbItems.filter((n) => n.id !== id);
      if (this.nsbEditId === id) {
        this.nsbEditId = null;
        this.nsbDraft = null;
      }
      this.saveNsb();
    },

    nsbResetDefaults() {
      if (
        !confirm(
          'Восстановить стартовый набор расценок НСБ? Текущие изменения базы будут потеряны.'
        )
      )
        return;
      this.nsbItems = defaultNsb();
      this.nsbEditId = null;
      this.nsbDraft = null;
      this.saveNsb();
    },

    nsbApply(item) {
      const targetId = this.selectedIds.size === 1 ? [...this.selectedIds][0] : null;
      let appliedTo = null;
      if (targetId) {
        for (const sec of this.data.sections) {
          const r = sec.resources.find((x) => x.id === targetId);
          if (r) {
            appliedTo = r;
            break;
          }
        }
      }
      if (!appliedTo) {
        // создаём новую запись в текущем разделе
        let si = this.currentTargetSection();
        if (si === null || !this.data.sections[si]) {
          this.data.sections.push(newSection('Новый раздел'));
          si = this.data.sections.length - 1;
          this.activeTab = si;
        }
        appliedTo = newRow({});
        this.data.sections[si].resources.push(appliedTo);
      }
      appliedTo.basis = item.basis;
      appliedTo.name = item.name;
      appliedTo.type = item.type;
      appliedTo.unit = item.unit;
      appliedTo.price = item.price;
      copyFrameworkFields(item, appliedTo);
      this.nsbModalOpen = false;
    },

    nsbApplyToSelected() {
      if (!this.selectedIds.size) {
        alert('Сначала выделите записи в таблице (клик по номеру строки, Ctrl+A — все видимые).');
        return;
      }
      this.pushHistory('Применены цены НСБ к выделению');
      let updated = 0;
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          if (!this.selectedIds.has(r.id)) continue;
          const hit = this.nsbItems.find(
            (n) =>
              (r.basis &&
                n.basis &&
                r.basis.trim().toLowerCase() === n.basis.trim().toLowerCase()) ||
              (r.name && n.name && r.name.trim().toLowerCase() === n.name.trim().toLowerCase())
          );
          if (hit) {
            r.price = hit.price;
            if (!r.unit) r.unit = hit.unit;
            if (!r.basis) r.basis = hit.basis;
            updated++;
          }
        }
      }
      alert(
        updated
          ? `Цены из НСБ обновлены в ${updated} выделенных записях.`
          : 'Среди выделенных записей нет совпадений с НСБ (по шифру или наименованию).'
      );
    },

    exportNsb() {
      // TOON-таблица (схема smetapro.nsb.v1) вместо JSON — компактнее в ~2 раза
      const toon = toonEncode(storage.STORAGE_KEYS.NSB, this.nsbItems); // 'TOON1:' + таблица
      this.download('nsb.toon', toon, 'text/plain;charset=utf-8');
    },

    importNsb(ev) {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          // автоопределение: TOON1:-таблица или legacy JSON-массив
          const arr = toonDecode(storage.STORAGE_KEYS.NSB, String(reader.result));
          if (!Array.isArray(arr)) throw new Error('ожидается массив записей');
          const FW_KEYS = [
            'wasteGroup',
            'perUnit',
            'unitMassT',
            'vehicleCapT',
            'distanceKm',
            'tariffPerKm',
            'supplyFee',
            'kGabarit',
            'manipulatorFlag',
            'unloadMachineHr',
            'unloadHours',
            'moveDistM',
            'moveSpeedMh',
            'perPct',
            'storePct',
            'perOn',
            'storeOn',
            'night',
            'holiday',
          ];
          this.nsbItems = arr.map((n) => {
            const base = {
              id: n.id || uid(),
              basis: n.basis || '',
              name: n.name || '',
              type: n.type || 'material',
              unit: n.unit || '',
              price: Number(n.price) || 0,
              note: n.note || '',
            };
            for (const k of FW_KEYS) if (n[k] !== undefined) base[k] = n[k];
            return base;
          });
          this.saveNsb();
        } catch (e) {
          alert('Не удалось прочитать НСБ: ' + e.message);
        }
      };
      reader.readAsText(file, 'utf-8');
      ev.target.value = '';
    },

    printPage() {
      window.print();
    },

    suggestionsFor(field, item) {
      const vals = new Set<string>();
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          const v = field === 'total' ? null : r[field];
          if (v !== '' && v !== null && !(Number(v) === 0)) vals.add(String(v));
        }
      }
      let arr: string[] = [...vals].sort((a, b) => a.localeCompare(b, 'ru'));
      // для предшественника — номера существующих записей
      if (field === 'pred') {
        arr = this.flatRows.filter((i) => i.row.id !== item.row.id).map((i) => String(i.index));
      }
      return arr.slice(0, 12);
    },

    acceptSuggestion(item, field, value) {
      if (field === 'qty' || field === 'price' || field === 'days')
        item.row[field] = Number(value) || 0;
      else item.row[field] = value;
      this.editing = null;
      if (field === 'price') this.syncResourcePrice(item.row);
    },

    // mergeSameResources(groupKey) удалён: группировки запрещены (см. README «⛔ Запрещено»).
  };
};

// Вспомогательный Alpine-компонент для SVG-слоя связей Ганта.
// Нужен потому, что parse5 (используется Vite при сборке) не умеет
// сериализовать <template x-for>/<template x-if> внутри SVG-контекста —
// вместо этого связи перерисовываются императивно через x-effect (см. index.html).
window.ganttLinks = function ganttLinks() {
  const NS = 'http://www.w3.org/2000/svg';
  let lastKey = '';
  return {
    layoutTick: 0,
    _ro: null,
    init(el) {
      // После первой отрисовки DOM пересчитываем связи по фактическим координатам полос.
      requestAnimationFrame(() => {
        this.layoutTick++;
      });
      if (typeof ResizeObserver === 'undefined') return;
      const grid = el.closest('.at-gantt');
      if (!grid) return;
      let raf = 0;
      this._ro = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          this.layoutTick++;
        });
      });
      this._ro.observe(grid);
    },
    destroy() {
      if (this._ro) this._ro.disconnect();
    },
    render(el, lines, preview) {
      // Инкремент при изменении раскладки: ResizeObserver в init() подписывает
      // компонент на пересчёт ganttLinkLines после полной отрисовки DOM.
      this.layoutTick++;
      // Связи: перерисовываем только при изменении набора путей (без ре-анимации
      // на каждое движение мыши). Ключ — содержимое, а не количество: при удалении
      // одной из нескольких связей тоже нужна перерисовка.
      const key = lines.map((l) => l.d + '#' + l.cls).join('|');
      if (key !== lastKey) {
        lastKey = key;
        el.replaceChildren(
          ...lines.map((l) => {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', l.d);
            p.setAttribute('class', 'at-gantt-linkpath ' + l.cls);
            p.setAttribute('marker-end', 'url(#arrowhead)');
            return p;
          })
        );
        // Анимация «прорисовки» стрелки как в draw.io: длина пути -> stroke-dashoffset.
        requestAnimationFrame(() => {
          for (const p of el.querySelectorAll('.at-gantt-linkpath')) {
            try {
              const len = Math.ceil(p.getTotalLength()) + 8;
              p.style.setProperty('--len', len);
            } catch {
              /* getTotalLength недоступен вне браузера */
            }
          }
        });
      }
      // Превью рисования связи — отдельный слой поверх (обновляется каждый mousemove).
      let pv = document.getElementById('gantt-link-preview-layer') as unknown as SVGGElement | null;
      if (!preview && !pv) return;
      if (!pv) {
        pv = document.createElementNS(NS, 'g');
        pv.id = 'gantt-link-preview-layer';
        pv.style.pointerEvents = 'none';
        el.parentNode.appendChild(pv);
      }
      if (!preview) {
        pv.remove();
        return;
      }
      pv.replaceChildren(
        (() => {
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', preview);
          p.setAttribute('class', 'at-gantt-linkpath preview');
          p.setAttribute('marker-end', 'url(#arrowhead)');
          return p;
        })()
      );
    },
  };
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  // Проверяем доступность localStorage
  if (!storage.isLocalStorageAvailable()) {
    alert('localStorage не доступен. Некоторые функции могут не работать.');
  }
});

export default window.smeta;
