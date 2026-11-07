import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataProvider, useStore } from './lib/data';
import { Library } from './pages/Library';
import { Login } from './pages/Login';
import { PrayerForm } from './pages/PrayerForm';
import { RoutineEdit } from './pages/RoutineEdit';
import { Today } from './pages/Today';

export function App() {
  const { store, error } = useStore();
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!store) return;
    store.getUserEmail().then(setEmail);
    return store.onAuthChange(setEmail);
  }, [store]);

  if (error) return <div className="center-state" role="alert">{error}</div>;
  if (!store || email === undefined) return <div className="center-state muted">Carregando…</div>;
  if (!email) return <Login store={store} />;

  return (
    <DataProvider key={email} store={store} email={email}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="dia/:weekday" element={<Today />} />
            <Route path="dias/:id/editar" element={<RoutineEdit />} />
            <Route path="base" element={<RoutineEdit base />} />
            <Route path="oracoes" element={<Library />} />
            <Route path="oracoes/nova" element={<PrayerForm />} />
            <Route path="oracoes/:id" element={<PrayerForm />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
