import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, toPlainText } from '../../src/lib/markdown';

describe('parseInline', () => {
  it('reconhece negrito, itálico e os dois juntos', () => {
    expect(parseInline('**D**eus')).toEqual([
      { type: 'bold', children: [{ type: 'text', text: 'D' }] },
      { type: 'text', text: 'eus' },
    ]);
    expect(parseInline('(*Sl* 62,1)')[1]).toEqual({ type: 'italic', children: [{ type: 'text', text: 'Sl' }] });
    expect(parseInline('***x***')).toEqual([
      { type: 'bold', children: [{ type: 'italic', children: [{ type: 'text', text: 'x' }] }] },
    ]);
  });

  it('mantém marcadores sem par e caracteres escapados como texto', () => {
    expect(toPlainText('2 * 3 e **aberto')).toBe('2 * 3 e **aberto');
    expect(toPlainText('1\\. Bendita \\*seja\\*')).toBe('1. Bendita *seja*');
  });

  it('não aceita links com protocolos perigosos', () => {
    expect(parseInline('[a](https://x.org)')[0]).toMatchObject({ type: 'link', href: 'https://x.org' });
    expect(parseInline('[a](javascript:alert(1))')[0].type).toBe('text');
  });
});

describe('parseMarkdown', () => {
  it('separa parágrafos e preserva quebras de linha', () => {
    const blocks = parseMarkdown('linha 1\nlinha 2\n\noutro');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(blocks[0].type === 'paragraph' && blocks[0].lines).toHaveLength(2);
  });

  it('agrupa itens de lista com linhas de continuação', () => {
    const [list] = parseMarkdown('1. um\n   continua\n2. dois');
    expect(list).toMatchObject({ type: 'list', ordered: true, start: 1 });
    expect(list.type === 'list' && list.items.map((i) => i.length)).toEqual([2, 1]);
  });

  it('não transforma "1\\." escapado em lista', () => {
    expect(parseMarkdown('1\\. Bendita')[0].type).toBe('paragraph');
  });
});
