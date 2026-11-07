import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchPrayers } from '../lib/search';
import type { Prayer } from '../lib/types';

interface Props {
  prayers: Prayer[];
  excluded: Set<string>;
  newPrayerHref: string;
  onPick: (prayer: Prayer) => void;
  onClose: () => void;
}

export function PrayerPicker({ prayers, excluded, newPrayerHref, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const results = useMemo(
    () => searchPrayers(prayers.filter((p) => !excluded.has(p.id)), query).slice(0, 30),
    [prayers, excluded, query],
  );
  return (
    <div className="picker">
      <div className="picker-head">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar oração para adicionar…"
          aria-label="Buscar oração para adicionar"
        />
        <button type="button" className="btn small" onClick={onClose}>Fechar</button>
      </div>
      <ul className="picker-list">
        {results.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p)}>
              <span aria-hidden="true">+</span> {p.title}
            </button>
          </li>
        ))}
        {!results.length && <li className="muted picker-empty">Nenhuma oração encontrada.</li>}
      </ul>
      <Link className="link-btn small" to={newPrayerHref}>Cadastrar uma oração nova</Link>
    </div>
  );
}
