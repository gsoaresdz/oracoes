import { describe, expect, it } from 'vitest';
import { planSeed } from '../../scripts/lib/seed-plan.mjs';

const seed = {
  prayers: [{ title: 'A', body: 'a' }, { title: 'B', body: 'b' }, { title: 'C', body: 'c' }],
  routines: [{ name: 'Domingo', weekday: 0 }, { name: 'Segunda-feira', weekday: 1 }, { name: 'Terça-feira', weekday: 2 }],
};

describe('planSeed', () => {
  it('em conta vazia adiciona tudo', () => {
    const plan = planSeed(seed, { prayers: [], routines: [] });
    expect(plan.newPrayers).toHaveLength(3);
    expect(plan.newRoutines).toHaveLength(3);
    expect(plan.createBase).toBe(true);
  });

  it('preserva o que foi editado no app e adiciona só o que falta', () => {
    const plan = planSeed(seed, {
      prayers: [{ title: 'A', body: 'editada no app' }, { title: 'B', body: 'b' }],
      routines: [{ weekday: null, is_base: true }, { weekday: 0, is_base: false }, { weekday: 1, is_base: false }],
    });
    expect(plan.newPrayers.map((p) => p.title)).toEqual(['C']);
    expect(plan.keptPrayers).toEqual(['A']);
    expect(plan.createBase).toBe(false);
    expect(plan.newRoutines.map((r) => r.name)).toEqual(['Terça-feira']);
    expect(plan.skippedRoutines).toEqual(['Domingo', 'Segunda-feira']);
  });

  it('não recria um dia que já foi montado no app', () => {
    const plan = planSeed(seed, { prayers: [], routines: [{ weekday: 2, is_base: false }] });
    expect(plan.newRoutines.map((r) => r.weekday)).toEqual([0, 1]);
  });

  it('a base não conta como dia da semana', () => {
    const plan = planSeed(seed, { prayers: [], routines: [{ weekday: null, is_base: true }] });
    expect(plan.newRoutines).toHaveLength(3);
  });
});
