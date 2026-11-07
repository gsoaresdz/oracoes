import { createClient } from '@supabase/supabase-js';
import { UserError, type Prayer, type Routine, type Store } from './types';

function check<T>({ data, error }: { data: T; error: { code?: string; message: string } | null }): T {
  if (!error) return data;
  if (error.code === '23505') throw new UserError('Já existe uma oração com esse título.');
  if (error.code === '23503') throw new UserError('Esta oração está em uso em algum dia. Remova-a de lá primeiro.');
  throw new Error(error.message);
}

function checkRow<T>(result: { data: T | null; error: { code?: string; message: string } | null }): T {
  const row = check(result);
  if (row === null) throw new Error('O banco não devolveu o registro.');
  return row;
}

interface RoutineRow extends Omit<Routine, 'sections'> {
  routine_sections: (Omit<Routine['sections'][number], 'items'> & { routine_items: Routine['sections'][number]['items'] })[];
}

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

function toRoutine({ routine_sections, ...routine }: RoutineRow): Routine {
  return {
    ...routine,
    sections: [...routine_sections].sort(byPosition).map(({ routine_items, ...section }) => ({
      ...section,
      items: [...routine_items].sort(byPosition),
    })),
  };
}

export function createSupabaseStore(url: string, anonKey: string): Store {
  const db = createClient(url, anonKey);
  const ROUTINE_COLUMNS = 'id, name, weekday, is_base, position, routine_sections(id, routine_id, title, is_base_slot, position, routine_items(id, section_id, prayer_id, position))';

  return {
    isDemo: false,

    async getUserEmail() {
      const { data } = await db.auth.getSession();
      return data.session?.user.email ?? null;
    },
    onAuthChange(listener) {
      const { data } = db.auth.onAuthStateChange((_event, session) => listener(session?.user.email ?? null));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw new UserError('E-mail ou senha incorretos.');
    },
    async signOut() {
      await db.auth.signOut();
    },

    async load() {
      const [prayers, routines] = await Promise.all([
        db.from('prayers').select('id, title, body').order('title'),
        db.from('routines').select(ROUTINE_COLUMNS).order('position'),
      ]);
      return {
        prayers: check(prayers) ?? [],
        routines: ((check(routines) ?? []) as unknown as RoutineRow[]).map(toRoutine),
      };
    },

    async savePrayer({ id, title, body }) {
      const query = id
        ? db.from('prayers').update({ title, body }).eq('id', id)
        : db.from('prayers').insert({ title, body });
      return checkRow<Prayer>(await query.select('id, title, body').single());
    },
    async deletePrayer(id) {
      check(await db.from('prayers').delete().eq('id', id));
    },

    async createRoutine({ name, weekday, is_base, position }) {
      const routine = checkRow<Omit<Routine, 'sections'>>(
        await db.from('routines').insert({ name, weekday, is_base, position }).select('id, name, weekday, is_base, position').single(),
      );
      const slot = is_base
        ? { routine_id: routine.id, title: 'Primícias', is_base_slot: false, position: 0 }
        : { routine_id: routine.id, title: '', is_base_slot: true, position: 0 };
      check(await db.from('routine_sections').insert(slot));
      return { ...routine, sections: [] };
    },
    async deleteRoutine(id) {
      check(await db.from('routines').delete().eq('id', id));
    },
    async createSection({ routine_id, title, position }) {
      check(await db.from('routine_sections').insert({ routine_id, title, position }));
    },
    async renameSection(id, title) {
      check(await db.from('routine_sections').update({ title }).eq('id', id));
    },
    async deleteSection(id) {
      check(await db.from('routine_sections').delete().eq('id', id));
    },
    async createItem(item) {
      check(await db.from('routine_items').insert(item));
    },
    async deleteItem(id) {
      check(await db.from('routine_items').delete().eq('id', id));
    },
    async applyOrder({ sections, items }) {
      const updates = [
        ...sections.map(({ id, position }) => db.from('routine_sections').update({ position }).eq('id', id)),
        ...items.map(({ id, section_id, position }) => db.from('routine_items').update({ section_id, position }).eq('id', id)),
      ];
      (await Promise.all(updates)).forEach(check);
    },
  };
}
