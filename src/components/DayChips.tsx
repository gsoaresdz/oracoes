import { Link } from 'react-router-dom';
import { DAY_NAMES, DAY_SHORT } from '../lib/routines';
import type { Routine } from '../lib/types';

export function DayChips({ routines, today, selected }: { routines: Routine[]; today: number; selected: number }) {
  return (
    <nav className="chips days" aria-label="Dias da semana">
      {DAY_SHORT.map((label, day) => {
        const hasRoutine = routines.some((r) => r.weekday === day);
        return (
          <Link
            key={day}
            to={day === today ? '/' : `/dia/${day}`}
            className={`chip${day === selected ? ' active' : ''}${hasRoutine ? '' : ' empty'}`}
            aria-label={`${DAY_NAMES[day]}${day === today ? ' (hoje)' : ''}`}
            aria-current={day === selected ? 'page' : undefined}
          >
            {label}
            {day === today && <span className="dot" aria-hidden="true" />}
          </Link>
        );
      })}
    </nav>
  );
}
