/**
 * One data layer for both worlds:
 *  - inside Forge it calls the resolver through @forge/bridge;
 *  - in the local preview it runs the exact same engine over recorded
 *    snapshots, so screenshots show real output rather than mock-ups.
 */
import type { Brief, HandoffRecord, WorkspaceSnapshot } from '../shared/types';
import { buildFromSnapshot } from '../shared/brief';
import { handoffMetrics, metricsNarrative, type HandoffMetrics } from '../shared/metrics';
import { DEMO_NOW, demoHandoffs, primaryWorkspace, thinWorkspace } from '../shared/fixtures';

export type PreviewView = 'panel' | 'action' | 'health';

export interface BriefPayload {
  brief: Brief;
  markdown: string;
  docsUnavailable: boolean;
  issueHandoffs: HandoffRecord[];
}

export interface HealthPayload {
  metrics: HandoffMetrics;
  narrative: string;
  records: HandoffRecord[];
}

export interface PreviewQuery {
  view: PreviewView;
  issueKey: string;
}

export function readPreviewQuery(): PreviewQuery {
  if (typeof window === 'undefined') return { view: 'panel', issueKey: 'PAY-412' };
  const params = new URLSearchParams(window.location.search);
  const view = (params.get('view') as PreviewView) ?? 'panel';
  const issueKey = params.get('issue') ?? 'PAY-412';
  return {
    view: ['panel', 'action', 'health'].includes(view) ? view : 'panel',
    issueKey: issueKey.toUpperCase(),
  };
}

export const isPreview = (): boolean =>
  typeof window !== 'undefined' && Boolean((window as unknown as { __BATON_PREVIEW__?: boolean }).__BATON_PREVIEW__);

function previewSnapshot(issueKey: string): WorkspaceSnapshot {
  const snapshot = issueKey === 'PAY-457' ? thinWorkspace : primaryWorkspace;
  return { ...snapshot, issue: { ...snapshot.issue } };
}

function previewBrief(issueKey: string): BriefPayload {
  const snapshot = previewSnapshot(issueKey);
  const brief = buildFromSnapshot(snapshot, new Date(DEMO_NOW));
  return {
    brief,
    markdown: '',
    docsUnavailable: false,
    issueHandoffs: demoHandoffs.filter((record) => record.issueKey === issueKey),
  };
}

type Bridge = typeof import('@forge/bridge');

let bridge: Promise<Bridge> | null = null;

/**
 * The bridge is imported lazily: loading it outside an Atlassian iframe throws,
 * and the preview harness has to run in a plain browser tab.
 */
function getBridge(): Promise<Bridge> {
  bridge ??= import('@forge/bridge');
  return bridge;
}

async function run<T>(payload: Record<string, unknown>): Promise<T> {
  const { invoke } = await getBridge();
  const response = (await invoke('resolver', payload)) as { ok?: boolean; error?: string } & T;
  if (response && response.ok === false) {
    throw new Error(response.error ?? 'Baton could not build this brief.');
  }
  return response;
}

export async function fetchBrief(issueKey: string): Promise<BriefPayload> {
  if (isPreview()) return previewBrief(issueKey);
  return run<BriefPayload>({ action: 'getBrief', issueKey });
}

export async function postBrief(issueKey: string): Promise<{ commentId: string }> {
  if (isPreview()) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { commentId: 'preview' };
  }
  return run<{ commentId: string }>({ action: 'postBrief', issueKey });
}

export async function recordHandoff(
  issueKey: string,
  to?: string,
): Promise<{ metrics: HandoffMetrics }> {
  if (isPreview()) {
    return { metrics: handoffMetrics(demoHandoffs) };
  }
  return run<{ metrics: HandoffMetrics }>({ action: 'recordHandoff', issueKey, to });
}

export async function fetchHealth(): Promise<HealthPayload> {
  if (isPreview()) {
    const records = demoHandoffs;
    const metrics = handoffMetrics(records, new Date(DEMO_NOW));
    return { metrics, narrative: metricsNarrative(metrics), records };
  }
  return run<HealthPayload>({ action: 'getHandoffHealth', limit: 20 });
}

export interface ModuleContext {
  moduleKey: string;
  issueKey?: string;
}

export async function resolveContext(): Promise<ModuleContext> {
  if (isPreview()) {
    const query = readPreviewQuery();
    return { moduleKey: `baton-${query.view}`, issueKey: query.issueKey };
  }
  const { view } = await getBridge();
  const context = (await view.getContext()) as {
    moduleKey?: string;
    extension?: { key?: string };
    issue?: { key?: string };
  };
  const extension = context.extension as { key?: string; issue?: { key?: string } } | undefined;
  return {
    moduleKey: context.moduleKey ?? extension?.key ?? 'baton-issue-panel',
    issueKey: extension?.issue?.key ?? (context as { issue?: { key?: string } }).issue?.key,
  };
}
