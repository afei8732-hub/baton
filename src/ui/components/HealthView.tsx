import type { HealthPayload } from '../api';

interface HealthViewProps {
  data: HealthPayload;
}

function tone(value: number): string {
  return value >= 75 ? 'strong' : value >= 60 ? 'workable' : 'thin';
}

export function HealthView({ data }: HealthViewProps) {
  const { metrics, narrative, records } = data;
  const max = Math.max(100, ...metrics.trend.map((point) => point.confidence));

  return (
    <div className="health">
      <header className="health-head">
        <div>
          <p className="eyebrow">Team signal</p>
          <h1>Handoff health</h1>
          <p className="health-narrative">{narrative}</p>
        </div>
        <div className="health-score ring-strong">
          <span className="health-score-number">{metrics.avgConfidence}</span>
          <span className="health-score-label">avg confidence</span>
        </div>
      </header>

      <section className="kpis">
        <div className="kpi">
          <span className="kpi-value">{metrics.total}</span>
          <span className="kpi-label">handoffs recorded</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{metrics.belowSixty}</span>
          <span className="kpi-label">went out below 60%</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{metrics.highRiskHandoffs}</span>
          <span className="kpi-label">with a high-severity gap</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{metrics.totalGaps}</span>
          <span className="kpi-label">context gaps carried over</span>
        </div>
      </section>

      <div className="health-columns">
        <section className="panel">
          <h2>Confidence per week</h2>
          <div className="chart" role="img" aria-label="Average handoff confidence per week">
            {metrics.trend.map((point) => (
              <div className="chart-col" key={point.label}>
                <span className="chart-value">{point.confidence}</span>
                <div className={`chart-bar bar-${tone(point.confidence)}`} style={{ height: `${(point.confidence / max) * 100}%` }} />
                <span className="chart-label">{point.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Needs attention</h2>
          {metrics.needsAttention.length === 0 && <p className="empty">Every recent handoff is above the bar.</p>}
          <ul className="attention">
            {metrics.needsAttention.map((record) => (
              <li key={record.id}>
                <div className="attention-top">
                  <span className="attention-key">{record.issueKey}</span>
                  <span className={`pill pill-${tone(record.confidence)}`}>{record.confidence}%</span>
                </div>
                <p className="attention-summary">{record.issueSummary}</p>
                <p className="attention-meta">
                  {record.from ?? 'Unknown'} → {record.to ?? 'unassigned'} · {record.gaps} gaps ·{' '}
                  {record.highRisks} high risk
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2>Recent handoffs</h2>
        <table className="records">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Handed to</th>
              <th>When</th>
              <th className="num">Confidence</th>
              <th className="num">Gaps</th>
            </tr>
          </thead>
          <tbody>
            {records.slice(0, 10).map((record) => (
              <tr key={record.id}>
                <td>
                  <span className="record-key">{record.issueKey}</span>
                  <span className="record-summary">{record.issueSummary}</span>
                </td>
                <td>{record.to ?? '—'}</td>
                <td className="mono">{record.at.slice(0, 10)}</td>
                <td className="num">
                  <span className={`pill pill-${tone(record.confidence)}`}>{record.confidence}%</span>
                </td>
                <td className="num">{record.gaps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
