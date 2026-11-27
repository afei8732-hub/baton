/**
 * All reads that touch Atlassian products live here.
 *
 * Every call goes through @forge/api's asApp() client, so there is no external
 * egress: Baton only reads Jira and Confluence inside the customer's own
 * Atlassian cloud, and only stores state in Forge storage.
 */
import api, { route } from '@forge/api';
import type {
  ChangeEvent,
  CommentSnapshot,
  DocSnapshot,
  IssueLinkSnapshot,
  IssueSnapshot,
  WorkspaceSnapshot,
} from '../shared/types';
import { normaliseDescription } from '../shared/adf';
import { stripMarkup, tokenize } from '../shared/text';

const MAX_COMMENTS = 60;
const MAX_CHANGELOG = 200;

export class SourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}

const ISSUE_KEY = /^[A-Z][A-Z0-9_]{0,19}-\d{1,9}$/;

export function assertIssueKey(key: unknown): string {
  if (typeof key !== 'string' || !ISSUE_KEY.test(key.trim().toUpperCase())) {
    throw new SourceError('A Jira issue key like PAY-412 is required.');
  }
  return key.trim().toUpperCase();
}

interface JiraUser {
  displayName?: string;
  accountId?: string;
}

interface JiraIssueResponse {
  key: string;
  fields: {
    summary?: string;
    description?: unknown;
    status?: { name?: string; statusCategory?: { name?: string; key?: string } };
    assignee?: JiraUser | null;
    reporter?: JiraUser | null;
    created?: string;
    updated?: string;
    duedate?: string | null;
    labels?: string[];
    components?: { name?: string }[];
    issuetype?: { name?: string };
    issuelinks?: {
      type?: { name?: string; inward?: string; outward?: string };
      outwardIssue?: { key?: string; fields?: { summary?: string; status?: { name?: string } } };
      inwardIssue?: { key?: string; fields?: { summary?: string; status?: { name?: string } } };
    }[];
    comment?: {
      comments?: {
        id: string;
        body?: unknown;
        author?: JiraUser;
        created?: string;
        updated?: string;
      }[];
      total?: number;
    };
  };
  changelog?: {
    histories?: {
      id: string;
      created: string;
      author?: JiraUser;
      items?: { field: string; fromString?: string | null; toString?: string | null }[];
    }[];
  };
}

