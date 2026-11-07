import { toPlainText } from './markdown';
import type { Prayer } from './types';

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Todas as palavras precisam aparecer, sem diferenciar acentos nem maiúsculas. */
export function searchPrayers<T extends Pick<Prayer, 'title' | 'body'>>(prayers: T[], query: string): T[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return prayers;
  const inTitle = (p: T) => terms.every((t) => normalize(p.title).includes(t));
  const matches = prayers.filter((p) => {
    const haystack = normalize(`${p.title} ${toPlainText(p.body)}`);
    return terms.every((t) => haystack.includes(t));
  });
  // Quem casa pelo título vem primeiro.
  return [...matches.filter(inTitle), ...matches.filter((p) => !inTitle(p))];
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** Títulos que podem ser a mesma oração, para evitar cadastro duplicado. */
export function similarTitles<T extends Pick<Prayer, 'title'>>(prayers: T[], title: string): T[] {
  const wanted = normalize(title);
  if (wanted.length < 4) return [];
  return prayers.filter((p) => {
    const other = normalize(p.title);
    return other === wanted || other.includes(wanted) || wanted.includes(other) || editDistance(other, wanted) <= 2;
  });
}
