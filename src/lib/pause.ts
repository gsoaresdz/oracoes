import { useEffect, useState, useSyncExternalStore } from 'react';

// Pausa curta depois de fechar uma oração, antes de poder abrir a próxima.
export const PAUSE_MS = 5000;
export const MIN_PAUSE_SECONDS = 1;
export const MAX_PAUSE_SECONDS = 30;
export const PAUSE_SECONDS_OPTIONS = Array.from(
  { length: MAX_PAUSE_SECONDS - MIN_PAUSE_SECONDS + 1 },
  (_, i) => MIN_PAUSE_SECONDS + i,
);
const KEY = 'oracoes-pausa';
const SECONDS_KEY = 'oracoes-pausa-segundos';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function readPauseEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

let enabled = readPauseEnabled();

export function setPauseEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off');
  } catch {
    // Sem armazenamento, a escolha vale só para esta visita.
  }
  notify();
}

export function usePauseEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled);
}

/** Duração escolhida, em segundos inteiros entre 1 e 30; fora disso, volta ao padrão. */
export function normalizePauseSeconds(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n)) return PAUSE_MS / 1000;
  if (n < MIN_PAUSE_SECONDS || n > MAX_PAUSE_SECONDS) return PAUSE_MS / 1000;
  return n;
}

export function readPauseSeconds(): number {
  try {
    return normalizePauseSeconds(localStorage.getItem(SECONDS_KEY) ?? undefined);
  } catch {
    return PAUSE_MS / 1000;
  }
}

let seconds = readPauseSeconds();

export function setPauseSeconds(value: number) {
  seconds = normalizePauseSeconds(value);
  try {
    localStorage.setItem(SECONDS_KEY, String(seconds));
  } catch {
    // Sem armazenamento, a escolha vale só para esta visita.
  }
  notify();
}

export function usePauseSeconds(): number {
  return useSyncExternalStore(subscribe, () => seconds);
}

/** Segundos que faltam (arredondado para cima), 0 quando acabou.
 *  Calcula pelo horário de término, não por tiques: o celular congela
 *  contadores com a tela apagada ou o app em segundo plano. */
export function secondsLeft(until: number, now = Date.now(), total = PAUSE_MS): number {
  const ms = until - now;
  // Relógio do aparelho voltou no tempo: não prende a oração além da pausa.
  if (ms <= 0 || ms > total) return 0;
  return Math.ceil(ms / 1000);
}

export function useCountdown(until: number | null, total = PAUSE_MS): number {
  // O estado só força o redesenho quando o segundo muda (React ignora valor igual);
  // o valor devolvido vem sempre do relógio, no próprio render.
  const [, setShown] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const s = secondsLeft(until, Date.now(), total);
      setShown(s);
      if (s === 0) stop();
    };
    const id = window.setInterval(tick, 200);
    const stop = () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
    document.addEventListener('visibilitychange', tick);
    return stop;
  }, [until, total]);
  return until ? secondsLeft(until, Date.now(), total) : 0;
}
