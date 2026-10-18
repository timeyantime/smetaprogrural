/**
 * Тесты фазы 1 миграции legacy → src/js/app.js (см. docs/MIGRATION.md).
 * Зоны: форматирование/отображение, пагинация, редактирование строк.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import smetaModule from '../app.js';

// Вне Alpine-окружения $nextTick недоступен (node/jsdom); подменяем no-op'ом.
const proto = smetaModule();
if (!Object.prototype.hasOwnProperty.call(proto, '$nextTick')) {
  Object.defineProperty(proto, '$nextTick', {
    value: function (fn) {
      fn && fn();
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

/** Свежий экземпляр smeta с тестовым $nextTick (Alpine внедряет его в рантайме). */
function mk() {
  const o = smetaModule();
  o.$nextTick = proto.$nextTick;
  return o;
}

describe('фаза 1: форматирование и отображение', () => {
  const obj = mk();

  // ru-RU использует неразрывный пробел как разделитель тысяч — нормализуем для сравнения
  const norm = (s) => String(s).replace(/[\u00A0\u202F]/g, ' ');

  it('fmtNum корректно обрабатывает числа', () => {
    expect(norm(obj.fmtNum(1234.5))).toBe('1 234,5');
    expect(obj.fmtNum(undefined)).toBe('0');
    expect(obj.fmtNum('abc')).toBe('0');
  });

  it('fmtMoney — всегда два знака после запятой', () => {
    expect(obj.fmtMoney(2)).toBe('2,00');
    expect(obj.fmtMoney('abc')).toBe('0,00');
  });

  it('typeLabel различает типы затрат', () => {
    expect(obj.typeLabel({ type: 'labor' })).toBe('ЗТ · труд');
    expect(obj.typeLabel({ type: 'machine', operator: false })).toBe('ОМ · машины');
    expect(obj.typeLabel({ type: 'machine', operator: true })).toBe('ОМ · Тмр');
    expect(obj.typeLabel({ type: 'material' })).toBe('М · материал');
  });

  it('setType сбрасывает признак Тмр для не-машин', () => {
    const row = { type: 'machine', operator: true };
    obj.setType(row, 'labor');
    expect(row.type).toBe('labor');
    expect(row.operator).toBe(false);
    const m = { type: 'labor', operator: false };
    obj.setType(m, 'machine');
    expect(m.operator).toBe(false); // не сбрасывается при установке machine
  });

  it('exportable — глубокая копия данных', () => {
    const snap = obj.exportable();
    expect(snap).toEqual(JSON.parse(JSON.stringify(obj.data)));
    snap.title = 'изменён';
    expect(obj.data.title).not.toBe('изменён');
  });

  it('rowTotal/sectionTotal считают стоимость', () => {
    expect(obj.rowTotal({ qty: 2, price: 150 })).toBe(300);
    const sec = {
      resources: [
        { qty: 1, price: 100 },
        { qty: 2, price: 50 },
      ],
    };
    expect(obj.sectionTotal(sec)).toBe(200);
  });

  it('roundingLabel описывает текущие правила округления', () => {
    const label = obj.roundingLabel();
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
    expect(label).toContain('·');
  });

  it('setRecalcMode переключает режим и пишет в журнал', () => {
    obj.setRecalcMode('manual');
    expect(obj.data.recalcMode).toBe('manual');
    obj.setRecalcMode('auto');
    expect(obj.data.recalcMode).toBe('auto');
  });

  it('forceRecalc сохраняет и мигает индикатором', () => {
    vi.useFakeTimers();
    obj.forceRecalc();
    expect(obj.savedFlash).toBe(true);
    vi.advanceTimersByTime(1600);
    expect(obj.savedFlash).toBe(false);
    vi.useRealTimers();
  });

  it('colIcon возвращает иконку или пусто для неизвестной колонки', () => {
    expect(obj.colIcon('qty')).toBe('#');
    expect(obj.colIcon('total')).toBe('∑');
    expect(obj.colIcon('nope')).toBe('');
  });

  it('totalTableWidth — сумма ширин видимых колонок', () => {
    const full = obj.totalTableWidth();
    expect(full).toBeGreaterThan(0);
    const hidden = obj.hiddenCols.length ? obj.hiddenCols[0] : null;
    if (hidden) {
      obj.hiddenCols.push(hidden);
      expect(obj.totalTableWidth()).toBeLessThan(full);
      obj.hiddenCols.pop();
    }
  });

  it('colSpanFor считает colspan от колонки до конца', () => {
    const vis = obj.visibleColumns();
    expect(obj.colSpanFor(vis[0].key)).toBeGreaterThan(0);
    expect(obj.colSpanFor('nonexistent')).toBe(0);
  });

  it('colSpanFor: колонка name считается за две ячейки', () => {
    const vis = obj.visibleColumns();
    const idx = vis.findIndex((c) => c.key === 'name');
    if (idx >= 0) {
      const others = vis.length - idx - 1;
      expect(obj.colSpanFor('name')).toBe(others + 2);
    }
  });
});

