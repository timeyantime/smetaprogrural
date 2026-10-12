/* СметаПро — ресурсный метод. Модель данных и логика на Alpine.js.
   Интерфейс в стиле Airtable: вкладки-разделы, ячейки с inline-редактированием,
   чипы single-select, группировка, выделение записей, боковая сводка, статус-бар. */

const LS_KEY = 'smetapro.v3';
const LS_NSB_KEY = 'smetapro.nsb.v1';

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
    ...partial,
  };
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
    rates: {
      overheadPct: 15,
      overheadBase: 'labor', // labor | pz
      profitPct: 10,
      profitBase: 'labor',   // labor | pz
      vatPct: 20,
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
    fieldMenuFor: null,        // id колонки, для которой открыто меню поля
    savedFlash: false,         // подсветка кнопки «Сохранено»
    lastSavedAt: null,         // время последнего автосохранения

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
      { key: 'actions',  label: '',               width: 118, min: 118, sortable: false },
    ],
    printOrientation: 'landscape', // landscape | portrait
    printModalOpen: false,
    viewTab: 'table',              // table | gantt
    helpModalOpen: false,
    nsbModalOpen: false,
    nsbSearch: '',
    nsbItems: loadNsb(),
    nsbEditId: null,               // id редактируемой записи НСБ (null — не редактируется)
    nsbDraft: null,                // копия записи для редактирования

    /* ---------- инициализация / хранение ---------- */

    init() {
      this.$watch('data', () => this.saveLocal(), { deep: true });
      this.$watch('columns', () => this.saveColWidths(), { deep: true });
      // Ctrl+A — выделить все видимые, Esc — снять выделение/редактирование
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.editing = null; this.expandedRow = null; this.selectedIds = new Set();
          this.sectionModalOpen = false; this.fieldMenuFor = null;
          this.helpModalOpen = false; this.printModalOpen = false;
          if (this.nsbModalOpen) this.cancelNsbEdit();
          this.nsbModalOpen = false;
          if (this.recordModalOpen) this.cancelRecordModal();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
          e.preventDefault();
          this.selectedIds = new Set(this.flatRows.map((i) => i.row.id));
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && this.selectedIds.size === 1) {
          const item = this.flatRows.find((i) => this.selectedIds.has(i.row.id));
          if (item) this.duplicateRowById(item.si, item.row.id);
        }
      });
      this.loadColWidths();
    },

    /* ---------- ширины столбцов (drag за границу заголовка, как в Airtable) ---------- */

    saveColWidths() {
      try {
        const map = {};
        for (const c of this.columns) map[c.key] = c.width;
        localStorage.setItem(LS_KEY + '.cols', JSON.stringify(map));
      } catch (e) { /* ignore */ }
    },

    loadColWidths() {
      try {
        const raw = localStorage.getItem(LS_KEY + '.cols');
        if (!raw) return;
        const map = JSON.parse(raw);
        for (const c of this.columns) {
          if (typeof map[c.key] === 'number' && map[c.key] >= c.min) c.width = map[c.key];
        }
      } catch (e) { /* ignore */ }
    },

    resetColWidths() {
      localStorage.removeItem(LS_KEY + '.cols');
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
      if (!this.lastSavedAt) return 'Автосохранение включено';
      const t = this.lastSavedAt.toLocaleTimeString('ru-RU');
      return `Сохранено в ${t}`;
    },

    exportable() {
      return JSON.parse(JSON.stringify(this.data));
    },

    /* ---------- вычисления ---------- */

    rowTotal(row) {
      return (Number(row.qty) || 0) * (Number(row.price) || 0);
    },

    sectionTotal(section) {
      return section.resources.reduce((s, r) => s + this.rowTotal(r), 0);
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
      sums.nr = (baseFor(rate.overheadBase) * (Number(rate.overheadPct) || 0)) / 100;
      sums.sp = (baseFor(rate.profitBase) * (Number(rate.profitPct) || 0)) / 100;
      sums.vat = ((sums.pz + sums.nr + sums.sp) * (Number(rate.vatPct) || 0)) / 100;
      sums.grand = sums.pz + sums.nr + sums.sp + sums.vat;
      return sums;
    },

    selectionTotal() {
      let s = 0;
      for (const sec of this.data.sections)
        for (const r of sec.resources)
          if (this.selectedIds.has(r.id)) s += this.rowTotal(r);
      return s;
    },

    /* ---------- плоский список строк (область просмотра) ---------- */

    get scopedSections() {
      return this.activeTab === null
        ? this.data.sections.map((sec, si) => ({ sec, si }))
        : [{ sec: this.data.sections[this.activeTab], si: this.activeTab }];
    },

    get flatRows() {
      const out = [];
      let n = 0;
      for (const { sec, si } of this.scopedSections) {
        for (const row of sec.resources) {
          n++;
          if (!this.matchesFilter(row)) continue;
          out.push({ row, si, ri: sec.resources.indexOf(row), index: n });
        }
      }
      return out;
    },

    /* группы для итоговых строк (Airtable-style group subtotals) */

    get visibleGroups() {
      const groups = [];
      if (this.groupBy !== 'none') {
        const map = new Map();
        for (const item of this.flatRows) {
          const key = this.groupBy === 'type' ? item.row.type : (item.row.unit || '—');
          if (!map.has(key)) map.set(key, { key, label: this.groupLabel(key), total: 0 });
          map.get(key).total += this.rowTotal(item.row);
        }
        groups.push(...map.values());
      } else if (this.activeTab !== null) {
        const sec = this.data.sections[this.activeTab];
        groups.push({ key: sec.id, label: sec.name, total: this.sectionTotal(sec) });
      }
      return groups;
    },

    groupLabel(key) {
      if (this.groupBy === 'unit') return key;
      return { labor: 'ЗТ — затраты труда', machine: 'ОМ — эксплуатация машин', material: 'М — материалы' }[key] || key;
    },

    groupByLabel() {
      return { type: 'По типу ресурса', unit: 'По единице измерения' }[this.groupBy] || '';
    },

    setGroupBy(v) { this.groupBy = v; this.toggleGroupMenu = false; },

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

    /* ---------- выделение ---------- */

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
      this.applySortToSections();
      this.fieldMenuFor = null;
    },

    applySortToSections() {
      const { field, dir } = this.sortState;
      if (!field) return;
      const val = (r) => {
        if (field === 'type') return this.typeLabel(r);
        if (field === 'total') return this.rowTotal(r);
        const v = r[field];
        return typeof v === 'number' ? v : String(v ?? '').toLowerCase();
      };
      for (const sec of this.data.sections) {
        sec.resources.sort((a, b) => {
          const va = val(a), vb = val(b);
          if (va < vb) return -dir;
          if (va > vb) return dir;
          return 0;
        });
      }
    },

    /* ---------- управление строками ---------- */

    currentTargetSection() {
      return this.activeTab === null ? this.data.sections.length - 1 : this.activeTab;
    },

    addRow(si) {
      if (si == null || si < 0 || !this.data.sections[si]) { this.addSection(); return; }
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

    removeRowById(si, id) {
      const arr = this.data.sections[si].resources;
      const idx = arr.findIndex((r) => r.id === id);
      if (idx >= 0) arr.splice(idx, 1);
      this.selectedIds.delete(id);
    },

    duplicateRowById(si, id) {
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
      const [moved] = sec.resources.splice(from, 1);
      sec.resources.splice(to, 0, moved);
    },

    /* ---------- экспорт / импорт ---------- */

    download(filename, text, mime) {
      const blob = new Blob([text], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    exportJson() {
      this.download('smeta.json', JSON.stringify(this.exportable(), null, 2), 'application/json');
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
            (sec.resources || []).forEach((r) => { r.id = r.id || uid(); });
          });
          obj.rates = { ...defaultData().rates, ...(obj.rates || {}) };
          this.data = obj;
          this.activeTab = null;
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
        lines.push([['', '', sec.name.toUpperCase()].map(esc).join(sep)].join(sep));
        for (const r of sec.resources) {
          n++;
          lines.push([
            n, r.basis, r.name, typeName(r), r.unit,
            num(r.qty), num(r.price), num(this.rowTotal(r)), r.note,
          ].map(esc).join(sep));
        }
      }
      const s = this.sums;
      lines.push('', ['', '', 'Итого прямые затраты'].map(esc).join(sep), num(s.pz));
      lines.push(['', '', 'НР'].map(esc).join(sep), num(s.nr));
      lines.push(['', '', 'СП'].map(esc).join(sep), num(s.sp));
      lines.push(['', '', 'НДС'].map(esc).join(sep), num(s.vat));
      lines.push(['', '', 'ИТОГО ПО СМЕТЕ'].map(esc).join(sep), num(s.grand));
      this.download('smeta.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv');

      function typeName(r) {
        if (r.type === 'labor') return 'ЗТ';
        if (r.type === 'machine') return r.operator ? 'ОМ+Тмр' : 'ОМ';
        return 'М';
      }
      function num(v) {
        return Number(v || 0).toFixed(2).replace('.', ',');
      }
    },

    /* ---------- печать: выбор ориентации ---------- */

    openPrintModal() { this.printModalOpen = true; },

    doPrint() {
      // применяем ориентацию через @page (переопределяем правило в <style>)
      const style = document.getElementById('print-orientation-style');
      if (style) {
        style.textContent = `@media print { @page { size: A4 ${this.printOrientation}; margin: 10mm; } }`;
      }
      document.body.classList.add('printing');
      this.printModalOpen = false;
      // небольшая задержка — чтобы стиль успел примениться
      setTimeout(() => {
        window.print();
        setTimeout(() => document.body.classList.remove('printing'), 300);
      }, 60);
    },

    /* ---------- диаграмма Ганта ---------- */

    toggleGantt() {
      this.viewTab = this.viewTab === 'gantt' ? 'table' : 'gantt';
    },

    get ganttData() {
      const DAY = 86400000;
      const start = new Date(this.data.startDate || defaultStartDate()).getTime();
      const rows = [];
      let cursorBySection = {};
      let maxEnd = start + DAY; // минимум одна неделя
      for (const [si, sec] of this.data.sections.entries()) {
        let secStart = start;
        // разделы идут последовательно: каждый следующий начинается после конца предыдущего
        if (si > 0 && cursorBySection[si - 1]) secStart = Math.max(secStart, cursorBySection[si - 1]);
        let cur = secStart;
        for (const r of sec.resources) {
          const d = Math.max(0, Math.round(Number(r.days) || 0));
          const dur = d > 0 ? d : 1;
          const from = cur;
          const to = cur + dur * DAY;
          rows.push({
            row: r, si, name: r.name || '(без наименования)', type: r.type,
            total: this.rowTotal(r), days: d,
            leftDays: Math.round((from - start) / DAY),
            spanDays: dur,
          });
          cur = to;
          if (to > maxEnd) maxEnd = to;
        }
        cursorBySection[si] = cur;
      }
      const totalDays = Math.max(7, Math.ceil((maxEnd - start) / DAY) + 1);
      return { rows, totalDays, start };
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

    totalTableWidth() {
      return this.columns.reduce((s, c) => s + c.width, 0);
    },

    colIcon(key) {
      return { num: '#', basis: 'T', name: 'T', type: '⬡', unit: 'T', qty: '#', price: '$', total: '∑', note: 'T', days: '🗓', actions: '' }[key] || '';
    },

    sortDescOrAsc2(field) {
      this.sortState = { field, dir: -1 };
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
        const si = this.currentTargetSection();
        if (si == null || !this.data.sections[si]) { this.addSection(); }
        const sIdx = this.data.sections.length - 1;
        const row = newRow({});
        this.data.sections[sIdx >= 0 ? sIdx : 0].resources.push(row);
        appliedTo = row;
        this.activeTab = sIdx >= 0 ? sIdx : 0;
      }
      appliedTo.basis = item.basis;
      appliedTo.name = item.name;
      appliedTo.type = item.type;
      appliedTo.unit = item.unit;
      appliedTo.price = item.price;
      this.nsbModalOpen = false;
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
  };
};

/* Директива x-focus: фокус input при появлении (inline-редактирование ячейки, модальные окна). */
document.addEventListener('alpine:init', () => {
  window.Alpine.directive('focus', (el) => {
    requestAnimationFrame(() => { setTimeout(() => { el.focus(); if (el.select && el.tagName === 'INPUT' && el.type !== 'checkbox') el.select(); }, 30); });
  });
});

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!Array.isArray(obj.sections)) return null;
    obj.sections.forEach((sec) => {
      sec.id = sec.id || uid();
      (sec.resources || []).forEach((r) => { r.id = r.id || uid(); });
    });
    obj.rates = { ...defaultData().rates, ...(obj.rates || {}) };
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
