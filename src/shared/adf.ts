/**
 * Atlassian Document Format helpers.
 *
 * Jira Cloud v3 returns rich-text descriptions as ADF, and comments must be
 * posted as ADF, so Baton needs both directions: read ADF into plain text for
 * analysis, and write a brief back as a comment.
 */
import type { Brief } from './types';

type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'panel',
  'rule',
  'table',
  'tableRow',
]);

export function adfToText(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('\n');
  const n = node as AdfNode;
  if (n.type === 'text') return n.text ?? '';
  if (n.type === 'hardBreak') return '\n';
  if (n.type === 'codeBlock') return ` ${(n.content ?? []).map(adfToText).join('')} `;
  if (n.type === 'mention') {
    const attrs = n.attrs ?? {};
    return `@${String(attrs.text ?? attrs.displayName ?? 'teammate')}`;
  }
  if (n.type === 'inlineCard' || n.type === 'blockCard') {
    const attrs = n.attrs ?? {};
    return ` ${String(attrs.url ?? '')} `;
  }
  const inner = (n.content ?? []).map(adfToText).join(BLOCK_TYPES.has(n.type ?? '') ? '\n' : '');
  return inner;
}

export function normaliseDescription(description: unknown): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  return adfToText(description).replace(/\n{2,}/g, '\n\n').trim();
}

function paragraph(text: string): AdfNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function heading(text: string, level = 3): AdfNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function bullet(text: string, level = 0): AdfNode {
  const content: AdfNode[] = [];
  if (level > 0) {
    content.push({ type: 'text', text: '  '.repeat(level) });
  }
  content.push({ type: 'text', text });
  return { type: 'listItem', content: [{ type: 'paragraph', content }] };
}

function bulletList(items: AdfNode[]): AdfNode {
  return { type: 'bulletList', content: items };
}

/**
 * The comment a human posts when handing work over. Written as ADF so the
 * brief survives copy/paste, search and Confluence embeds.
 */
export function briefToAdf(brief: Brief): Record<string, unknown> {
  const content: AdfNode[] = [
    heading(`Baton handoff brief - ${brief.issueKey}`),
    paragraph(brief.headline),
    paragraph(
      `Confidence ${brief.confidence}% (${brief.confidenceLabel}) - ${brief.stats.signals} signals from ${brief.stats.sources} sources, ${brief.stats.people} people. Generated ${brief.generatedAt.slice(0, 16).replace('T', ' ')}Z.`,
    ),
    heading('Load-bearing context'),
    bulletList(
      brief.signals
        .filter((s) => s.relevance >= 0.1)
        .slice(0, 6)
        .map((s) =>
          bullet(
            `[${s.kind}] ${s.title} (${s.source}${s.ageDays === null ? '' : `, ${s.ageDays}d old`}${s.author ? `, ${s.author}` : ''}) - ${s.excerpt}`,
          ),
        ),
    ),
  ];

  if (brief.risks.length > 0) {
    content.push(heading('Gaps and risks'));
    content.push(
      bulletList(
        brief.risks.map((r) => bullet(`(${r.severity}) ${r.title} - ${r.detail}`)),
      ),
    );
  }

  content.push(heading('Coverage'));
  content.push(
    bulletList(
      brief.coverage.map((c) => bullet(`${c.present ? 'OK' : 'MISSING'} - ${c.label}: ${c.note}`)),
    ),
  );

  content.push(heading('What to do next'));
  content.push(bulletList(brief.nextActions.map((a) => bullet(a))));

  content.push(paragraph('Assembled by Baton from this issue, its changelog and linked pages. No data leaves Atlassian.'));

  return {
    type: 'doc',
    version: 1,
    content,
  };
}
