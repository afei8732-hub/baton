import { describe, expect, it } from 'vitest';
import { buildFromSnapshot, renderMarkdown, renderText } from '../src/shared/brief';
import { DEMO_NOW, demoHandoffs, primaryWorkspace, thinWorkspace } from '../src/shared/fixtures';
import { handoffMetrics } from '../src/shared/metrics';
import { negationTargets } from '../src/shared/text';

const now = new Date(DEMO_NOW);

describe('brief for a well-documented issue', () => {
  const brief = buildFromSnapshot(primaryWorkspace, now);

  it('produces a workable confidence score, not a perfect one', () => {
    expect(brief.issueKey).toBe('PAY-412');
    expect(brief.confidence).toBeGreaterThanOrEqual(60);
    expect(brief.confidence).toBeLessThan(75);
    expect(brief.confidenceLabel).toBe('workable');
  });

  it('leads with the current decision rather than the superseded one', () => {
    expect(brief.headline).toContain('sliding window');
    expect(brief.headline.toLowerCase()).not.toContain('24h');
  });

  it('detects that one update retired two earlier facts', () => {
    const contradiction = brief.risks.find((risk) => risk.type === 'contradiction');
    expect(contradiction).toBeDefined();
    expect(contradiction?.severity).toBe('high');
    expect(contradiction?.signalIds.length).toBe(3);
    expect(contradiction?.title).toContain('2 earlier facts');
  });

  it('does not claim the still-current API contract was superseded', () => {
    const contradiction = brief.risks.find((risk) => risk.type === 'contradiction');
    expect(contradiction?.detail).not.toContain('Payments API contract v3');
  });

  it('flags drift between this and the last recorded handoff', () => {
    const drift = brief.risks.filter((risk) => risk.type === 'drift');
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.some((risk) => risk.title.toLowerCase().includes('changed'))).toBe(true);
  });

  it('covers every bucket and reports real statistics', () => {
    expect(brief.coverage.every((bucket) => bucket.present)).toBe(true);
    expect(brief.stats.signals).toBeGreaterThan(3);
    expect(brief.stats.people).toBeGreaterThanOrEqual(3);
    expect(brief.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it('renders text and markdown from the same facts', () => {
    expect(renderText(brief)).toContain('BATON BRIEF - PAY-412');
    expect(renderMarkdown(brief)).toContain('#### Next');
    expect(renderMarkdown(brief)).toContain(brief.headline);
  });
});

describe('brief for an issue with no decision recorded', () => {
  const brief = buildFromSnapshot(thinWorkspace, now);

  it('comes out thin with the decision bucket missing', () => {
    expect(brief.confidence).toBeLessThan(50);
    expect(brief.confidenceLabel).toBe('thin');
    expect(brief.coverage.find((bucket) => bucket.key === 'decision')?.present).toBe(false);
  });

  it('names the missing decision as the top risk', () => {
    const risk = brief.risks[0];
    expect(risk.type).toBe('missing-decision');
    expect(risk.severity).toBe('high');
    expect(risk.action).toBeTruthy();
  });

  it('suggests writing the decision down', () => {
    expect(brief.nextActions.join(' ').toLowerCase()).toContain('decision');
  });
});

describe('negation targets', () => {
  it('anchors on the clause being replaced, not the whole sentence', () => {
    const targets = negationTargets(
      'We moved to the sliding window limiter instead of the fixed window from the February decision, and the idempotency key is now checked.',
    );
    expect(targets).toContain('fix');
    expect(targets).toContain('window');
    expect(targets).not.toContain('idempotent');
  });

  it('returns nothing when there is no replacement cue', () => {
    expect(negationTargets('We decided to keep the retry budget at three attempts.')).toEqual([]);
  });
});

describe('handoff metrics', () => {
  const metrics = handoffMetrics(demoHandoffs, now);

  it('summarises the recorded handoffs', () => {
    expect(metrics.total).toBe(demoHandoffs.length);
    expect(metrics.avgConfidence).toBeGreaterThan(60);
    expect(metrics.belowSixty).toBeGreaterThan(0);
  });

  it('buckets confidence by week, newest last', () => {
    expect(metrics.trend.length).toBeGreaterThan(1);
    const labels = metrics.trend.map((point) => point.label);
    expect([...labels].sort()).toEqual(labels);
  });

  it('puts the weakest handoffs first', () => {
    const scores = metrics.needsAttention.map((record) => record.confidence);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(metrics.needsAttention.every((record) => record.confidence < 70 || record.highRisks > 0)).toBe(true);
  });
});
