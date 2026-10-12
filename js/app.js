/* СметаПро — ресурсный метод. Модель данных и логика на Alpine.js.
   Интерфейс в стиле Airtable: вкладки-разделы, ячейки с inline-редактированием,
   чипы single-select, группировка, выделение записей, боковая сводка, статус-бар. */

const LS_KEY = 'smetapro.v2';

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
    ...partial,
  };
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
          }),
          newRow({
            basis: '',
            name: 'Песок строительный',
            type: 'material',
            unit: 'т',
            qty: 12,
            price: 890,
            note: 'Прайс поставщика №14',
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
          }),
          newRow({
            basis: '',
            name: 'Бетон В22.5 (М300)',
            type: 'material',
            unit: 'м3',
            qty: 18.4,
            price: 6200,
            note: 'ГОСТ 7473-2010',
          }),
        ],
      },
    ],
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

    /* ---------- инициализация / хранение ---------- */

    init() {
      this.$watch('data', () => this.saveLocal(), { deep: true });
      // Ctrl+A — выделить все видимые, Esc — снять выделение/редактирование
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.editing = null; this.expandedRow = null; this.selectedIds = new Set();
          this.sectionModalOpen = false; this.fieldMenuFor = null;
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
    return obj;
  } catch (e) {
    return null;
  }
}
