import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/data';
import { prayersInSection, prayerUsage, sectionTitles } from '../lib/routines';
import { searchPrayers } from '../lib/search';

export function Library() {
  const { prayers, routines } = useData();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');

  const titles = useMemo(() => sectionTitles(routines), [routines]);
  const results = useMemo(() => {
    const allowed = section ? prayersInSection(routines, section) : null;
    return searchPrayers(allowed ? prayers.filter((p) => allowed.has(p.id)) : prayers, query);
  }, [prayers, routines, query, section]);

  return (
    <div className="stack">
      <div className="page-head row-between">
        <div>
          <p className="eyebrow">{prayers.length} orações</p>
          <h1>Biblioteca</h1>
        </div>
        <Link className="btn primary" to="/oracoes/nova">Nova oração</Link>
      </div>
      <div className="filters">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no título ou no texto…"
          aria-label="Buscar orações"
        />
        <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Filtrar por seção">
          <option value="">Todas as seções</option>
          {titles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <ul className="library">
        {results.map((p) => {
          const usage = prayerUsage(routines, p.id);
          return (
            <li key={p.id}>
              <Link to={`/oracoes/${p.id}`}>
                <span className="prayer-title">{p.title}</span>
                <span className="usage">
                  {usage.length ? usage.map((u) => <span key={u} className="pill">{u}</span>) : <span className="muted small-text">Sem uso</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!results.length && <p className="muted">Nenhuma oração encontrada.</p>}
    </div>
  );
}