describe('фаза 1: проблемы сметы (#10)', () => {
  const obj = mk();
  const mkSection = (name, resources = []) => ({
    id: 's1',
    name,
    parentId: null,
    collapsed: false,
    resources,
  });
  const origSections = () => JSON.parse(JSON.stringify(obj.data.sections));

  beforeEach(() => {
    obj.data.sections = origSections();
  });

  it('пустое название раздела — warn', () => {
    obj.data.sections = [mkSection('')];
    const p = obj.problems;
    expect(p.some((x) => x.sev === 'warn' && /пустое название/.test(x.text))).toBe(true);
  });

  it('цена ≤ 0 — err, количество ≤ 0 и без единицы — warn', () => {
    obj.data.sections = [
      mkSection('S', [{ id: 'r1', name: 'Работа', basis: '', unit: '', qty: 0, price: 0 }]),
    ];
    const p = obj.problems.filter((x) => x.id === 'r1');
    expect(p.some((x) => x.sev === 'err' && /цена/.test(x.text))).toBe(true);
    expect(p.some((x) => x.sev === 'warn' && /количество/.test(x.text))).toBe(true);
    expect(p.some((x) => x.sev === 'warn' && /единица/.test(x.text))).toBe(true);
  });

  it('корректная запись не даёт проблем', () => {
    obj.data.sections = [
      mkSection('S', [
        { id: 'r2', name: 'Работа', basis: 'ГЭСН 01', unit: 'м2', qty: 10, price: 500 },
      ]),
    ];
    expect(obj.problems.length).toBe(0);
    expect(obj.problemCount()).toBe(0);
  });

  it('problemCount фильтрует по severity', () => {
    obj.data.sections = [
      mkSection('S', [{ id: 'r3', name: 'Р', basis: '', unit: 'м', qty: 5, price: 0 }]),
    ];
    expect(obj.problemCount('err')).toBe(1);
    expect(obj.problemCount('warn')).toBe(1);
    expect(obj.problemCount()).toBe(2);
  });

  it('goToProblem переходит к разделу и записи', () => {
    obj.data.sections = [
      mkSection('S', [{ id: 'r9', name: 'Р', basis: 'Б', unit: 'м', qty: 1, price: 1 }]),
    ];
    obj.activeTab = null;
    obj.selectedIds = new Set(['other']);
    obj.historyOpen = true;
    obj.goToProblem({ si: 0, id: 'r9' });
    expect(obj.activeTab).toBe(0);
    expect(obj.page).toBe(0);
    expect([...obj.selectedIds]).toEqual(['r9']);
    expect(obj.historyOpen).toBe(false);
  });
});

