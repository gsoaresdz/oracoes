import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PrayerPicker } from '../components/PrayerPicker';
import { useAction, useData } from '../lib/data';
import { baseRoutine, diffOrder, nextPosition } from '../lib/routines';
import type { Item, Prayer, Routine, Section } from '../lib/types';

function DragHandle({ label, handle }: { label: string; handle: ReturnType<typeof useSortable> }) {
  return (
    <button
      type="button"
      className="handle"
      aria-label={label}
      ref={handle.setActivatorNodeRef}
      {...handle.attributes}
      {...handle.listeners}
    >
      ⠿
    </button>
  );
}

function ItemRow({ item, title, onRemove }: { item: Item; title: string; onRemove: () => void }) {
  const sortable = useSortable({ id: item.id, data: { type: 'item' } });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  return (
    <li ref={sortable.setNodeRef} style={style} className={`edit-item${sortable.isDragging ? ' dragging' : ''}`} data-testid="edit-item">
      <DragHandle label={`Mover ${title}`} handle={sortable} />
      <Link className="edit-item-title" to={`/oracoes/${item.prayer_id}`}>{title}</Link>
      <button type="button" className="icon-btn" aria-label={`Remover ${title} deste dia`} onClick={onRemove}>×</button>
    </li>
  );
}

function SectionShell({ section, children, label }: { section: Section; children: (handle: ReactNode) => ReactNode; label: string }) {
  const sortable = useSortable({ id: section.id, data: { type: 'section', slot: section.is_base_slot } });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  return (
    <section
      ref={sortable.setNodeRef}
      style={style}
      className={`card edit-section${section.is_base_slot ? ' slot' : ''}${sortable.isDragging ? ' dragging' : ''}`}
      data-testid="edit-section"
    >
      {children(<DragHandle label={`Mover ${label}`} handle={sortable} />)}
    </section>
  );
}

interface SectionEditorProps {
  section: Section;
  byId: Map<string, Prayer>;
  prayers: Prayer[];
  busy: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAdd: (prayer: Prayer) => void;
  onRemoveItem: (item: Item) => void;
}

function SectionEditor({ section, byId, prayers, busy, onRename, onDelete, onAdd, onRemoveItem }: SectionEditorProps) {
  const [title, setTitle] = useState(section.title);
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setTitle(section.title), [section.title]);
  const inSection = useMemo(() => new Set(section.items.map((i) => i.prayer_id)), [section.items]);

  const commitTitle = () => {
    const clean = title.trim();
    if (!clean) setTitle(section.title);
    else if (clean !== section.title) onRename(clean);
  };

  return (
    <SectionShell section={section} label={section.title}>
      {(handle) => (
        <>
          <div className="edit-section-head">
            {handle}
            <input
              className="section-title-input"
              value={title}
              aria-label="Nome da seção"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
          <SortableContext items={section.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="edit-items">
              {section.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  title={byId.get(item.prayer_id)?.title ?? '(oração removida)'}
                  onRemove={() => onRemoveItem(item)}
                />
              ))}
              {!section.items.length && <li className="muted drop-hint">Arraste uma oração para cá ou adicione abaixo.</li>}
            </ul>
          </SortableContext>
          {picking ? (
            <PrayerPicker
              prayers={prayers}
              excluded={inSection}
              newPrayerHref={`/oracoes/nova?secao=${section.id}`}
              onPick={onAdd}
              onClose={() => setPicking(false)}
            />
          ) : (
            <div className="row-between">
              <button type="button" className="link-btn" onClick={() => setPicking(true)}>+ Adicionar oração</button>
              {confirming ? (
                <span className="small-text">
                  Excluir a seção? As orações continuam na biblioteca.{' '}
                  <button type="button" className="link-btn danger" disabled={busy} onClick={onDelete}>Excluir</button>{' '}
                  <button type="button" className="link-btn" onClick={() => setConfirming(false)}>Não</button>
                </span>
              ) : (
                <button type="button" className="link-btn muted-link" onClick={() => setConfirming(true)}>Excluir seção</button>
              )}
            </div>
          )}
        </>
      )}
    </SectionShell>
  );
}

