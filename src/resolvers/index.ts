/**
 * Forge resolver entry point.
 *
 * One function serves the Custom UI (issue panel, issue action, global page)
 * and the Rovo actions / MCP tools. Every response is plain JSON so the UI
 * can render without a second round trip.
 */
import type { Brief, HandoffRecord } from '../shared/types';
import { buildFromSnapshot, renderMarkdown, renderText } from '../shared/brief';
import { briefToAdf } from '../shared/adf';
import { handoffMetrics, metricsNarrative } from '../shared/metrics';
import { assertIssueKey, fetchIssueSnapshot, postIssueComment, SourceError } from './sources';
import {
  appendHandoff,
  readBriefState,
  readHandoffIndex,
  readIssueHandoffs,
  writeBriefState,
} from './storage';

interface InvokeEvent {
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  issueKey?: string;
  inputs?: Record<string, unknown>;
  action?: string;
  [key: string]: unknown;
}

interface Unpacked {
  payload: Record<string, unknown>;
  context: Record<string, unknown>;
}

/**
 * Custom UI passes (payload, context); Rovo passes { payload, context } where
 * payload holds the action inputs. Accept both shapes rather than guessing.
 */
function unpack(event: unknown, context?: unknown): Unpacked {
  const first = (event ?? {}) as InvokeEvent & { call?: { payload?: Record<string, unknown> } };
  if (typeof first === 'object' && first.call && typeof first.call === 'object') {
    return {
      payload: (first.call.payload as Record<string, unknown>) ?? {},
      context: ((first.context as Record<string, unknown>) ??
        (context as Record<string, unknown>) ??
        {}) as Record<string, unknown>,
    };
  }
  const looksWrapped =
    typeof first === 'object' && (first.payload !== undefined || first.context !== undefined);
  if (looksWrapped) {
    return {
      payload: (first.payload as Record<string, unknown>) ?? {},
      context: ((first.context as Record<string, unknown>) ??
        (context as Record<string, unknown>) ??
        {}) as Record<string, unknown>,
    };
  }
  return {
    payload: (first as Record<string, unknown>) ?? {},
    context: (context as Record<string, unknown>) ?? {},
  };
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** Rovo gives an issue key in inputs, or a browse URL in the product context. */
function extractIssueKey(payload: Record<string, unknown>, context: Record<string, unknown>): string | undefined {
  const inputs = (payload.inputs as Record<string, unknown>) ?? payload;
  const direct = readString(inputs, 'issueKey') ?? readString(payload, 'issueKey');
  if (direct) return direct;

  const jira = ((payload.context as Record<string, unknown>)?.jira ??
    (context.jira as Record<string, unknown>) ??
    {}) as Record<string, unknown>;
  const url = readString(jira, 'url');
  if (url) {
    const match = url.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i);
    if (match) return match[1].toUpperCase();
  }
  const fromContext = readString(jira, 'issueKey');
  return fromContext;
}

async function compileBrief(issueKey: string): Promise<{
  brief: Brief;
  markdown: string;
  text: string;
  adf: Record<string, unknown>;
  docsUnavailable: boolean;
  previousAt?: string;
}> {
  const { snapshot, docsUnavailable } = await fetchIssueSnapshot(issueKey);
  const previous = await readBriefState(issueKey);

  if (previous) {
    snapshot.previousFingerprints = [
      { at: previous.at, fingerprint: previous.fingerprint, confidence: previous.confidence },
    ];
  }

  const brief = buildFromSnapshot(snapshot, new Date());

  await writeBriefState(issueKey, {
    fingerprint: brief.fingerprint,
    confidence: brief.confidence,
    at: brief.generatedAt,
    topSignalIds: brief.signals.slice(0, 5).map((signal) => signal.id),
  });

  return {
    brief,
    markdown: renderMarkdown(brief),
    text: renderText(brief),
    adf: briefToAdf(brief),
    docsUnavailable,
    previousAt: previous?.at,
  };
}

function failure(error: unknown): Record<string, unknown> {
  if (error instanceof SourceError) {
    return { ok: false, error: error.message, status: error.status ?? null };
  }
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return { ok: false, error: message };
}

/* ------------------------------------------------------------------ */
/* Actions used by the Custom UI                                       */
/* ------------------------------------------------------------------ */

