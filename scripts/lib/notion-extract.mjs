// Converte os blocos brutos do Notion na estrutura do app: base, dias, seções e orações.
// Mantém só o português e nunca altera as palavras da oração.

export const EXCLUDED_HEADINGS = ['Latim', 'Grego', 'Sobre a oração', 'Referências', 'Notas', 'Bibliografia'];
const PT_HEADING = 'Português';
const BASE_SECTION = 'Primícias';
export const SUNDAY_EXTRA_SECTION = 'Primícias de domingo';

// Blocos que estão no corpo da oração, mas não são reza (autoria, por exemplo).
export const REMOVED_BLOCKS = new Map([
  ['Ato de abandono (Jeremias)', ['Frei Réginald Marie Garrigou-Lagrange, O.P.']],
]);

const plainText = (block) => (block?.properties?.title ?? []).map((s) => s[0]).join('');

function escapeMarkdown(text) {
  return text.replace(/\\/g, '\\\\').replace(/([*_[\]])/g, '\\$1');
}

export function segmentsToMarkdown(segments = []) {
  return segments
    .map(([text, marks = []]) => {
      // Espaços ficam fora dos marcadores, senão `**texto **` não é reconhecido como negrito.
      const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const [, lead, core, trail] = match;
      if (!core) return text;
      let out = escapeMarkdown(core);
      const link = marks.find((m) => m[0] === 'a');
      if (link) out = `[${out}](${link[1]})`;
      if (marks.some((m) => m[0] === 'i')) out = `*${out}*`;
      if (marks.some((m) => m[0] === 'b')) out = `**${out}**`;
      return lead + out + trail;
    })
    .join('');
}

function blockToMarkdown(block, listIndex, blocks) {
  // Versículos e outras linhas podem estar aninhados dentro do bloco.
  const childLines = (block.content ?? []).map((id) => {
    const child = blocks[id];
    if (!child) throw new Error(`Bloco não carregado: ${id}`);
    return blockToMarkdown(child, 0, blocks);
  });
  const text = [segmentsToMarkdown(block.properties?.title ?? []).trim(), ...childLines].join('\n');
  if (block.type === 'bulleted_list') return `- ${text.replace(/\n/g, '\n  ')}`;
  if (block.type === 'numbered_list' && listIndex > 0) return `${listIndex}. ${text.replace(/\n/g, '\n   ')}`;
  // "1. Bendita seja..." é texto corrido da oração, não uma lista.
  return text.replace(/^(\d+)\. /gm, '$1\\. ').replace(/^- /gm, '\\- ');
}

/** Blocos em português de uma oração, sem subtítulos e sem separadores. */
export function portugueseBlocks(toggle, blocks) {
  const result = [];
  let current = null; // null = antes do primeiro subtítulo, o que é português
  for (const id of toggle.content ?? []) {
    const block = blocks[id];
    if (!block) throw new Error(`Bloco não carregado: ${id}`);
    if (block.type === 'sub_sub_header') {
      const heading = plainText(block).trim();
      if (heading !== PT_HEADING && !EXCLUDED_HEADINGS.includes(heading)) {
        throw new Error(`Subtítulo desconhecido "${heading}" em "${plainText(toggle)}"`);
      }
      current = heading;
      continue;
    }
    if (block.type === 'divider' || !plainText(block).trim()) continue;
    // Em algumas orações o subtítulo foi escrito como texto comum.
    const asText = plainText(block).trim().replace(/:$/, '');
    if (asText === PT_HEADING || EXCLUDED_HEADINGS.includes(asText)) {
      current = asText;
      continue;
    }
    if (current === null || current === PT_HEADING) result.push(block);
  }
  return result;
}

export function prayerBody(title, toggle, blocks) {
  const removed = REMOVED_BLOCKS.get(title) ?? [];
  const kept = portugueseBlocks(toggle, blocks).filter((b) => !removed.includes(plainText(b).trim()));
  const parts = [];
  let number = 0;
  let previousType = null;
  for (const block of kept) {
    number = block.type === 'numbered_list' ? number + 1 : 0;
    const line = blockToMarkdown(block, number, blocks);
    const isList = block.type === 'numbered_list' || block.type === 'bulleted_list';
    parts.push(isList && previousType === block.type ? `\n${line}` : `\n\n${line}`);
    previousType = block.type;
  }
  return parts.join('').trim();
}

