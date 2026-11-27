/**
 * Brief analysis: what is missing, what contradicts what, and how much the
 * brief can be trusted. All of this is computed from the signals themselves,
 * never from a model, so a reviewer can re-derive every claim.
 */
import type {
  Brief,
  CoverageBucket,
  IssueSnapshot,
  RankedSignal,
  Risk,
  RiskType,
  SignalKind,
} from './types';
import {
  buildIdf,
  bestSentence,
  humanDays,
  idfWeight,
  negationCue,
  negationTargets,
  sentences,
  termSet,
  truncate,
  hash,
  weightedOverlap,
} from './text';
import type { Participant } from './extract';
import { rankSignals } from './rank';

const TOPIC_KINDS: SignalKind[] = ['decision', 'spec', 'incident', 'discussion'];
const STALE_DECISION_DAYS = 90;
const RECENT_ACTIVITY_DAYS = 45;
const CONTRADICTION_THRESHOLD = 0.45;

function riskId(type: RiskType, key: string): string {
  return `${type}:${hash(key)}`;
}

interface Replacement {
  older: RankedSignal;
  newer: RankedSignal;
  score: number;
  sentence: string;
}

function signalText(signal: RankedSignal): string {
  return `${signal.title}. ${signal.fullText ?? signal.excerpt}`;
}

/**
 * Content bigrams ("fixed window", "circuit breaker"). A replacement statement
 * almost always names the thing it replaces; requiring a shared bigram keeps
 * generic decisions in the same ticket from looking like contradictions.
 */
export function contentBigrams(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (STOPWORD_BIGRAM_PARTS.has(tokens[i]) || STOPWORD_BIGRAM_PARTS.has(tokens[i + 1])) continue;
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

const STOPWORD_BIGRAM_PARTS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'over', 'under', 'after', 'before',
  'was', 'were', 'are', 'not', 'now', 'but', 'our', 'its', 'any', 'all', 'can', 'will', 'would',
  'should', 'have', 'has', 'had', 'been', 'they', 'them', 'their', 'when', 'then', 'than', 'also',
]);

function explicitKeyMatch(sentence: string, older: RankedSignal): boolean {
  return Boolean(older.originKey) &&
    sentence.toLowerCase().includes((older.originKey ?? '').toLowerCase());
}

