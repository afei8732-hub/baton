/**
 * Baton - shared domain types.
 *
 * Everything in src/shared is pure TypeScript: no Forge APIs, no DOM.
 * The resolvers, the unit tests and the local preview harness all import
 * these same functions, so what judges see in the preview is exactly what
 * runs inside Forge.
 */

export type SignalKind =
  | 'decision'
  | 'spec'
  | 'incident'
  | 'discussion'
  | 'change'
  | 'person';

export type SignalSource = 'jira' | 'confluence' | 'history';

export interface Signal {
  id: string;
  kind: SignalKind;
  source: SignalSource;
  title: string;
  excerpt: string;
  /** Display name of the human behind the fact. */
  author?: string;
  /** Atlassian accountId when the source is Jira. */
  authorId?: string;
  /** ISO timestamp. */
  updatedAt?: string;
  url?: string;
  labels?: string[];
  /** Issue key or page id the fact came from, used for traceability. */
  originKey?: string;
  /**
   * Provenance text kept for analysis (contradiction detection, topic
   * overlap). Not displayed; the UI shows `excerpt`.
   */
  fullText?: string;
}

export interface RankedSignal extends Signal {
  score: number;
  relevance: number;
  authority: number;
  freshness: number;
  specificity: number;
  ageDays: number | null;
  /** Human readable justification, shown in the UI. */
  why: string;
  matchedTerms: string[];
}

export type RiskType =
  | 'contradiction'
  | 'stale'
  | 'single-source'
  | 'missing-decision'
  | 'drift';

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface Risk {
  id: string;
  type: RiskType;
  severity: RiskSeverity;
  title: string;
  detail: string;
  signalIds: string[];
  /** Suggested action, phrased so a human can act on it. */
  action?: string;
}

export interface CoverageBucket {
  key: 'decision' | 'spec' | 'history' | 'people' | 'recency';
  label: string;
  present: boolean;
  weight: number;
  note: string;
}

export interface BriefStats {
  candidates: number;
  signals: number;
  sources: number;
  people: number;
  newestAgeDays: number | null;
  oldestAgeDays: number | null;
}

export interface Brief {
  issueKey: string;
  issueSummary: string;
  generatedAt: string;
  /** 0-100. How much of the load-bearing context for this issue is present. */
  confidence: number;
  confidenceLabel: 'strong' | 'workable' | 'thin';
  headline: string;
  signals: RankedSignal[];
  risks: Risk[];
  coverage: CoverageBucket[];
  nextActions: string[];
  stats: BriefStats;
  /** Stable hash of the brief's content, used to detect drift between handoffs. */
  fingerprint: string;
}

export interface CommentSnapshot {
  id: string;
  author: string;
  authorId?: string;
  body: string;
  created: string;
  updated?: string;
}

export interface ChangeEvent {
  id: string;
  author: string;
  field: string;
  from?: string;
  to?: string;
  at: string;
}

export interface IssueLinkSnapshot {
  key: string;
  type: string;
  summary: string;
  status: string;
}

export interface IssueSnapshot {
  key: string;
  summary: string;
  description: string;
  status: string;
  statusCategory?: string;
  assignee?: string;
  assigneeId?: string;
  reporter?: string;
  reporterId?: string;
  created: string;
  updated: string;
  dueDate?: string;
  labels: string[];
  components: string[];
  issueType?: string;
  comments: CommentSnapshot[];
  changelog: ChangeEvent[];
  links: IssueLinkSnapshot[];
  /** True when the issue was moved back to an in-progress or open category. */
  reopened?: boolean;
}

export interface DocSnapshot {
  id: string;
  title: string;
  space?: string;
  author?: string;
  updated: string;
  labels: string[];
  excerpt: string;
  url?: string;
}

export interface WorkspaceSnapshot {
  issue: IssueSnapshot;
  docs: DocSnapshot[];
  /** Recorded handoffs for this issue, newest first. */
  previousFingerprints?: { at: string; fingerprint: string; confidence: number }[];
}

export interface HandoffRecord {
  id: string;
  issueKey: string;
  issueSummary: string;
  at: string;
  from?: string;
  to?: string;
  confidence: number;
  gaps: number;
  highRisks: number;
  fingerprint: string;
  note?: string;
}
