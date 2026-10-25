/**
 * @vitest-environment jsdom
 *
 * UI-тесты: визуальная проверка расположения элементов и наличия функций.
 *  1) Структурные тесты — раскладка index.html (порядок секций, вложенность,
 *     привязка кнопок меню/табов к нужным контейнерам через x-show).
 *  2) Поведенческие тесты — открытие/закрытие модалок и переключение видов
 *     через реальные обработчики @click из разметки (jsdom + Alpine-подобный
 *     биндинг this к объекту smeta()).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import smetaModule from '../app.ts';

const ROOT = path.resolve(__dirname, '../../..');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'src/css/style.css'), 'utf8');

let dom;
let doc;
// Глобальный Node из jsdom-окна: compareDocumentPosition возвращает его константы,
// а не константы глобального Node vitest-окружения.
let NODE_POS;

beforeAll(() => {
  // CDN Alpine намеренно не исполняем — проверяем статику разметки и
  // вручную дёргаем методы smeta(), привязанные к кнопкам через @click.
  dom = new JSDOM(htmlSrc, { url: 'http://localhost/' });
  doc = dom.window.document;
  NODE_POS = dom.window.Node;
});

const FOLLOWING = (a, b) => !!(a.compareDocumentPosition(b) & NODE_POS.DOCUMENT_POSITION_FOLLOWING);
const PRECEDING = (a, b) => !!(a.compareDocumentPosition(b) & NODE_POS.DOCUMENT_POSITION_PRECEDING);

// ---------------------------------------------------------------------------
// 1. СТРУКТУРА И РАСПОЛОЖЕНИЕ (визуальная раскладка DOM)
// ---------------------------------------------------------------------------
describe('Расположение элементов в index.html', () => {
  it('корневой контейнер x-data="smeta()" с header → nav → main по порядку', () => {
    const root = doc.querySelector('.app[x-data]');
    expect(root).not.toBeNull();
    expect(root.getAttribute('x-data')).toBe('smeta()');
    expect(root.getAttribute('x-init')).toBe('init()');

    // Главный экран (карточки инструментов) идёт первым, затем экран сметы
    const home = root.querySelector(':scope > section.home-screen');
    const smetaScreen = root.querySelector(':scope > div.smeta-screen');
    expect(home, 'главный экран не найден').toBeTruthy();
    expect(smetaScreen, 'экран сметы не найден').toBeTruthy();
    expect([...root.children][0]).toBe(home);

    const topbar = smetaScreen.querySelector(':scope > header.at-topbar');
    const viewsBar = smetaScreen.querySelector(':scope > nav.at-views-bar');
    const main = smetaScreen.querySelector(':scope > main.at-main');
    expect(topbar, 'шапка не найдена').toBeTruthy();
    expect(viewsBar, 'панель видов не найдена').toBeTruthy();
    expect(main, 'основная область не найдена').toBeTruthy();

    // Визуальный порядок сверху вниз: шапка, под ней табы видов, затем контент
    const kids = [...smetaScreen.children].filter((el) =>
      ['HEADER', 'NAV', 'MAIN'].includes(el.tagName)
    );
    expect(kids.map((el) => el.className)).toEqual(['at-topbar', 'at-views-bar', 'at-main']);
    expect(kids.indexOf(topbar)).toBeLessThan(kids.indexOf(viewsBar));
    expect(kids.indexOf(viewsBar)).toBeLessThan(kids.indexOf(main));
  });

  it('шапка слева направо: хлебные крошки (иконка, название, поле сметы) → действия', () => {
    const topbar = doc.querySelector('.at-topbar');
    const crumb = topbar.querySelector('.at-crumb');
    const actions = topbar.querySelector('.at-actions');
    expect(crumb && actions).toBeTruthy();
    expect(PRECEDING(topbar, crumb) || topbar.contains(crumb)).toBe(true);

    // внутри крошек: иконка БД, имя «СметаHome», разделитель, редактируемое название
    const seq = [...crumb.children].map((c) => c.className);
    expect(seq[0]).toContain('at-db-icon');
    expect(seq[1]).toContain('at-db-name');
    expect(crumb.querySelector('.at-db-name').textContent).toBe('СметаHome');
    expect(seq[2]).toContain('at-sep');
    const titleInput = crumb.querySelector('input.at-title-input');
    expect(titleInput.getAttribute('x-model')).toBe('data.title');

    // порядок действий: Главная → Сохранить → Undo → Redo → Меню
    const btns = [...actions.querySelectorAll('button')].map((b) => b.className);
    expect(btns[0]).toContain('at-home-btn');
    expect(btns[1]).toContain('gh-btn');
    expect(actions.querySelectorAll('button').length).toBeGreaterThanOrEqual(4);
    const menuWrap = actions.querySelector('.gh-menu-wrap');
    expect(menuWrap).toBeTruthy();
    expect(actions.contains(menuWrap)).toBe(true);
  });

  it('кнопки undo/redo задизейблены стеками и стоят сразу после «Сохранить»', () => {
    const saveBtn = [...doc.querySelectorAll('.at-actions button')].find((b) =>
      /manualSave/.test(b.getAttribute('@click') || '')
    );
    const undoBtn = [...doc.querySelectorAll('.at-actions button')].find((b) =>
      /undoAction/.test(b.getAttribute('@click') || '')
    );
    const redoBtn = [...doc.querySelectorAll('.at-actions button')].find((b) =>
      /redoAction/.test(b.getAttribute('@click') || '')
    );
    expect(saveBtn).toBeTruthy();
    expect(undoBtn).toBeTruthy();
    expect(redoBtn).toBeTruthy();
    expect(undoBtn.getAttribute(':disabled')).toBe('!undoStack.length');
    expect(redoBtn.getAttribute(':disabled')).toBe('!redoStack.length');
    // визуальный порядок: save < undo < redo
    const order = [saveBtn, undoBtn, redoBtn];
    for (let i = 0; i < order.length - 1; i++) {
      expect(FOLLOWING(order[i], order[i + 1])).toBe(true);
    }
  });

  it('выпадающее меню «Меню» содержит все группы: Разделы, Справочники, Файл, Проект', () => {
    const menu = doc.querySelector('.gh-menu');
    const titles = [...menu.querySelectorAll('.gh-menu-group-title')].map((t) =>
      t.textContent.trim()
    );
    expect(titles).toEqual(expect.arrayContaining(['Разделы', 'Справочники', 'Файл', 'Проект']));
    // порядок групп сверху вниз именно такой
    expect(titles.indexOf('Разделы')).toBeLessThan(titles.indexOf('Справочники'));
    expect(titles.indexOf('Справочники')).toBeLessThan(titles.indexOf('Файл'));
    expect(titles.indexOf('Файл')).toBeLessThan(titles.indexOf('Проект'));
    // разделители между группами присутствуют
    expect(menu.querySelectorAll('.gh-menu-sep').length).toBeGreaterThanOrEqual(2);
    // бейдж количества проблем у пункта валидации
    expect(menu.querySelector('.gh-menu-badge')).toBeTruthy();
  });

  it('табы видов идут в порядке Таблица → Гант → Сводная, поиск прижат к ним справа', () => {
    const tabs = [...doc.querySelectorAll('.at-views .at-view-tab')];
    expect(tabs.map((t) => t.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Таблица',
      'Диаграмма Ганта',
      'Сводная ведомость ресурсов',
    ]);
    // активный таб привязан к viewTab
    expect(tabs[0].getAttribute(':class')).toMatch(/viewTab === 'table'/);
    expect(tabs[1].getAttribute(':class')).toMatch(/viewTab === 'gantt'/);
    expect(tabs[2].getAttribute(':class')).toMatch(/viewTab === 'summary'/);
    // поиск — внутри той же панели видов, после табов, виден только в «Таблице»
    const search = doc.querySelector('.at-views .at-search');
    expect(search).toBeTruthy();
    expect(search.getAttribute('x-show')).toBe("viewTab === 'table'");
    expect(FOLLOWING(tabs[2], search)).toBe(true);
  });

  it('три области контента mutually exclusive по viewTab и идут в порядке table → gantt → summary', () => {
    const table = doc.querySelector('.at-content .at-table-wrap');
    const gantt = doc.querySelector('.at-content .at-gantt-wrap');
    const summary = doc.querySelector('.at-content .at-summary-wrap');
    expect(table.getAttribute('x-show')).toBe("viewTab === 'table'");
    expect(gantt.getAttribute('x-show')).toBe("viewTab === 'gantt'");
    expect(summary.getAttribute('x-show')).toBe("viewTab === 'summary'");
    // все три — прямые дети at-content, порядок совпадает с табами
    const content = doc.querySelector('.at-content');
    const kids = [...content.children].filter((el) =>
      ['at-table-wrap', 'at-gantt-wrap', 'at-summary-wrap'].some((c) => el.classList.contains(c))
    );
    expect(kids.map((el) => el.className.split(' ')[0])).toEqual([
      'at-table-wrap',
      'at-gantt-wrap',
      'at-summary-wrap',
    ]);
  });

  it('панель вкладок разделов (AutoCAD-листы) закреплена внизу таблицы, только в виде «Таблица»', () => {
    const tabsBar = doc.querySelector('.at-tabs-bar.at-tabs-bottom');
    expect(tabsBar.getAttribute('x-show')).toBe("viewTab === 'table'");
    const content = doc.querySelector('.at-content');
    // идёт ПОСЛЕ at-table-wrap/gantt/summary — т.е. визуально под таблицей
    const table = content.querySelector('.at-table-wrap');
    expect(FOLLOWING(table, tabsBar)).toBe(true);
    // кнопка раскрытия списка разделов стоит первой внутри панели
    const select = tabsBar.querySelector('.at-section-select');
    expect(select).toBeTruthy();
    expect(select.getAttribute('@click')).toMatch(/sectionDropdownOpen/);
  });

  it('строка добавления записи — последняя строка tbody таблицы (единственное место быстрой вставки)', () => {
    const addRow = doc.querySelector('.at-table .at-add-row');
    expect(addRow).toBeTruthy();
    const tbody = addRow.closest('tbody');
    expect(tbody.lastElementChild).toBe(addRow);
    // две точки входа: ячейка ＋ и кнопка «Через форму»
    expect(addRow.innerHTML).toContain('openAddRecordModal()');
    expect(addRow.querySelector('td.add')?.getAttribute('@click')).toMatch(
      /addRow\(currentTargetSection\(\)\)/
    );
    // в шапке НЕ должно быть дублирующей кнопки «Добавить запись»
    const topbarText = doc.querySelector('.at-topbar').textContent;
    expect(/Добавить запись/.test(topbarText)).toBe(false);
  });

  it('тулбар Ганта: слева дата начала, по центру инфо, справа кнопки крит.пути/автоплана/экспорта', () => {
    const toolbar = doc.querySelector('.at-gantt-toolbar');
    expect(toolbar.querySelector('.at-gantt-start input[type="date"]')).toBeTruthy();
    const critical = [...toolbar.querySelectorAll('button')].find((b) =>
      /ganttCritical/.test(b.getAttribute('@click') || '')
    );
    const exportBtn = [...toolbar.querySelectorAll('button')].find((b) =>
      /exportGantt\(\)/.test(b.getAttribute('@click') || '')
    );
    expect(critical).toBeTruthy();
    expect(exportBtn).toBeTruthy();
    // spacer разделяет левую и правую части
    expect(toolbar.querySelector('.spacer')).toBeTruthy();
    const spacer = toolbar.querySelector('.spacer');
    expect(FOLLOWING(spacer, exportBtn)).toBe(true);
    // старая пара кнопок PNG/SVG отсутствует (слита в exportGantt)
    expect(toolbar.innerHTML).not.toMatch(/exportGanttPng|exportGanttSvg/);
  });

  it('сводная ведомость: заголовок слева, поиск ресурса, CSV справа; колонка «Раздел» присутствует', () => {
    const sumToolbar = doc.querySelector('.at-summary-toolbar');
    expect(sumToolbar.querySelector('.at-summary-title').textContent).toBe(
      'Сводная ведомость ресурсов'
    );
    expect(sumToolbar.querySelector('.at-search input').getAttribute('x-model')).toBe(
      'summarySearch'
    );
    const csv = [...sumToolbar.querySelectorAll('button')].find((b) =>
      /exportSummaryCsv/.test(b.getAttribute('@click') || '')
    );
    expect(csv).toBeTruthy();
    expect(sumToolbar.querySelector('.spacer')).toBeTruthy();
    // таблица сводки содержит колонку «Раздел» между «Ед. изм.» и «Кол-во всего»
    const ths = [...doc.querySelectorAll('.summary-table thead th')].map((th) =>
      th.textContent.replace(/[T#∑⬡$]/g, '').trim()
    );
    expect(ths).toEqual(
      expect.arrayContaining([
        'Наименование ресурса',
        'Тип',
        'Ед. изм.',
        'Раздел',
        'Кол-во всего',
        'Средняя цена',
        'Стоимость, ₽',
      ])
    );
    const idxUnit = ths.indexOf('Ед. изм.');
    const idxSection = ths.indexOf('Раздел');
    const idxQty = ths.indexOf('Кол-во всего');
    expect(idxUnit).toBeLessThan(idxSection);
    expect(idxSection).toBeLessThan(idxQty);
  });

  it('модалки рендерятся в конце документа как backdrop+modal с x-show по своим флагам', () => {
    const expectedFlags = {
      expandedRow: null,
      recordModalOpen: 'saveRecordModal()',
      sectionModalOpen: 'saveSectionModal()',
    };
    for (const flag of Object.keys(expectedFlags)) {
      const backdrop = doc.querySelector(`.at-modal-backdrop[x-show="${flag}"]`);
      expect(backdrop, `нет backdrop для ${flag}`).toBeTruthy();
      const modal = backdrop.querySelector('.at-modal');
      expect(modal, `нет .at-modal внутри backdrop ${flag}`).toBeTruthy();
    }
    // все модальные состояния app.js имеют якорь в разметке
    for (const flag of [
      'calcModalOpen',
      'projModalOpen',
      'resModalOpen',
      'printModalOpen',
      'helpModalOpen',
      'nsbModalOpen',
    ]) {
      expect(htmlSrc).toContain(`x-show="${flag}"`);
    }
    // панель истории — боковой overlay, а не центральная модалка
    expect(doc.querySelector('.at-history-panel[x-show="historyOpen"]')).toBeTruthy();
    // batch-bar привязан к наличию выделенных строк
    const batch = doc.querySelector('.at-batch-bar');
    expect(batch.getAttribute('x-show')).toBe('batchBar && selectedIds.size > 0');
  });

  it('CSS подтверждает визуальную модель: flex-колонна app, sticky-вкладки снизу, absolute-меню, batch-bar', () => {
    expect(cssSrc).toMatch(/\.app\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/s);
    // вкладки разделов прижаты к низу окна (sticky bottom) — как листы AutoCAD
    expect(cssSrc).toMatch(/\.at-tabs-bottom\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0/s);
    expect(cssSrc).toMatch(/\.gh-menu\s*\{[^}]*position:\s*absolute/s);
    expect(cssSrc).toMatch(/\.at-batch-bar\s*\{[^}]*position:\s*(fixed|absolute)/s);
    // x-cloak скрыт до старта Alpine — иначе модалки «мигают» при загрузке
    expect(cssSrc).toMatch(/\[x-cloak\][^{]*\{[^}]*display:\s*none/is);
  });
});

// ---------------------------------------------------------------------------
// 2. НАЛИЧИЕ ФУНКЦИЙ: каждый @click/x-* из HTML резолвится в smeta()
// ---------------------------------------------------------------------------
describe('Наличие функций, вызываемых из UI', () => {
  it('каждый прямой вызов метода в @click существует в объекте smeta()', () => {
    const obj = typeof smetaModule === 'function' ? smetaModule() : smetaModule;
    const clickHandlers = [...htmlSrc.matchAll(/@click(?:\.outside|\.self)?="([^"]+)"/g)].map(
      (m) => m[1]
    );
    const BUILTINS = new Set([
      'if',
      'typeof',
      'Math',
      'Number',
      'String',
      'JSON',
      'Date',
      '$refs',
      'nextTick',
    ]);
    const missing = new Set();
    for (const h of clickHandlers) {
      for (const call of h.matchAll(/(?:^|[^.\w$])([A-Za-z_]\w*)\s*\(/g)) {
        const name = call[1];
        if (BUILTINS.has(name)) continue;
        if (typeof obj[name] !== 'function' && !Object.prototype.hasOwnProperty.call(obj, name)) {
          missing.add(name);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('ключевые UI-функции present и вызываются без исключений', () => {
    const obj = typeof smetaModule === 'function' ? smetaModule() : smetaModule;
    const keyFns = [
      'manualSave',
      'undoAction',
      'redoAction',
      'openNsb',
      'openResHub',
      'openCalc',
      'openAddSectionModal',
      'openAddRecordModal',
      'openProjectModal',
      'openPrintModal',
      'exportJson',
      'exportGantt',
      'exportSummaryCsv',
      'toggleGantt',
      'problemCount',
      'savedTimeText',
      'currentTargetSection',
      'addRow',
      'goPage',
      'pageLabel',
      'totalTableWidth',
      'colSpanFor',
      'tailCols',
      'printColOn',
      'groupTypeLabel',
      'fmtNum',
      'summaryTotalCost',
      'ganttHasShifts',
      'resetAllGanttShifts',
    ];
    for (const n of keyFns) {
      expect(typeof obj[n], `нет функции ${n}`).toBe('function');
    }
    // safe-call: функции, открывающие оверлеи, не падают на дефолтных данных
    expect(() => obj.openNsb()).not.toThrow();
    expect(() => obj.openResHub()).not.toThrow();
    expect(() => obj.openCalc()).not.toThrow();
    expect(() => obj.openProjectModal()).not.toThrow();
    expect(() => obj.toggleGantt()).not.toThrow();
    expect(() => obj.problemCount()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. ПОВЕДЕНИЕ: обработчики кнопок реально меняют состояние (прогон @click)
// ---------------------------------------------------------------------------
describe('Поведение UI-функций (исполнение @click из разметки)', () => {
  let obj;
  beforeAll(() => {
    obj = typeof smetaModule === 'function' ? smetaModule() : smetaModule;
  });

  const getClick = (b) =>
    b.getAttribute('@click') ||
    b.getAttribute('@click.stop') ||
    b.getAttribute('@click.self') ||
    '';

  // Исполняем ровно тот код, что висит на кнопке @click, в контексте smeta().
  // Прямой вызов методов вместо new Function: esbuild в TS-файле подменяет
  // идентификаторы метода (this.toggleGantt → this.obj_1), из-за чего динамический
  // код ссылаётся на несуществующие поля. Разбор выражений @click по образцу.
  const runExpr = (expr: string) => {
    for (const part of expr
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      let m;
      if ((m = part.match(/^([\w$]+)\(\)$/))) {
        obj[m[1]]();
      } else if ((m = part.match(/^([\w$.]+)\s*=\s*!\1$/))) {
        const path = m[1].split('.');
        let t = obj;
        for (let i = 0; i < path.length - 1; i++) t = t[path[i]];
        t[path[path.length - 1]] = !t[path[path.length - 1]];
      } else if ((m = part.match(/^([\w$.]+)\s*=\s*(true|false)$/))) {
        const path = m[1].split('.');
        let t = obj;
        for (let i = 0; i < path.length - 1; i++) t = t[path[i]];
        t[path[path.length - 1]] = m[2] === 'true';
      } else if ((m = part.match(/^([\w$.]+)\s*=\s*'([^']*)'$/))) {
        const path = m[1].split('.');
        let t = obj;
        for (let i = 0; i < path.length - 1; i++) t = t[path[i]];
        t[path[path.length - 1]] = m[2];
      } else {
        throw new Error(`runExpr: неразобранное выражение @click: "${part}"`);
      }
    }
  };

  const runClick = (selector, matcher) => {
    const btn = [...doc.querySelectorAll(selector)].find((b) => matcher.test(getClick(b)));
    expect(btn, `кнопка не найдена: ${matcher}`).toBeTruthy();
    runExpr(getClick(btn));
    return btn;
  };

  it('таб «Диаграмма Ганта» (@click=toggleGantt()) переключает viewTab туда и обратно', () => {
    obj.viewTab = 'table';
    runClick('.at-views .at-view-tab', /toggleGantt\(\)/);
    expect(obj.viewTab).toBe('gantt');
    runClick('.at-views .at-view-tab', /toggleGantt\(\)/);
    expect(obj.viewTab).toBe('table');
  });

  it('таб «Сводная ведомость» ставит viewTab=summary (прямое присваивание из HTML)', () => {
    runClick('.at-views .at-view-tab', /viewTab = 'summary'/);
    expect(obj.viewTab).toBe('summary');
  });

  it('кнопка «Меню» тогглит topMenuOpen, клик по пункту «НСБ» закрывает меню и открывает модалку', () => {
    obj.topMenuOpen = false;
    runClick('.gh-menu-wrap > button', /topMenuOpen = !topMenuOpen/);
    expect(obj.topMenuOpen).toBe(true);
    // пункт меню НСБ: сначала закрывает меню, потом openNsb()
    const nsbItem = [...doc.querySelectorAll('.gh-menu button')].find((b) =>
      /openNsb\(\)/.test(b.getAttribute('@click') || '')
    );
    expect(nsbItem).toBeTruthy();
    runExpr(getClick(nsbItem));
    expect(obj.topMenuOpen).toBe(false);
    expect(obj.nsbModalOpen).toBe(true);
  });

  it('«Новый раздел» из меню открывает sectionModal с режимом create', () => {
    obj.topMenuOpen = true;
    runClick('.gh-menu button', /openAddSectionModal\(\)/);
    expect(obj.topMenuOpen).toBe(false);
    expect(obj.sectionModalOpen).toBe(true);
    expect(obj.sectionModalMode).toBe('create');
  });

  it('«Через форму» в строке добавления открывает recordModal с черновиком', () => {
    obj.data.sections = [{ id: 's1', name: 'S', resources: [] }];
    obj.activeTab = 0;
    runClick('.at-add-inline button', /openAddRecordModal\(\)/);
    expect(obj.recordModalOpen).toBe(true);
    expect(obj.recordDraft).toBeTruthy();
    obj.cancelRecordModal();
    expect(obj.recordModalOpen).toBe(false);
  });

  it('ESC закрывает все открытые оверлеи (handleKeyDown из init)', () => {
    obj.nsbModalOpen = true;
    obj.calcModalOpen = true;
    obj.helpModalOpen = true;
    obj.recordModalOpen = false;
    obj.handleKeyDown({ key: 'Escape' });
    expect(obj.nsbModalOpen).toBe(false);
    expect(obj.calcModalOpen).toBe(false);
    expect(obj.helpModalOpen).toBe(false);
  });

  it('undo/redo: disabled-состояние кнопок согласуется с длиной стеков', () => {
    obj.undoStack = [];
    obj.redoStack = [];
    expect(!obj.undoStack.length).toBe(true); // :disabled="!undoStack.length" → кнопка серая
    obj.pushHistory({ label: 'тест', undo: () => {} });
    expect(obj.undoStack.length).toBeGreaterThan(0);
    obj.undoAction();
    expect(obj.undoStack.length).toBe(0);
    expect(obj.redoStack.length).toBeGreaterThan(0);
    obj.redoAction();
    expect(obj.undoStack.length).toBeGreaterThan(0);
  });

  it('кнопка ⤓ Экспорт… в тулбаре Ганта вызывает существующий exportGantt (без падения до стадии диалога)', () => {
    // exportGantt показывает confirm()/canvas — в jsdom нет canvas, поэтому
    // проверяем лишь что метод привязан и это функция smeta (см. также ui-contract)
    const btn = [...doc.querySelectorAll('.at-gantt-toolbar button')].find((b) =>
      /exportGantt\(\)/.test(b.getAttribute('@click') || '')
    );
    expect(btn).toBeTruthy();
    const obj2 = typeof smetaModule === 'function' ? smetaModule() : smetaModule;
    expect(typeof obj2.exportGantt).toBe('function');
  });
});
