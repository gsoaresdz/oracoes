import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { baseRoutine } from './routines';
import { storePromise } from './store';
import type { AppData, Store } from './types';

interface DataContextValue extends AppData {
  store: Store;
  email: string;
  /** Busca tudo de novo. Chamar depois de cada alteração. */
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData fora do DataProvider');
  return value;
}

export function useStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    storePromise.then(setStore).catch((e: Error) => setError(e.message));
  }, []);
  return { store, error };
}

export function DataProvider({ store, email, children }: { store: Store; email: string; children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    let next = await store.load();
    // Conta nova, ainda sem importação: garante que a base exista.
    if (!baseRoutine(next.routines)) {
      await store.createRoutine({ name: 'Base', weekday: null, is_base: true, position: 0 });
      next = await store.load();
    }
    setData(next);
  }, [store]);

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
  }, [reload]);

  if (error) {
    return (
      <div className="center-state" role="alert">
        <p>Não foi possível carregar as orações.</p>
        <p className="muted">{error}</p>
        <button className="btn" onClick={() => location.reload()}>Tentar de novo</button>
      </div>
    );
  }
  if (!data) return <div className="center-state muted">Carregando…</div>;
  return <DataContext.Provider value={{ ...data, store, email, reload }}>{children}</DataContext.Provider>;
}

/** Executa uma alteração, recarrega os dados e devolve a mensagem de erro, se houver. */
export function useAction() {
  const { reload } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await reload();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Algo deu errado.');
        await reload().catch(() => undefined);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );
  return { run, busy, error, clearError: () => setError(null) };
}