function sharesBigram(sentence: string, olderText: string): boolean {
  const older = ` ${olderText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  return contentBigrams(sentence).some((bigram) => older.includes(` ${bigram} `));
}

/** Number of matched terms that are genuinely rare in this workspace. */
function rareMatches(terms: string[], idf: Map<string, number>): number {
  return terms.filter((term) => idfWeight(term, idf) >= 1.15).length;
}

export interface ContradictionResult {
  risks: Risk[];
  /** Ids of facts a newer source has explicitly replaced. */
  superseded: Set<string>;
}

/**
 * Finds statements that replace earlier ones: the newer text carries a
 * negation ("instead of", "superseded", "we moved to") and talks about the
 * same rare terms as an older fact. This is the single most expensive thing
 * to rediscover by hand after a handoff.
 */
export function detectContradictions(
  signals: RankedSignal[],
  idf: Map<string, number>,
): ContradictionResult {
  const timed = signals
    .filter((s) => TOPIC_KINDS.includes(s.kind) && s.updatedAt)
    .sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''));

  // older fact id -> the strongest newer statement that replaces it
  const replacements = new Map<string, Replacement>();

  for (let j = 0; j < timed.length; j++) {
    const newer = timed[j];
    const text = signalText(newer);
    const cueSentences = sentences(text).filter((s) => negationCue(s));
    if (cueSentences.length === 0) {
      if (negationCue(newer.title)) cueSentences.push(newer.title);
    }
    if (cueSentences.length === 0) continue;

    for (const sentence of cueSentences) {
      const need = termSet(sentence);
      const rareInSentence = [...need].filter((term) => idfWeight(term, idf) >= 1.15).length;
      const targets = new Set(negationTargets(sentence));
      const targetsNeeded = Math.min(2, targets.size);

      for (let i = 0; i < j; i++) {
        const older = timed[i];
        if ((older.updatedAt ?? '') >= (newer.updatedAt ?? '')) continue;
        const { matched } = weightedOverlap(need, termSet(signalText(older)), idf);
        const rare = rareMatches(matched, idf);
        if (matched.length < 3 || rare < 2) continue;
        const explicit = explicitKeyMatch(sentence, older);
        if (!sharesBigram(sentence, signalText(older)) && !explicit) continue;

        // The older fact must be about the specific thing being replaced.
        const targetHits = matched.filter((term) => targets.has(term)).length;
        if (targetsNeeded > 0 && targetHits < targetsNeeded) continue;

        // The replacement sentence is short and full of words the older doc
        // never used ("moved", "sliding", "instead"), so plain overlap
        // under-reports. What matters is how much of the sentence's specific
        // vocabulary the older fact explains, and how many rare terms it hits.
        const concentration = rare / Math.max(1, Math.min(rareInSentence, 6));
        const score = Math.min(
          1,
          0.6 * concentration + 0.4 * (rare >= 4 ? 1 : rare / 4) + (explicit ? 0.15 : 0),
        );
        if (score < CONTRADICTION_THRESHOLD) continue;

        const existing = replacements.get(older.id);
        if (!existing || score > existing.score) {
          replacements.set(older.id, { older, newer, score, sentence });
        }
      }
    }
  }

  const ordered = [...replacements.values()].sort((a, b) => b.score - a.score);

  // Group by the statement doing the replacing: one newer decision often
  // retires several older facts, and saying that once is clearer than three
  // near-identical risks.
  const byNewer = new Map<string, Replacement[]>();
  for (const item of ordered) {
    const group = byNewer.get(item.newer.id) ?? [];
    group.push(item);
    byNewer.set(item.newer.id, group);
  }
  const groups = [...byNewer.values()]
    .map((items) => ({
      items: [...items].sort((a, b) => b.score - a.score),
      best: Math.max(...items.map((item) => item.score)),
    }))
    .sort((a, b) => b.best - a.best);

  const risks: Risk[] = groups.slice(0, 2).map(({ items, best }) => {
    const newest = items[0].newer;
    const older = [...items]
      .map((item) => item.older)
      .sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''));
    const names = older
      .map((fact) => `"${truncate(fact.title, 46)}" (${(fact.updatedAt ?? '').slice(0, 10)})`)
      .join(' and ');
    const title =
      older.length === 1
        ? `"${truncate(older[0].title, 58)}" was superseded`
        : `${older.length} earlier facts were superseded by one update`;
    return {
      id: riskId('contradiction', `${older.map((fact) => fact.id).join('|')}|${newest.id}`),
      type: 'contradiction',
      severity: best >= 0.6 ? 'high' : 'medium',
      title,
      detail: `${names} no longer match "${truncate(newest.title, 64)}" (${(newest.updatedAt ?? '').slice(0, 10)}), which says: "${truncate(items[0].sentence, 190)}"`,
      signalIds: [...older.map((fact) => fact.id), newest.id],
      action: 'Confirm which version is current before building on it.',
    };
  });

  const superseded = new Set(groups.slice(0, 2).flatMap(({ items }) => items.map((item) => item.older.id)));
  return { risks, superseded };
}

export function detectStale(
  signals: RankedSignal[],
  issue: IssueSnapshot,
  now: Date,
  superseded: Set<string>,
): Risk[] {
  const risks: Risk[] = [];
  const lastActivity = issue.changelog.at(-1)?.at ?? issue.updated;
  const activeRecently =
    lastActivity >= new Date(now.getTime() - RECENT_ACTIVITY_DAYS * 86_400_000).toISOString();
  if (!activeRecently) return risks;

  const candidates = signals.filter(
    (signal) =>
      (signal.kind === 'decision' || signal.kind === 'spec') &&
      !superseded.has(signal.id) &&
      (signal.ageDays ?? 0) >= STALE_DECISION_DAYS,
  );

  const covered: RankedSignal[] = [];
  for (const signal of candidates) {
    const duplicate = covered.some(
      (c) => weightedOverlap(termSet(signal.title), termSet(signalText(c)), buildIdf([signalText(signal), signalText(c)])).score > 0.5,
    );
    if (duplicate) continue;
    covered.push(signal);
    risks.push({
      id: riskId('stale', signal.id),
      type: 'stale',
      severity: (signal.ageDays ?? 0) > 180 ? 'high' : 'medium',
      title: `${truncate(signal.title, 58)} last confirmed ${humanDays(signal.ageDays)}`,
      detail: `Work moved on ${lastActivity.slice(0, 10)} but this ${signal.source} fact is ${signal.ageDays} days old and nobody has re-confirmed it.`,
      signalIds: [signal.id],
      action: `Ask ${signal.author ?? 'the owner'} to re-confirm or retire it.`,
    });
    if (risks.length >= 1) break;
  }
  return risks;
}

export function detectSingleSource(
  signals: RankedSignal[],
  issue: IssueSnapshot,
  people: Participant[],
  idf: Map<string, number>,
): Risk[] {
  const decisions = signals.filter((s) => s.kind === 'decision');
  const current = new Set(people.map((p) => p.name));
  const risks: Risk[] = [];
  const authorsSeen = new Set<string>();

  for (const decision of decisions) {
    const peers = signals.filter(
      (s) =>
        s.id !== decision.id &&
        TOPIC_KINDS.includes(s.kind) &&
        topicStrength(decision, s, idf) >= 0.45,
    );
    const authors = new Set(
      [decision, ...peers].map((s) => s.author).filter((a): a is string => Boolean(a)),
    );
    if (authors.size > 1) continue;
    const only = decision.author;
    if (!only || only === issue.assignee || authorsSeen.has(only)) continue;
    authorsSeen.add(only);
    const stillAround = current.has(only);
    risks.push({
      id: riskId('single-source', decision.id),
      type: 'single-source',
      severity: stillAround ? 'low' : 'medium',
      title: `${truncate(decision.title, 55)} lives with one person`,
      detail: stillAround
        ? `${only} is the only recorded source for this reasoning. If they are away, the "why" is gone.`
        : `${only} is the only recorded source and is no longer active on ${issue.key}.`,
      signalIds: [decision.id],
      action: `Ask ${only} for five minutes, or write the reasoning down.`,
    });
    if (risks.length >= 1) break;
  }
  return risks;
}

function topicStrength(a: RankedSignal, b: RankedSignal, idf: Map<string, number>): number {
  return weightedOverlap(termSet(signalText(a)), termSet(signalText(b)), idf).score;
}

export function detectDrift(
  issue: IssueSnapshot,
  fingerprint: string,
  previous?: { at: string; fingerprint: string; confidence: number },
): Risk[] {
  const risks: Risk[] = [];
  if (previous && previous.fingerprint !== fingerprint) {
    risks.push({
      id: riskId('drift', `${issue.key}:${previous.at}`),
      type: 'drift',
      severity: 'medium',
      title: 'Context changed since the last handoff',
      detail: `The brief from ${previous.at.slice(0, 10)} had confidence ${previous.confidence}% and a different set of load-bearing facts. A new owner cannot rely on it as-is.`,
      signalIds: [],
      action: 'Read what changed, do not duplicate the old reasoning.',
    });
  }

  const rework = issue.changelog.filter(
    (event) =>
      event.field.toLowerCase() === 'status' &&
      /done|closed|resolved/i.test(event.from ?? '') &&
      !/done|closed|resolved/i.test(event.to ?? ''),
  );
  if (rework.length > 0) {
    risks.push({
      id: riskId('drift', `${issue.key}:rework`),
      type: 'drift',
      severity: rework.length > 1 ? 'high' : 'medium',
      title: `Work came back ${rework.length} time${rework.length === 1 ? '' : 's'}`,
      detail: `The issue was reopened from "${rework[0].from}" to "${rework[0].to}" on ${rework[0].at.slice(0, 10)}. An assumption the team believed at handoff did not hold.`,
      signalIds: [],
      action: 'Name the assumption that broke before restarting.',
    });
  }
  return risks;
}

export function coverageOf(
  signals: RankedSignal[],
  issue: IssueSnapshot,
  superseded: Set<string>,
): CoverageBucket[] {
  const relevant = (kind: SignalKind) =>
    signals.filter((s) => s.kind === kind && s.relevance >= 0.1 && !superseded.has(s.id));

  const decisions = relevant('decision');
  const specs = relevant('spec');
  const history = [...relevant('incident'), ...relevant('change')];
  const people = signals.filter((s) => s.kind === 'person' && s.author !== issue.assignee);
  const newest = signals
    .filter((s) => s.ageDays !== null && s.relevance >= 0.1)
    .reduce<number | null>(
      (min, s) => (min === null ? s.ageDays! : Math.min(min, s.ageDays!)),
      null,
    );

  const supersededDecisions = signals.filter(
    (s) => s.kind === 'decision' && superseded.has(s.id),
  ).length;

  return [
    {
      key: 'decision',
      label: 'Why the work is shaped this way',
      weight: 0.3,
      present: decisions.length > 0,
      note: decisions.length
        ? `${decisions.length} current decision source${decisions.length === 1 ? '' : 's'}`
        : supersededDecisions > 0
          ? `only ${supersededDecisions} superseded decision${supersededDecisions === 1 ? '' : 's'}`
          : 'no recorded decision',
    },
    {
      key: 'spec',
      label: 'Where the spec or contract lives',
      weight: 0.2,
      present: specs.length > 0,
      note: specs.length
        ? `${specs.length} reference item${specs.length === 1 ? '' : 's'}`
        : 'no doc found',
    },
    {
      key: 'history',
      label: 'What broke here before',
      weight: 0.2,
      present: history.length > 0,
      note: history.length
        ? `${history.length} historical signal${history.length === 1 ? '' : 's'}`
        : 'no incident or change history',
    },
    {
      key: 'people',
      label: 'Who else knows the detail',
      weight: 0.15,
      present: people.length > 0,
      note: people.length
        ? `${people.length} person${people.length === 1 ? '' : 's'} beyond the assignee`
        : 'single owner only',
    },
    {
      key: 'recency',
      label: 'Still current',
      weight: 0.15,
      present: newest !== null && newest <= 120,
      note: newest === null ? 'no dated evidence' : `newest evidence ${humanDays(newest)}`,
    },
  ];
}

export function confidenceOf(coverage: CoverageBucket[], risks: Risk[]): number {
  const base = coverage.reduce((sum, bucket) => sum + (bucket.present ? bucket.weight : 0), 0);
  const penalty = risks.reduce((sum, risk) => {
    // A missing decision is the one gap a reader cannot work around: every
    // other gap narrows the brief, this one removes its spine.
    if (risk.type === 'missing-decision') return sum + (risk.severity === 'high' ? 22 : 12);
    if (risk.severity === 'high') return sum + 10;
    if (risk.severity === 'medium') return sum + 5;
    return sum + 2;
  }, 0);
  return Math.max(8, Math.min(97, Math.round(base * 100 - penalty)));
}

function tidy(sentence: string): string {
  if (sentence.endsWith('...')) return sentence;
  return sentence.replace(/[.;\s]+$/, '');
}

export function buildHeadline(
  issue: IssueSnapshot,
  signals: RankedSignal[],
  superseded: Set<string>,
): string {
  const topDecision = signals
    .filter((s) => s.kind === 'decision' && s.relevance >= 0.1 && !superseded.has(s.id))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
  const anchor = topDecision
    ? truncate(bestSentence(topDecision.fullText ?? topDecision.excerpt, ['decided', 'because', 'instead']), 170)
    : truncate(bestSentence(issue.description, ['constraint', 'must', 'need', 'cannot']), 170) ||
      issue.summary;
  return tidy(anchor);
}

export interface BuildBriefInput {
  issue: IssueSnapshot;
  signals: RankedSignal[];
  people: Participant[];
  now: Date;
  previous?: { at: string; fingerprint: string; confidence: number };
}

export function buildBrief(input: BuildBriefInput): Brief {
  const { issue, signals, people, now, previous } = input;
  const idf = buildIdf(signals.map((s) => signalText(s)));

  const contradictions = detectContradictions(signals, idf);
  const fingerprint = fingerprintOf(signals, contradictions.superseded, now);
  const coverage = coverageOf(signals, issue, contradictions.superseded);

  const risks: Risk[] = [
    ...contradictions.risks,
    ...detectDrift(issue, fingerprint, previous),
    ...detectStale(signals, issue, now, contradictions.superseded),
    ...detectSingleSource(signals, issue, people, idf),
  ];

  if (!coverage.find((c) => c.key === 'decision')?.present) {
    risks.unshift({
      id: riskId('missing-decision', issue.key),
      type: 'missing-decision',
      severity: 'high',
      title: 'No usable recorded decision',
      detail: `Nothing current in ${issue.key}'s history or linked docs explains why this work is shaped the way it is. A new owner would have to guess, or interrupt someone.`,
      signalIds: [],
      action: 'Write a two-line decision note and link it before handoff.',
    });
  }

  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  risks.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const confidence = confidenceOf(coverage, risks);
  const nextActions = dedupe([
    ...risks.map((r) => r.action).filter((a): a is string => Boolean(a)),
    coverage.some((c) => !c.present && c.key === 'history')
      ? 'Link the incident or change that makes this risky.'
      : '',
    'Post this brief as a comment so the next owner inherits the reasoning.',
  ]).slice(0, 4);

  const ages = signals.map((s) => s.ageDays).filter((a): a is number => a !== null);

  return {
    issueKey: issue.key,
    issueSummary: issue.summary,
    generatedAt: now.toISOString(),
    confidence,
    confidenceLabel: confidence >= 75 ? 'strong' : confidence >= 50 ? 'workable' : 'thin',
    headline: buildHeadline(issue, signals, contradictions.superseded),
    signals,
    risks,
    coverage,
    nextActions,
    stats: {
      candidates: signals.length,
      signals: signals.filter((s) => s.relevance >= 0.1).length,
      sources: new Set(signals.map((s) => s.source)).size,
      people: people.length,
      newestAgeDays: ages.length ? Math.min(...ages) : null,
      oldestAgeDays: ages.length ? Math.max(...ages) : null,
    },
    fingerprint,
  };
}

export function fingerprintOf(
  signals: RankedSignal[],
  superseded: Set<string>,
  now: Date,
): string {
  const top = signals
    .filter((s) => !superseded.has(s.id))
    .slice(0, 8)
    .map((s) => `${s.id}:${s.score.toFixed(0)}`)
    .join('|');
  const gaps = [...superseded].sort().join(',');
  // Bucketed by day so an unchanged brief stays stable between renders.
  return hash(`${top}#${gaps}#${now.toISOString().slice(0, 10)}`);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export { rankSignals };
