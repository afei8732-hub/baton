/**
 * The single entry point shared by the Forge resolvers, the Rovo action and
 * the local preview: snapshot in, brief out. Pure and deterministic.
 */
import type { Brief, WorkspaceSnapshot } from './types';
import { extractSignals, needText, participants } from './extract';
import { rankSignals } from './rank';
import { buildBrief } from './analyze';
import { humanDays } from './text';

export function buildFromSnapshot(
  snapshot: WorkspaceSnapshot,
  now: Date = new Date(),
): Brief {
  const { issue, docs, previousFingerprints } = snapshot;
  const signals = extractSignals(issue, docs, now);
  const ranked = rankSignals(signals, needText(issue), {
    now,
    assignee: issue.assignee,
    labels: issue.labels,
    issueKey: issue.key,
  });

  return buildBrief({
    issue,
    signals: ranked,
    people: participants(issue),
    now,
    previous: previousFingerprints?.[0],
  });
}

/** Plain text version, used by "copy brief" and by the Rovo action output. */
export function renderText(brief: Brief, options: { maxSignals?: number } = {}): string {
  const max = options.maxSignals ?? 5;
  const lines: string[] = [];
  lines.push(`BATON BRIEF - ${brief.issueKey} ${brief.issueSummary}`);
  lines.push(
    `Confidence ${brief.confidence}% (${brief.confidenceLabel}) - generated ${brief.generatedAt.slice(0, 16).replace('T', ' ')}Z`,
  );
  lines.push('');
  lines.push(`HEADLINE: ${brief.headline}`);
  lines.push('');
  lines.push('LOAD-BEARING CONTEXT');
  for (const signal of brief.signals.filter((s) => s.relevance >= 0.1).slice(0, max)) {
    const age = signal.ageDays === null ? 'undated' : humanDays(signal.ageDays);
    lines.push(
      `- [${signal.kind}] ${signal.title} (${signal.source}, ${age}${signal.author ? `, ${signal.author}` : ''})`,
    );
    lines.push(`  ${signal.excerpt}`);
  }
  if (brief.risks.length > 0) {
    lines.push('');
    lines.push('RISKS');
    for (const risk of brief.risks) {
      lines.push(`- (${risk.severity}) ${risk.title}`);
      lines.push(`  ${risk.detail}`);
    }
  }
  lines.push('');
  lines.push('NEXT');
  brief.nextActions.forEach((action) => lines.push(`- ${action}`));
  return lines.join('\n');
}

/** Markdown, used for the "posted brief" preview and for docs. */
export function renderMarkdown(brief: Brief): string {
  const rows = brief.coverage
    .map((c) => `| ${c.present ? 'yes' : 'no'} | ${c.label} | ${c.note} |`)
    .join('\n');
  const signals = brief.signals
    .filter((s) => s.relevance >= 0.1)
    .slice(0, 6)
    .map((s) => {
      const age = s.ageDays === null ? 'undated' : humanDays(s.ageDays);
      return `- **${s.title}** - ${s.source}, ${age}${s.author ? `, ${s.author}` : ''}\n  ${s.excerpt}\n  _why: ${s.why}_`;
    })
    .join('\n');
  return [
    `### Baton handoff brief`,
    `${brief.headline}`,
    ``,
    `**Confidence ${brief.confidence}% (${brief.confidenceLabel})** - ${brief.stats.signals} signals from ${brief.stats.sources} sources, ${brief.stats.people} people.`,
    ``,
    `#### Load-bearing context`,
    signals,
    ``,
    `#### Coverage`,
    `| present | bucket | note |`,
    `| --- | --- | --- |`,
    rows,
    ``,
    brief.risks.length ? `#### Risks` : `#### Risks\nNone detected.`,
    brief.risks.map((r) => `- **${r.title}** (${r.severity})\n  ${r.detail}`).join('\n'),
    ``,
    `#### Next`,
    brief.nextActions.map((a) => `- ${a}`).join('\n'),
  ].join('\n');
}
