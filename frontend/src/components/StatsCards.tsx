import { type Stats } from '../api/client';
import { RESPONSE_META } from '../responses';

interface Props {
  stats: Stats;
}

export default function StatsCards({ stats }: Props) {
  const awaitingResponse = stats.activeCount;
  const totalResponses = stats.total - (stats.responsesByType?.none ?? stats.total);

  return (
    <div className="metrics-row">
      {/* Hero Metric 1: Total Applications */}
      <div className="hero-metric-card" id="stat-hero-applications">
        <div>
          <div className="hero-metric-label">Applications</div>
          <div className="hero-metric-value">{stats.total}</div>
        </div>
        <div className="hero-metric-sub">
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>+{stats.thisWeek}</span> this week
        </div>
      </div>

      {/* Hero Metric 2: Active Pipeline */}
      <div className="hero-metric-card" id="stat-hero-active">
        <div>
          <div className="hero-metric-label">Active Pipeline</div>
          <div className="hero-metric-value">{stats.activeCount}</div>
        </div>
        <div className="hero-metric-sub">
          {awaitingResponse} awaiting response
        </div>
      </div>

      {/* Secondary & Analytical Panel */}
      <div className="secondary-metrics-panel" id="stat-secondary-panel">
        <div className="text-caption" style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>
          Company responses
        </div>
        {(['accepted', 'interview', 'moved_forward', 'rejected', 'none'] as const).map((key) => (
          <div key={key} className="secondary-metric-row">
            <span className="secondary-metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="status-dot" style={{ backgroundColor: RESPONSE_META[key].color }} />
              {RESPONSE_META[key].label}
            </span>
            <span className="secondary-metric-val">{stats.responsesByType?.[key] ?? 0}</span>
          </div>
        ))}
        <div
          style={{
            marginTop: 'var(--space-1)',
            paddingTop: 'var(--space-2)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
            Response rate
          </span>
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
            {stats.responseRate}%{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>
              ({totalResponses}/{stats.total} · avg {stats.avgDaysToResponse}d)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