export async function getBrief(issueKey: string): Promise<Record<string, unknown>> {
  try {
    const compiled = await compileBrief(assertIssueKey(issueKey));
    const handoffs = await readIssueHandoffs(compiled.brief.issueKey);
    return {
      ok: true,
      ...compiled,
      issueHandoffs: handoffs.slice(0, 5),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function postBrief(issueKey: string): Promise<Record<string, unknown>> {
  try {
    const compiled = await compileBrief(assertIssueKey(issueKey));
    const commentId = await postIssueComment(compiled.brief.issueKey, compiled.adf);
    return { ok: true, commentId, confidence: compiled.brief.confidence, fingerprint: compiled.brief.fingerprint };
  } catch (error) {
    return failure(error);
  }
}

export async function recordHandoff(
  issueKey: string,
  options: { to?: string; note?: string } = {},
): Promise<Record<string, unknown>> {
  try {
    const compiled = await compileBrief(assertIssueKey(issueKey));
    const brief = compiled.brief;
    const record: HandoffRecord = {
      id: `${brief.issueKey}:${brief.generatedAt}`,
      issueKey: brief.issueKey,
      issueSummary: brief.issueSummary,
      at: brief.generatedAt,
      from: undefined,
      to: options.to,
      confidence: brief.confidence,
      gaps: brief.coverage.filter((bucket) => !bucket.present).length,
      highRisks: brief.risks.filter((risk) => risk.severity === 'high').length,
      fingerprint: brief.fingerprint,
      note: options.note,
    };
    const records = await appendHandoff(record);
    return { ok: true, record, metrics: handoffMetrics(records) };
  } catch (error) {
    return failure(error);
  }
}

export async function getHandoffHealth(limit = 20): Promise<Record<string, unknown>> {
  try {
    const records = await readHandoffIndex();
    const metrics = handoffMetrics(records);
    return {
      ok: true,
      metrics,
      narrative: metricsNarrative(metrics),
      records: records.slice(0, Math.max(1, Math.min(50, limit))),
    };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Resolver entry point                                                */
/* ------------------------------------------------------------------ */

export async function handler(event: unknown, context?: unknown): Promise<Record<string, unknown>> {
  const { payload } = unpack(event, context);
  const action = readString(payload, 'action') ?? 'getBrief';

  switch (action) {
    case 'getBrief':
      return getBrief(readString(payload, 'issueKey') ?? '');
    case 'postBrief':
      return postBrief(readString(payload, 'issueKey') ?? '');
    case 'recordHandoff':
      return recordHandoff(readString(payload, 'issueKey') ?? '', {
        to: readString(payload, 'to'),
        note: readString(payload, 'note'),
      });
    case 'getHandoffHealth':
      return getHandoffHealth(Number(payload.limit ?? 20));
    default:
      return { ok: false, error: `Unknown action "${action}".` };
  }
}

/* ------------------------------------------------------------------ */
/* Rovo agent actions + MCP tools                                      */
/* ------------------------------------------------------------------ */

export async function handoffBriefAction(event: unknown, context?: unknown): Promise<Record<string, unknown>> {
  const { payload, context: ctx } = unpack(event, context);
  const issueKey = extractIssueKey(payload, ctx);
  if (!issueKey) {
    return {
      ok: false,
      error: 'Tell me the Jira issue key, for example PAY-412, or open the issue and ask again.',
    };
  }
  try {
    const compiled = await compileBrief(assertIssueKey(issueKey));
    return {
      ok: true,
      issueKey: compiled.brief.issueKey,
      confidence: compiled.brief.confidence,
      summary: compiled.brief.headline,
      risks: compiled.brief.risks.map((risk) => `${risk.severity}: ${risk.title}`),
      brief: compiled.text,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function handoffHealthAction(event: unknown, context?: unknown): Promise<Record<string, unknown>> {
  const { payload } = unpack(event, context);
  const inputs = (payload.inputs as Record<string, unknown>) ?? payload;
  const limit = Number(inputs.limit ?? 10) || 10;
  try {
    const records = await readHandoffIndex();
    const metrics = handoffMetrics(records);
    return {
      ok: true,
      narrative: metricsNarrative(metrics),
      metrics,
      worst: metrics.needsAttention.slice(0, Math.max(1, Math.min(10, limit))).map((record) => ({
        issueKey: record.issueKey,
        confidence: record.confidence,
        gaps: record.gaps,
        at: record.at,
      })),
    };
  } catch (error) {
    return failure(error);
  }
}