describe('фаза 1: пагинация (#38)', () => {
  const obj = mk();
  const origSections = () => JSON.parse(JSON.stringify(obj.data.sections));

  beforeEach(() => {
    obj.data.sections = [{ id: 's1', name: 'S', parentId: null, collapsed: false, resources: [] }];
  });
  it('pageCount не меньше 1 даже для пустой сметы', () => {
    expect(obj.pageCount).toBe(1);
    expect(obj.pageLabel()).toBe('1 / 1');
  });

  it('goPage листает с клампом, gotoLastPage ведёт на последнюю', () => {
    // 55 строк → 2 страницы
    const rows = Array.from({ length: 55 }, (_, i) => ({
      id: 'r' + i,
      name: 'N' + i,
      basis: '',
      unit: 'м',
      qty: 1,
      price: 1,
    }));
    obj.data.sections[0].resources = rows;
    expect(obj.pageCount).toBe(2);
    obj.goPage(1);
    expect(obj.page).toBe(1);
    obj.goPage(5); // кламп
    expect(obj.page).toBe(1);
    obj.goPage(-10); // кламп вниз
    expect(obj.page).toBe(0);
    obj.gotoLastPage();
    expect(obj.page).toBe(1);
    expect(obj.pageLabel()).toBe('2 / 2');
  });
});

