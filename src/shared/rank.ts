/**
 * Deterministic ranking. Every point of score can be explained to a human,
 * which matters more for a handoff brief than a clever opaque score.
 */
import type { RankedSignal, Signal, SignalKind } from './types';
import { ageInDays, buildIdf, humanDays, idfCosine, termSet } from './text';

/**
 * How much a source is allowed to move a decision. A recorded ADR outranks a
 * passing comment; a change event is a fact about mechanics, not intent.
 */
const AUTHORITY: Record<SignalKind, number> = {
  decision: 1,
  incident: 0.85,
  spec: 0.75,
  discussion: 0.55,
  person: 0.5,
  change: 0.4,
};

const HALF_LIFE_DAYS = 120;

export interface RankOptions {
  now: Date;
  assignee?: string;
  labels?: string[];
  issueKey?: string;
}

export function freshness(ageDays: number | null): number {
  if (ageDays === null) return 0.3;
  const decayed = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  return Math.max(0.15, decayed);
}

function specificity(signal: Signal, options: RankOptions): number {
  let score = 0;
  const text = `${signal.title} ${signal.excerpt} ${signal.originKey ?? ''}`.toLowerCase();
  if (options.issueKey && text.includes(options.issueKey.toLowerCase())) score += 0.5;
  const sharedLabels = (signal.labels ?? []).filter((label) =>
    (options.labels ?? []).map((l) => l.toLowerCase()).includes(label.toLowerCase()),
  );
  if (sharedLabels.length > 0) score += Math.min(0.3, sharedLabels.length * 0.15);
  if (signal.author && options.assignee && signal.author === options.assignee) score += 0.2;
  if (signal.source === 'jira') score += 0.1;
  return Math.min(1, score);
}

function describe(
  signal: Signal,
  matched: string[],
  ageDays: number | null,
  authority: number,
): string {
  const bits: string[] = [];
  if (matched.length > 0) {
    const terms = matched.slice(0, 3).join(', ');
    bits.push(`shares ${matched.length} specific term${matched.length === 1 ? '' : 's'} (${terms})`);
  } else {
    bits.push('no specific term overlap');
  }
  if (signal.kind === 'decision') bits.push('recorded decision');
  else if (signal.kind === 'incident') bits.push('prior incident evidence');
  else if (signal.kind === 'spec') bits.push('spec / reference material');
  else if (signal.kind === 'change') bits.push('history event');
  else if (signal.kind === 'person') bits.push('person with direct history');
  bits.push(`authority ${Math.round(authority * 100)}%`);
  bits.push(ageDays === null ? 'no timestamp' : humanDays(ageDays));
  return bits.join(' - ');
}

export function rankSignals(
  signals: Signal[],
  need: string,
  options: RankOptions,
): RankedSignal[] {
  const corpus = [need, ...signals.map((s) => `${s.title} ${s.excerpt} ${s.fullText ?? ''}`)];
  const idf = buildIdf(corpus);
  const needTerms = termSet(need);

  const ranked = signals.map((signal) => {
    const candidate = `${signal.title} ${signal.excerpt} ${signal.fullText ?? ''}`;
    const cosine = idfCosine(needTerms, termSet(candidate), idf);
    // Cosine on this corpus lands around 0.1-0.5; stretch it so topical match
    // is the dominant term in the final score.
    const relevance = Math.min(1, cosine.score * 2.4);
    const matched = cosine.matched;
    const authority = AUTHORITY[signal.kind];
    const ageDays = ageInDays(signal.updatedAt, options.now);
    const fresh = freshness(ageDays);
    const spec = specificity(signal, options);

    const total =
      100 * (0.45 * relevance + 0.25 * authority + 0.18 * fresh + 0.12 * spec);

    return {
      ...signal,
      score: Math.round(total * 10) / 10,
      relevance: Math.round(relevance * 100) / 100,
      authority,
      freshness: Math.round(fresh * 100) / 100,
      specificity: Math.round(spec * 100) / 100,
      ageDays,
      why: describe(signal, matched, ageDays, authority),
      matchedTerms: matched.slice(0, 6),
    } satisfies RankedSignal;
  });

  return ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '');
  });
}
