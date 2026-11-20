import { describe, expect, it } from 'vitest';
import {
  MAX_PAUSE_SECONDS,
  MIN_PAUSE_SECONDS,
  normalizePauseSeconds,
  PAUSE_MS,
  PAUSE_SECONDS_OPTIONS,
  secondsLeft,
} from '../../src/lib/pause';

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

describe('secondsLeft com duração escolhida', () => {
  const start = 1_000_000;

  it('conta a partir da duração configurada (30 s)', () => {
    const total = 30_000;
    const until = start + total;
    expect(secondsLeft(until, start, total)).toBe(30);
    expect(secondsLeft(until, start + 12_500, total)).toBe(18);
    expect(secondsLeft(until, until - 1, total)).toBe(1);
    expect(secondsLeft(until, until, total)).toBe(0);
  });

  it('funciona com 1 segundo', () => {
    const until = start + 1000;
    expect(secondsLeft(until, start, 1000)).toBe(1);
    expect(secondsLeft(until, until, 1000)).toBe(0);
  });

  it('não prende além da duração se o relógio voltar no tempo', () => {
    expect(secondsLeft(start + 10_000, start - 1, 10_000)).toBe(0);
  });
});

describe('normalizePauseSeconds', () => {
  it('aceita inteiros de 1 a 30', () => {
    expect(normalizePauseSeconds(1)).toBe(1);
    expect(normalizePauseSeconds(12)).toBe(12);
    expect(normalizePauseSeconds(30)).toBe(30);
    expect(normalizePauseSeconds('20')).toBe(20);
  });

  it('volta ao padrão de 5 s com valor inválido ou fora da faixa', () => {
    for (const bad of [0, 31, -3, 2.5, NaN, '', 'abc', null, undefined]) {
      expect(normalizePauseSeconds(bad)).toBe(PAUSE_MS / 1000);
    }
  });

  it('o menu oferece todas as opções de 1 a 30', () => {
    expect(PAUSE_SECONDS_OPTIONS[0]).toBe(MIN_PAUSE_SECONDS);
    expect(PAUSE_SECONDS_OPTIONS.at(-1)).toBe(MAX_PAUSE_SECONDS);
    expect(PAUSE_SECONDS_OPTIONS).toHaveLength(30);
  });
});
