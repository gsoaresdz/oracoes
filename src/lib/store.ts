import { createSupabaseStore } from './supabaseStore';
import type { Store } from './types';

async function createStore(): Promise<Store> {
  // A condição é resolvida no build: sem VITE_DEMO, os textos de demonstração não entram no pacote publicado.
  if (import.meta.env.VITE_DEMO) {
    const { createDemoStore } = await import('./demoStore');
    return createDemoStore();
  }
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local.');
  return createSupabaseStore(url, key);
}

export const storePromise = createStore();
