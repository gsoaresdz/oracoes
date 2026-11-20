import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Prayer } from '../lib/types';
import { Markdown } from './Markdown';

/** Pausa em andamento, vista por um cartão. "next": a oração logo depois da que foi
 *  fechada (travada, com o anel); "after": as seguintes (só o texto velado). */
export interface CardPause {
  role: 'next' | 'after';
  left: number;
  until: number;
  /** Duração total da pausa, em ms. */
  total: number;
}

interface PrayerCardProps {
  prayer: Prayer;
  allOpen: { open: boolean; version: number };
  pause?: CardPause | null;
  /** Não há oração depois desta no dia. */
  isLast?: boolean;
  /** Chamado quando a pessoa fecha a oração (título ou "Amém"), não pelo "Recolher todas". */
  onUserClose?: () => void;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function PrayerCard({ prayer, allOpen, pause = null, isLast = false, onUserClose }: PrayerCardProps) {
  const [open, setOpen] = useState(allOpen.open);
  useEffect(() => setOpen(allOpen.open), [allOpen]);
  const summaryRef = useRef<HTMLElement>(null);
  const locked = pause?.role === 'next' && pause.left > 0;
  const veiled = !!pause && pause.left > 0;

  // O toque (ou Enter/Espaço no teclado) chega aqui antes de o <details> mudar.
  // Em pausa, não abre nem fecha: quem abriu todas também não pula a próxima.
  const onSummaryClick = (e: MouseEvent) => {
    if (locked) {
      e.preventDefault();
      return;
    }
    if (open) onUserClose?.();
  };

  // Fechar pelo fim de uma oração longa: o título pode ter ficado acima da tela.
  // Depois de recolher, traz o título para cima, com a próxima logo abaixo.
  const amen = () => {
    setOpen(false);
    onUserClose?.();
    requestAnimationFrame(() => {
      const summary = summaryRef.current;
      if (summary && summary.getBoundingClientRect().top < 0) {
        summary.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    });
  };

  // Atraso negativo: se o cartão for remontado no meio da pausa, o anel continua de onde estava.
  const ringStyle = pause
    ? ({ '--pause-ms': `${pause.total}ms`, animationDelay: `${Math.min(0, pause.until - pause.total - Date.now())}ms` } as CSSProperties)
    : undefined;

  return (
    <details
      className={locked ? 'prayer paused' : 'prayer'}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary ref={summaryRef} onClick={onSummaryClick} aria-disabled={locked || undefined}>
        <span className="prayer-title">{prayer.title}</span>
        {locked ? (
          <span className="pause-timer" role="timer">
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <circle className="pause-track" cx="18" cy="18" r="15.5" />
              <circle className="pause-ring" cx="18" cy="18" r="15.5" pathLength="100" style={ringStyle} />
            </svg>
            <span className="pause-count" aria-hidden="true">{pause.left}</span>
            <span className="sr-only">Pausa: disponível em instantes</span>
          </span>
        ) : (
          <span className="chevron" aria-hidden="true">›</span>
        )}
      </summary>
      {open && (
        // Em pausa, o texto fica velado até ela acabar, para o olho não correr adiante.
        <div className={veiled ? 'prayer-content veiled' : 'prayer-content'} aria-hidden={veiled || undefined}>
          <Markdown source={prayer.body} />
          <div className="prayer-actions">
            <Link className="link-btn small" to={`/oracoes/${prayer.id}`}>Editar oração</Link>
            <button type="button" className="btn small amen" onClick={amen} disabled={veiled}>
              {isLast ? 'Amém' : 'Amém, próxima'}
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
