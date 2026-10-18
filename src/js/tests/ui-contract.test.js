/**
 * Контрактный тест UI: каждый вызов метода из Alpine-атрибутов index.html
 * обязан существовать в объекте smeta() — иначе кнопка/поле «не работает» в браузере.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, 'src/js/app.js'), 'utf8');

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
        if (!defined.has(name) && !BUILTINS.has(name)) missing.add(name);
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
    // «Excel» допускается только в баннере-запрете (gh-notice), но не как код/кнопка экспорта
    const htmlWithoutNotice = html.replace(
      /<!-- Быстрые действия[\s\S]*?Без тем · Excel · сортировок\s*<\/span>/g,
      ''
    );
    expect(htmlWithoutNotice).not.toMatch(/exportExcel|Экспорт Excel|\.xlsx/i);
    expect(htmlWithoutNotice).not.toMatch(/sortBy|toggleGroupMenu|summaryGroup/);
    expect(appSrc).not.toMatch(/toggleTheme|exportExcel|sortBy\s*[:(]|toggleGroupMenu/);
  });

  it('rowTotal считается по каркасному методу (frameworkRowCost), а не q*price', () => {
    const rt = appSrc.match(/rowTotal\(row\)\s*\{[\s\S]{0,200}?\}/);
    expect(rt).not.toBeNull();
    expect(rt[0]).toMatch(/frameworkRowCost/);
  });
});
