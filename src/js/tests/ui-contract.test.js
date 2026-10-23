/**
 * Контрактный тест UI: каждый вызов метода из Alpine-атрибутов index.html
 * обязан существовать в объекте smeta() — иначе кнопка/поле «не работает» в браузере.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appSrcFull = fs.readFileSync(path.join(ROOT, 'src/js/app.js'), 'utf8');
// Тело только smeta(): до window.ganttLinks — иначе ключи второго Alpine-компонента
// (init и т.п.) ложно считаются дублями.
const ganttStart = appSrcFull.indexOf('window.ganttLinks');
const appSrc = ganttStart === -1 ? appSrcFull : appSrcFull.slice(0, ganttStart);
// Ключи вспомогательного компонента ganttLinks() (init/destroy/render…) — не часть smeta().
const ganttKeys = new Set();
if (ganttStart !== -1) {
  for (const m of appSrcFull
    .slice(ganttStart)
    .matchAll(/^ {4}(?:get |set )?([A-Za-z_][\w]*)\s*[:(]/gm)) {
    ganttKeys.add(m[1]);
  }
}

// имена методов/геттеров, объявленных в smeta() (отступ 4 пробела)
const defined = new Set();
for (const m of appSrc.matchAll(/^ {4}(?:get |set )?([A-Za-z_][\w]*)\s*[:(]/gm)) {
  defined.add(m[1]);
}

// стандартные методы/функции, которые не обязаны быть в smeta()
const BUILTINS = new Set([
  'if',
  'typeof',
  'Number',
  'String',
  'Math',
  'JSON',
  'Date',
  'Array',
  'Object',
  'Boolean',
  'parseFloat',
  'parseInt',
  'alert',
  'confirm',
  'encodeURIComponent',
  'decodeURIComponent',
  'fetch',
  'window',
  'localStorage',
  'document',
  'test',
  'replace',
  'split',
  'join',
  'map',
  'filter',
  'forEach',
  'find',
  'findIndex',
  'includes',
  'slice',
  'abs',
  'round',
  'max',
  'min',
  'push',
  'has',
  'toFixed',
  'toLowerCase',
  'toUpperCase',
  'localeCompare',
  'sort',
  'reduce',
  'some',
  'every',
  'concat',
  'padStart',
  'trim',
  'click',
  'preventDefault',
  'stopPropagation',
  'focus',
  'blur',
  'keys',
  'values',
  'entries',
  'from',
  'of',
  'isArray',
  'stringify',
  'parse',
  'pow',
  'floor',
  'ceil',
  'random',
  'match',
  'startsWith',
  'endsWith',
  'indexOf',
  'substring',
  'toString',
  'var',
  'length',
  'addEventListener',
  'removeEventListener',
  'scrollIntoView',
]);

describe('UI-контракт: index.html ↔ smeta()', () => {
  it('все вызовы функций в Alpine-атрибутах объявлены в smeta()', () => {
    const missing = new Set();
    for (const attr of html.matchAll(/(?:@[\w.-]+|x-show|x-text|x-if|:href)="([^"]+)"/g)) {
      for (const call of attr[1].matchAll(/(?:^|[^.\w$])([A-Za-z_][\w]*)\s*\(/g)) {
        const name = call[1];
        if (!defined.has(name) && !ganttKeys.has(name) && !BUILTINS.has(name)) missing.add(name);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('в smeta() нет дублирующихся ключей (последнее объявление не перезаписывает рабочее)', () => {
    const keys = [];
    for (const m of appSrc.matchAll(/^ {4}(?:get |set )?([A-Za-z_][\w]*)\s*[:(]/gm)) {
      // «if» — ветвления кода с 4-пробельным отступом, не ключ объекта smeta()
      if (m[1] !== 'if') keys.push(m[1]);
    }
    const dups = keys.filter((k, i) => {
      return keys.indexOf(k) !== i;
    });
    expect([...new Set(dups)]).toEqual([]);
  });

  it('удалённый функционал отсутствует в UI: тема, Excel, сортировка/группировка строк', () => {
    expect(html).not.toMatch(/toggleTheme|darkMode|lightMode/i);
    // Баннер-запрет «Без тем · Excel» убран из шапки по просьбе пользователя —
    // теперь просто запрещаем любые упоминания Excel/xlsx и экспорта Excel в разметке.
    expect(html).not.toMatch(/exportExcel|Экспорт Excel|\.xlsx|Без тем/i);
    expect(html).not.toMatch(/sortBy|toggleGroupMenu|summaryGroup/);
    expect(appSrc).not.toMatch(/toggleTheme|exportExcel|sortBy\s*[:(]|toggleGroupMenu/);
  });

  it('rowTotal считается по каркасному методу (frameworkRowCost), а не q*price', () => {
    const rt = appSrc.match(/rowTotal\(row\)\s*\{[\s\S]{0,200}?\}/);
    expect(rt).not.toBeNull();
    expect(rt[0]).toMatch(/frameworkRowCost/);
  });

  it('раунд 7: единая кнопка экспорта Ганта, анимация drop и столбец «Раздел» в сводке', () => {
    // PNG/SVG слиты в одну кнопку exportGantt() — из HTML нельзя звать старые методы
    expect(html).toMatch(/@click="exportGantt\(\)"/);
    expect(html).not.toMatch(/@click="exportGanttPng\(\)"|@click="exportGanttSvg\(\)"/);
    // обе реализации остаются только внутренними (вызываются из exportGantt)
    expect(defined.has('exportGantt')).toBe(true);
    // вспышка переставленной строки: состояние объявлено, класс привязан, CSS есть
    expect(appSrc).toMatch(/^\s*droppedRowId:\s*null,/m);
    expect(html).toMatch(/'row-dropped':\s*droppedRowId === item\.row\.id/);
    const css = fs.readFileSync(path.join(ROOT, 'src/css/style.css'), 'utf8');
    expect(css).toMatch(/\.at-row\.row-dropped/);
    // сводная ведомость: колонка «Раздел» + данные sections
    expect(html).toMatch(/<th[^>]*>[^<]*<\/?span[^>]*>T<\/span>\s*Раздел<\/th>/);
    expect(html).toMatch(/\[\.\.\.item\.e\.sections\]\.join\(', '\)/);
  });
});
