import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DayChips } from '../components/DayChips';
import { PrayerCard, type CardPause } from '../components/PrayerCard';
import { useAction, useData } from '../lib/data';
import { PAUSE_MS, useCountdown, usePauseEnabled } from '../lib/pause';
import { baseRoutine, DAY_IN_SENTENCE, DAY_NAMES, nextPosition, routineForDay } from '../lib/routines';
import type { Section } from '../lib/types';

interface Pause {
  /** Item que fica em pausa (o seguinte ao que foi fechado). */
  itemId: string;
  until: number;
}

interface SectionViewProps {
  section: Section;
  fromBase?: boolean;
  allOpen: { open: boolean; version: number };
  pauseFor: (itemId: string) => CardPause | null;
  isLast: (itemId: string) => boolean;
  onUserClose: (itemId: string) => void;
}

function SectionView({ section, fromBase, allOpen, pauseFor, isLast, onUserClose }: SectionViewProps) {
  const { prayers } = useData();
  const byId = useMemo(() => new Map(prayers.map((p) => [p.id, p])), [prayers]);
  return (
    <section className="day-section">
      <h2>
        {section.title}
        {fromBase && <span className="pill">Base de todos os dias</span>}
      </h2>
      {section.items.length ? (
        <div className="prayer-list">
          {section.items.map((item) => {
            const prayer = byId.get(item.prayer_id);
            return prayer ? (
              <PrayerCard
                key={item.id}
                prayer={prayer}
                allOpen={allOpen}
                pause={pauseFor(item.id)}
                isLast={isLast(item.id)}
                onUserClose={() => onUserClose(item.id)}
              />
            ) : null;
          })}
        </div>
      ) : (
        <p className="muted">Nenhuma oração nesta seção.</p>
      )}
    </section>
  );
}

export function Today() {
  const { routines, prayers, store } = useData();
  const { weekday } = useParams();
  const navigate = useNavigate();
  const { run, busy, error } = useAction();
  const today = new Date().getDay();
  const parsed = weekday === undefined ? today : Number(weekday);
  const selected = Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : today;
  const [allOpen, setAllOpen] = useState({ open: false, version: 0 });

  const base = baseRoutine(routines);
  const routine = routineForDay(routines, selected);
  const baseSections = base?.sections ?? [];
  const toggleAll = () => setAllOpen((s) => ({ open: !s.open, version: s.version + 1 }));

  const pauseEnabled = usePauseEnabled();
  const [pause, setPause] = useState<Pause | null>(null);
  // Ordem em que as orações aparecem na tela, para saber qual é a "próxima".
  const sectionsOnScreen = routine
    ? routine.sections.flatMap((s) => (s.is_base_slot ? baseSections : [s]))
    : baseSections;
  const prayerIds = new Set(prayers.map((p) => p.id));
  const order = sectionsOnScreen.flatMap((s) => s.items.filter((i) => prayerIds.has(i.prayer_id)).map((i) => i.id));
  const position = new Map(order.map((id, i) => [id, i]));
  // Um só contador para a página: todos os cartões em pausa mostram o mesmo tempo.
  const active = pauseEnabled ? pause : null;
  const left = useCountdown(active?.until ?? null);
  useEffect(() => {
    if (pause && left === 0) setPause(null);
  }, [pause, left]);

  const onUserClose = (itemId: string) => {
    const next = order[(position.get(itemId) ?? -1) + 1];
    if (pauseEnabled && next) setPause({ itemId: next, until: Date.now() + PAUSE_MS });
  };
  // A próxima fica travada; as seguintes, só veladas, para o olho não correr adiante.
  const pauseFor = (itemId: string): CardPause | null => {
    if (!active || left === 0) return null;
    const start = position.get(active.itemId);
    const here = position.get(itemId);
    if (start === undefined || here === undefined || here < start) return null;
    return { role: here === start ? 'next' : 'after', left, until: active.until };
  };
  const isLast = (itemId: string) => position.get(itemId) === order.length - 1;
  const pauseProps = { pauseFor, isLast, onUserClose };

  const createDay = async () => {
    let id = '';
    const ok = await run(async () => {
      const created = await store.createRoutine({
        name: DAY_NAMES[selected],
        weekday: selected,
        is_base: false,
        position: nextPosition(routines),
      });
      id = created.id;
    });
    if (ok) navigate(`/dias/${id}/editar`);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <p className="eyebrow">{selected === today ? 'Hoje' : 'Outro dia'}</p>
        <h1>{DAY_NAMES[selected]}</h1>
      </div>
      <DayChips routines={routines} today={today} selected={selected} />
      <div className="row-between">
        <button type="button" className="link-btn" onClick={toggleAll}>
          {allOpen.open ? 'Recolher todas' : 'Abrir todas'}
        </button>
        {routine && <Link className="link-btn" to={`/dias/${routine.id}/editar`}>Editar este dia</Link>}
      </div>

      {routine ? (
        routine.sections.map((section) =>
          section.is_base_slot ? (
            baseSections.map((b) => <SectionView key={`${section.id}-${b.id}`} section={b} fromBase allOpen={allOpen} {...pauseProps} />)
          ) : (
            <SectionView key={section.id} section={section} allOpen={allOpen} {...pauseProps} />
          ),
        )
      ) : (
        <>
          {baseSections.map((b) => <SectionView key={b.id} section={b} fromBase allOpen={allOpen} {...pauseProps} />)}
          <div className="card empty-day">
            <p>Nada mais cadastrado para {DAY_IN_SENTENCE[selected]}.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn" disabled={busy} onClick={createDay}>Montar este dia</button>
          </div>
        </>
      )}
    </div>
  );
}
