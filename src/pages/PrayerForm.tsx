import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Markdown } from '../components/Markdown';
import { useAction, useData } from '../lib/data';
import { nextPosition, prayerUsage } from '../lib/routines';
import { similarTitles } from '../lib/search';
import { UserError } from '../lib/types';

interface Draft {
  title: string;
  body: string;
}

const draftKey = (id?: string) => `oracoes-draft-${id ?? 'nova'}`;

function readDraft(id?: string): Draft | null {
  try {
    const stored = localStorage.getItem(draftKey(id));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function clearDraft(id?: string) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    // Sem armazenamento, não há rascunho para limpar.
  }
}

/** A chave recria o formulário ao passar de uma oração para outra. */
export function PrayerForm() {
  const { id } = useParams();
  return <PrayerFormFields key={id ?? 'nova'} id={id} />;
}

function PrayerFormFields({ id }: { id?: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { prayers, routines, store } = useData();
  const { run, busy, error, clearError } = useAction();
  const existing = prayers.find((p) => p.id === id);

  const [restored] = useState(() => readDraft(id));
  const [title, setTitle] = useState(restored?.title ?? existing?.title ?? '');
  const [body, setBody] = useState(restored?.body ?? existing?.body ?? '');
  const [preview, setPreview] = useState(false);
  const [draftNotice, setDraftNotice] = useState(!!restored);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const currentSections = useMemo(() => {
    const ids = new Set<string>();
    routines.forEach((r) => r.sections.forEach((s) => s.items.forEach((i) => {
      if (i.prayer_id === id) ids.add(s.id);
    })));
    return ids;
  }, [routines, id]);
  const [placed, setPlaced] = useState<Set<string>>(() => {
    const preselected = params.get('secao');
    return preselected ? new Set([...currentSections, preselected]) : new Set(currentSections);
  });

  useEffect(() => {
    if (title === (existing?.title ?? '') && body === (existing?.body ?? '')) return;
    try {
      localStorage.setItem(draftKey(id), JSON.stringify({ title, body }));
    } catch {
      // Sem armazenamento, o rascunho não fica guardado.
    }
  }, [title, body, id, existing]);

  const similar = useMemo(
    () => similarTitles(prayers.filter((p) => p.id !== id), title),
    [prayers, id, title],
  );
  const usage = id ? prayerUsage(routines, id) : [];

  if (id && !existing) {
    return (
      <div className="stack">
        <p>Oração não encontrada.</p>
        <Link className="link-btn" to="/oracoes">Voltar à biblioteca</Link>
      </div>
    );
  }

  const wrapSelection = (marker: string) => {
    const element = textarea.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const selected = body.slice(start, end);
    setBody(body.slice(0, start) + marker + selected + marker + body.slice(end));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + marker.length, end + marker.length);
    });
  };

  const toggleSection = (sectionId: string) => {
    setPlaced((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    clearError();
    const ok = await run(async () => {
      if (!title.trim()) throw new UserError('Informe o título da oração.');
      if (!body.trim()) throw new UserError('Informe o texto da oração.');
      const saved = await store.savePrayer({ id, title: title.trim(), body: body.trim() });
      for (const routine of routines) {
        for (const section of routine.sections) {
          const items = section.items.filter((i) => i.prayer_id === saved.id);
          if (placed.has(section.id) && !items.length) {
            await store.createItem({ section_id: section.id, prayer_id: saved.id, position: nextPosition(section.items) });
          } else if (!placed.has(section.id)) {
            for (const item of items) await store.deleteItem(item.id);
          }
        }
      }
    });
    if (ok) {
      clearDraft(id);
      navigate('/oracoes');
    }
  };

  const remove = async () => {
    if (await run(() => store.deletePrayer(id!))) {
      clearDraft(id);
      navigate('/oracoes');
    }
  };

  const discardDraft = () => {
    clearDraft(id);
    setTitle(existing?.title ?? '');
    setBody(existing?.body ?? '');
    setDraftNotice(false);
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="page-head">
        <p className="eyebrow"><Link to="/oracoes">‹ Biblioteca</Link></p>
        <h1>{id ? 'Editar oração' : 'Nova oração'}</h1>
      </div>

      {draftNotice && (
        <p className="notice">
          Rascunho não salvo recuperado.{' '}
          <button type="button" className="link-btn" onClick={discardDraft}>Descartar</button>
        </p>
      )}

      <div className="card form">
        <label>
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!id} required />
        </label>
        {similar.length > 0 && (
          <p className="notice" role="status">
            Parecida com:{' '}
            {similar.slice(0, 3).map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <Link to={`/oracoes/${p.id}`}>{p.title}</Link>
              </span>
            ))}
          </p>
        )}

        <div className="label-row">
          <label htmlFor="body">Texto da oração</label>
          <div className="toolbar">
            <button type="button" onClick={() => wrapSelection('**')} aria-label="Negrito" disabled={preview}><b>N</b></button>
            <button type="button" onClick={() => wrapSelection('*')} aria-label="Itálico" disabled={preview}><i>I</i></button>
            <button type="button" onClick={() => setPreview(!preview)} aria-pressed={preview}>Prévia</button>
          </div>
        </div>
        {preview ? (
          <div className="preview"><Markdown source={body} /></div>
        ) : (
          <textarea id="body" ref={textarea} rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Cole ou escreva o texto aqui…" />
        )}
      </div>

      <fieldset className="card placement">
        <legend>Onde esta oração entra</legend>
        {routines.map((routine) => {
          const sections = routine.sections.filter((s) => !s.is_base_slot);
          const chosen = sections.filter((s) => placed.has(s.id));
          return (
            <details key={routine.id} className="placement-row" open={routine.is_base || chosen.length > 0 ? true : undefined}>
              <summary>
                <span className="placement-name">{routine.is_base ? 'Base (todos os dias)' : routine.name}</span>
                {chosen.length > 0 && <span className="pill">{chosen.length} {chosen.length === 1 ? 'seção' : 'seções'}</span>}
              </summary>
              <div className="chips wrap">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={`chip${placed.has(section.id) ? ' active' : ''}`}
                    aria-pressed={placed.has(section.id)}
                    onClick={() => toggleSection(section.id)}
                  >
                    {section.title}
                  </button>
                ))}
                {!sections.length && <span className="muted small-text">Sem seções ainda</span>}
              </div>
            </details>
          );
        })}
      </fieldset>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        <Link className="btn" to="/oracoes">Cancelar</Link>
      </div>

      {id && (
        <div className="danger-zone">
          {usage.length > 0 ? (
            <p className="muted small-text">Para apagar, primeiro remova esta oração de: {usage.join(', ')}.</p>
          ) : confirmDelete ? (
            <p>
              Apagar “{existing?.title}” definitivamente?{' '}
              <button type="button" className="link-btn danger" onClick={remove}>Sim, apagar</button>{' '}
              <button type="button" className="link-btn" onClick={() => setConfirmDelete(false)}>Não</button>
            </p>
          ) : (
            <button type="button" className="link-btn danger" onClick={() => setConfirmDelete(true)}>Apagar oração</button>
          )}
        </div>
      )}
    </form>
  );
}
