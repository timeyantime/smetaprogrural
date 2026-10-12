/* СметаПро — ресурсный метод. Модель данных и логика на Alpine.js.
   Интерфейс в стиле Airtable: вкладки-разделы, ячейки с inline-редактированием,
   чипы single-select, группировка, выделение записей, боковая сводка, статус-бар. */

const LS_KEY = 'smetapro.v4';
const LS_MIGRATE_FROM = 'smetapro.v3';
const LS_NSB_KEY = 'smetapro.nsb.v1';
const LS_RESOURCES_KEY = 'smetapro.resources.v1';
const LS_UI_KEY = 'smetapro.ui.v1';
const LS_HISTORY_KEY = 'smetapro.history.v1';
const LS_COLS_KEY = 'smetapro.v4.cols';
const PAGE_SIZE = 50; // виртуализация: строк на страницу (пункт #38)

/* Миграция v3 → v4: дополняем новую схему дефолтами, ничего не теряя */
function migrateV3toV4(obj) {
  const d = defaultData();
  obj.recalcMode = obj.recalcMode || 'auto';
  obj.company = { ...d.company, ...(obj.company || {}) };
  obj.rates = { ...d.rates, ...(obj.rates || {}) };
  obj.rounding = { ...d.rounding, ...(obj.rounding || {}) };
  obj.sections.forEach((sec) => {
    sec.parentId = sec.parentId ?? null;
    sec.collapsed = !!sec.collapsed;
    (sec.resources || []).forEach((r) => { r.predecessor = r.predecessor || ''; });
  });
  return obj;
}

/* Нормативно-справочная база (НСБ) — стартовые расценки */
function defaultNsb() {
  return [
    { id: uid(), basis: 'ГЭСН 81-02-01-01-01', name: 'Разработка грунта экскаватором под фундаменты', type: 'labor', unit: 'чел.-ч', price: 250, note: 'Средний разряд работ' },
    { id: uid(), basis: 'ГЭСНр 81-02-01-01-01', name: 'Экскаватор одноковшовый 0,4 м³', type: 'machine', unit: 'маш.-ч', price: 1450, note: 'Вкл. Тмр машиниста' },
    { id: uid(), basis: 'ГЭСН 81-02-03-01-01', name: 'Устройство бетонных подготовки', type: 'labor', unit: 'чел.-ч', price: 275, note: '' },
    { id: uid(), basis: 'ФЕР 81-02-05-01-01', name: 'Монтаж фундаментных блоков', type: 'labor', unit: 'чел.-ч', price: 310, note: '' },
    { id: uid(), basis: 'Ресурс-01', name: 'Бетон В22.5 (М300)', type: 'material', unit: 'м3', price: 6200, note: 'ГОСТ 7473-2010' },
    { id: uid(), basis: 'Ресурс-02', name: 'Песок строительный', type: 'material', unit: 'т', price: 890, note: 'Карьер' },
    { id: uid(), basis: 'Ресурс-03', name: 'Щебень фр. 5-20 мм', type: 'material', unit: 'т', price: 1650, note: '' },
    { id: uid(), basis: 'Ресурс-04', name: 'Арматура А500С Ø12', type: 'material', unit: 'т', price: 62000, note: '' },
    { id: uid(), basis: 'ГЭСНм 81-03', name: 'Кран стреловой 25 т', type: 'machine', unit: 'маш.-ч', price: 3800, note: 'Вкл. Тмр' },
  ];
}

