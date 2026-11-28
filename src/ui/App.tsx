import { useCallback, useEffect, useState } from 'react';
import { fetchBrief, fetchHealth, postBrief, recordHandoff, resolveContext, type BriefPayload, type HealthPayload, type ModuleContext } from './api';
import { BriefView } from './components/BriefView';
import { HealthView } from './components/HealthView';
import { ActionView } from './components/ActionView';

type Phase = 'loading' | 'ready' | 'error';

export function App() {
  const [context, setContext] = useState<ModuleContext | null>(null);
  const [brief, setBrief] = useState<BriefPayload | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);

  const load = useCallback(async (ctx: ModuleContext) => {
    setPhase('loading');
    setError(null);
    try {
      if (ctx.moduleKey.includes('health')) {
        setHealth(await fetchHealth());
      } else if (ctx.issueKey) {
        setBrief(await fetchBrief(ctx.issueKey));
      } else {
        setError('Open Baton from a Jira issue, or ask the Rovo agent for a brief.');
        setPhase('error');
        return;
      }
      setPhase('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Baton could not load this context.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    resolveContext().then((ctx) => {
      if (cancelled) return;
      setContext(ctx);
      void load(ctx);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handlePost = async () => {
    if (!context?.issueKey) return;
    setPosting(true);
    try {
      const result = await postBrief(context.issueKey);
      setPosted(result.commentId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post the brief.');
    } finally {
      setPosting(false);
    }
  };

  const handleRecord = async () => {
    if (!context?.issueKey) return;
    try {
      await recordHandoff(context.issueKey);
      setRecorded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record the handoff.');
    }
  };

  const moduleKey = context?.moduleKey ?? '';
  const isHealth = moduleKey.includes('health');
  const isAction = moduleKey.includes('action');

  return (
    <div className={`app ${isAction ? 'app-action' : ''}`}>
      <div className="topbar">
        <span className="brand">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <rect x="1" y="6" width="3" height="9" rx="1.2" fill="currentColor" opacity="0.45" />
            <rect x="6.5" y="3" width="3" height="12" rx="1.2" fill="currentColor" opacity="0.75" />
            <rect x="12" y="1" width="3" height="14" rx="1.2" fill="currentColor" />
          </svg>
          Baton
        </span>
        <span className="topbar-context">
          {context?.issueKey ? context.issueKey : isHealth ? 'Portfolio view' : 'Jira issue'}
        </span>
        <span className="egress" title="Baton makes no calls outside your Atlassian cloud">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M6 1l4 1.6v3.1c0 2.4-1.7 4.3-4 5-2.3-.7-4-2.6-4-5V2.6L6 1z" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 5.8l1.4 1.4L8.2 4.4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          No external egress
        </span>
      </div>

      <main className="content">
        {phase === 'loading' && (
          <div className="skeleton" aria-busy="true">
            <div className="skeleton skeleton-hero" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
            <div className="skeleton-grid">
              <div className="skeleton skeleton-block" />
              <div className="skeleton skeleton-block" />
            </div>
            <p className="skeleton-note">
              {isHealth ? 'Reading recorded handoffs…' : 'Reading issue, comments, history and linked pages…'}
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="error-card">
            <h1>No brief yet</h1>
            <p>{error}</p>
            {context && (
              <button className="secondary" onClick={() => void load(context)}>
                Try again
              </button>
            )}
          </div>
        )}

        {phase === 'ready' && isHealth && health && <HealthView data={health} />}

        {phase === 'ready' && !isHealth && isAction && context && (
          <ActionView
            issueKey={context.issueKey ?? 'issue'}
            brief={brief?.brief ?? null}
            loading={false}
            error={error}
            posting={posting}
            posted={posted}
            onRun={() => void load(context)}
            onPost={handlePost}
          />
        )}

        {phase === 'ready' && !isHealth && !isAction && brief && (
          <BriefView
            brief={brief.brief}
            docsUnavailable={brief.docsUnavailable}
            posting={posting}
            posted={posted}
            recorded={recorded}
            onPost={handlePost}
            onRecord={handleRecord}
          />
        )}
      </main>
    </div>
  );
}
