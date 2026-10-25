/**
 * Юнит-тесты норм отходов (блок waste_norms ТЗ, 12 групп) и q_факт.
 */

import { WASTE_NORMS, wasteK, factQty } from '../framework.ts';

describe('НОРМЫ ОТХОДОВ И ЗАПАСОВ (waste_norms, 12 групп)', () => {
  const EXPECTED = [
    ['block', 'Блочные (газобетон, кирпич)', 0.04],
    ['sheet', 'Листовые (ГКЛ, ОСБ, фанера)', 0.06],
    ['roll', 'Рулонные (гидроизоляция, подложка)', 0.08],
    ['lumber', 'Пиломатериалы (доска, брус, рейка)', 0.08],
    ['metal', 'Металлоконструкции (ЛСТК, профиль, уголок)', 0.03],
    ['concrete', 'Растворы и бетон (готовые смеси)', 0.04],
    ['paint', 'Краски, грунтовки, шпатлевки', 0.08],
    ['floor', 'Чистовые полы (ламинат, плитка, кварцвинил)', 0.07],
    ['insul', 'Утеплитель (минвата, ЭППС, PIR)', 0.04],
    ['roof', 'Кровельные (металлочерепица, мягкая кровля)', 0.1],
    ['cable', 'Кабель и проводка', 0.08],
    ['pipe', 'Трубы (сантехника, отопление, канализация)', 0.05],
  ];

  test('в справочнике ровно 12 групп', () => {
    expect(WASTE_NORMS).toHaveLength(12);
  });

  test.each(EXPECTED)('k_отх [%s] = %p — %s', (id, group, k) => {
    const norm = WASTE_NORMS.find((n) => n.id === id);
    expect(norm).toBeDefined();
    expect(norm.material_group).toBe(group);
    expect(wasteK(id)).toBeCloseTo(k, 10);
    expect(norm.pct).toBe(`${Math.round(k * 100)}%`);
    expect(norm.explanation.length).toBeGreaterThan(0);
  });

  test('неизвестная/пустая группа → запас не применять (k = 0)', () => {
    expect(wasteK('')).toBe(0);
    expect(wasteK(undefined)).toBe(0);
    expect(wasteK('nonexistent')).toBe(0);
  });

  test('q_факт = q_нетто × (1 + k_отх)', () => {
    expect(factQty(100, 'block')).toBeCloseTo(104); // +4%
    expect(factQty(100, 'roof')).toBeCloseTo(110); // +10%
    expect(factQty(100, 'metal')).toBeCloseTo(103); // +3%
    expect(factQty(50, '')).toBeCloseTo(50); // без нормы — без запаса
    expect(factQty(0, 'lumber')).toBe(0);
  });
});
