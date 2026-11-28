import { useState } from 'react';
import type { Brief, RankedSignal, Risk } from '../../shared/types';
import { ConfidenceRing } from './ConfidenceRing';

const KIND_LABEL: Record<RankedSignal['kind'], string> = {
  decision: 'Decision',
  spec: 'Spec',
  incident: 'Incident',
  discussion: 'Discussion',
  change: 'Change',
  person: 'Person',
};

const RISK_LABEL: Record<Risk['type'], string> = {
  contradiction: 'Superseded',
  stale: 'Stale',
  'single-source': 'Single source',
  'missing-decision': 'No decision',
  drift: 'Drift',
};

function relativeAge(days: number | null): string {
  if (days === null) return 'undated';
  if (days <= 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function riskTone(severity: Risk['severity']): string {
  return severity === 'high' ? 'bad' : severity === 'medium' ? 'warn' : 'muted';
}

interface BriefViewProps {
  brief: Brief;
  docsUnavailable: boolean;
  posting: boolean;
  posted: string | null;
  recorded: boolean;
  onPost: () => void;
  onRecord: () => void;
  compact?: boolean;
}

export function BriefView({
  brief,
  docsUnavailable,
  posting,
  posted,
  recorded,
  onPost,
  onRecord,
  compact = false,
}: BriefViewProps) {
  const [expanded, setExpanded] = useState<string | null>(brief.signals[0]?.id ?? null);
  const topSignals = brief.signals.filter((signal) => signal.relevance >= 0.1).slice(0, compact ? 3 : 6);
  const missing = brief.coverage.filter((bucket) => !bucket.present);

  return (
    <div className={`brief ${compact ? 'brief-compact' : ''}`}>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Handoff brief</p>
          <h1>{brief.headline}</h1>
          <p className="issue-line">
            <span className="issue-key">{brief.issueKey}</span>
            <span className="issue-summary">{brief.issueSummary}</span>
          </p>
          <div className="stat-row">
            <span>
              <strong>{brief.stats.signals}</strong> signals
            </span>
            <span>
              <strong>{brief.stats.sources}</strong> sources
            </span>
            <span>
              <strong>{brief.stats.people}</strong> people
            </span>
            <span className="muted">fingerprint {brief.fingerprint}</span>
          </div>
        </div>
        <ConfidenceRing value={brief.confidence} label={brief.confidenceLabel} size={compact ? 112 : 136} />
      </section>

      {docsUnavailable && (
        <p className="notice">
          Confluence search was unavailable, so this brief only reflects Jira. Confidence is capped accordingly.
        </p>
      )}

      <div className="columns">
        <section className="panel">
          <h2>
            Load-bearing context <span className="count">{topSignals.length}</span>
          </h2>
          <ol className="signals">
            {topSignals.map((signal, index) => {
              const open = expanded === signal.id;
              return (
                <li key={signal.id} className={`signal signal-${signal.kind}`}>
                  <button
                    className="signal-head"
                    onClick={() => setExpanded(open ? null : signal.id)}
                    aria-expanded={open}
                  >
                    <span className="signal-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="signal-main">
                      <span className="signal-title">{signal.title}</span>
                      <span className="signal-meta">
                        <span className={`chip chip-${signal.kind}`}>{KIND_LABEL[signal.kind]}</span>
                        <span>{signal.author ?? 'Unknown author'}</span>
                        <span className="dot" />
                        <span>{signal.source}</span>
                        <span className="dot" />
                        <span>{relativeAge(signal.ageDays)}</span>
                      </span>
                    </span>
                    <span className="signal-score" title="Ranking score">
                      {Math.round(signal.score)}
                    </span>
                  </button>
                  <p className="signal-excerpt">{signal.excerpt}</p>
                  <div className={`signal-why ${open ? 'open' : ''}`}>
                    <span className="why-label">Why it ranks here</span>
                    <span>{signal.why}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="side">
          <section className="panel">
            <h2>
              Gaps <span className="count">{brief.risks.length}</span>
            </h2>
            {brief.risks.length === 0 && <p className="empty">Nothing contradictory or stale in this context.</p>}
            <ul className="risks">
              {brief.risks.map((risk) => (
                <li key={risk.id} className={`hazard hazard-${riskTone(risk.severity)}`}>
                  <div className="hazard-top">
                    <span className={`hazard-badge hazard-${riskTone(risk.severity)}`}>
                      {RISK_LABEL[risk.type]} · {risk.severity}
                    </span>
                  </div>
                  <p className="hazard-title">{risk.title}</p>
                  <p className="hazard-detail">{risk.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Coverage</h2>
            <ul className="coverage">
              {brief.coverage.map((bucket) => (
                <li key={bucket.key} className={bucket.present ? 'have' : 'miss'}>
                  <span className="tick" aria-hidden>
                    {bucket.present ? '✓' : '!'}
                  </span>
                  <span className="coverage-body">
                    <span className="coverage-label">{bucket.label}</span>
                    <span className="coverage-note">{bucket.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <section className="panel next">
        <h2>What to do next</h2>
        <ol>
          {brief.nextActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
        {missing.length > 0 && (
          <p className="next-note">
            Missing {missing.map((bucket) => bucket.label.toLowerCase()).join(', ')}. Baton will keep flagging this brief
            until it is filled in.
          </p>
        )}
      </section>

      <footer className="brief-actions">
        <button className="primary" onClick={onPost} disabled={posting || Boolean(posted)}>
          {posted ? 'Posted to Jira' : posting ? 'Posting…' : 'Post brief as comment'}
        </button>
        <button className="secondary" onClick={onRecord} disabled={recorded}>
          {recorded ? 'Handoff recorded' : 'Record handoff'}
        </button>
        <span className="stamp">Generated {brief.generatedAt.slice(0, 16).replace('T', ' ')}Z</span>
      </footer>
    </div>
  );
}
