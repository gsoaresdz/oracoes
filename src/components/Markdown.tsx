import { Fragment, useMemo, type ReactNode } from 'react';
import { parseMarkdown, type Inline } from '../lib/markdown';

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((node, i) => {
    if (node.type === 'text') return <Fragment key={i}>{node.text}</Fragment>;
    if (node.type === 'bold') return <strong key={i}>{renderInline(node.children)}</strong>;
    if (node.type === 'link') return <a key={i} href={node.href} target="_blank" rel="noreferrer">{renderInline(node.children)}</a>;
    return <em key={i}>{renderInline(node.children)}</em>;
  });
}

function renderLines(lines: Inline[][]): ReactNode {
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(line)}
    </Fragment>
  ));
}

export function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <div className="prayer-text">
      {blocks.map((block, i) => {
        if (block.type === 'paragraph') return <p key={i}>{renderLines(block.lines)}</p>;
        const items = block.items.map((lines, j) => <li key={j}>{renderLines(lines)}</li>);
        return block.ordered ? <ol key={i} start={block.start}>{items}</ol> : <ul key={i}>{items}</ul>;
      })}
    </div>
  );
}
