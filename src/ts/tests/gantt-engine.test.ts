/**
 * Тесты движка диаграммы Ганта (Wix/MS Project-style):
 * — разбор/сериализация связей «FS:2,SS:3»;
 * — каскад ограничений по типам FS/SS/FF/SF в топологическом порядке;
 * — циклические связи исключаются из расчёта и помечаются cyclic;
 * — live-каскад при перетаскивании (_ganttPushDown).
 */
import { describe, it, expect } from 'vitest';
import { parsePredRefs } from '../app';

describe('parsePredRefs / формат связей MS Project', () => {
  it('простой номер = FS (обратная совместимость)', () => {
    expect(parsePredRefs('3')).toEqual([{ type: 'FS', num: 3 }]);
  });
  it('несколько связей с типами', () => {
    expect(parsePredRefs('SS:2,FF:5')).toEqual([
      { type: 'SS', num: 2 },
      { type: 'FF', num: 5 },
    ]);
  });
  it('игнорирует мусор и пустые токены', () => {
    expect(parsePredRefs('2, abc, SS:, , 7')).toEqual([
      { type: 'FS', num: 2 },
      { type: 'FS', num: 7 },
    ]);
  });
  it('пустая строка/undefined → []', () => {
    expect(parsePredRefs('')).toEqual([]);
    expect(parsePredRefs(undefined)).toEqual([]);
    expect(parsePredRefs(null)).toEqual([]);
  });
});

/* ── Мини-стенд движка: копия алгоритма _computeGanttData без DOM ─────────── */
type G = { id: number; leftDays: number; spanDays: number };
type L = { from: G; to: G; type: string; cyclic?: boolean };

const constraintStart = (l: L) => {
  const f = l.from,
    t = l.to;
  switch (l.type) {
    case 'SS':
      return f.leftDays;
    case 'FF':
      return f.leftDays + f.spanDays - t.spanDays;
    case 'SF':
      return f.leftDays - t.spanDays;
    default:
      return f.leftDays + f.spanDays;
  }
};

