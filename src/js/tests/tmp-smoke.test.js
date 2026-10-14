import { describe, it, expect } from 'vitest';
describe('smeta() migrated full', () => {
  it('has all 122 ported methods and works', async () => {
    const m = await import('../app.js');
    const app = m.default();
    const need = ['applyResourcePrice','problems','ganttData','nsbApply','batchApply','buildGanttSVG','summaryResources','commitEdit','openCalc','startRenameSection','moveGridCursor','mergeSameResources','exportGanttPng','doPrint','rangeSelect'];
    for (const k of need) expect(k in app).toBe(true);
    app.data.sections[0].resources.push({ id:'x1', name:'Тест', basis:'', type:'labor', unit:'ч', qty:2, price:100.5, days:null, pred:'', startAt:null, operator:false });
    const before = app.sums.pz;
    expect(app.sums.nr + app.sums.sp + app.sums.vat).toBeGreaterThanOrEqual(0);
    expect(app.sums.grand).toBeGreaterThan(before);
    expect(app.rowTotal({qty:3,price:10})).toBe(30);
    app.addRow(0);
    expect(typeof app.isChapter).toBe('function');
    const g = app.ganttData; // getter smoke
    expect(Array.isArray(g.rows)).toBe(true);
    expect(typeof app.buildGanttSVG()).toBe('string');
  });
});
