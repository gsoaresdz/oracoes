import type { OrderChange, Routine, Section } from './types';

export const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAY_IN_SENTENCE = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const baseRoutine = (routines: Routine[]) => routines.find((r) => r.is_base);
export const routineForDay = (routines: Routine[], weekday: number) => routines.find((r) => r.weekday === weekday);

/** Rótulos dos lugares onde a oração é usada, sem repetição: "Base", "Domingo"... */
export function prayerUsage(routines: Routine[], prayerId: string): string[] {
  return routines
    .filter((r) => r.sections.some((s) => s.items.some((i) => i.prayer_id === prayerId)))
    .map((r) => r.name);
}

/** Versão curta para a lista: resume quando a oração está em todos os dias. */
export function usageLabels(routines: Routine[], prayerId: string): string[] {
  const usage = prayerUsage(routines, prayerId);
  const base = baseRoutine(routines);
  if (base && usage.includes(base.name)) return ['Todos os dias'];
  const days = routines.filter((r) => r.weekday !== null);
  if (days.length === 7 && days.every((d) => usage.includes(d.name))) return ['Todos os dias'];
  return usage;
}

/** Títulos das seções, sem repetição, na ordem em que aparecem. */
export function sectionTitles(routines: Routine[]): string[] {
  const titles = routines.flatMap((r) => r.sections.filter((s) => !s.is_base_slot).map((s) => s.title));
  return [...new Set(titles)];
}

export function prayersInSection(routines: Routine[], title: string): Set<string> {
  return new Set(
    routines.flatMap((r) => r.sections.filter((s) => s.title === title).flatMap((s) => s.items.map((i) => i.prayer_id))),
  );
}

/** O que mudou entre a ordem salva e a ordem atual da tela. */
export function diffOrder(saved: Section[], current: Section[]): OrderChange {
  const savedSections = new Map(saved.map((s) => [s.id, s]));
  const savedItems = new Map(saved.flatMap((s) => s.items.map((i) => [i.id, i] as const)));
  const change: OrderChange = { sections: [], items: [] };
  current.forEach((section, position) => {
    if (savedSections.get(section.id)?.position !== position) change.sections.push({ id: section.id, position });
    section.items.forEach((item, itemPosition) => {
      const before = savedItems.get(item.id);
      if (before?.section_id !== section.id || before?.position !== itemPosition) {
        change.items.push({ id: item.id, section_id: section.id, position: itemPosition });
      }
    });
  });
  return change;
}

export const nextPosition = (list: { position: number }[]) => list.reduce((max, x) => Math.max(max, x.position + 1), 0);