function topoAndCascade(rows: G[], links: L[]) {
  const indeg = new Map<G, number>();
  for (const g of rows) indeg.set(g, 0);
  for (const l of links) indeg.set(l.to, (indeg.get(l.to) || 0) + 1);
  const queue = rows.filter((g) => indeg.get(g) === 0);
  const topo: G[] = [];
  while (queue.length) {
    const g = queue.shift()!;
    topo.push(g);
    for (const l of links) {
      if (l.from !== g) continue;
      indeg.set(l.to, indeg.get(l.to)! - 1);
      if (indeg.get(l.to) === 0) queue.push(l.to);
    }
  }
  const inTopo = new Set(topo);
  for (const l of links) l.cyclic = !inTopo.has(l.from) || !inTopo.has(l.to);
  const pos = new Map(topo.map((g, i) => [g, i]));
  const order = rows.slice().sort((a, b) => {
    const ia = pos.has(a) ? pos.get(a)! : Number.MAX_SAFE_INTEGER;
    const ib = pos.has(b) ? pos.get(b)! : Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
  for (const g of order) {
    let minStart = g.leftDays;
    for (const l of links) {
      if (l.to !== g || l.cyclic) continue;
      const c = Math.max(0, constraintStart(l));
      if (c > minStart) minStart = c;
    }
    g.leftDays = minStart;
  }
}

describe('движок расписания Ганта', () => {
  it('FS: преемник стартует сразу после финиша предшественника', () => {
    const a: G = { id: 1, leftDays: 0, spanDays: 5 };
    const b: G = { id: 2, leftDays: 0, spanDays: 3 };
    topoAndCascade([a, b], [{ from: a, to: b, type: 'FS' }]);
    expect(b.leftDays).toBe(5);
  });

  it('SS: преемник стартует не раньше старта предшественника', () => {
    const a: G = { id: 1, leftDays: 4, spanDays: 5 };
    const b: G = { id: 2, leftDays: 0, spanDays: 3 };
    topoAndCascade([b, a], [{ from: a, to: b, type: 'SS' }]);
    expect(b.leftDays).toBe(4);
  });

  it('FF: финиш преемника подтягивается к финишу предшественника', () => {
    const a: G = { id: 1, leftDays: 0, spanDays: 10 };
    const b: G = { id: 2, leftDays: 0, spanDays: 4 };
    topoAndCascade([a, b], [{ from: a, to: b, type: 'FF' }]);
    expect(b.leftDays).toBe(6); // finish 10 - dur 4
  });

  it('множественные связи: максимум из всех ограничений', () => {
    const a: G = { id: 1, leftDays: 0, spanDays: 8 };
    const s: G = { id: 2, leftDays: 3, spanDays: 2 };
    const b: G = { id: 3, leftDays: 0, spanDays: 3 };
    topoAndCascade(
      [a, s, b],
      [
        { from: a, to: b, type: 'FS' }, // ≥8
        { from: s, to: b, type: 'SS' }, // ≥3
      ]
    );
    expect(b.leftDays).toBe(8);
  });

  it('каскад по цепочке 1→2→3 сходится за один топопроход', () => {
    const a: G = { id: 1, leftDays: 0, spanDays: 2 };
    const b: G = { id: 2, leftDays: 0, spanDays: 2 };
    const c: G = { id: 3, leftDays: 0, spanDays: 2 };
    topoAndCascade(
      [c, b, a],
      [
        { from: a, to: b, type: 'FS' },
        { from: b, to: c, type: 'FS' },
      ]
    );
    expect(b.leftDays).toBe(2);
    expect(c.leftDays).toBe(4);
  });

  it('цикл A↔B: связи помечены cyclic и не двигают полосы', () => {
    const a: G = { id: 1, leftDays: 1, spanDays: 3 };
    const b: G = { id: 2, leftDays: 2, spanDays: 3 };
    const links: L[] = [
      { from: a, to: b, type: 'FS' },
      { from: b, to: a, type: 'FS' },
    ];
    topoAndCascade([a, b], links);
    expect(links.every((l) => l.cyclic)).toBe(true);
    expect(a.leftDays).toBe(1);
    expect(b.leftDays).toBe(2);
  });

  it('закреплённая дата (startAt) работает как SNET: связи двигают только позже', () => {
    // полоса закреплена на 10-м дне, предшественник заканчивается на 4-м → остаётся 10
    const a: G = { id: 1, leftDays: 0, spanDays: 4 };
    const b: G = { id: 2, leftDays: 10, spanDays: 2 };
    topoAndCascade([a, b], [{ from: a, to: b, type: 'FS' }]);
    expect(b.leftDays).toBe(10);
    // а если закреплено раньше ограничения — связь вытесняет полосу позже
    const c: G = { id: 3, leftDays: 1, spanDays: 2 };
    topoAndCascade([a, c], [{ from: a, to: c, type: 'FS' }]);
    expect(c.leftDays).toBe(4);
  });
});

describe('live-каскад при перетаскивании (_ganttPushDown)', () => {
  // копия метода из app.ts для проверки математики проталкивания
  function pushDown(g: G, desiredLeft: number, links: L[], seen = new Set<G>()) {
    if (seen.has(g)) return;
    seen.add(g);
    if (desiredLeft === g.leftDays) return;
    g.leftDays = Math.max(0, desiredLeft);
    for (const l of links) {
      if (l.from !== g || l.cyclic) continue;
      const req = Math.max(0, constraintStart(l));
      if (l.to.leftDays < req) pushDown(l.to, req, links, seen);
    }
  }

  it('тянем FS-предка — потомки сдвигаются цепочкой', () => {
    const a: G = { id: 1, leftDays: 0, spanDays: 3 };
    const b: G = { id: 2, leftDays: 3, spanDays: 2 };
    const c: G = { id: 3, leftDays: 5, spanDays: 2 };
    const links: L[] = [
      { from: a, to: b, type: 'FS' },
      { from: b, to: c, type: 'FS' },
    ];
    pushDown(a, 6, links);
    expect(b.leftDays).toBe(9);
    expect(c.leftDays).toBe(11);
  });

  it('тянем назад — зависимые НЕ подтягиваются (без рывков, как в Wix)', () => {
    const a: G = { id: 1, leftDays: 5, spanDays: 3 };
    const b: G = { id: 2, leftDays: 8, spanDays: 2 };
    const links: L[] = [{ from: a, to: b, type: 'FS' }];
    pushDown(a, 1, links);
    expect(b.leftDays).toBe(8);
  });

  it('SS-связь толкает по старту, FF — по финишу', () => {
    const a: G = { id: 1, leftDays: 0, spanDays: 4 };
    const ss: G = { id: 2, leftDays: 0, spanDays: 2 };
    const ff: G = { id: 3, leftDays: 0, spanDays: 2 };
    pushDown(a, 7, [{ from: a, to: ss, type: 'SS' }]);
    expect(ss.leftDays).toBe(7);
    pushDown(a, 10, [{ from: a, to: ff, type: 'FF' }]);
    expect(ff.leftDays).toBe(12); // finish 14 - dur 2
  });

  it('циклическая связь игнорируется (защита от бесконечного каскада)', () => {
    const a: G = { id: 1, leftDays: 0, spanDays: 2 };
    const b: G = { id: 2, leftDays: 0, spanDays: 2 };
    const links: L[] = [
      { from: a, to: b, type: 'FS', cyclic: true },
      { from: b, to: a, type: 'FS', cyclic: true },
    ];
    pushDown(a, 5, links);
    expect(b.leftDays).toBe(0);
  });
});
