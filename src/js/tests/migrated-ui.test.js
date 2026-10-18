/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import smetaModule from '../app.js';

describe('src/js/app.js — перенесённые из legacy UI-функции', () => {
  const obj = typeof smetaModule === 'function' ? smetaModule() : smetaModule;

  it('все бывшие заглушки теперь реализованы (не пустые)', () => {
    const names = [
      'startRenameSection',
      'moveSectionByDrag',
      'startResize',
      'moveGridCursor',
      'openCell',
      'removeSelected',
      'cancelNsbEdit',
      'cancelRecordModal',
      'openProjectModal',
      'openCalc',
      'openResHub',
      'openNsb',
    ];
    for (const n of names) {
      expect(typeof obj[n], n).toBe('function');
      // тело не пустое: length исходника функции > минимального
      expect(obj[n].toString().length, 'пустая заглушка: ' + n).toBeGreaterThan(25);
    }
  });

  it('дополнительные зависимости перенесены', () => {
    for (const n of [
      'recordRow',
      'calcResult',
      'rowNumber',
      'setPredByNumber',
      'syncResourcePrice',
      'onPriceEdited',
      'saveNsb',
      'openAddRecordModal',
      'applyCalcToRow',
    ]) {
      const d = Object.getOwnPropertyDescriptor(obj, n);
      expect(d, 'нет члена ' + n).toBeTruthy();
    }
  });

  it('openCalc + calcResult считает трудозатраты', () => {
    obj.openCalc();
    expect(obj.calcModalOpen).toBe(true);
    Object.assign(obj.calc, {
      volume: 100,
      normTime: 1.2,
      crewSize: 3,
      shiftsPerDay: 1,
      hoursPerShift: 8,
      ratePerHour: 250,
      days: null,
    });
    const r = obj.calcResult;
    expect(r.totalHours).toBe(120);
    expect(r.days).toBe(5);
    expect(r.cost).toBe(30000);
  });

  it('openCalc с prefillRow machine выбирает машинную вкладку', () => {
    obj.openCalc({ type: 'machine', qty: 40, price: 900 });
    expect(obj.calcTab).toBe('machine');
    expect(obj.calc.volume).toBe(40);
    expect(obj.calc.ratePerHour).toBe(900);
  });

  it('openCell устанавливает editing key', () => {
    obj.openCell('name', { row: { id: 'rX' } });
    expect(obj.editing.key).toBe('rX|name');
  });

  it('moveGridCursor двигает курсор и выделяет строку', () => {
    Object.defineProperty(obj, 'pagedRows', {
      value: [{ row: { id: 'a' } }, { row: { id: 'b' } }],
      configurable: true,
    });
    obj.cursor = -1;
    obj.moveGridCursor(1);
    expect(obj.cursor).toBe(0);
    obj.moveGridCursor(5);
    expect(obj.cursor).toBe(1); // клампинг
    expect([...obj.selectedIds]).toEqual(['b']);
  });

  it('removeSelected удаляет выделенные записи', () => {
    // confirm() в jsdom не реализован и возвращает false — мокаем подтверждение
    const origConfirm = window.confirm;
    window.confirm = () => true;
    obj.data.sections = [{ id: 's1', name: 'S', resources: [{ id: 'r1' }, { id: 'r2' }] }];
    obj.selectedIds = new Set(['r1']);
    obj.removeSelected();
    window.confirm = origConfirm;
    expect(obj.data.sections[0].resources.map((r) => r.id)).toEqual(['r2']);
    expect(obj.selectedIds.size).toBe(0);
  });

  it('openNsb сбрасывает состояние редактирования', () => {
    obj.nsbEditId = 'x';
    obj.nsbDraft = { a: 1 };
    obj.nsbModalOpen = false;
    obj.openNsb();
    expect(obj.nsbModalOpen).toBe(true);
    expect(obj.nsbEditId).toBe(null);
    expect(obj.nsbDraft).toBe(null);
  });

  it('cancelNsbEdit удаляет пустую новую запись НСБ', () => {
    obj.nsbItems = [{ id: 'n1', name: '' }];
    obj.nsbEditId = 'n1';
    obj.nsbDraft = { id: 'n1', name: '' };
    obj.cancelNsbEdit();
    expect(obj.nsbItems.length).toBe(0);
    expect(obj.nsbEditId).toBe(null);
  });

  it('cancelRecordModal удаляет пустую новую запись формы', () => {
    const row = { id: 'rNew', name: '', basis: '', qty: 0, price: 0 };
    obj.data.sections = [{ id: 's1', name: 'S', resources: [row] }];
    obj.recordModalOpen = true;
    obj.recordDraft = { si: 0, rowId: 'rNew' };
    obj.cancelRecordModal();
    expect(obj.data.sections[0].resources.length).toBe(0);
    expect(obj.recordModalOpen).toBe(false);
    expect(obj.recordDraft).toBe(null);
  });

  it('syncResourcePrice синхронизирует цену по ключу (auto режим)', () => {
    obj.data.recalcMode = 'auto';
    // Resource.getKey требует валидного ресурса: qty/price — числа, unit — строка
    obj.data.sections = [
      {
        id: 's1',
        name: 'S',
        resources: [
          { id: 'a', name: 'Кирпич', unit: 'шт', type: 'material', qty: 10, price: 20 },
          { id: 'b', name: 'Кирпич', unit: 'шт', type: 'material', qty: 5, price: 15 },
        ],
      },
    ];
    const [ra, rb] = obj.data.sections[0].resources;
    ra.price = 20;
    obj.syncResourcePrice(ra);
    expect(rb.price).toBe(20);
  });

  it('syncResourcePrice не трогает others в manual режиме', () => {
    obj.data.recalcMode = 'manual';
    obj.data.sections = [
      {
        id: 's1',
        name: 'S',
        resources: [
          { id: 'a', name: 'Кирпич', unit: 'шт', type: 'material', qty: 10, price: 20 },
          { id: 'b', name: 'Кирпич', unit: 'шт', type: 'material', qty: 5, price: 15 },
        ],
      },
    ];
    obj.syncResourcePrice(obj.data.sections[0].resources[0]);
    expect(obj.data.sections[0].resources[1].price).toBe(15);
  });

  it('moveSectionByDrag переставляет разделы', () => {
    obj.data.sections = [
      { id: 's1', name: 'A', resources: [] },
      { id: 's2', name: 'B', resources: [] },
      { id: 's3', name: 'C', resources: [] },
    ];
    obj.tabDragFrom = 0;
    obj.moveSectionByDrag(2);
    expect(obj.data.sections.map((s) => s.name)).toEqual(['B', 'C', 'A']);
    expect(obj.tabDragFrom).toBe(null);
  });

  it('openProjectModal/openResHub открывают модалки', () => {
    obj.openProjectModal();
    expect(obj.projModalOpen).toBe(true);
    obj.openResHub();
    expect(obj.resModalOpen).toBe(true);
  });

  it('applyCalcToRow применяет результат к записи', () => {
    obj.calcTab = 'labor';
    Object.assign(obj.calc, {
      volume: 10,
      normTime: 2,
      crewSize: 1,
      shiftsPerDay: 1,
      hoursPerShift: 8,
      ratePerHour: 300,
      days: null,
    });
    const row = { id: 'r1', name: 'Р', unit: '', qty: 0, price: 0, days: 0, type: 'material' };
    obj.pushHistory = () => {};
    obj.applyCalcToRow({ row });
    expect(row.type).toBe('labor');
    expect(row.qty).toBe(20);
    expect(row.price).toBe(300);
    expect(row.unit).toBe('чел-ч');
    expect(obj.calcModalOpen).toBe(false);
  });

  it('problemCount считает ошибки валидации сметы', () => {
    const origSections = obj.data.sections;
    const mkSection = (name) => ({
      id: 's1',
      name,
      parentId: null,
      collapsed: false,
      resources: [],
    });
    // пустое название раздела — ошибка валидации
    obj.data.sections = [mkSection('')];
    expect(obj.problemCount()).toBeGreaterThan(0);
    // корректный раздел — ноль проблем
    obj.data.sections = [mkSection('Раздел')];
    expect(obj.problemCount()).toBe(0);
    obj.data.sections = origSections;
  });
});