export function parsePage(pageId, blocks) {
  const page = blocks[pageId];
  if (!page) throw new Error(`Página não carregada: ${pageId}`);
  const sections = [];
  let section = null;
  for (const id of page.content ?? []) {
    const block = blocks[id];
    if (block?.type === 'sub_header') {
      section = { title: plainText(block).trim(), prayers: [] };
      sections.push(section);
    } else if (block?.type === 'toggle') {
      if (!section) throw new Error(`Oração fora de seção: ${plainText(block)}`);
      const title = plainText(block).trim();
      section.prayers.push({ title, body: prayerBody(title, block, blocks) });
    } else if (block?.type !== 'divider' && plainText(block).trim()) {
      throw new Error(`Bloco inesperado na página: ${block?.type} "${plainText(block)}"`);
    }
  }
  return { name: plainText(page).trim(), sections };
}

const normalizeForCompare = (s) => s.replace(/\s+/g, ' ').trim();

/** Variações conhecidas e aceitas: o título aponta para o texto que deve permanecer. */
export const PREFERRED_VARIANT = new Map([['Ao deitar-se', (body) => body.includes('Oremos:')]]);

/** Monta o seed: orações únicas, base com as Primícias comuns e o restante em cada dia. */
export function buildSeed(days) {
  const prayers = new Map();
  for (const day of days) {
    for (const section of day.sections) {
      for (const { title, body } of section.prayers) {
        const existing = prayers.get(title);
        if (!existing) {
          prayers.set(title, { title, body });
        } else if (normalizeForCompare(existing.body) !== normalizeForCompare(body)) {
          const prefer = PREFERRED_VARIANT.get(title);
          if (!prefer) throw new Error(`Textos diferentes para "${title}"`);
          if (prefer(body)) existing.body = body;
        }
      }
    }
  }

  const baseTitlesPerDay = days.map(
    (d) => d.sections.find((s) => s.title === BASE_SECTION)?.prayers.map((p) => p.title) ?? [],
  );
  const baseTitles = baseTitlesPerDay[0].filter((t) => baseTitlesPerDay.every((list) => list.includes(t)));

  const routines = days.map((day) => {
    const sections = [];
    for (const section of day.sections) {
      if (section.title !== BASE_SECTION) {
        sections.push({ title: section.title, isBaseSlot: false, prayers: section.prayers.map((p) => p.title) });
        continue;
      }
      sections.push({ title: BASE_SECTION, isBaseSlot: true, prayers: [] });
      const extras = section.prayers.map((p) => p.title).filter((t) => !baseTitles.includes(t));
      if (extras.length) sections.push({ title: SUNDAY_EXTRA_SECTION, isBaseSlot: false, prayers: extras });
    }
    return { name: day.name, weekday: day.weekday, sections };
  });

  return {
    prayers: [...prayers.values()],
    base: { name: 'Base', sectionTitle: BASE_SECTION, prayers: baseTitles },
    routines,
  };
}

/** Falha se o resultado não bater com o que foi conferido nas páginas originais. */
export function validateSeed(seed) {
  const problems = [];
  const expect = (label, actual, wanted) => {
    if (actual !== wanted) problems.push(`${label}: esperado ${wanted}, veio ${actual}`);
  };
  const own = (r) => r.sections.filter((s) => !s.isBaseSlot);
  const entries = (r) => own(r).reduce((n, s) => n + s.prayers.length, 0);

  expect('orações únicas', seed.prayers.length, 52);
  expect('entradas na base', seed.base.prayers.length, 12);
  const [sunday, monday] = seed.routines;
  expect('entradas próprias no domingo', entries(sunday), 33);
  expect('seções próprias no domingo', own(sunday).length, 11);
  expect('entradas próprias na segunda', entries(monday), 22);
  expect('seções próprias na segunda', own(monday).length, 8);
  expect('primeira seção do domingo', sunday.sections[0].title, 'Preparação para a Santa Missa');
  expect('base abre a segunda', monday.sections[0].isBaseSlot, true);

  const titles = new Set(seed.prayers.map((p) => p.title));
  for (const t of [...seed.base.prayers, ...seed.routines.flatMap((r) => r.sections.flatMap((s) => s.prayers))]) {
    if (!titles.has(t)) problems.push(`oração referenciada e inexistente: ${t}`);
  }
  for (const p of seed.prayers) {
    if (!p.body.trim()) problems.push(`oração vazia: ${p.title}`);
    for (const heading of [PT_HEADING, ...EXCLUDED_HEADINGS]) {
      if (new RegExp(`^\\W*${heading}\\W*$`, 'm').test(p.body)) problems.push(`"${p.title}" contém o subtítulo ${heading}`);
    }
    if (/[Ͱ-Ͽἀ-῿]{3,}/.test(p.body)) problems.push(`"${p.title}" contém texto em grego`);
  }
  return problems;
}
