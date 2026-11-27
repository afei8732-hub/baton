import { describe, expect, it } from 'vitest';
import { adfToText, briefToAdf, normaliseDescription } from '../src/shared/adf';
import { buildFromSnapshot } from '../src/shared/brief';
import { DEMO_NOW, primaryWorkspace } from '../src/shared/fixtures';

describe('ADF reading', () => {
  it('flattens a Jira description into readable text', () => {
    const description = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Retries must reuse the same key.' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Max 3 attempts' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Window is 24h' }] }] },
          ],
        },
      ],
    };
    const text = normaliseDescription(description);
    expect(text).toContain('Retries must reuse the same key.');
    expect(text).toContain('Max 3 attempts');
    expect(text).toContain('Window is 24h');
  });

  it('keeps mentions and links visible', () => {
    const text = adfToText({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { text: '@Priya Raman' } },
            { type: 'text', text: ' owns ' },
            { type: 'inlineCard', attrs: { url: 'https://example.atlassian.net/browse/PAY-388' } },
          ],
        },
      ],
    });
    expect(text).toContain('@Priya Raman');
    expect(text).toContain('PAY-388');
  });

  it('treats a plain string description as text', () => {
    expect(normaliseDescription('plain description')).toBe('plain description');
  });
});

describe('ADF writing', () => {
  const brief = buildFromSnapshot(primaryWorkspace, new Date(DEMO_NOW));
  const doc = briefToAdf(brief) as { type: string; version: number; content: unknown[] };

  it('builds a valid ADF document', () => {
    expect(doc.type).toBe('doc');
    expect(doc.version).toBe(1);
    expect(Array.isArray(doc.content)).toBe(true);
    expect(doc.content.length).toBeGreaterThan(4);
  });

  it('carries the headline, risks and next actions', () => {
    const text = adfToText(doc);
    expect(text).toContain(brief.headline);
    expect(text).toContain('Load-bearing context');
    expect(text).toContain('What to do next');
    expect(text).toContain(brief.nextActions[0]);
    expect(text).toContain('No data leaves Atlassian');
  });
});