function toChangeEvents(response: JiraIssueResponse): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  for (const history of response.changelog?.histories ?? []) {
    for (const item of history.items ?? []) {
      events.push({
        id: `${history.id}:${item.field}`,
        author: history.author?.displayName ?? 'Unknown',
        field: item.field,
        from: item.fromString ?? undefined,
        to: item.toString ?? undefined,
        at: history.created,
      });
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  return events.slice(-MAX_CHANGELOG);
}

function toComments(response: JiraIssueResponse): CommentSnapshot[] {
  const raw = response.fields.comment?.comments ?? [];
  return raw
    .slice(-MAX_COMMENTS)
    .map((comment) => ({
      id: comment.id,
      author: comment.author?.displayName ?? 'Unknown',
      authorId: comment.author?.accountId,
      body: normaliseDescription(comment.body),
      created: comment.created ?? '',
      updated: comment.updated,
    }))
    .filter((comment) => comment.body.length > 0);
}

function toLinks(response: JiraIssueResponse): IssueLinkSnapshot[] {
  const links: IssueLinkSnapshot[] = [];
  for (const link of response.fields.issuelinks ?? []) {
    const issue = link.outwardIssue ?? link.inwardIssue;
    if (!issue?.key) continue;
    links.push({
      key: issue.key,
      type: (link.outwardIssue ? link.type?.outward : link.type?.inward) ?? link.type?.name ?? 'relates to',
      summary: issue.fields?.summary ?? '',
      status: issue.fields?.status?.name ?? 'unknown',
    });
  }
  return links.slice(0, 10);
}

export interface FetchResult {
  snapshot: WorkspaceSnapshot;
  /** True when Confluence search was skipped or failed; surfaced in the UI. */
  docsUnavailable: boolean;
}

export async function fetchIssueSnapshot(issueKey: string): Promise<FetchResult> {
  const key = assertIssueKey(issueKey);
  const fields = [
    'summary',
    'description',
    'status',
    'assignee',
    'reporter',
    'labels',
    'components',
    'duedate',
    'created',
    'updated',
    'issuetype',
    'issuelinks',
    'comment',
  ].join(',');

  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${key}?expand=changelog&fields=${fields}`);

  if (!response.ok) {
    throw new SourceError(
      `Jira returned ${response.status} for ${key}. Check the key and that the app can read this project.`,
      response.status,
    );
  }

  const body = (await response.json()) as JiraIssueResponse;
  const issue: IssueSnapshot = {
    key: body.key,
    summary: body.fields.summary ?? key,
    description: normaliseDescription(body.fields.description),
    status: body.fields.status?.name ?? 'Unknown',
    statusCategory: body.fields.status?.statusCategory?.name,
    assignee: body.fields.assignee?.displayName,
    assigneeId: body.fields.assignee?.accountId,
    reporter: body.fields.reporter?.displayName,
    reporterId: body.fields.reporter?.accountId,
    created: body.fields.created ?? new Date().toISOString(),
    updated: body.fields.updated ?? new Date().toISOString(),
    dueDate: body.fields.duedate ?? undefined,
    labels: body.fields.labels ?? [],
    components: (body.fields.components ?? []).map((c) => c.name ?? '').filter(Boolean),
    issueType: body.fields.issuetype?.name,
    comments: toComments(body),
    changelog: toChangeEvents(body),
    links: toLinks(body),
  };

  const { docs, docsUnavailable } = await fetchRelatedDocs(issue);
  return { snapshot: { issue, docs }, docsUnavailable };
}

/**
 * Confluence full-text search for pages that talk about the same work.
 * Failures are non-fatal: a Jira-only site still gets a useful brief.
 */
export async function fetchRelatedDocs(issue: IssueSnapshot): Promise<{
  docs: DocSnapshot[];
  docsUnavailable: boolean;
}> {
  const terms = [...new Set([...tokenize(issue.summary), ...issue.labels.map((l) => l.toLowerCase())])]
    .filter((term) => term.length > 3)
    .slice(0, 4);

  if (terms.length === 0) return { docs: [], docsUnavailable: false };

  const cql = `type = page AND (${terms
    .map((term) => `text ~ "${term.replace(/"/g, '')}"`)
    .join(' OR ')}) ORDER BY lastmodified DESC`;

  try {
    const response = await api
      .asApp()
      .requestConfluence(
        route`/wiki/rest/api/content/search?cql=${cql}&limit=8&expand=version,space,body.storage`,
      );
    if (!response.ok) return { docs: [], docsUnavailable: true };
    const body = (await response.json()) as {
      results?: {
        id: string;
        title?: string;
        space?: { key?: string };
        version?: { when?: string; by?: { displayName?: string } };
        body?: { storage?: { value?: string } };
        _links?: { webui?: string };
      }[];
    };
    const docs: DocSnapshot[] = (body.results ?? []).map((page) => ({
      id: page.id,
      title: page.title ?? 'Untitled',
      space: page.space?.key,
      author: page.version?.by?.displayName,
      updated: page.version?.when ?? new Date(0).toISOString(),
      labels: [],
      excerpt: stripMarkup(page.body?.storage?.value ?? '').slice(0, 1200),
      url: page._links?.webui,
    }));
    return { docs: docs.filter((doc) => doc.excerpt.length > 0), docsUnavailable: false };
  } catch {
    return { docs: [], docsUnavailable: true };
  }
}

export async function postIssueComment(issueKey: string, adf: Record<string, unknown>): Promise<string> {
  const key = assertIssueKey(issueKey);
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${key}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ body: adf }),
    });
  if (!response.ok) {
    throw new SourceError(`Could not post the brief (Jira returned ${response.status}).`, response.status);
  }
  const body = (await response.json()) as { id?: string };
  return body.id ?? 'unknown';
}
