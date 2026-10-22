/**
 * @vitest-environment jsdom
 */
import { describe, it } from 'vitest';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import smetaModule from '../app.js';

const htmlSrc = fs.readFileSync('/workspace/index.html', 'utf8');
describe('dbg2', () => {
  it('runClick debug', () => {
    const dom = new JSDOM(htmlSrc, { url: 'http://localhost/' });
    const doc = dom.window.document;
    const obj = typeof smetaModule === 'function' ? smetaModule() : smetaModule;
    const btns = [...doc.querySelectorAll('.at-views .at-view-tab')];
    for (const b of btns) console.log('TAB click attr:', JSON.stringify(b.getAttribute('@click')));
    const g = btns.find((b) => /toggleGantt\(\)/.test(b.getAttribute('@click') || ''));
    console.log('found gantt tab?', !!g);
    if (g) {
      obj.viewTab = 'table';
      new Function(`return function(){${g.getAttribute('@click')}}`).call(obj);
      console.log('viewTab after run:', obj.viewTab);
    }
  });
});
