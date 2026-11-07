import { describe, expect, it } from 'vitest';
import { diffOrder, nextPosition, prayerUsage, usageLabels } from '../../src/lib/routines';
import type { Routine, Section } from '../../src/lib/types';

const item = (id: string, section_id: string, position: number, prayer_id = `p-${id}`) => ({ id, section_id, prayer_id, position });
const section = (id: string, position: number, items: ReturnType<typeof item>[]): Section => ({
  id, routine_id: 'r', title: id, is_base_slot: false, position, items,
});

describe('diffOrder', () => {
  const saved = [section('a', 0, [item('1', 'a', 0), item('2', 'a', 1)]), section('b', 1, [item('3', 'b', 0)])];

  it('não muda nada quando a ordem é a mesma', () => {
    expect(diffOrder(saved, saved)).toEqual({ sections: [], items: [] });
  });
  it('detecta troca de seções', () => {
    expect(diffOrder(saved, [saved[1], saved[0]]).sections).toEqual([{ id: 'b', position: 0 }, { id: 'a', position: 1 }]);
  });
  it('detecta oração movida para outra seção e renumera as vizinhas', () => {
    const moved = [section('a', 0, [item('2', 'a', 1)]), section('b', 1, [item('1', 'a', 0), item('3', 'b', 0)])];
    expect(diffOrder(saved, moved).items).toEqual([
      { id: '2', section_id: 'a', position: 0 },
      { id: '1', section_id: 'b', position: 0 },
      { id: '3', section_id: 'b', position: 1 },
    ]);
  });
});

it('prayerUsage lista os lugares sem repetir', () => {
  const routines: Routine[] = [
    { id: 'x', name: 'Base', weekday: null, is_base: true, position: 0, sections: [section('a', 0, [item('1', 'a', 0, 'p')])] },
    { id: 'y', name: 'Domingo', weekday: 0, is_base: false, position: 1, sections: [section('b', 0, [item('2', 'b', 0, 'p'), item('3', 'b', 1, 'p')])] },
    { id: 'z', name: 'Segunda', weekday: 1, is_base: false, position: 2, sections: [] },
  ];
  expect(prayerUsage(routines, 'p')).toEqual(['Base', 'Domingo']);
});

it('nextPosition vai depois do maior valor', () => {
  expect(nextPosition([])).toBe(0);
  expect(nextPosition([{ position: 4 }, { position: 1 }])).toBe(5);
});

describe('usageLabels', () => {
  const day = (id: string, weekday: number, prayer: string): Routine => ({
    id, name: id, weekday, is_base: false, position: weekday, sections: [section(`s${id}`, 0, [item(`i${id}`, `s${id}`, 0, prayer)])],
  });
  const week = (prayer: (w: number) => string) => [0, 1, 2, 3, 4, 5, 6].map((w) => day(`d${w}`, w, prayer(w)));

  it('resume quando está nos 7 dias', () => {
    expect(usageLabels(week(() => 'p'), 'p')).toEqual(['Todos os dias']);
  });
  it('resume quando está na base', () => {
    const base = { ...day('Base', 0, 'p'), weekday: null, is_base: true };
    expect(usageLabels([base, ...week(() => 'x')], 'p')).toEqual(['Todos os dias']);
  });
  it('lista os dias quando são só alguns', () => {
    expect(usageLabels(week((w) => (w < 2 ? 'p' : 'x')), 'p')).toEqual(['d0', 'd1']);
  });
  it('sem uso fica vazio', () => {
    expect(usageLabels(week(() => 'x'), 'p')).toEqual([]);
  });
});
