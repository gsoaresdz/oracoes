import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { PAUSE_MS, useCountdown } from '../lib/pause';
import type { Prayer } from '../lib/types';
import { Markdown } from './Markdown';

interface PrayerCardProps {
  prayer: Prayer;
  allOpen: { open: boolean; version: number };
  /** Horário (Date.now) em que a pausa desta oração termina, se ela for a próxima. */
  lockedUntil?: number | null;
  /** Chamado quando a pessoa fecha a oração com um toque (não pelo "Recolher todas"). */
  onUserClose?: () => void;
  /** Chamado quando a pausa desta oração acaba. */
  onUnlock?: () => void;
}

export function PrayerCard({ prayer, allOpen, lockedUntil = null, onUserClose, onUnlock }: PrayerCardProps) {
  const [open, setOpen] = useState(allOpen.open);
  useEffect(() => setOpen(allOpen.open), [allOpen]);
  const left = useCountdown(lockedUntil);
  const locked = left > 0;

  useEffect(() => {
    if (lockedUntil && left === 0) onUnlock?.();
  }, [lockedUntil, left, onUnlock]);

  // O toque (ou Enter/Espaço no teclado) chega aqui antes de o <details> mudar.
  // Em pausa, não abre nem fecha: quem abriu todas também não pula a próxima.
  const onSummaryClick = (e: MouseEvent) => {
    if (locked) {
      e.preventDefault();
      return;
    }
    if (open) onUserClose?.();
  };

  // Atraso negativo: se o cartão for remontado no meio da pausa, o anel continua de onde estava.
  const ringStyle = lockedUntil
    ? ({ '--pause-ms': `${PAUSE_MS}ms`, animationDelay: `${Math.min(0, lockedUntil - PAUSE_MS - Date.now())}ms` } as CSSProperties)
    : undefined;

  return (
    <details
      className={locked ? 'prayer paused' : 'prayer'}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary onClick={onSummaryClick} aria-disabled={locked || undefined}>
        <span className="prayer-title">{prayer.title}</span>
        {locked ? (
          <span className="pause-timer" role="timer">
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <circle className="pause-track" cx="18" cy="18" r="15.5" />
              <circle className="pause-ring" cx="18" cy="18" r="15.5" pathLength="100" style={ringStyle} />
            </svg>
            <span className="pause-count" aria-hidden="true">{left}</span>
            <span className="sr-only">Pausa: disponível em instantes</span>
          </span>
        ) : (
          <span className="chevron" aria-hidden="true">›</span>
        )}
      </summary>
      {open && (
        // Aberta e em pausa (quem abre todas e vai fechando): o texto fica velado até a pausa acabar.
        <div className={locked ? 'prayer-content veiled' : 'prayer-content'} aria-hidden={locked || undefined}>
          <Markdown source={prayer.body} />
          <Link className="link-btn small" to={`/oracoes/${prayer.id}`}>Editar oração</Link>
        </div>
      )}
    </details>
  );
}
