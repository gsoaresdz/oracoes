import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Prayer } from '../lib/types';
import { Markdown } from './Markdown';

export function PrayerCard({ prayer, allOpen }: { prayer: Prayer; allOpen: { open: boolean; version: number } }) {
  const [open, setOpen] = useState(allOpen.open);
  useEffect(() => setOpen(allOpen.open), [allOpen]);
  return (
    <details className="prayer" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="prayer-title">{prayer.title}</span>
        <span className="chevron" aria-hidden="true">›</span>
      </summary>
      {open && (
        <div className="prayer-content">
          <Markdown source={prayer.body} />
          <Link className="link-btn small" to={`/oracoes/${prayer.id}`}>Editar oração</Link>
        </div>
      )}
    </details>
  );
}
