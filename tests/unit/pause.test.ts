import { describe, expect, it } from 'vitest';
import { PAUSE_MS, secondsLeft } from '../../src/lib/pause';

describe('secondsLeft', () => {
  const start = 1_000_000;
  const until = start + PAUSE_MS;

  it('conta de 5 até 1, arredondando para cima', () => {
    expect(secondsLeft(until, start)).toBe(5);
    expect(secondsLeft(until, start + 1)).toBe(5);
    expect(secondsLeft(until, start + 1000)).toBe(4);
    expect(secondsLeft(until, until - 1)).toBe(1);
  });

  it('acaba no horário de término, mesmo se o app ficou parado', () => {
    expect(secondsLeft(until, until)).toBe(0);
    expect(secondsLeft(until, until + 60_000)).toBe(0);
  });

  it('não prende a oração se o relógio do aparelho voltar no tempo', () => {
    expect(secondsLeft(until, start - 60_000)).toBe(0);
  });
});