let uidCounter = 0;
const uid = () => `id-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;

function newRow(partial = {}) {
  return {
    id: uid(),
    basis: '',        // Обоснование (шифр расценки)
    name: '',         // Наименование работ и затрат
    type: 'material', // labor | machine | material
    operator: false,  // для machine: оплата труда машинистов (Тмр)
    unit: '',         // Ед. изм.
    qty: 0,           // Кол-во
    price: 0,         // Текущая цена, руб.
    note: '',         // Примечание
    days: null,       // Длительность, дни (для диаграммы Ганта)
    pred: '',         // Предшественник: номер записи (для связей Ганта)
    startAt: null,    // Принудительное начало в днях от старта (перемещённое мышью)
    ...partial,
  };
}

/* Ключ ресурса для единого справочника цен (#9): тип + наименование + единица */
function resKey(r) {
  const name = String(r.name || '').trim().toLowerCase();
  if (!name) return null;
  const type = r.type === 'labor' ? 'l' : r.type === 'machine' ? 'm' : 'c';
  return `${type}|${name}|${String(r.unit || '').trim().toLowerCase()}`;
}

/* Дата начала работ сметы (для диаграммы Ганта) */
function defaultStartDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function newSection(name = 'Новый раздел') {
  return { id: uid(), name, resources: [] };
}

function defaultData() {
  return {
    title: 'Локальная смета № 1',
    sections: [
      {
        id: uid(),
        name: 'Земляные работы',
        parentId: null,
        collapsed: false,
        resources: [
          newRow({
            basis: 'ГЭСН 81-02-01-01-01',
            name: 'Разработка грунта под фундаменты экскаватором',
            type: 'labor',
            unit: 'чел.-ч',
            qty: 10.5,
            price: 250,
            note: 'Слесарь 4 разр.',
            days: 3,
          }),
          newRow({
            basis: 'ГЭСНр 81-02-01-01-01',
            name: 'Экскаватор одноковшовый 0,4 м³',
            type: 'machine',
            operator: true,
            unit: 'маш.-ч',
            qty: 5.2,
            price: 1450,
            note: '',
            days: 2,
          }),
          newRow({
            basis: '',
            name: 'Песок строительный',
            type: 'material',
            unit: 'т',
            qty: 12,
            price: 890,
            note: 'Прайс поставщика №14',
            days: 1,
          }),
        ],
      },
      {
        id: uid(),
        name: 'Фундаменты',
        parentId: null,
        collapsed: false,
        resources: [
          newRow({
            basis: 'ГЭСН 81-02-03-01-01',
            name: 'Устройство бетонных подготовки',
            type: 'labor',
            unit: 'чел.-ч',
            qty: 24,
            price: 275,
            note: '',
            days: 4,
          }),
          newRow({
            basis: '',
            name: 'Бетон В22.5 (М300)',
            type: 'material',
            unit: 'м3',
            qty: 18.4,
            price: 6200,
            note: 'ГОСТ 7473-2010',
            days: 2,
          }),
        ],
      },
    ],
    startDate: defaultStartDate(),
    recalcMode: 'auto', // auto | manual (пункт #48: ручной пересчёт)
    company: {           // пункт #24: реквизиты для титульного листа печати
      customer: '', contractor: '', objectName: '', address: '',
      basis: '', chief: '', phone: '', date: '',
    },
    rates: {
      overheadPct: 15,
      overheadBase: 'labor', // labor | pz
      profitPct: 10,
      profitBase: 'labor',   // labor | pz
      vatPct: 20,
    },
    rounding: {         // пункт #11: Методика № 421/пр, п. 58 (таблица 22)
      mode: 'kopecks',  // kopecks | rubles
      method: 'math',   // math | bank | truncate
    },
  };
}

window.smeta = function smeta() {
  return {
    /* ---------- состояние ---------- */
    data: loadLocal() || defaultData(),
    filter: '',
    groupBy: 'none',       // none | type | unit
    toggleGroupMenu: false,
    activeTab: null,       // null = «Все разделы», иначе индекс раздела
    renamingSection: null, // индекс раздела в режиме переименования вкладки
    tabDragFrom: null,
    selectedIds: new Set(),
    editing: null,         // { key: `${rowId}|${field}` }
    expandedRow: null,     // { si, row, index } — модальное окно записи
    sidebarCollapsed: false,
    sectionModalOpen: false,   // модальное окно добавления/редактирования раздела
    sectionModalMode: 'create',// create | edit
    sectionDraft: { name: '', index: null },
    recordModalOpen: false,    // модальное окно добавления записи
    recordDraft: null,         // { si, rowId }
    sortState: { field: null, dir: 1 },
    multiSort: [],             // пункт #15: многоуровневая сортировка [{field,dir}]
    fieldMenuFor: null,        // id колонки, для которой открыто меню поля
    savedFlash: false,         // подсветка кнопки «Сохранено»
    lastSavedAt: null,         // время последнего автосохранения

    /* UI v4 */
    viewTab: 'table',              // table | gantt | summary (Сводная ведомость)
    groupCollapsed: {},            // сворачивание групп (#17): { key: true }
    page: 0,                       // виртуализация: текущая страница (#38)
    historyOpen: false,            // журнал изменений (#46)
    activityLog: loadActivity(),   // [{time, text}]
    undoStack: [], redoStack: [],  // Undo/Redo (#34)
    _histBusy: false,
    ctxMenu: null,                 // контекстное меню строки (#35): {x,y,item}
    batchBar: false,               // панель батч-редактирования (#36)
    batchPrice: '', batchQty: '', batchUnit: '',
    darkTheme: false,              // тёмная тема (#41)
    calcModalOpen: false,          // калькулятор трудозатрат / маш.-часов (#48)
    projModalOpen: false,          // реквизиты объекта (титульный лист, #24)
    resModalOpen: false,           // единый справочник ресурсов (#9)
    resSearch: '',
    resources: loadResources(),
    dirty: false,                  // есть несохранённые изменения при ручном режиме
    ganttDrag: null,               // перетаскивание полосы Ганта (#49)
    ganttLinkFrom: null,           // рисование связи щелчком (#49)
    ganttLinkPath: null,           // [x1,y1,x2,y2] для превью связи

    /* UI v3: колонки, печать, вью-табы, модалки справочника и НСБ */
    columns: [                 // ширины столбцов — можно менять мышью за границы заголовков
      { key: 'num',      label: '#',              width: 44,  min: 34,  sortable: false },
      { key: 'basis',    label: 'Обоснование',    width: 120, min: 70,  sortable: true },
      { key: 'name',     label: 'Наименование работ и затрат', width: 300, min: 140, sortable: true },
      { key: 'type',     label: 'Тип затрат',     width: 150, min: 110, sortable: true },
      { key: 'unit',     label: 'Ед. изм.',       width: 90,  min: 60,  sortable: true },
      { key: 'qty',      label: 'Кол-во',         width: 100, min: 70,  sortable: true },
      { key: 'price',    label: 'Текущая цена, ₽',width: 120, min: 80,  sortable: true },
      { key: 'total',    label: 'Стоимость, ₽',   width: 130, min: 90,  sortable: true },
      { key: 'note',     label: 'Примечание',     width: 190, min: 90,  sortable: true },
      { key: 'days',     label: 'Длит., дн.',     width: 90,  min: 60,  sortable: true },
      { key: 'pred',     label: 'Предшест.',      width: 90,  min: 60,  sortable: true },
      { key: 'actions',  label: '',               width: 118, min: 118, sortable: false },
    ],
    printOrientation: 'landscape', // landscape | portrait
    printModalOpen: false,
    helpModalOpen: false,
    nsbModalOpen: false,
    nsbSearch: '',
    nsbItems: loadNsb(),
    nsbEditId: null,               // id редактируемой записи НСБ (null — не редактируется)
    nsbDraft: null,                // копия записи для редактирования

    /* ---------- инициализация / хранение ---------- */

    init() {
      this.loadColWidths();
      this.loadUI();
      this.$watch('data', () => {
        if (this.data.recalcMode === 'manual') { this.dirty = true; }
        else { this.saveLocal(); }
      }, { deep: true });
      this.$watch('columns', () => this.saveColWidths(), { deep: true });
      this.$watch('multiSort', () => this.saveUI());
      this.$watch('hiddenCols', () => this.saveUI());
      this.$watch('darkTheme', () => { document.body.classList.toggle('theme-dark', this.darkTheme); this.saveUI(); });
      this.$watch('viewTab', () => this.saveUI());
      document.body.classList.toggle('theme-dark', this.darkTheme);

      window.addEventListener('keydown', (e) => {
        const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
        if (e.key === 'Escape') {
          this.editing = null; this.expandedRow = null; this.selectedIds = new Set();
          this.sectionModalOpen = false; this.fieldMenuFor = null; this.ctxMenu = null;
          this.helpModalOpen = false; this.printModalOpen = false;
          this.calcModalOpen = false; this.projModalOpen = false; this.resModalOpen = false;
          this.historyOpen = false; this.batchBar = false;
          this.ganttLinkFrom = null; this.ganttLinkPath = null;
          if (this.nsbModalOpen) this.cancelNsbEdit();
          this.nsbModalOpen = false;
          if (this.recordModalOpen) this.cancelRecordModal();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !inField) {
          e.preventDefault();
          this.selectedIds = new Set(this.flatRows.map((i) => i.row.id));
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && this.selectedIds.size === 1) {
          const item = this.flatRows.find((i) => this.selectedIds.has(i.row.id));
          if (item) this.duplicateRowById(item.si, item.row.id);
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
          e.preventDefault();
          e.shiftKey ? this.redoAction() : this.undoAction();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inField) {
          e.preventDefault(); this.redoAction();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault(); this.manualSave();
        }
        if (!inField && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
          // клавиатурная навигация по гриду (#37)
          e.preventDefault();
          this.moveGridCursor(e.key === 'ArrowDown' ? 1 : -1);
        }
        if (!inField && e.key === 'F2' && this.cursor >= 0) {
          e.preventDefault();
          const items = this.pagedRows;
          const item = items[Math.min(this.cursor, items.length - 1)];
          if (item) this.openCell('name', item);
        }
        if (!inField && e.key === 'Delete' && this.selectedIds.size) {
          e.preventDefault();
          this.removeSelected();
        }
      });
      // защита от закрытия вкладки при несохранённых изменениях (#39)
      window.addEventListener('beforeunload', (e) => {
        if (this.dirty) { e.preventDefault(); e.returnValue = ''; }
      });
    },

    /* ---------- настройки интерфейса (тема, сортировка, скрытые колонки) ---------- */

    saveUI() {
      try {
        localStorage.setItem(LS_UI_KEY, JSON.stringify({
          darkTheme: this.darkTheme, multiSort: this.multiSort,
          hiddenCols: this.hiddenCols, viewTab: this.viewTab, groupBy: this.groupBy,
        }));
      } catch (e) { /* ignore */ }
    },

    loadUI() {
      try {
        const ui = JSON.parse(localStorage.getItem(LS_UI_KEY) || '{}');
        if (ui.darkTheme) this.darkTheme = true;
        if (Array.isArray(ui.multiSort)) this.multiSort = ui.multiSort;
        if (Array.isArray(ui.hiddenCols)) this.hiddenCols = ui.hiddenCols;
        if (['table', 'gantt', 'summary'].includes(ui.viewTab)) this.viewTab = ui.viewTab;
        if (ui.groupBy) this.groupBy = ui.groupBy;
      } catch (e) { /* ignore */ }
    },

    /* ---------- видимость колонок (#18) ---------- */

    hiddenCols: [],

    visibleColumns() {
      return this.columns.filter((c) => !this.hiddenCols.includes(c.key));
    },

    toggleColVisibility(key) {
      if (key === 'num' || key === 'name' || key === 'actions') return; // всегда видимы
      this.hiddenCols = this.hiddenCols.includes(key)
        ? this.hiddenCols.filter((k) => k !== key)
        : [...this.hiddenCols, key];
      this.fieldMenuFor = null;
    },

    colHidden(key) { return this.hiddenCols.includes(key); },

    /* ---------- Undo/Redo (#34) + журнал изменений (#46) ---------- */

    pushHistory(label) {
      if (this._histBusy) return;
      try {
        this.undoStack.push(JSON.stringify(this.data));
        if (this.undoStack.length > 60) this.undoStack.shift();
        this.redoStack = [];
        this.logActivity(label);
      } catch (e) { /* ignore */ }
    },

    undoAction() {
      if (!this.undoStack.length) return;
      this._histBusy = true;
      this.redoStack.push(JSON.stringify(this.data));
      this.data = JSON.parse(this.undoStack.pop());
      this._histBusy = false;
      this.logActivity('↶ Отмена действия');
    },

    redoAction() {
      if (!this.redoStack.length) return;
      this._histBusy = true;
      this.undoStack.push(JSON.stringify(this.data));
      this.data = JSON.parse(this.redoStack.pop());
      this._histBusy = false;
      this.logActivity('↷ Повтор действия');
    },

    logActivity(text) {
      this.activityLog.unshift({ time: new Date().toLocaleTimeString('ru-RU'), text });
      if (this.activityLog.length > 100) this.activityLog.length = 100;
      try { localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(this.activityLog)); } catch (e) { /* ignore */ }
    },

    clearActivity() {
      this.activityLog = [];
      try { localStorage.removeItem(LS_HISTORY_KEY); } catch (e) { /* ignore */ }
    },

    /* ---------- единый справочник ресурсов (#9) ---------- */

    get resourceIndex() {
      // ключ → { name, type, unit, price, uses, sections:Set }
      const map = new Map();
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          const k = resKey(r);
          if (!k) continue;
          if (!map.has(k)) map.set(k, { key: k, name: r.name, type: r.type, unit: r.unit, prices: new Set(), uses: 0, sections: new Set() });
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
      return arr.filter((r) => r.name.toLowerCase().includes(f) || r.unit.toLowerCase().includes(f));
    },

    openResHub() { this.resModalOpen = true; },

    applyResourcePrice(entry, price) {
      const p = Number(price);
      if (!isFinite(p) || p < 0) return;
      let n = 0;
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          if (resKey(r) === entry.key) { r.price = p; n++; }
        }
      }
      this.pushHistory(`Цена ресурса «${entry.name}» → ${p} ₽ (${n} записей)`);
    },

    /* подставить ресурс из справочника в строку поиска НСБ/ресурсов */
    findResourceByName(name) {
      const f = String(name || '').trim().toLowerCase();
      if (!f) return null;
      for (const sec of this.data.sections)
        for (const r of sec.resources)
          if (String(r.name).trim().toLowerCase() === f) return r;
      return null;
    },

    /* ---------- ширины столбцов (drag за границу заголовка, как в Airtable) ---------- */

    saveColWidths() {
      try {
        const map = {};
        for (const c of this.columns) map[c.key] = c.width;
        localStorage.setItem(LS_COLS_KEY, JSON.stringify(map));
      } catch (e) { /* ignore */ }
    },

    loadColWidths() {
      try {
        const raw = localStorage.getItem(LS_COLS_KEY) || localStorage.getItem('smetapro.v3.cols');
        if (!raw) return;
        const map = JSON.parse(raw);
        for (const c of this.columns) {
          if (typeof map[c.key] === 'number' && map[c.key] >= c.min) c.width = map[c.key];
        }
      } catch (e) { /* ignore */ }
    },

    resetColWidths() {
      localStorage.removeItem(LS_COLS_KEY);
      location.reload();
    },

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

    saveLocal() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.exportable()));
        this.lastSavedAt = new Date();
        this.dirty = false;
      } catch (e) {
        console.warn('localStorage недоступен', e);
      }
    },

    manualSave() {
      this.saveLocal();
      this.savedFlash = true;
      setTimeout(() => (this.savedFlash = false), 1500);
    },

    savedTimeText() {
      if (this.data.recalcMode === 'manual' && this.dirty) return '● Есть несохранённые изменения';
      if (!this.lastSavedAt) return 'Автосохранение включено';
      const t = this.lastSavedAt.toLocaleTimeString('ru-RU');
      return `Сохранено в ${t}`;
    },

    exportable() {
      return JSON.parse(JSON.stringify(this.data));
    },

    /* ---------- вычисления (с округлением по Методике 421/пр, #11) ---------- */

    rowTotal(row) {
      return (Number(row.qty) || 0) * (Number(row.price) || 0);
    },

    sectionTotal(section) {
      return section.resources.reduce((s, r) => s + this.rowTotal(r), 0);
    },

    rnd(v) {
      const r = this.data.rounding || { mode: 'kopecks', method: 'math' };
      return roundMoney(v, r.mode, r.method);
    },

    get sums() {
      const sums = { labor: 0, machine: 0, operator: 0, material: 0 };
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          const t = this.rowTotal(r);
          if (r.type === 'labor') sums.labor += t;
          else if (r.type === 'machine') {
            sums.machine += t;
            if (r.operator) sums.operator += t;
          } else sums.material += t;
        }
      }
      sums.pz = sums.labor + sums.machine + sums.material;

      const rate = this.data.rates;
      const baseFor = (base) => (base === 'pz' ? sums.pz : sums.labor + sums.operator);
      // статьи рассчитываются с полной точностью и округляются согласно правилам (#11)
      sums.nr = this.rnd((baseFor(rate.overheadBase) * (Number(rate.overheadPct) || 0)) / 100);
      sums.sp = this.rnd((baseFor(rate.profitBase) * (Number(rate.profitPct) || 0)) / 100);
      sums.vat = this.rnd(((sums.pz + sums.nr + sums.sp) * (Number(rate.vatPct) || 0)) / 100);
      sums.grand = roundGrandTotal(sums.pz + sums.nr + sums.sp + sums.vat);
      return sums;
    },

    roundingLabel() {
      const r = this.data.rounding || {};
      return (ROUND_MODES[r.mode] || ROUND_MODES.kopecks).label + ' · ' + (ROUND_METHODS[r.method] || '');
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

    selectionTotal() {
      let s = 0;
      for (const sec of this.data.sections)
        for (const r of sec.resources)
          if (this.selectedIds.has(r.id)) s += this.rowTotal(r);
      return s;
    },

    /* ---------- валидация сметы (#10) ---------- */

    get problems() {
      const list = [];
      let n = 0;
      for (let si = 0; si < this.data.sections.length; si++) {
        const sec = this.data.sections[si];
        if (!sec.name.trim()) list.push({ sev: 'warn', text: `Раздел ${si + 1}: пустое название`, si });
        for (const r of sec.resources) {
          n++;
          const label = `№${n} «${(r.name || '').trim() || 'без наименования'}»`;
          if (!(String(r.name).trim() || String(r.basis).trim()))
            list.push({ sev: 'err', text: `${label}: пустая запись (нет ни наименования, ни обоснования)`, si, id: r.id });
          else {
            if (!String(r.basis).trim())
              list.push({ sev: 'warn', text: `${label}: нет обоснования (шифра расценки)`, si, id: r.id });
            if ((Number(r.price) || 0) <= 0)
              list.push({ sev: 'err', text: `${label}: цена ≤ 0 — стоимость не формируется`, si, id: r.id });
            if ((Number(r.qty) || 0) <= 0)
              list.push({ sev: 'warn', text: `${label}: количество ≤ 0`, si, id: r.id });
            if (!String(r.unit).trim())
              list.push({ sev: 'warn', text: `${label}: не указана единица измерения`, si, id: r.id });
          }
        }
      }
      return list;
    },

    problemCount(sev) {
      return this.problems.filter((p) => !sev || p.sev === sev).length;
    },

    goToProblem(p) {
      this.activeTab = null;
      this.page = 0;
      if (p.si != null) this.selectTab(p.si);
      if (p.id) this.selectedIds = new Set([p.id]);
      this.historyOpen = false;
    },

    /* ---------- иерархия разделов (#14): глава → раздел → подраздел ---------- */

    isChapter(sec) { return Array.isArray(sec.children) && sec.children.length > 0; },

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
      if (name == null) return;
      this.data.sections.splice(index, 0, {
        id: uid(), name: name.trim() || 'Глава', parentId: null,
        collapsed: false, resources: [], children: [],
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
        const chapter = { id: uid(), name: prev.name + ' (глава)', parentId: null, collapsed: false, resources: [], children: [prev, arr[si]] };
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
      return this.data.sections.findIndex((s) => this.isChapter(s) && s.children.some((c) => c.id === secId));
    },

    /* плоский список разделов для вкладок: главы + их дети подряд */
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

    /* ---------- плоский список строк (область просмотра) ---------- */

    get scopedSections() {
      if (this.activeTab !== null) {
        const sec = this.data.sections[this.activeTab];
        if (!sec) return [];
        if (this.isChapter(sec)) {
          if (sec.collapsed) return [];
          return [{ sec, si: this.activeTab }, ...sec.children.map((c) => ({ sec: c, si: this.activeTab }))];
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

    get flatRows() {
      const out = [];
      let n = 0;
      for (const { sec, si } of this.scopedSections) {
        if (this.groupBy !== 'none' && this.groupCollapsed.all) continue;
        for (const row of sec.resources) {
          n++;
          if (!this.matchesFilter(row)) continue;
          out.push({ row, si, ri: sec.resources.indexOf(row), index: n });
        }
      }
      return out;
    },

    /* виртуализация: страница из PAGE_SIZE строк (#38) */
    get pageCount() {
      return Math.max(1, Math.ceil(this.flatRows.length / PAGE_SIZE));
    },

    get pagedRows() {
      const p = Math.min(this.page, this.pageCount - 1);
      return this.flatRows.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
    },

    goPage(delta) {
      this.page = Math.max(0, Math.min(this.pageCount - 1, this.page + delta));
      this.cursor = -1;
    },

    gotoLastPage() { this.page = this.pageCount - 1; },

    pageLabel() {
      return `${Math.min(this.page + 1, this.pageCount)} / ${this.pageCount}`;
    },

    /* клавиатурный курсор (#37) */
    cursor: -1,

    moveGridCursor(delta) {
      const items = this.pagedRows;
      if (!items.length) return;
      this.cursor = Math.max(0, Math.min(items.length - 1, this.cursor + delta));
      const item = items[this.cursor];
      if (item) this.selectedIds = new Set([item.row.id]);
    },

    /* группы для итоговых строк (Airtable-style group subtotals) + сворачивание (#17) */

    get visibleGroups() {
      const groups = [];
      if (this.groupBy !== 'none') {
        const map = new Map();
        for (const item of this.flatRows) {
          const key = this.groupBy === 'type' ? item.row.type : (item.row.unit || '—');
          if (!map.has(key)) map.set(key, { key, label: this.groupLabel(key), total: 0, count: 0 });
          map.get(key).total += this.rowTotal(item.row);
          map.get(key).count++;
        }
        groups.push(...map.values());
      } else if (this.activeTab !== null) {
        const sec = this.data.sections[this.activeTab];
        if (sec) groups.push({ key: sec.id, label: sec.name, total: this.sectionTotal(sec), count: sec.resources.length });
      }
      return groups;
    },

    get groupedFlatRows() {
      if (this.groupBy === 'none') return this.pagedRows;
      const buckets = new Map();
      for (const item of this.flatRows) {
        const key = this.groupBy === 'type' ? item.row.type : (item.row.unit || '—');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
      }
      const out = [];
      for (const [key, rows] of buckets) {
        if (this.groupCollapsed[key]) continue;
        out.push(...rows);
      }
      return out;
    },

    toggleGroupCollapse(key) {
      this.groupCollapsed = { ...this.groupCollapsed, [key]: !this.groupCollapsed[key] };
    },

    groupCollapsedFn(key) { return !!this.groupCollapsed[key]; },

    groupLabel(key) {
      if (this.groupBy === 'unit') return key;
      return { labor: 'ЗТ — затраты труда', machine: 'ОМ — эксплуатация машин', material: 'М — материалы' }[key] || key;
    },

    groupByLabel() {
      return { type: 'По типу ресурса', unit: 'По единице измерения' }[this.groupBy] || '';
    },

    setGroupBy(v) { this.groupBy = v; this.toggleGroupMenu = false; this.saveUI(); },

    /* ---------- сводная ведомость ресурсов (#12) ---------- */

    get summaryResources() {
      const map = new Map();
      for (const sec of this.data.sections) {
        const secs = this.isChapter(sec) ? sec.children : [sec];
        for (const s of secs) {
          for (const r of s.resources) {
            const k = resKey(r);
            if (!k) continue;
            if (!map.has(k)) map.set(k, { name: r.name, type: r.type, unit: r.unit, qty: 0, cost: 0, bases: new Set(), uses: 0 });
            const e = map.get(k);
            e.qty += Number(r.qty) || 0;
            e.cost += this.rowTotal(r);
            e.uses++;
            if (String(r.basis).trim()) e.bases.add(String(r.basis).trim());
          }
        }
      }
      return [...map.values()].sort((a, b) => b.cost - a.cost);
    },

    summaryTotalCost() {
      return this.summaryResources.reduce((s, e) => s + e.cost, 0);
    },

    /* ---------- фильтр ---------- */

    matchesFilter(row) {
      const f = this.filter.trim().toLowerCase();
      if (!f) return true;
      return (row.name || '').toLowerCase().includes(f)
        || (row.basis || '').toLowerCase().includes(f)
        || (row.note || '').toLowerCase().includes(f);
    },

    hiddenCount() {
      let hidden = 0;
      for (const sec of this.data.sections)
        for (const r of sec.resources)
          if (!this.matchesFilter(r)) hidden++;
      return hidden;
    },

    visibleCount() { return this.flatRows.length; },

    totalCount() {
      return this.data.sections.reduce((s, sec) => s + sec.resources.length, 0);
    },

    /* ---------- форматирование ---------- */

    fmtNum(v) {
      const n = Number(v) || 0;
      return n.toLocaleString('ru-RU', { maximumFractionDigits: 6 });
    },

    fmtMoney(v) {
      return (Number(v) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    /* ---------- редактирование ячеек ---------- */

    openCell(field, item) {
      this.editing = { key: item.row.id + '|' + field };
    },

    commitEdit(ev, field, item) {
      const row = item.row;
      if (ev && ev.key === 'Escape') { this.editing = null; return; }
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

    selectOnly(id) {
      this.selectedIds = new Set([id]);
    },

    toggleSelect(id) {
      const s = new Set(this.selectedIds);
      s.has(id) ? s.delete(id) : s.add(id);
      this.selectedIds = s;
    },

    /* ---------- модальное окно записи ---------- */

    openRowModal(item) {
      this.expandedRow = { ...item };
    },

    /* ---------- управление разделами (вкладками) ---------- */

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
      if (!name) { this.sectionModalOpen = false; return; }
      if (this.sectionModalMode === 'create') {
        this.data.sections.push(newSection(name));
        this.activeTab = this.data.sections.length - 1;
      } else if (this.sectionDraft.index != null && this.data.sections[this.sectionDraft.index]) {
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

    selectTab(si) {
      this.activeTab = si;
      this.selectedIds = new Set();
    },

    startRenameSection(si) {
      this.renamingSection = si;
      this.$nextTick(() => {
        const el = document.querySelector('.at-tab-wrap .at-tab-rename');
        if (el) { el.focus(); el.select(); }
      });
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
      if (si == null || !this.data.sections[si]) return;
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

    moveSectionByDrag(targetSi) {
      if (this.tabDragFrom === null || this.tabDragFrom === targetSi) return;
      const arr = this.data.sections;
      const [moved] = arr.splice(this.tabDragFrom, 1);
      arr.splice(targetSi, 0, moved);
      this.activeTab = null;
      this.tabDragFrom = null;
    },

    /* ---------- меню поля колонки (Airtable-style header menu) ---------- */

    toggleFieldMenu(col) {
      this.fieldMenuFor = this.fieldMenuFor === col ? null : col;
    },

    sortDescOrAsc(field) {
      const order = this.sortState.field === field ? -this.sortState.dir : 1;
      this.sortState = { field, dir: order };
      // однократная сортировка сбрасывает многоуровневую (#15)
      this.multiSort = [{ field, dir: order }];
      this.applySortToSections();
      this.fieldMenuFor = null;
    },

    /* многоуровневая сортировка: Shift+клик по пункту меню добавляет уровень (#15) */
    addSortLevel(field, dir) {
      const exists = this.multiSort.find((s) => s.field === field);
      if (exists) exists.dir = dir;
      else this.multiSort = [...this.multiSort, { field, dir }];
      this.sortState = { field, dir };
      this.applySortToSections();
      this.fieldMenuFor = null;
    },

    removeSortLevel(field) {
      this.multiSort = this.multiSort.filter((s) => s.field !== field);
      this.fieldMenuFor = null;
    },

    sortLevelIndex(field) {
      const i = this.multiSort.findIndex((s) => s.field === field);
      return i >= 0 ? i + 1 : null;
    },

    applySortToSections() {
      const levels = this.multiSort.length
        ? this.multiSort
        : (this.sortState.field ? [this.sortState] : []);
      if (!levels.length) return;
      const val = (r, field) => {
        if (field === 'type') return this.typeLabel(r);
        if (field === 'total') return this.rowTotal(r);
        const v = r[field];
        return typeof v === 'number' ? v : String(v ?? '').toLowerCase();
      };
      for (const sec of this.data.sections) {
        sec.resources.sort((a, b) => {
          for (const { field, dir } of levels) {
            const va = val(a, field), vb = val(b, field);
            if (va < vb) return -dir;
            if (va > vb) return dir;
          }
          return 0;
        });
      }
      this.logActivity('Сортировка: ' + levels.map((l) => l.field + (l.dir > 0 ? '↑' : '↓')).join(', '));
    },

    /* ---------- управление строками ---------- */

    currentTargetSection() {
      return this.activeTab === null ? this.data.sections.length - 1 : this.activeTab;
    },

    addRow(si) {
      if (si == null || si < 0 || !this.data.sections[si]) { this.addSection(); return; }
      this.pushHistory('Добавлена запись');
      this.data.sections[si].resources.push(newRow());
      const list = this.data.sections[si].resources;
      const created = list[list.length - 1];
      this.openCell('name', { row: created });
    },

    openAddRecordModal() {
      let si = this.activeTab === null
        ? (this.data.sections.length ? this.data.sections.length - 1 : null)
        : this.activeTab;
      if (si == null || !this.data.sections[si]) {
        this.data.sections.push(newSection('Новый раздел'));
        si = this.data.sections.length - 1;
        this.activeTab = si;
      }
      this.pushHistory('Новая запись (форма)');
      const row = newRow({ type: 'material' });
      this.data.sections[si].resources.push(row);
      this.recordDraft = { si, rowId: row.id };
      this.recordModalOpen = true;
    },

    get recordRow() {
      if (!this.recordModalOpen || !this.recordDraft) return null;
      const sec = this.data.sections[this.recordDraft.si];
      if (!sec) return null;
      return sec.resources.find((r) => r.id === this.recordDraft.rowId) || null;
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

    cancelRecordModal() {
      const row = this.recordRow;
      if (row && !(String(row.name).trim() || String(row.basis).trim() || Number(row.qty) || Number(row.price))) {
        const sec = this.data.sections[this.recordDraft.si];
        const idx = sec.resources.indexOf(row);
        if (idx >= 0) sec.resources.splice(idx, 1);
      }
      this.recordModalOpen = false;
      this.recordDraft = null;
    },

    /* единый справочник ресурсов (#9): при изменении цены последней — обновить все такие же ресурсы */
    syncResourcePrice(row) {
      if (this.data.recalcMode === 'manual') return; // ручной режим — не трогаем остальные (#48)
      const k = resKey(row);
      if (!k) return;
      for (const sec of this.data.sections)
        for (const r of sec.resources)
          if (r !== row && resKey(r) === k) r.price = row.price;
    },

    onPriceEdited(row) {
      this.syncResourcePrice(row);
      this.logActivity(`Цена «${(row.name || '').slice(0, 40)}» → ${row.price}`);
    },

    removeRowById(si, id) {
      this.pushHistory('Удалена запись');
      const arr = this.data.sections[si].resources;
      const idx = arr.findIndex((r) => r.id === id);
      if (idx >= 0) arr.splice(idx, 1);
      this.selectedIds.delete(id);
    },

    duplicateRowById(si, id) {
      this.pushHistory('Дублирование записи');
      const arr = this.data.sections[si].resources;
      const idx = arr.findIndex((r) => r.id === id);
      if (idx < 0) return;
      const { id: _drop, ...rest } = arr[idx];
      arr.splice(idx + 1, 0, newRow(rest));
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
      try { e.dataTransfer.setData('text/plain', item.row.id); } catch (err) { /* ignore */ }
    },

    endRowDrag() { this.dragRow = null; },

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

    /* контекстное меню строки (#35) */
    openCtxMenu(e, item) {
      e.preventDefault();
      if (!this.selectedIds.has(item.row.id)) this.selectOnly(item.row.id);
      this.ctxMenu = { x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 260), item };
    },

    closeCtxMenu() { this.ctxMenu = null; },

    ctxAction(fn) {
      const m = this.ctxMenu;
      if (!m) return;
      this.ctxMenu = null;
      fn(m.item);
    },

    ctxEditRow() {
      this.ctxAction((item) => { this.expandedRow = { ...item }; });
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
        const hit = this.nsbItems.find((n) =>
          (n.basis && n.basis.trim().toLowerCase() === String(item.row.basis).trim().toLowerCase()) ||
          (n.name && n.name.trim().toLowerCase() === String(item.row.name).trim().toLowerCase()));
        if (hit) {
          this.pushHistory('Применена расценка НСБ');
          item.row.basis = hit.basis; item.row.name = hit.name; item.row.type = hit.type;
          item.row.unit = hit.unit; item.row.price = hit.price;
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

    /* выделение и батч-редактирование (#36) */
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

    clearSelection() { this.selectedIds = new Set(); this.batchBar = false; },

    openBatchBar() {
      this.batchBar = true;
      this.ctxMenu = null;
      this.batchPrice = ''; this.batchQty = ''; this.batchUnit = '';
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

    removeSelected() {
      if (!this.selectedIds.size) return;
      if (!confirm(`Удалить выделенные записи (${this.selectedIds.size})?`)) return;
      this.pushHistory(`Удалено записей: ${this.selectedIds.size}`);
      for (const sec of this.data.sections)
        sec.resources = sec.resources.filter((r) => !this.selectedIds.has(r.id));
      this.selectedIds = new Set();
    },

    /* ---------- экспорт / импорт ---------- */

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

    exportJson() {
      this.download('smeta.json', JSON.stringify(this.exportable(), null, 2), 'application/json');
      this.logActivity('Экспорт JSON');
    },

    importJson(ev) {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (!Array.isArray(obj.sections)) throw new Error('нет массива sections');
          obj.sections.forEach((sec) => {
            sec.id = sec.id || uid();
            sec.parentId = sec.parentId ?? null;
            sec.collapsed = !!sec.collapsed;
            (sec.resources || []).forEach((r) => { r.id = r.id || uid(); });
          });
          migrateV3toV4(obj);
          this.pushHistory('Импорт JSON');
          this.data = obj;
          this.activeTab = null;
          this.page = 0;
          this.logActivity('Импорт из файла JSON');
        } catch (e) {
          alert('Не удалось прочитать JSON: ' + e.message);
        }
      };
      reader.readAsText(file, 'utf-8');
      ev.target.value = '';
    },

    exportCsv() {
      const sep = ';';
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [];
      lines.push(esc(this.data.title));
      lines.push(['№ п/п', 'Обоснование', 'Наименование', 'Тип', 'Ед.изм.',
        'Кол-во', 'Цена', 'Стоимость', 'Примечание'].map(esc).join(sep));
      let n = 0;
      for (const sec of this.data.sections) {
        const secs = this.isChapter(sec) ? sec.children : [sec];
        if (this.isChapter(sec)) lines.push([['', '', sec.name.toUpperCase()].map(esc).join(sep)].join(sep));
        for (const s of secs) {
          lines.push([['', '', s.name.toUpperCase()].map(esc).join(sep)].join(sep));
          for (const r of s.resources) {
            n++;
            lines.push([
              n, r.basis, r.name, typeName(r), r.unit,
              num(r.qty), num(r.price), num(this.rowTotal(r)), r.note,
            ].map(esc).join(sep));
          }
        }
      }
      const s = this.sums;
      lines.push('', ['', '', 'Итого прямые затраты'].map(esc).join(sep), num(s.pz));
      lines.push(['', '', 'НР'].map(esc).join(sep), num(s.nr));
      lines.push(['', '', 'СП'].map(esc).join(sep), num(s.sp));
      lines.push(['', '', 'НДС'].map(esc).join(sep), num(s.vat));
      lines.push(['', '', 'ИТОГО ПО СМЕТЕ'].map(esc).join(sep), num(s.grand));
      this.download('smeta.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv');
      this.logActivity('Экспорт CSV');

      function typeName(r) {
        if (r.type === 'labor') return 'ЗТ';
        if (r.type === 'machine') return r.operator ? 'ОМ+Тмр' : 'ОМ';
        return 'М';
      }
      function num(v) {
        return Number(v || 0).toFixed(2).replace('.', ',');
      }
    },

    /* Excel: SpreadsheetML 2.03 (.xls) — открывается в Excel/LibreOffice, без библиотек (#27) */
    exportXls() {
      const cells = (arr) => arr.map((c) => (typeof c === 'number' ? { v: c, s: 'Money' } : { v: c, t: 's' }));
      const rows = [[{ v: this.data.title, s: 'Title' }], [],
        cells(['№ п/п', 'Обоснование', 'Наименование', 'Тип', 'Ед.изм.', 'Кол-во', 'Цена', 'Стоимость', 'Примечание'])];
      let n = 0;
      for (const sec of this.data.sections) {
        const secs = this.isChapter(sec) ? sec.children : [sec];
        if (this.isChapter(sec)) rows.push(cells(['', '', sec.name.toUpperCase()]));
        for (const s of secs) {
          rows.push(cells(['', '', s.name.toUpperCase()]));
          for (const r of s.resources) {
            n++;
            rows.push(cells([n, r.basis, r.name, typeName(r), r.unit, Number(r.qty) || 0, Number(r.price) || 0, this.rowTotal(r), r.note]));
          }
        }
      }
      const sm = this.sums;
      rows.push([]);
      rows.push(cells(['', '', 'Итого прямые затраты', '', '', '', '', sm.pz]));
      rows.push(cells(['', '', 'НР', '', '', '', '', sm.nr]));
      rows.push(cells(['', '', 'СП', '', '', '', '', sm.sp]));
      rows.push(cells(['', '', 'НДС', '', '', '', '', sm.vat]));
      rows.push(cells(['', '', 'ИТОГО ПО СМЕТЕ', '', '', '', '', sm.grand]));

      /* лист «Ресурсы» — сводная ведомость (#12) */
      const sumRows = [cells(['Наименование', 'Тип', 'Ед. изм.', 'Кол-во всего', 'Расценки (обоснования)', 'Стоимость, ₽'])];
      for (const e of this.summaryResources) {
        sumRows.push([{ v: e.name, t: 's' }, { v: typeName({ type: e.type }), t: 's' }, { v: e.unit, t: 's' },
          { v: Number(e.qty.toFixed(4)), s: 'Num' }, { v: [...e.bases].join(', '), t: 's' }, { v: e.cost, s: 'Money' }]);
      }

      const xml = buildSpreadsheetML([
        { name: 'Смета', rows },
        { name: 'Ресурсы', rows: sumRows },
      ]);
      this.download('smeta.xls', xml, 'application/vnd.ms-excel');
      this.logActivity('Экспорт Excel (.xls)');

      function typeName(r) {
        if (r.type === 'labor') return 'ЗТ';
        if (r.type === 'machine') return r.operator ? 'ОМ+Тмр' : 'ОМ';
        return 'М';
      }
    },

    /* PNG-экспорт диаграммы Ганта через SVG→canvas (#28) */
    exportGanttPng() {
      const svg = this.buildGanttSVG();
      if (!svg) { alert('Нет работ для экспорта: задайте длительность хотя бы одной записи.'); return; }
      svgToPng(svg, 2, (blob) => {
        if (!blob) { alert('Не удалось создать изображение.'); return; }
        this.downloadBlob('gantt.png', blob);
        this.logActivity('Экспорт диаграммы Ганта (PNG)');
      });
    },

    /* SVG-экспорт Ганта (#28) */
    exportGanttSvg() {
      const svg = this.buildGanttSVG();
      if (!svg) { alert('Нет работ для экспорта.'); return; }
      this.download('gantt.svg', svg, 'image/svg+xml');
      this.logActivity('Экспорт диаграммы Ганта (SVG)');
    },

    buildGanttSVG() {
      const g = this.ganttData;
      if (!g.rows.length && !g.sections.length) return null;
      const DAYW = 34, ROWH = 26, SECH = 30, NAMEW = 260, TOP = 46;
      const width = NAMEW + g.totalDays * DAYW + 40;
      const height = TOP + g.sections.length * SECH + g.rows.length * ROWH + 30;
      const colors = { labor: '#0052cc', machine: '#ff8b00', material: '#36b37e', section: '#4c9aff' };
      const parts = [];
      parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
      parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
      parts.push(`<text x="12" y="24" font-family="Arial" font-size="15" font-weight="bold" fill="#172b4d">${xmlEsc(this.data.title)} — график работ</text>`);
      // шкала
      for (let d = 0; d <= g.totalDays; d++) {
        const x = NAMEW + d * DAYW;
        parts.push(`<line x1="${x}" y1="${TOP - 8}" x2="${x}" y2="${height - 10}" stroke="#eaebf0" stroke-width="1"/>`);
        if (d % 5 === 0) parts.push(`<text x="${x + 2}" y="${TOP - 12}" font-family="Arial" font-size="10" fill="#7a8699">${this.ganttDateLabel(d)}</text>`);
      }
      let y = TOP;
      for (const s of g.sections) {
        parts.push(`<text x="8" y="${y + 18}" font-family="Arial" font-size="12" font-weight="bold" fill="#172b4d">${xmlEsc((s.si + 1) + '. ' + s.name).slice(0, 34)}</text>`);
        parts.push(`<rect x="${NAMEW + s.leftDays * DAYW}" y="${y + 8}" width="${Math.max(6, s.spanDays * DAYW - 4)}" height="12" rx="3" fill="${colors.section}"/>`);
        y += SECH;
      }
      for (const r of g.rows) {
        parts.push(`<text x="22" y="${y + 17}" font-family="Arial" font-size="11" fill="#344563">${xmlEsc(r.name).slice(0, 40)}</text>`);
        parts.push(`<rect x="${NAMEW + r.leftDays * DAYW}" y="${y + 5}" width="${Math.max(6, r.spanDays * DAYW - 4)}" height="16" rx="4" fill="${colors[r.type] || colors.material}"/>`);
        parts.push(`<text x="${NAMEW + r.leftDays * DAYW + 6}" y="${y + 17}" font-family="Arial" font-size="10" fill="#fff">${r.days} дн.</text>`);
        y += ROWH;
      }
      parts.push('</svg>');
      return parts.join('');
    },

    /* ---------- печать: выбор ориентации + настройки (#24, #47) ---------- */

    openPrintModal() { this.printModalOpen = true; },

    togglePrintField(key) {
      if (key === 'title') return; // заголовок обязателен
      const i = this.printFields.indexOf(key);
      if (i >= 0) this.printFields.splice(i, 1);
      else this.printFields.push(key);
      try { localStorage.setItem(LS_PRINT_KEY, JSON.stringify(this.printFields)); } catch (e) { /* ignore */ }
    },

    printHas(key) { return this.printFields.includes(key); },

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

    /* ---------- реквизиты объекта / титульный лист (#24) ---------- */

    openProjectModal() { this.projModalOpen = true; },

    projectFilled() {
      const c = this.data.company || {};
      return !!(c.objectName || c.customer || c.contractor || c.chief);
    },

    saveProjectModal() {
      this.projModalOpen = false;
      this.pushHistory('Сохранены реквизиты объекта');
    },

    /* ---------- калькулятор трудозатрат и маш.-часов (#48) ---------- */

    calcTab: 'labor',
    calc: {
      volume: 100,       // объём работ в единице из сметы
      normTime: 1.2,     // чел-ч (или machine-часы) на единицу объёма
      crewSize: 3,       // бригада, чел. (для машин — звено механизаторов)
      shiftsPerDay: 1,   // смен в день
      hoursPerShift: 8,  // часов в смене
      ratePerHour: 250,  // стоимость одного чел-ч / маш-ч, руб.
      days: null,        // обратный расчёт: задан срок → подобрать состав
    },

    openCalc(prefillRow) {
      this.calcTab = prefillRow && prefillRow.type === 'machine' ? 'machine' : 'labor';
      if (prefillRow) {
        this.calc.volume = Number(prefillRow.qty) || 100;
        this.calc.ratePerHour = Number(prefillRow.price) || 250;
      }
      this.calc.days = null;
      this.calcModalOpen = true;
    },

    get calcResult() {
      const c = this.calc;
      const V = Number(c.volume) || 0;
      const N = Number(c.normTime) || 0;
      const totalHours = V * N;                                   // всего чел-ч / маш-ч
      const dayHours = Math.max(1, (Number(c.crewSize) || 1)) * Math.max(1, Number(c.shiftsPerDay) || 1) * Math.max(1, Number(c.hoursPerShift) || 8);
      const days = totalHours > 0 ? totalHours / dayHours : 0;
      const cost = totalHours * (Number(c.ratePerHour) || 0);
      // обратная задача: срок задан → минимальный состав бригады
      const needCrew = (Number(c.days) > 0)
        ? Math.ceil(totalHours / (Math.max(1, Number(c.days)) * Math.max(1, Number(c.shiftsPerDay) || 1) * Math.max(1, Number(c.hoursPerShift) || 8)))
        : null;
      return { totalHours, days: Math.ceil(days), exactDays: days, cost, needCrew, dayHours };
    },

    applyCalcToRow(item) {
      const res = this.calcResult;
      const row = item ? item.row : this.recordRow;
      if (!row) { alert('Сначала выделите запись в таблице.'); this.calcModalOpen = false; return; }
      this.pushHistory('Калькулятор применён к записи');
      if (this.calcTab === 'labor') {
        row.type = 'labor';
        row.price = Number(this.calc.ratePerHour) || 0;
        row.unit = row.unit || 'чел-ч';
        row.qty = Number(res.totalHours.toFixed(2));
      } else {
        row.type = 'machine';
        row.price = Number(this.calc.ratePerHour) || 0;
        row.unit = row.unit || 'маш-ч';
        row.qty = Number(res.totalHours.toFixed(2));
      }
      if (res.days > 0) row.days = res.days;
      this.calcModalOpen = false;
    },

    /* ---------- диаграмма Ганта ---------- */

    toggleGantt() {
      this.viewTab = this.viewTab === 'gantt' ? 'table' : 'gantt';
    },

    /* нумерация записей сквозная (по flatRows) — предшественник задаётся номером (#49) */
    rowNumber(rowId) {
      const i = this.flatRows.findIndex((it) => it.row.id === rowId);
      return i >= 0 ? i + 1 : null;
    },

    setPredByNumber(row, numText) {
      const n = parseInt(numText, 10);
      if (!isFinite(n) || n <= 0) { row.pred = ''; return; }
      const items = this.flatRows;
      const target = items[n - 1];
      row.pred = target ? String(this.rowNumber(target.row.id)) : '';
    },

    get ganttData() {
      const DAY = 86400000;
      const start = new Date(this.data.startDate || defaultStartDate()).getTime();
      // если активна вкладка раздела — диаграмма строится только по работам этого раздела
      const scoped = this.activeTab === null
        ? (() => {
            const out = [];
            this.data.sections.forEach((sec, si) => {
              out.push({ sec, si });
              if (this.isChapter(sec) && !sec.collapsed) sec.children.forEach((c) => out.push({ sec: c, si }));
            });
            return out;
          })()
        : [{ sec: this.data.sections[this.activeTab], si: this.activeTab }].filter((x) => x.sec);
      const rows = [];
      const skipped = [];   // записи без длительности — не попадают на диаграмму
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
          if (!isFinite(raw) || raw <= 0) { skipped.push(r); continue; }
          const dur = Math.round(raw);
          if (dur <= 0) { skipped.push(r); continue; }
          const from = cur;
          const to = from + dur * DAY;
          rows.push({
            row: r, si, name: r.name || '(без наименования)', type: r.type,
            total: this.rowTotal(r), days: dur,
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
      const byNum = new Map(rows.map((g, i) => [i + 1, g]));
      const origLeft = rows.map((g) => g.leftDays);
      const moved = rows.some((g) => Number(g.row.startAt) >= 0);
      if (moved) {
        rows.forEach((g, i) => {
          if (Number(g.row.startAt) >= 0) g.leftDays = Math.max(0, Math.round(Number(g.row.startAt)));
        });
      }
      const links = [];
      rows.forEach((g, i) => {
        const n = parseInt(String(g.row.pred || '').trim(), 10);
        if (!isFinite(n) || n <= 0 || n === i + 1) return;
        const pred = byNum.get(n);
        if (!pred) return;
        links.push({ from: pred, to: g });
        // каскад: преемник не может начинаться раньше окончания предшественника
        const minStart = pred.leftDays + pred.spanDays;
        if (moved) {
          if (g.leftDays < minStart) {
            const shift = minStart - g.leftDays;
            g.leftDays = minStart;
            for (let j = i; j < rows.length; j++) rows[j].leftDays += shift;
          }
        } else {
          g.leftDays = Math.max(g.leftDays, minStart);
        }
      });
      const workedDays = rows.reduce((m, g) => Math.max(m, g.leftDays + g.spanDays), 0);
      const totalDays = Math.max(7, workedDays); // минимум — неделя шкалы
      const sections = [];
      for (const { sec, si } of scoped) {
        const gr = rows.filter((g) => g.row && sec.resources.includes(g.row));
        if (!gr.length) continue;
        const left = Math.min(...gr.map((g) => g.leftDays));
        const right = Math.max(...gr.map((g) => g.leftDays + g.spanDays));
        sections.push({ id: sec.id, si, name: sec.name, leftDays: left, spanDays: right - left, total: this.sectionTotal(sec) });
      }
      return { rows, sections, skipped, links, totalDays, workedDays, start, origLeft };
    },

    /* SVG-оверлей связей поверх полос (#49).
       Геометрия рядов: шапка-шкала 34px, полосы разделов по 38px, строки работ по 34px. */
    get ganttLinkLines() {
      const w = this.ganttDayWidth();
      const ROWH = 34, SECH = 38, TOP = 34;
      const rows = this.ganttData.rows;
      const secCount = this.ganttData.sections.length;
      return this.ganttData.links.map((l) => {
        const fi = rows.indexOf(l.from);
        const ti = rows.indexOf(l.to);
        if (fi < 0 || ti < 0) return null;
        const x1 = TOP * 0 + l.from.leftDays * w + Math.max(6, l.from.spanDays * w - 4);
        const y1 = TOP + secCount * SECH + fi * ROWH + ROWH / 2;
        const x2 = l.to.leftDays * w;
        const y2 = TOP + secCount * SECH + ti * ROWH + ROWH / 2;
        const midX = Math.max(x1 + 8, x2 - 14);
        return `M${x1},${y1} H${midX} V${y2} H${Math.max(0, x2 - 6)}`;
      }).filter(Boolean);
    },

    /* превью связи при рисовании (курсор мыши) */
    trackGanttLink(e) {
      if (!this.ganttLinkFrom) return;
      const rect = e.currentTarget.getBoundingClientRect();
      this.ganttLinkPath = [
        this.ganttLinkFrom.leftDays * this.ganttDayWidth() + 40,
        20,
        e.clientX - rect.left,
        e.clientY - rect.top,
      ];
    },

    ganttBarStyle(g) {
      const w = this.ganttDayWidth();
      return `left:${g.leftDays * w}px;width:${Math.max(6, g.spanDays * w - 4)}px`;
    },

    ganttSecBarStyle(s) {
      const w = this.ganttDayWidth();
      return `left:${s.leftDays * w}px;width:${Math.max(6, s.spanDays * w - 4)}px`;
    },

    /* перетаскивание полос мышью (#49) */
    startGanttDrag(e, g) {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startLeft = g.leftDays;
      const w = this.ganttDayWidth();
      this.ganttDrag = { row: g.row, days: g.leftDays };
      const onMove = (ev) => {
        const d = Math.round((ev.clientX - startX) / w);
        g.leftDays = Math.max(0, startLeft + d);
        this.ganttDrag.days = g.leftDays;
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (g.leftDays !== startLeft) {
          this.pushHistory('Сдвиг работы на диаграмме');
          g.row.startAt = g.leftDays;
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

    /* рисование связи щёлк-щёлк (#49) */
    ganttLinkClick(e, g) {
      e.stopPropagation();
      if (!this.ganttLinkFrom) {
        this.ganttLinkFrom = g;
      } else {
        if (this.ganttLinkFrom !== g) {
          this.pushHistory('Создана связь Ганта');
          g.row.pred = String(this.rowNumber(this.ganttLinkFrom.row.id));
          this.logActivity(`Связь: №${this.rowNumber(this.ganttLinkFrom.row.id)} → №${this.rowNumber(g.row.id)}`);
        }
        this.ganttLinkFrom = null;
      }
    },

    removePred(row) { row.pred = ''; },

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

    totalTableWidth() {
      return this.visibleColumns().reduce((s, c) => s + c.width, 0);
    },

    colSpanFor(key) {
      // ячейка-разделитель на всю ширину таблицы: суммарный colspan видимых колонок
      const vis = this.visibleColumns();
      const idx = vis.findIndex((c) => c.key === key);
      if (idx < 0) return 0;
      let span = 0;
      for (let i = idx; i < vis.length; i++) span += (vis[i].key === 'name' ? 2 : 1);
      return span;
    },

    colIcon(key) {
      return { num: '#', basis: 'T', name: 'T', type: '⬡', unit: 'T', qty: '#', price: '$', total: '∑', note: 'T', days: '🗓', pred: '→', actions: '' }[key] || '';
    },

    sortDescOrAsc2(field) {
      this.sortState = { field, dir: -1 };
      this.multiSort = [{ field, dir: -1 }];
      this.applySortToSections();
      this.fieldMenuFor = null;
    },

    /* ---------- Нормативно-справочная база (НСБ) ---------- */

    openNsb() {
      this.nsbModalOpen = true;
      this.nsbEditId = null;
      this.nsbDraft = null;
    },

    get nsbFiltered() {
      const f = this.nsbSearch.trim().toLowerCase();
      if (!f) return this.nsbItems;
      return this.nsbItems.filter((n) =>
        (n.name || '').toLowerCase().includes(f) ||
        (n.basis || '').toLowerCase().includes(f) ||
        (n.unit || '').toLowerCase().includes(f));
    },

    nsbAddNew() {
      const item = { id: uid(), basis: '', name: '', type: 'material', unit: '', price: 0, note: '' };
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

    cancelNsbEdit() {
      // если редактировали новый пустой элемент — удалить его
      if (this.nsbEditId && this.nsbDraft && !String(this.nsbDraft.name || '').trim()) {
        const idx = this.nsbItems.findIndex((n) => n.id === this.nsbEditId);
        if (idx >= 0) { this.nsbItems.splice(idx, 1); this.saveNsb(); }
      }
      this.nsbEditId = null;
      this.nsbDraft = null;
    },

    nsbDelete(id) {
      const item = this.nsbItems.find((n) => n.id === id);
      if (!item) return;
      if (!confirm(`Удалить из НСБ «${item.name || item.basis}»?`)) return;
      this.nsbItems = this.nsbItems.filter((n) => n.id !== id);
      if (this.nsbEditId === id) { this.nsbEditId = null; this.nsbDraft = null; }
      this.saveNsb();
    },

    nsbResetDefaults() {
      if (!confirm('Восстановить стартовый набор расценок НСБ? Текущие изменения базы будут потеряны.')) return;
      this.nsbItems = defaultNsb();
      this.nsbEditId = null; this.nsbDraft = null;
      this.saveNsb();
    },

    saveNsb() {
      try { localStorage.setItem(LS_NSB_KEY, JSON.stringify(this.nsbItems)); } catch (e) { /* ignore */ }
    },

    /* подставить расценку из НСБ в запись сметы (через выделенную строку или форму) */
    nsbApply(item) {
      const targetId = this.selectedIds.size === 1 ? [...this.selectedIds][0] : null;
      let appliedTo = null;
      if (targetId) {
        for (const sec of this.data.sections) {
          const r = sec.resources.find((x) => x.id === targetId);
          if (r) { appliedTo = r; break; }
        }
      }
      if (!appliedTo) {
        // создаём новую запись в текущем разделе
        let si = this.currentTargetSection();
        if (si == null || !this.data.sections[si]) {
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
      this.nsbModalOpen = false;
    },

    /* массовое обновление цен в выделенных записях по совпадению шифра или наименования в НСБ */
    nsbApplyToSelected() {
      if (!this.selectedIds.size) { alert('Сначала выделите записи в таблице (клик по номеру строки, Ctrl+A — все видимые).'); return; }
      this.pushHistory('Применены цены НСБ к выделению');
      let updated = 0;
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          if (!this.selectedIds.has(r.id)) continue;
          const hit = this.nsbItems.find((n) =>
            (r.basis && n.basis && r.basis.trim().toLowerCase() === n.basis.trim().toLowerCase()) ||
            (r.name && n.name && r.name.trim().toLowerCase() === n.name.trim().toLowerCase()));
          if (hit) {
            r.price = hit.price;
            if (!r.unit) r.unit = hit.unit;
            if (!r.basis) r.basis = hit.basis;
            updated++;
          }
        }
      }
      alert(updated
        ? `Цены из НСБ обновлены в ${updated} выделенных записях.`
        : 'Среди выделенных записей нет совпадений с НСБ (по шифру или наименованию).');
    },

    exportNsb() {
      this.download('nsb.json', JSON.stringify(this.nsbItems, null, 2), 'application/json');
    },

    importNsb(ev) {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arr = JSON.parse(reader.result);
          if (!Array.isArray(arr)) throw new Error('ожидается массив записей');
          this.nsbItems = arr.map((n) => ({ id: n.id || uid(), basis: n.basis || '', name: n.name || '', type: n.type || 'material', unit: n.unit || '', price: Number(n.price) || 0, note: n.note || '' }));
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

    /* ---------- авто-подсказки для ячеек (#40) ---------- */

    suggestionsFor(field, item) {
      const vals = new Set();
      for (const sec of this.data.sections) {
        for (const r of sec.resources) {
          const v = field === 'total' ? null : r[field];
          if (v !== '' && v != null && !(Number(v) === 0)) vals.add(String(v));
        }
      }
      let arr = [...vals].sort((a, b) => a.localeCompare(b, 'ru'));
      // для предшественника — номера существующих записей
      if (field === 'pred') {
        arr = this.flatRows.filter((i) => i.row.id !== item.row.id).map((i) => String(i.index));
      }
      return arr.slice(0, 12);
    },

    acceptSuggestion(item, field, value) {
      if (field === 'qty' || field === 'price' || field === 'days') item.row[field] = Number(value) || 0;
      else item.row[field] = value;
      this.editing = null;
      if (field === 'price') this.syncResourcePrice(item.row);
    },

    /* объединение одинаковых ресурсов в группе (#33) */
    mergeSameResources(groupKey) {
      const items = this.groupedFlatRows.filter((i) => {
        const k = this.groupBy === 'type' ? i.row.type : (i.row.unit || '—');
        return k === groupKey;
      });
      const byName = new Map();
      for (const i of items) {
        const k = resKey(i.row);
        if (!k) continue;
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(i);
      }
      let merged = 0;
      for (const [k, list] of byName) {
        if (list.length < 2) continue;
        const first = list[0];
        for (const dup of list.slice(1)) {
          first.row.qty = Number(((Number(first.row.qty) || 0) + (Number(dup.row.qty) || 0)).toFixed(6));
          if (!first.row.basis && dup.row.basis) first.row.basis = dup.row.basis;
          if (!first.row.note && dup.row.note) first.row.note = dup.row.note;
          const sec = this.data.sections[dup.si];
          sec.resources.splice(sec.resources.indexOf(dup.row), 1);
          merged++;
        }
      }
      if (merged) this.pushHistory(`Объединено дублей ресурсов: ${merged}`);
      else alert('В этой группе нет повторяющихся ресурсов с одинаковым наименованием и ценой.');
    },
  };
};

/* Директива x-focus: фокус input при появлении (inline-редактирование ячейки, модальные окна). */
document.addEventListener('alpine:init', () => {
  window.Alpine.directive('focus', (el) => {
    requestAnimationFrame(() => { setTimeout(() => { el.focus(); if (el.select && el.tagName === 'INPUT' && el.type !== 'checkbox') el.select(); }, 30); });
  });
});

function loadActivity() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function loadResources() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_RESOURCES_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function loadLocal() {
  try {
    let raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      // миграция со схемы v3
      raw = localStorage.getItem(LS_MIGRATE_FROM);
      if (!raw) return null;
    }
    const obj = JSON.parse(raw);
    if (!Array.isArray(obj.sections)) return null;
    obj.sections.forEach((sec) => {
      sec.id = sec.id || uid();
      (sec.resources || []).forEach((r) => { r.id = r.id || uid(); });
    });
    migrateV3toV4(obj);
    obj.startDate = obj.startDate || defaultStartDate();
    return obj;
  } catch (e) {
    return null;
  }
}

function loadNsb() {
  try {
    const raw = localStorage.getItem(LS_NSB_KEY);
    if (!raw) return defaultNsb();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return defaultNsb();
    return arr.map((n) => ({ id: n.id || uid(), basis: n.basis || '', name: n.name || '', type: n.type || 'material', unit: n.unit || '', price: Number(n.price) || 0, note: n.note || '' }));
  } catch (e) {
    return defaultNsb();
  }
}
