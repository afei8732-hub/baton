/**
 * Forge storage: the only place Baton keeps state.
 *
 * Nothing here is derived from data outside the Atlassian cloud, which is what
 * keeps the app "Runs on Atlassian" clean and makes the demo reproducible.
 */
import { kvs } from '@forge/kvs';
import type { HandoffRecord } from '../shared/types';

const INDEX_KEY = 'baton:handoff-index';
const MAX_INDEX = 60;

export function stateKey(issueKey: string): string {
  return `baton:brief-state:${issueKey}`;
}

export function handoffKey(issueKey: string): string {
  return `baton:handoffs:${issueKey}`;
}

export interface BriefState {
  fingerprint: string;
  confidence: number;
  at: string;
  topSignalIds: string[];
}

export async function readBriefState(issueKey: string): Promise<BriefState | undefined> {
  try {
    return await kvs.get<BriefState>(stateKey(issueKey));
  } catch {
    return undefined;
  }
}

export async function writeBriefState(issueKey: string, state: BriefState): Promise<void> {
  try {
    await kvs.set(stateKey(issueKey), state);
  } catch {
    // Storage is best-effort here: a brief is still useful without history.
  }
}

export async function readHandoffIndex(): Promise<HandoffRecord[]> {
  try {
    const records = await kvs.get<HandoffRecord[]>(INDEX_KEY);
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export async function appendHandoff(record: HandoffRecord): Promise<HandoffRecord[]> {
  const existing = await readHandoffIndex();
  const next = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, MAX_INDEX);
  try {
    await kvs.set(INDEX_KEY, next);
  } catch {
    // Keep the response useful even if persistence fails.
  }
  return next;
}

export async function readIssueHandoffs(issueKey: string): Promise<HandoffRecord[]> {
  const all = await readHandoffIndex();
  return all.filter((record) => record.issueKey === issueKey);
}
