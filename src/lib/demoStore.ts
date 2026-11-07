// Modo demonstração (npm run dev:demo): mesmas regras do banco, com dados só neste navegador.
// Serve para testar a interface sem Supabase. Nunca entra na versão publicada.
import seed from '../../data/seed.json';
import { UserError, type AppData, type Item, type Prayer, type Routine, type Section, type Store } from './types';

// A chave muda quando o seed muda, para o navegador não continuar com dados antigos.
const KEY = `oracoes-demo-data-${seed.prayers.length}-${seed.routines.length}`;
const SESSION = 'oracoes-demo-session';
export const DEMO_EMAIL = 'demo@oracoes.local';
export const DEMO_PASSWORD = 'demo';

const uuid = () => crypto.randomUUID();

function initialData(): AppData {
  const prayers: Prayer[] = seed.prayers.map((p) => ({ id: uuid(), title: p.title, body: p.body }));
  const idOf = new Map(prayers.map((p) => [p.title, p.id]));
  const makeSection = (routineId: string, title: string, isSlot: boolean, position: number, titles: string[]): Section => {
    const id = uuid();
    return {
      id,
      routine_id: routineId,
      title,
      is_base_slot: isSlot,
      position,
      items: titles.map((t, i) => ({ id: uuid(), section_id: id, prayer_id: idOf.get(t)!, position: i })),
    };
  };
  const baseId = uuid();
  const routines: Routine[] = [
    {
      id: baseId,
      name: seed.base.name,
      weekday: null,
      is_base: true,
      position: 0,
      sections: [makeSection(baseId, seed.base.sectionTitle, false, 0, seed.base.prayers)],
    },
    ...seed.routines.map((r, index) => {
      const id = uuid();
      return {
        id,
        name: r.name,
        weekday: r.weekday,
        is_base: false,
        position: index + 1,
        sections: r.sections.map((s, i) => makeSection(id, s.title, s.isBaseSlot, i, s.prayers)),
      };
    }),
  ];
  return { prayers, routines };
}

export function createDemoStore(): Store {
  const listeners = new Set<(email: string | null) => void>();
  const read = (): AppData => {
    const stored = localStorage.getItem(KEY);
    if (stored) return JSON.parse(stored);
    const data = initialData();
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  };
  const write = (data: AppData) => localStorage.setItem(KEY, JSON.stringify(data));
  const email = () => localStorage.getItem(SESSION);
  const emit = () => listeners.forEach((l) => l(email()));

  const sectionsOf = (data: AppData) => data.routines.flatMap((r) => r.sections);
  const sortAll = (data: AppData) => {
    data.routines.sort((a, b) => a.position - b.position);
    data.routines.forEach((r) => {
      r.sections.sort((a, b) => a.position - b.position);
      r.sections.forEach((s) => s.items.sort((a, b) => a.position - b.position));
    });
    data.prayers.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    return data;
  };
  const mutate = (change: (data: AppData) => void) => {
    const data = read();
    change(data);
    write(data);
  };

  return {
    isDemo: true,
    async getUserEmail() {
      return email();
    },
    onAuthChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signIn(mail, password) {
      if (mail !== DEMO_EMAIL || password !== DEMO_PASSWORD) throw new UserError('E-mail ou senha incorretos.');
      localStorage.setItem(SESSION, mail);
      emit();
    },
    async signOut() {
      localStorage.removeItem(SESSION);
      emit();
    },
    async load() {
      return sortAll(read());
    },
    async savePrayer({ id, title, body }) {
      const data = read();
      if (data.prayers.some((p) => p.title === title && p.id !== id)) {
        throw new UserError('Já existe uma oração com esse título.');
      }
      let prayer = data.prayers.find((p) => p.id === id);
      if (prayer) Object.assign(prayer, { title, body });
      else data.prayers.push((prayer = { id: uuid(), title, body }));
      write(data);
      return prayer;
    },
    async deletePrayer(id) {
      mutate((data) => {
        if (sectionsOf(data).some((s) => s.items.some((i) => i.prayer_id === id))) {
          throw new UserError('Esta oração está em uso em algum dia. Remova-a de lá primeiro.');
        }
        data.prayers = data.prayers.filter((p) => p.id !== id);
      });
    },
    async createRoutine({ name, weekday, is_base, position }) {
      const id = uuid();
      const routine: Routine = {
        id,
        name,
        weekday,
        is_base,
        position,
        sections: [
          { id: uuid(), routine_id: id, title: is_base ? 'Primícias' : '', is_base_slot: !is_base, position: 0, items: [] },
        ],
      };
      mutate((data) => void data.routines.push(routine));
      return routine;
    },
    async deleteRoutine(id) {
      mutate((data) => {
        data.routines = data.routines.filter((r) => r.id !== id);
      });
    },
    async createSection({ routine_id, title, position }) {
      mutate((data) => {
        data.routines
          .find((r) => r.id === routine_id)!
          .sections.push({ id: uuid(), routine_id, title, is_base_slot: false, position, items: [] });
      });
    },
    async renameSection(id, title) {
      mutate((data) => {
        sectionsOf(data).find((s) => s.id === id)!.title = title;
      });
    },
    async deleteSection(id) {
      mutate((data) => {
        data.routines.forEach((r) => {
          r.sections = r.sections.filter((s) => s.id !== id);
        });
      });
    },
    async createItem({ section_id, prayer_id, position }) {
      mutate((data) => {
        sectionsOf(data).find((s) => s.id === section_id)!.items.push({ id: uuid(), section_id, prayer_id, position });
      });
    },
    async deleteItem(id) {
      mutate((data) => {
        sectionsOf(data).forEach((s) => {
          s.items = s.items.filter((i) => i.id !== id);
        });
      });
    },
    async applyOrder({ sections, items }) {
      mutate((data) => {
        const all = sectionsOf(data);
        for (const { id, position } of sections) all.find((s) => s.id === id)!.position = position;
        const moved = new Map<string, Item>();
        all.forEach((s) => s.items.forEach((i) => moved.set(i.id, i)));
        for (const { id, section_id, position } of items) {
          const item = moved.get(id)!;
          const from = all.find((s) => s.items.includes(item))!;
          from.items = from.items.filter((i) => i !== item);
          item.section_id = section_id;
          item.position = position;
          all.find((s) => s.id === section_id)!.items.push(item);
        }
      });
    },
  };
}