function BaseSlot({ section }: { section: Section }) {
  return (
    <SectionShell section={section} label="a base">
      {(handle) => (
        <div className="edit-section-head">
          {handle}
          <div className="slot-text">
            <strong>Base de todos os dias</strong>
            <Link className="link-btn small" to="/base">Editar a base</Link>
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function RoutineEditor({ routine }: { routine: Routine }) {
  const { prayers, store } = useData();
  const { run, busy, error } = useAction();
  const navigate = useNavigate();
  const [sections, setSections] = useState(routine.sections);
  const [newSection, setNewSection] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  useEffect(() => setSections(routine.sections), [routine.sections]);

  const byId = useMemo(() => new Map(prayers.map((p) => [p.id, p])), [prayers]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findSectionOfItem = (list: Section[], itemId: string) => list.find((s) => s.items.some((i) => i.id === itemId));

  const collision: CollisionDetection = (args) => {
    const type = args.active.data.current?.type;
    const isSection = (c: (typeof args.droppableContainers)[number]) => c.data.current?.type === 'section';
    if (type === 'section') {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(isSection) });
    }
    // Oração: nunca cai no marcador da base; primeiro acha a seção sob o ponteiro, depois a posição nela.
    const targets = args.droppableContainers.filter((c) => !c.data.current?.slot);
    const within = args.pointerCoordinates ? pointerWithin({ ...args, droppableContainers: targets }) : [];
    const section = within.map((w) => targets.find((c) => c.id === w.id)).find((c) => c && isSection(c));
    if (section) {
      const items = sectionsRef.current.find((s) => s.id === section.id)?.items ?? [];
      const inside = targets.filter((c) => items.some((i) => i.id === c.id));
      if (!inside.length) return [{ id: section.id }];
      return closestCenter({ ...args, droppableContainers: inside });
    }
    return closestCenter({ ...args, droppableContainers: targets.filter((c) => !isSection(c)) });
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.data.current?.type !== 'item') return;
    setSections((list) => {
      const from = findSectionOfItem(list, String(active.id));
      const to = over.data.current?.type === 'section' ? list.find((s) => s.id === over.id) : findSectionOfItem(list, String(over.id));
      if (!from || !to || from.id === to.id || to.is_base_slot) return list;
      const moving = from.items.find((i) => i.id === active.id)!;
      const overIndex = to.items.findIndex((i) => i.id === over.id);
      const index = overIndex === -1 ? to.items.length : overIndex;
      return list.map((s) => {
        if (s.id === from.id) return { ...s, items: s.items.filter((i) => i.id !== active.id) };
        if (s.id === to.id) return { ...s, items: [...s.items.slice(0, index), moving, ...s.items.slice(index)] };
        return s;
      });
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    let next = sectionsRef.current;
    if (over && active.id !== over.id) {
      if (active.data.current?.type === 'section') {
        const from = next.findIndex((s) => s.id === active.id);
        const to = next.findIndex((s) => s.id === over.id);
        if (from !== -1 && to !== -1) next = arrayMove(next, from, to);
      } else {
        const section = findSectionOfItem(next, String(active.id));
        if (section) {
          const from = section.items.findIndex((i) => i.id === active.id);
          const to = section.items.findIndex((i) => i.id === over.id);
          if (from !== -1 && to !== -1) {
            next = next.map((s) => (s.id === section.id ? { ...s, items: arrayMove(s.items, from, to) } : s));
          }
        }
      }
    }
    setSections(next);
    const change = diffOrder(routine.sections, next);
    if (change.sections.length || change.items.length) void run(() => store.applyOrder(change));
  };

  const addSection = async (event: FormEvent) => {
    event.preventDefault();
    const title = newSection.trim();
    if (!title) return;
    if (await run(() => store.createSection({ routine_id: routine.id, title, position: nextPosition(sections) }))) {
      setNewSection('');
    }
  };

  const removeRoutine = async () => {
    if (await run(() => store.deleteRoutine(routine.id))) navigate('/');
  };

  const dayHref = routine.weekday === null ? '/' : `/dia/${routine.weekday}`;

  return (
    <div className="stack">
      <div className="page-head">
        <p className="eyebrow"><Link to={dayHref}>‹ Voltar</Link></p>
        <h1>{routine.is_base ? 'Base de todos os dias' : `Editar ${routine.name}`}</h1>
        {routine.is_base && <p className="muted">O que mudar aqui aparece em todos os dias da semana.</p>}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        // Rolagem suave e só bem perto da borda: rápida demais, a oração passaria direto pelas seções.
        autoScroll={{ threshold: { x: 0, y: 0.08 }, acceleration: 3 }} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setSections(routine.sections)}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="stack">
            {sections.map((section) =>
              section.is_base_slot ? (
                <BaseSlot key={section.id} section={section} />
              ) : (
                <SectionEditor
                  key={section.id}
                  section={section}
                  byId={byId}
                  prayers={prayers}
                  busy={busy}
                  onRename={(title) => void run(() => store.renameSection(section.id, title))}
                  onDelete={() => void run(() => store.deleteSection(section.id))}
                  onAdd={(prayer) => void run(() => store.createItem({ section_id: section.id, prayer_id: prayer.id, position: nextPosition(section.items) }))}
                  onRemoveItem={(item) => void run(() => store.deleteItem(item.id))}
                />
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>

      <form className="add-section" onSubmit={addSection}>
        <input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Nome da nova seção" aria-label="Nome da nova seção" />
        <button className="btn" disabled={busy || !newSection.trim()}>Adicionar seção</button>
      </form>

      {!routine.is_base && (
        <div className="danger-zone">
          {confirmDelete ? (
            <p>
              Excluir {routine.name}? As orações continuam na biblioteca.{' '}
              <button type="button" className="link-btn danger" onClick={removeRoutine}>Sim, excluir</button>{' '}
              <button type="button" className="link-btn" onClick={() => setConfirmDelete(false)}>Não</button>
            </p>
          ) : (
            <button type="button" className="link-btn danger" onClick={() => setConfirmDelete(true)}>Excluir este dia</button>
          )}
        </div>
      )}
    </div>
  );
}

export function RoutineEdit({ base }: { base?: boolean }) {
  const { routines } = useData();
  const { id } = useParams();
  const routine = base ? baseRoutine(routines) : routines.find((r) => r.id === id);
  if (!routine) {
    return (
      <div className="stack">
        <p>Dia não encontrado.</p>
        <Link className="link-btn" to="/">Voltar</Link>
      </div>
    );
  }
  return <RoutineEditor key={routine.id} routine={routine} />;
}
