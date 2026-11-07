// Subconjunto de markdown usado nas orações: parágrafos, quebras de linha, listas,
// negrito, itálico e links. Gera uma árvore; o React cuida de escapar o texto.

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold' | 'italic'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'paragraph'; lines: Inline[][] }
  | { type: 'list'; ordered: boolean; start: number; items: Inline[][][] };

const SAFE_URL = /^(https?:|mailto:)/i;

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}

/** Procura o fechamento de `**`, escolhendo o fim da sequência em casos como `***`. */
function findBoldClose(text: string, from: number): number {
  for (let i = from; i < text.length - 1; i++) {
    if (text[i] === '*' && text[i + 1] === '*' && !isEscaped(text, i)) {
      let end = i;
      while (text[end + 2] === '*') end++;
      return end;
    }
  }
  return -1;
}

function findItalicClose(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] !== '*' || isEscaped(text, i)) continue;
    if (text[i + 1] === '*') {
      const close = findBoldClose(text, i + 2);
      if (close === -1) return -1;
      i = close + 1;
      continue;
    }
    return i;
  }
  return -1;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\\' && i + 1 < text.length) {
      buffer += text[++i];
      continue;
    }
    if (char === '*' && text[i + 1] === '*') {
      const close = findBoldClose(text, i + 2);
      if (close > i + 2) {
        flush();
        out.push({ type: 'bold', children: parseInline(text.slice(i + 2, close)) });
        i = close + 1;
        continue;
      }
    }
    if (char === '*') {
      const close = findItalicClose(text, i + 1);
      if (close > i + 1) {
        flush();
        out.push({ type: 'italic', children: parseInline(text.slice(i + 1, close)) });
        i = close;
        continue;
      }
    }
    if (char === '[') {
      const match = /^\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/.exec(text.slice(i));
      if (match && SAFE_URL.test(match[2])) {
        flush();
        out.push({ type: 'link', href: match[2], children: parseInline(match[1]) });
        i += match[0].length - 1;
        continue;
      }
    }
    buffer += char;
  }
  flush();
  return out;
}

const LIST_ITEM = /^(\d+)\.\s+(.*)$|^-\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of source.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    const first = LIST_ITEM.exec(lines[0]);
    if (!first) {
      blocks.push({ type: 'paragraph', lines: lines.map((l) => parseInline(l.trim())) });
      continue;
    }
    const ordered = first[1] !== undefined;
    const items: Inline[][][] = [];
    for (const line of lines) {
      const match = LIST_ITEM.exec(line);
      const sameKind = match && (match[1] !== undefined) === ordered;
      if (sameKind) items.push([parseInline((ordered ? match[2] : match[3]).trim())]);
      else items[items.length - 1].push(parseInline(line.trim()));
    }
    blocks.push({ type: 'list', ordered, start: ordered ? Number(first[1]) : 1, items });
  }
  return blocks;
}

/** Texto puro, sem marcações, usado na busca. */
export function toPlainText(source: string): string {
  const inline = (nodes: Inline[]): string =>
    nodes.map((n) => (n.type === 'text' ? n.text : inline(n.children))).join('');
  return parseMarkdown(source)
    .flatMap((b) => (b.type === 'paragraph' ? b.lines : b.items.flat()))
    .map(inline)
    .join(' ');
}
