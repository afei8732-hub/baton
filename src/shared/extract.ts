/**
 * Turns raw Jira + Confluence snapshots into neutral "signals".
 *
 * A signal is one fact a teammate would want before picking up the work:
 * a decision, a spec, a past incident, a discussion, a change event, a person.
 * Signals keep their provenance so the brief can always say where a claim
 * came from and who is accountable for it.
 */
import type {
  ChangeEvent,
  DocSnapshot,
  IssueSnapshot,
  Signal,
  SignalKind,
} from './types';
import {
  bestSentence,
  decisionCue,
  incidentCue,
  negationCue,
  stripMarkup,
  truncate,
  ageInDays,
} from './text';

const DECISION_LABELS = ['decision', 'adr', 'rfc', 'architecture', 'design-decision'];
const INCIDENT_LABELS = ['incident', 'postmortem', 'retro', 'outage'];

const NOTABLE_FIELDS = new Set([
  'status',
  'assignee',
  'duedate',
  'priority',
  'labels',
  'fixversions',
  'resolution',
  'sprint',
]);

export function classifyText(text: string): SignalKind {
  if (decisionCue(text)) return 'decision';
  // A statement that overrides an earlier intent is itself a decision.
  if (negationCue(text)) return 'decision';
  if (incidentCue(text)) return 'incident';
  return 'discussion';
}

function normaliseLabel(label: string): string {
  return label.toLowerCase().trim();
}

export function classifyDoc(doc: DocSnapshot): SignalKind {
  const labels = doc.labels.map(normaliseLabel);
  if (labels.some((l) => DECISION_LABELS.includes(l))) return 'decision';
  if (labels.some((l) => INCIDENT_LABELS.includes(l))) return 'incident';
  const text = `${doc.title} ${doc.excerpt}`;
  if (/postmortem|post-mortem|retrospective|outage/i.test(doc.title)) return 'incident';
  if (/\bADR\b|decision record|design doc|specification|RFC/i.test(text)) {
    return /\bADR\b|decision/i.test(text) ? 'decision' : 'spec';
  }
  return 'spec';
}

export function signalsFromDocs(docs: DocSnapshot[]): Signal[] {
  return docs.map((doc) => {
    const kind = classifyDoc(doc);
    return {
      id: `doc:${doc.id}`,
      kind,
      source: 'confluence' as const,
      title: doc.title,
      excerpt: truncate(doc.excerpt, 260),
      author: doc.author,
      updatedAt: doc.updated,
      url: doc.url,
      labels: doc.labels,
      originKey: doc.id,
      fullText: `${doc.title}. ${doc.excerpt}`.slice(0, 2000),
    };
  });
}

/**
 * The description itself is already in front of the reader, so we only lift
 * the sentence that carries a decision or a constraint out of it. That is the
 * part a new owner would otherwise skim past.
 */
function signalFromDescription(issue: IssueSnapshot): Signal[] {
  const clean = stripMarkup(issue.description || '');
  if (clean.length < 40) return [];
  const cue = decisionCue(clean);
  if (!cue) return [];
  return [
    {
      id: `issue:${issue.key}:description`,
      kind: 'decision',
      source: 'jira',
      title: `${issue.key} states a constraint`,
      excerpt: bestSentence(clean, [cue, 'because', 'so that', 'constraint', 'requirement']),
      author: issue.reporter,
      updatedAt: issue.updated,
      originKey: issue.key,
      labels: issue.labels,
      fullText: clean.slice(0, 2000),
    },
  ];
}

function signalFromComments(issue: IssueSnapshot): Signal[] {
  const out: Signal[] = [];
  for (const comment of issue.comments) {
    const clean = stripMarkup(comment.body);
    if (clean.length < 25) continue;
    const kind = classifyText(clean);
    const when = new Date(comment.updated || comment.created).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
    out.push({
      id: `issue:${issue.key}:comment:${comment.id}`,
      kind,
      source: 'jira',
      title:
        kind === 'decision'
          ? `Decision by ${comment.author} (${when})`
          : kind === 'incident'
            ? `Incident note by ${comment.author} (${when})`
            : `Discussion with ${comment.author} (${when})`,
      excerpt: bestSentence(clean, [
        'decided',
        'agreed',
        'because',
        'revert',
        'instead',
        'blocked',
        'root cause',
      ]),
      author: comment.author,
      authorId: comment.authorId,
      updatedAt: comment.updated || comment.created,
      originKey: issue.key,
      fullText: clean.slice(0, 2000),
    });
  }
  return out;
}

