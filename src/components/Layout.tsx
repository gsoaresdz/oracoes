import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useData } from '../lib/data';
import {
  PAUSE_SECONDS_OPTIONS,
  setPauseEnabled,
  setPauseSeconds,
  usePauseEnabled,
  usePauseSeconds,
} from '../lib/pause';
import { applyTheme, readTheme, THEME_LABEL, type Theme } from '../lib/theme';

const NEXT_THEME: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };

export function Layout() {
  const { store, email, prayers, routines } = useData();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const pauseEnabled = usePauseEnabled();
  const pauseSeconds = usePauseSeconds();

  const exportBackup = () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), prayers, routines }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `oracoes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="top">
        <NavLink to="/" className="brand">Orações</NavLink>
        <nav className="main-nav" aria-label="Principal">
          <NavLink to="/" end>Hoje</NavLink>
          <NavLink to="/oracoes">Biblioteca</NavLink>
          <NavLink to="/base">Base</NavLink>
        </nav>
        <details className="menu">
          <summary aria-label="Menu">☰</summary>
          <div className="menu-panel">
            <span className="muted small-text">{email}</span>
            <button
              type="button"
              onClick={() => {
                const next = NEXT_THEME[theme];
                applyTheme(next);
                setTheme(next);
              }}
            >
              {THEME_LABEL[theme]}
            </button>
            <button type="button" onClick={() => setPauseEnabled(!pauseEnabled)}>
              {pauseEnabled ? 'Pausa entre orações: ligada' : 'Pausa entre orações: desligada'}
            </button>
            <label className="menu-field">
              <span>Duração da pausa</span>
              <select
                value={pauseSeconds}
                disabled={!pauseEnabled}
                onChange={(e) => setPauseSeconds(Number(e.target.value))}
              >
                {PAUSE_SECONDS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === 1 ? '1 segundo' : `${s} segundos`}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={exportBackup}>Exportar backup (JSON)</button>
            <button type="button" onClick={() => store.signOut()}>Sair</button>
          </div>
        </details>
      </header>
      {store.isDemo && <p className="demo-banner">Modo demonstração: os dados ficam só neste navegador.</p>}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
