import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSeed, parsePage, prayerBody, REMOVED_BLOCKS, segmentsToMarkdown, validateSeed } from '../../scripts/lib/notion-extract.mjs';
import { parseMarkdown } from '../../src/lib/markdown';

const block = (type, text, content) => ({ type, properties: text ? { title: [[text]] } : undefined, content });

describe('segmentsToMarkdown', () => {
  it('mantém os espaços fora dos marcadores e escapa símbolos', () => {
    expect(segmentsToMarkdown([['Deus ', [['b']]], ['eterno']])).toBe('**Deus** eterno');
    expect(segmentsToMarkdown([['a*b']])).toBe('a\\*b');
    expect(segmentsToMarkdown([['Sl', [['i']]]])).toBe('*Sl*');
  });
});

describe('prayerBody', () => {
  it('fica só com o português', () => {
    const blocks = {
      a: { type: 'divider' },
      b: block('sub_sub_header', 'Português'),
      c: block('text', 'Oração'),
      d: block('sub_sub_header', 'Latim'),
      e: block('text', 'Oratio'),
      f: block('sub_sub_header', 'Sobre a oração'),
      g: block('text', 'História'),
    };
    expect(prayerBody('X', { content: Object.keys(blocks) }, blocks)).toBe('Oração');
  });

  it('entende português sem subtítulo ou com o subtítulo em texto comum', () => {
    const semRotulo = { a: block('text', 'Oração'), b: block('sub_sub_header', 'Latim'), c: block('text', 'Oratio') };
    expect(prayerBody('X', { content: ['a', 'b', 'c'] }, semRotulo)).toBe('Oração');
    const emTexto = { a: block('text', 'Português'), b: block('text', 'Oração'), c: block('sub_sub_header', 'Grego'), d: block('text', 'Προσευχή') };
    expect(prayerBody('X', { content: ['a', 'b', 'c', 'd'] }, emTexto)).toBe('Oração');
  });

  it('inclui blocos aninhados', () => {
    const blocks = { a: block('numbered_list', 'Verso 1', ['b']), b: block('text', 'continua') };
    expect(prayerBody('X', { content: ['a'] }, blocks)).toBe('1. Verso 1\n   continua');
  });

  it('não confunde numeração da oração com lista', () => {
    const blocks = { a: block('text', '1. Bendita seja') };
    const body = prayerBody('X', { content: ['a'] }, blocks);
    expect(parseMarkdown(body)[0].type).toBe('paragraph');
  });

  it('recusa subtítulo desconhecido em vez de engolir texto', () => {
    const blocks = { a: block('sub_sub_header', 'Inglês') };
    expect(() => prayerBody('X', { content: ['a'] }, blocks)).toThrow('Inglês');
  });
});

const rawFile = new URL('../../data/notion-raw.json', import.meta.url);

describe.runIf(existsSync(rawFile))('importação real', () => {
  const raw = existsSync(rawFile) ? JSON.parse(readFileSync(rawFile, 'utf8')) : {};
  const PAGE_IDS = ['30ad975d-5ec5-80ce-9859-f2526f74acfb', '30ad975d-5ec5-8043-b5f2-c35b18af7007'];
  const days = PAGE_IDS.map((id, weekday) => ({ ...parsePage(id, raw[id]), weekday }));
  const seed = buildSeed(days);
  const body = (title) => seed.prayers.find((p) => p.title === title).body;

  it('passa na validação de contagens', () => {
    expect(validateSeed(seed)).toEqual([]);
  });

  it('não perde nenhuma palavra em português', () => {
    const text = (b) => (b?.properties?.title ?? []).map((s) => s[0]).join('');
    const words = (s) => s.split(/\s+/).filter(Boolean).length;
    const deep = (id, blocks) => words(text(blocks[id])) + (blocks[id].content ?? []).reduce((n, c) => n + deep(c, blocks), 0);
    const clean = (s) => s.replace(/\\/g, '').replace(/\*+/g, '').replace(/^- /gm, '').replace(/^\d+\. /gm, (m, i, str) => (str[i - 1] === undefined || str[i - 1] === '\n' ? m : m));
    for (const id of PAGE_IDS) {
      const blocks = raw[id];
      for (const childId of blocks[id].content) {
        const toggle = blocks[childId];
        if (toggle?.type !== 'toggle') continue;
        const title = text(toggle).trim();
        let current = 'Português';
        let expected = 0;
        for (const k of toggle.content ?? []) {
          const b = blocks[k];
          const t = text(b).trim().replace(/:$/, '');
          if (b.type === 'sub_sub_header' || ['Português', 'Latim', 'Grego'].includes(t)) { current = t; continue; }
          if (current === 'Português' && !(REMOVED_BLOCKS.get(title) ?? []).includes(text(b).trim())) expected += deep(k, blocks);
        }
        const listMarkers = (body(title).match(/^\d+\. /gm) ?? []).length;
        expect(words(clean(body(title))) - listMarkers, title).toBe(expected);
      }
    }
  });

  it('confere as orações mais delicadas', () => {
    expect(body('Alma de Cristo').split('\n\n')).toHaveLength(14);
    expect(body('Alma de Cristo')).not.toMatch(/Bibliografia|Latim|Anima Christi/);
    expect(body('Salmos 90 (91)')).toContain('com seu escudo e suas armas, defender-te.');
    expect(body('À Sagrada Família')).toMatch(/^1\\\. Jesus, Maria e José/);
    expect(body('Medalha de São Bento')).toContain('Vade-retro, Satã');
    expect(body('Ato de abandono (Jeremias)')).not.toContain('Garrigou');
    expect(body('Ao deitar-se')).toContain('Oremos:');
  });

  it('coloca as Primícias na base e preserva a ordem de cada dia', () => {
    const [sunday, monday] = seed.routines;
    expect(sunday.sections.map((s) => s.isBaseSlot)).toEqual([false, true, ...Array(10).fill(false)]);
    expect(sunday.sections[2]).toMatchObject({ title: 'Primícias de domingo', prayers: ['Uma Oração Para Manter o Foco'] });
    expect(monday.sections[0].isBaseSlot).toBe(true);
    expect(seed.base.prayers).toContain('Bênção dos alimentos');
    expect(sunday.sections.at(-1).prayers).toContain('Bênção dos alimentos');
  });
});