function signalFromChangelog(issue: IssueSnapshot): Signal[] {
  const notable: ChangeEvent[] = issue.changelog.filter((event) =>
    NOTABLE_FIELDS.has(event.field.toLowerCase()),
  );
  // Keep the newest change per field so the brief reads like a status delta,
  // not a raw audit log.
  const seen = new Set<string>();
  const out: Signal[] = [];
  for (const event of [...notable].sort((a, b) => b.at.localeCompare(a.at))) {
    const field = event.field.toLowerCase();
    if (seen.has(field)) continue;
    seen.add(field);
    const label = event.field.charAt(0).toUpperCase() + event.field.slice(1);
    out.push({
      id: `issue:${issue.key}:change:${event.id}`,
      kind: 'change',
      source: 'history',
      title: `${label}: ${event.from ?? 'empty'} -> ${event.to ?? 'empty'}`,
      excerpt: `${event.author} changed ${event.field}${
        event.to ? ` to "${event.to}"` : ''
      }.`,
      author: event.author,
      updatedAt: event.at,
      originKey: issue.key,
    });
  }
  return out.slice(0, 8);
}

function signalFromLinks(issue: IssueSnapshot): Signal[] {
  return issue.links.map((link) => ({
    id: `link:${link.key}`,
    kind: /incident|bug|regression/i.test(link.summary) ? ('incident' as const) : ('spec' as const),
    source: 'jira' as const,
    title: `${link.key} ${link.summary}`,
    excerpt: `${link.type} - ${link.status}`,
    updatedAt: undefined,
    originKey: link.key,
  }));
}

export interface Participant {
  name: string;
  count: number;
  lastAt: string;
  role: string;
}

export function participants(issue: IssueSnapshot): Participant[] {
  const map = new Map<string, Participant>();
  const bump = (name: string | undefined, at: string, role: string) => {
    if (!name) return;
    const existing = map.get(name);
    if (existing) {
      existing.count += 1;
      if (at > existing.lastAt) {
        existing.lastAt = at;
        existing.role = role;
      }
    } else {
      map.set(name, { name, count: 1, lastAt: at, role });
    }
  };
  bump(issue.assignee, issue.updated, 'assignee');
  bump(issue.reporter, issue.created, 'reporter');
  for (const comment of issue.comments) bump(comment.author, comment.updated || comment.created, 'commenter');
  for (const event of issue.changelog) bump(event.author, event.at, 'contributor');
  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

function signalFromPeople(issue: IssueSnapshot, now: Date): Signal[] {
  return participants(issue)
    .slice(0, 6)
    .map((person) => {
      const age = ageInDays(person.lastAt, now) ?? 0;
      return {
        id: `person:${person.name}`,
        kind: 'person' as const,
        source: 'history' as const,
        title: `${person.name} (${person.role})`,
        excerpt: `${person.count} touchpoint${person.count === 1 ? '' : 's'} on this issue, last one ${age} days before the latest update.`,
        author: person.name,
        updatedAt: person.lastAt,
        originKey: issue.key,
      };
    });
}

export function extractSignals(issue: IssueSnapshot, docs: DocSnapshot[], now: Date = new Date()): Signal[] {
  return [
    ...signalFromDescription(issue),
    ...signalFromComments(issue),
    ...signalsFromDocs(docs),
    ...signalFromLinks(issue),
    ...signalFromChangelog(issue),
    ...signalFromPeople(issue, now),
  ];
}

/** Free text a reader needs before starting work; drives relevance scoring. */
export function needText(issue: IssueSnapshot): string {
  return [
    issue.summary,
    issue.description,
    issue.labels.join(' '),
    issue.components.join(' '),
    issue.issueType ?? '',
    `status ${issue.status}`,
    issue.dueDate ? `due ${issue.dueDate}` : '',
    // Linked issue summaries are excluded on purpose: they repeat this
    // issue's vocabulary and would win the ranking against real evidence.
    issue.links.map((l) => l.key).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}
