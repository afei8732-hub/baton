/**
 * Text utilities used to explain *why* a piece of context matters.
 *
 * Deliberately dependency free and deterministic: the same issue always
 * produces the same ranking, which is what makes a handoff brief reviewable.
 */

const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by
  can cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't
  have haven't having he her here hers herself him himself his how i if in into is isn't it its itself just let's me more most
  mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she should
  shouldn't so some such than that the their theirs them themselves then there these they this those through to too under until
  up very was wasn't we were weren't what when where which while who whom why with won't would wouldn't you your yours yourself
  yourselves will also may might should shall get got make made new use used using one two three issue issues jira ticket
  please thanks thank hi hello want need needs needed see look looking currently still already`
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean),
);

/** Words that flip the meaning of an earlier fact when they appear later. */
const NEGATION_CUES = [
  'no longer',
  'not anymore',
  'revert',
  'reverted',
  'rollback',
  'rolled back',
  'instead of',
  'superseded',
  'supersedes',
  'deprecated',
  'cancelled',
  'canceled',
  'dropped',
  'abandoned',
  'we moved to',
  'switch to',
  'switched to',
  'replace',
  'replaced',
  'revoked',
  'out of date',
  'obsolete',
  'scrapped',
];

const DECISION_CUES = [
  'we decided',
  'decision:',
  'decided to',
  'agreed to',
  'agreed on',
  'the plan is',
  'going with',
  'we will',
  "we'll",
  'sign off',
  'signed off',
  'approved',
  'conclusion',
  'rationale',
  'trade-off',
  'tradeoff',
  'ADR',
  'final answer',
];

const INCIDENT_CUES = [
  'incident',
  'postmortem',
  'post-mortem',
  'root cause',
  'outage',
  'degraded',
  'hotfix',
  'regression',
  'sev1',
  'sev2',
  'p1',
  'timed out',
  'timeout',
  'failure',
];

export function stripMarkup(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_>#|]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deliberately tiny suffix stripper. "retries"/"retry", "charges"/"charge" and
 * "idempotent"/"idempotency" have to land on the same term or relevance
 * scoring misses the obvious matches in real Jira text.
 */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  if (w.length > 6 && w.endsWith('ency')) return `${w.slice(0, -4)}ent`;
  if (w.length > 6 && w.endsWith('ance')) return `${w.slice(0, -4)}ant`;
  return w;
}

export function tokenize(input: string): string[] {
  if (!input) return [];
  return stripMarkup(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_.]/g, ' ')
    .split(/[\s\-_.]+/)
    .map((t) => stem(t.trim()))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

export function termSet(input: string): Set<string> {
  return new Set(tokenize(input));
}

/**
 * Inverse document frequency over the workspace, so that "gateway" outweighs
 * "update". Rare terms are what make a context item specific to this issue.
 */
export function buildIdf(documents: string[]): Map<string, number> {
  const df = new Map<string, number>();
  const docs = documents.map((d) => termSet(d));
  for (const doc of docs) {
    for (const term of doc) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const total = Math.max(docs.length, 1);
  const idf = new Map<string, number>();
  for (const [term, count] of df) idf.set(term, Math.log(1 + total / count));
  return idf;
}

export function idfWeight(term: string, idf: Map<string, number>): number {
  return idf.get(term) ?? Math.log(2);
}

/**
 * IDF weighted overlap, normalised to 0..1 by the "need" side.
 * Asymmetric on purpose: a short decision note that hits the issue's rare
 * terms scores high; a long page that happens to mention everything does not.
 */
export function weightedOverlap(
  need: Set<string>,
  candidate: Set<string>,
  idf: Map<string, number>,
): { score: number; matched: string[] } {
  if (need.size === 0 || candidate.size === 0) return { score: 0, matched: [] };
  let needTotal = 0;
  let hit = 0;
  const matched: string[] = [];
  for (const term of need) {
    const weight = idfWeight(term, idf);
    needTotal += weight;
    if (candidate.has(term)) {
      hit += weight;
      matched.push(term);
    }
  }
  if (needTotal === 0) return { score: 0, matched: [] };
  matched.sort((a, b) => idfWeight(b, idf) - idfWeight(a, idf));
  return { score: hit / needTotal, matched };
}

/**
 * IDF weighted cosine similarity. Used for topical relevance because it
 * normalises both sides: a long ADR that mentions everything does not win
 * over a short comment that answers exactly this issue.
 */
export function idfCosine(
  a: Set<string>,
  b: Set<string>,
  idf: Map<string, number>,
): { score: number; matched: string[] } {
  if (a.size === 0 || b.size === 0) return { score: 0, matched: [] };
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const matched: string[] = [];
  for (const term of a) {
    const w = idfWeight(term, idf);
    normA += w * w;
    if (b.has(term)) {
      dot += w * w;
      matched.push(term);
    }
  }
  for (const term of b) {
    const w = idfWeight(term, idf);
    normB += w * w;
  }
  if (normA === 0 || normB === 0) return { score: 0, matched: [] };
  matched.sort((x, y) => idfWeight(y, idf) - idfWeight(x, idf));
  return { score: dot / Math.sqrt(normA * normB), matched };
}

export function containsAny(input: string, cues: string[]): string | null {
  const haystack = stripMarkup(input).toLowerCase();
  for (const cue of cues) {
    if (haystack.includes(cue.toLowerCase())) return cue;
  }
  return null;
}

export function decisionCue(input: string): string | null {
  return containsAny(input, DECISION_CUES);
}

export function negationCue(input: string): string | null {
  return containsAny(input, NEGATION_CUES);
}

/**
 * The part of a replacement sentence that names what is being replaced.
 *
 * "We moved to a sliding window instead of the fixed window" negates the fixed
 * window, not the whole API contract that also mentions idempotency. Anchoring
 * on the negated clause keeps a passing mention from looking like a reversal.
 */
export function negationTargets(sentence: string): string[] {
  const lower = sentence.toLowerCase();
  const cues = [
    'instead of',
    'rather than',
    'supersedes',
    'superseded',
    'replaces',
    'replaced',
    'no longer',
    'deprecated in favour of',
    'deprecated in favor of',
    'we moved to',
    'switched to',
    'switch to',
  ];
  for (const cue of cues) {
    const at = lower.indexOf(cue);
    if (at === -1) continue;
    const clause = sentence
      .slice(at + cue.length)
      // Keep the target local: a comma usually starts a different claim.
      .split(/[,;.!?]/)[0]
      .replace(/^[\s:-]+/, '');
    const terms = [...termSet(clause)].slice(0, 6);
    if (terms.length > 0) return terms;
  }
  return [];
}

export function incidentCue(input: string): string | null {
  return containsAny(input, INCIDENT_CUES);
}

export function ageInDays(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.round((now.getTime() - then) / 86_400_000));
}

export function truncate(input: string, max: number): string {
  const clean = stripMarkup(input);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}...`;
}

/** Sentences, used to pull the most decision-dense excerpt out of a comment. */
export function sentences(input: string): string[] {
  return stripMarkup(input)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

export function bestSentence(input: string, cues: string[]): string {
  const parts = sentences(input);
  if (parts.length === 0) return truncate(input, 180);
  let best = parts[0];
  let bestScore = -1;
  for (const part of parts) {
    let score = 0;
    const lower = part.toLowerCase();
    for (const cue of cues) if (lower.includes(cue.toLowerCase())) score += 3;
    score += Math.min(part.length / 120, 2);
    if (score > bestScore) {
      bestScore = score;
      best = part;
    }
  }
  return truncate(best, 220);
}

/** FNV-1a 32 bit, hex. Stable across runtimes, good enough for fingerprints. */
export function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function humanDays(days: number | null): string {
  if (days === null) return 'date unknown';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.round(days / 365)} years ago`;
}
