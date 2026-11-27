/**
 * Handoff health metrics. Pure functions over stored handoff records so the
 * dashboard can be unit tested and rendered identically in the local preview.
 */
import type { HandoffRecord } from './types';

export interface HandoffMetrics {
  total: number;
  avgConfidence: number;
  belowSixty: number;
  totalGaps: number;
  highRiskHandoffs: number;
  /** Oldest to newest, weekly buckets of average confidence. */
  trend: { label: string; confidence: number; count: number }[];
  needsAttention: HandoffRecord[];
}

export function handoffMetrics(records: HandoffRecord[], now: Date = new Date()): HandoffMetrics {
  const sorted = [...records].sort((a, b) => a.at.localeCompare(b.at));
  const total = sorted.length;
  const avgConfidence = total
    ? Math.round(sorted.reduce((sum, r) => sum + r.confidence, 0) / total)
    : 0;
  const belowSixty = sorted.filter((r) => r.confidence < 60).length;
  const totalGaps = sorted.reduce((sum, r) => sum + r.gaps, 0);
  const highRiskHandoffs = sorted.filter((r) => r.highRisks > 0).length;

  const weeks = new Map<string, { sum: number; count: number }>();
  for (const record of sorted) {
    const date = new Date(record.at);
    if (Number.isNaN(date.getTime())) continue;
    const weekStart = new Date(date);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    const key = weekStart.toISOString().slice(0, 10);
    const bucket = weeks.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += record.confidence;
    bucket.count += 1;
    weeks.set(key, bucket);
  }

  const trend = [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, bucket]) => ({
      label: key.slice(5),
      confidence: Math.round(bucket.sum / bucket.count),
      count: bucket.count,
    }));

  const needsAttention = [...sorted]
    .filter((record) => record.confidence < 70 || record.highRisks > 0)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 5);

  return {
    total,
    avgConfidence,
    belowSixty,
    totalGaps,
    highRiskHandoffs,
    trend,
    needsAttention,
  };
}

export function metricsNarrative(metrics: HandoffMetrics): string {
  if (metrics.total === 0) {
    return 'No handoffs recorded yet. Post a brief from a Jira issue to start measuring handoff quality.';
  }
  const risk = metrics.belowSixty;
  const trend = metrics.trend;
  const direction =
    trend.length >= 2
      ? trend[trend.length - 1].confidence - trend[0].confidence >= 0
        ? 'improving'
        : 'slipping'
      : 'not enough weeks to trend yet';
  return `${metrics.total} handoffs recorded, average confidence ${metrics.avgConfidence}%. ${risk} of them went out below 60%, and ${metrics.highRiskHandoffs} carried a high-severity gap. Confidence is ${direction}.`;
}
