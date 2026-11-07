export interface Prayer {
  id: string;
  title: string;
  body: string;
}

export interface Item {
  id: string;
  section_id: string;
  prayer_id: string;
  position: number;
}

export interface Section {
  id: string;
  routine_id: string;
  title: string;
  is_base_slot: boolean;
  position: number;
  items: Item[];
}

export interface Routine {
  id: string;
  name: string;
  weekday: number | null;
  is_base: boolean;
  position: number;
  sections: Section[];
}

export interface AppData {
  prayers: Prayer[];
  routines: Routine[];
}

export interface OrderChange {
  sections: { id: string; position: number }[];
  items: { id: string; section_id: string; position: number }[];
}

/** Acesso aos dados. Implementado pelo Supabase e, em desenvolvimento, pelo modo demonstração. */
export interface Store {
  readonly isDemo: boolean;
  getUserEmail(): Promise<string | null>;
  onAuthChange(listener: (email: string | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  load(): Promise<AppData>;
  savePrayer(prayer: { id?: string; title: string; body: string }): Promise<Prayer>;
  deletePrayer(id: string): Promise<void>;

  createRoutine(routine: { name: string; weekday: number | null; is_base: boolean; position: number }): Promise<Routine>;
  deleteRoutine(id: string): Promise<void>;
  createSection(section: { routine_id: string; title: string; position: number }): Promise<void>;
  renameSection(id: string, title: string): Promise<void>;
  deleteSection(id: string): Promise<void>;
  createItem(item: { section_id: string; prayer_id: string; position: number }): Promise<void>;
  deleteItem(id: string): Promise<void>;
  applyOrder(change: OrderChange): Promise<void>;
}

/** Erro com mensagem pronta para mostrar na tela. */
export class UserError extends Error {}
