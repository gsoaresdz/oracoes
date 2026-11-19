import { useEffect, useState, useSyncExternalStore } from 'react';

// Pausa curta depois de fechar uma oração, antes de poder abrir a próxima.
export const PAUSE_MS = 5000;
const KEY = 'oracoes-pausa';
const listeners = new Set<() => void>();

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
  listeners.forEach((fn) => fn());
}

export function usePauseEnabled(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => enabled,
  );
}

/** Segundos que faltam (arredondado para cima), 0 quando acabou.
 *  Calcula pelo horário de término, não por tiques: o celular congela
 *  contadores com a tela apagada ou o app em segundo plano. */
export function secondsLeft(until: number, now = Date.now()): number {
  const ms = until - now;
  // Relógio do aparelho voltou no tempo: não prende a oração além da pausa.
  if (ms <= 0 || ms > PAUSE_MS) return 0;
  return Math.ceil(ms / 1000);
}

export function useCountdown(until: number | null): number {
  // O estado só força o redesenho quando o segundo muda (React ignora valor igual);
  // o valor devolvido vem sempre do relógio, no próprio render.
  const [, setShown] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const s = secondsLeft(until);
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
  }, [until]);
  return until ? secondsLeft(until) : 0;
}
