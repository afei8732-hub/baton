import { useEffect, useState } from 'react';
import type { Brief } from '../../shared/types';
import { ConfidenceRing } from './ConfidenceRing';

interface ActionViewProps {
  issueKey: string;
  brief: Brief | null;
  posting: boolean;
  posted: string | null;
  error: string | null;
  onRun: () => void;
  onPost: () => void;
  loading: boolean;
}

const STEPS = ['Read the issue and its changelog', 'Searched Confluence for linked context', 'Checked for superseded decisions'];

export function ActionView({ issueKey, brief, posting, posted, error, onRun, onPost, loading }: ActionViewProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const timers = [setTimeout(() => setStep(1), 500), setTimeout(() => setStep(2), 1000)];
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  const topRisk = brief?.risks.find((risk) => risk.severity === 'high') ?? brief?.risks[0];

  return (
    <div className="action-view">
      <header className="action-head">
        <div className="action-mark" aria-hidden>
          <span />
          <span />
        </div>
        <div>
          <p className="eyebrow">Baton</p>
          <h1>Hand off {issueKey} without losing the plot</h1>
          <p className="action-lede">
            Baton reads the issue, its comments, its history and the pages that mention it, then tells the next owner what
            is load-bearing and what has changed.
          </p>
        </div>
      </header>

      {!brief && !loading && (
        <button className="primary wide" onClick={onRun}>
          Build handoff brief
        </button>
      )}

      {loading && (
        <ol className="steps">
          {STEPS.map((label, index) => (
            <li key={label} className={index < step ? 'done' : index === step ? 'active' : ''}>
              <span className="step-dot">{index < step ? '✓' : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      )}

      {error && <p className="notice bad">{error}</p>}

      {brief && (
        <div className="action-result">
          <div className="action-result-top">
            <ConfidenceRing value={brief.confidence} label={brief.confidenceLabel} size={104} />
            <div>
              <p className="action-headline">{brief.headline}</p>
              <p className="action-stats">
                {brief.stats.signals} signals · {brief.stats.sources} sources · {brief.stats.people} people · fingerprint{' '}
                {brief.fingerprint}
              </p>
            </div>
          </div>

          {topRisk && (
            <div className="action-risk">
              <span className={`risk-badge risk-${topRisk.severity === 'high' ? 'bad' : 'warn'}`}>
                {topRisk.severity} risk
              </span>
              <p className="risk-title">{topRisk.title}</p>
              <p className="risk-detail">{topRisk.detail}</p>
            </div>
          )}

          <ul className="mini-signals">
            {brief.signals
              .filter((signal) => signal.relevance >= 0.1)
              .slice(0, 3)
              .map((signal) => (
                <li key={signal.id}>
                  <span className={`chip chip-${signal.kind}`}>{signal.kind}</span>
                  <span>{signal.title}</span>
                </li>
              ))}
          </ul>

          <div className="action-buttons">
            <button className="primary" onClick={onPost} disabled={posting || Boolean(posted)}>
              {posted ? 'Comment posted' : posting ? 'Posting…' : 'Post as Jira comment'}
            </button>
            <button className="secondary" onClick={onRun} disabled={loading}>
              Rebuild
            </button>
          </div>
          <p className="action-footnote">
            Nothing leaves your Atlassian cloud. Baton runs entirely on Forge and stores only brief fingerprints.
          </p>
        </div>
      )}
    </div>
  );
}