describe('фаза 1: редактирование ячеек и строк', () => {
  const obj = mk();
  const mkRow = (over = {}) => ({
    id: 'r1',
    name: '',
    basis: '',
    type: 'material',
    operator: false,
    unit: '',
    qty: 0,
    price: 0,
    note: '',
    days: null,
    pred: '',
    startAt: null,
    ...over,
  });
  const mkSection = (name, resources = []) => ({
    id: 's1',
    name,
    parentId: null,
    collapsed: false,
    resources,
  });

  beforeEach(() => {
    obj.data.sections = [mkSection('S', [])];
  });

  it('commitEdit: Escape закрывает редактирование без изменений', () => {
    const row = mkRow({ name: 'старое' });
    obj.editing = { key: row.id + '|name' };
    obj.commitEdit({ key: 'Escape' }, 'name', { row });
    expect(obj.editing).toBe(null);
    expect(row.name).toBe('старое');
  });

  it('commitEdit: число с запятой приводится к number', () => {
    const row = mkRow();
    obj.commitEdit({ key: 'Enter', target: { value: '2,5' } }, 'qty', { row });
    expect(row.qty).toBe(2.5);
    expect(obj.editing).toBe(null);
  });

  it('commitEdit: мусор в числовом поле → 0', () => {
    const row = mkRow();
    obj.commitEdit({ key: 'Enter', target: { value: 'abc' } }, 'price', { row });
    expect(row.price).toBe(0);
  });

  it('commitEdit: текстовое поле триммится', () => {
    const row = mkRow();
    obj.commitEdit({ key: 'Enter', target: { value: '  Земляные работы  ' } }, 'name', { row });
    expect(row.name).toBe('Земляные работы');
  });

  it('commitEdit: price синхронизирует одноимённые записи', () => {
    const a = mkRow({ id: 'ra', name: 'Бетон', unit: 'м3' });
    const b = mkRow({ id: 'rb', name: 'Бетон', unit: 'м3', price: 999 });
    obj.data.sections[0].resources = [a, b];
    obj.data.recalcMode = 'auto';
    obj.commitEdit({ key: 'Enter', target: { value: '5000' } }, 'price', { row: a });
    expect(a.price).toBe(5000);
    expect(b.price).toBe(5000); // синхронизирована по resKey
  });

  it('openRowModal копирует item в expandedRow', () => {
    const item = { si: 0, row: mkRow() };
    obj.openRowModal(item);
    expect(obj.expandedRow).toEqual(item);
    expect(obj.expandedRow).not.toBe(item);
  });

  it('addRow добавляет запись и открывает редактирование имени', () => {
    obj.data.sections[0].resources = [];
    const before = obj.data.sections[0].resources.length;
    obj.addRow(0);
    expect(obj.data.sections[0].resources.length).toBe(before + 1);
    expect(obj.editing.key).toContain('|name');
  });

  it('addRow без раздела создаёт новый раздел', () => {
    const before = obj.data.sections.length;
    obj.addRow(null);
    expect(obj.data.sections.length).toBe(before + 1);
    expect(obj.activeTab).toBe(obj.data.sections.length - 1);
  });

  it('saveRecordModal удаляет пустую запись', () => {
    const row = mkRow();
    obj.data.sections[0].resources = [row];
    obj.recordModalOpen = true;
    obj.recordDraft = { si: 0, rowId: row.id };
    obj.saveRecordModal();
    expect(obj.data.sections[0].resources.length).toBe(0);
    expect(obj.recordModalOpen).toBe(false);
    expect(obj.recordDraft).toBe(null);
  });

  it('saveRecordModal сохраняет заполненную запись', () => {
    const row = mkRow({ name: 'Работа', price: 100 });
    obj.data.sections[0].resources = [row];
    obj.recordModalOpen = true;
    obj.recordDraft = { si: 0, rowId: row.id };
    obj.saveRecordModal();
    expect(obj.data.sections[0].resources.length).toBe(1);
    expect(obj.recordModalOpen).toBe(false);
  });

  it('removeRowById удаляет по id и чистит выделение', () => {
    const a = mkRow({ id: 'ra' });
    const b = mkRow({ id: 'rb' });
    obj.data.sections[0].resources = [a, b];
    obj.selectedIds = new Set(['ra', 'rb']);
    obj.removeRowById(0, 'ra');
    expect(obj.data.sections[0].resources.map((r) => r.id)).toEqual(['rb']);
    expect(obj.selectedIds.has('ra')).toBe(false);
    expect(obj.selectedIds.has('rb')).toBe(true);
  });

  it('moveRow перемещает запись и клампит границы', () => {
    const a = mkRow({ id: 'ra' });
    const b = mkRow({ id: 'rb' });
    const c = mkRow({ id: 'rc' });
    obj.data.sections[0].resources = [a, b, c];
    const item = { si: 0, row: b };
    obj.moveRow(item, -1);
    expect(obj.data.sections[0].resources.map((r) => r.id)).toEqual(['rb', 'ra', 'rc']);
    obj.moveRow(item, 5); // кламп: ничего не меняет
    expect(obj.data.sections[0].resources.map((r) => r.id)).toEqual(['rb', 'ra', 'rc']);
  });

  it('drag&drop: startRowDrag запоминает строку, dropOnSection переносит', () => {
    const row = mkRow({ id: 'rd' });
    obj.data.sections = [mkSection('A', [row]), mkSection('B', [])];
    const dt = { effectAllowed: null, setData: vi.fn() };
    obj.startRowDrag({ dataTransfer: dt }, { si: 0, row });
    expect(obj.dragRow).toEqual({ si: 0, id: 'rd' });
    expect(dt.effectAllowed).toBe('move');
    obj.dropOnSection(1);
    expect(obj.data.sections[0].resources.length).toBe(0);
    expect(obj.data.sections[1].resources[0].id).toBe('rd');
    expect(obj.dragRow).toBe(null);
  });

  it('dropOnSection в тот же раздел — no-op, без dragRow — no-op', () => {
    const row = mkRow({ id: 'rd' });
    obj.data.sections = [mkSection('A', [row]), mkSection('B', [])];
    obj.dropOnSection(0); // dragRow = null
    expect(obj.data.sections[0].resources.length).toBe(1);
    obj.startRowDrag({ dataTransfer: { setData: vi.fn() } }, { si: 0, row });
    obj.dropOnSection(0); // тот же si
    expect(obj.data.sections[0].resources.length).toBe(1);
    obj.endRowDrag();
    expect(obj.dragRow).toBe(null);
  });
});
