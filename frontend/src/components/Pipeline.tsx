interface PipelineProps {
  byStatus: Record<string, number>;
  total: number;
}

const STAGES = [
  { key: 'applied', label: 'Applied', color: 'var(--status-applied)' },
  { key: 'screening', label: 'Screening', color: 'var(--status-screening)' },
  { key: 'interview', label: 'Interview', color: 'var(--status-interview)' },
  { key: 'offer', label: 'Offer', color: 'var(--status-offer)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--status-rejected)' },
];

export default function Pipeline({ byStatus, total }: PipelineProps) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Application Pipeline</span>
        <span className="text-caption font-mono" style={{ color: 'var(--text-muted)' }}>
          {total} tracked
        </span>
      </div>

      <div className="card-body">
        <div className="pipeline-container">
          {STAGES.map((stage) => {
            const count = byStatus[stage.key] || 0;
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

            return (
              <div key={stage.key} className="pipeline-item">
                <div className="pipeline-item-info">
                  <span className="status-dot" style={{ backgroundColor: stage.color }} />
                  <span className="text-small" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {stage.label}
                  </span>
                </div>

                <div className="pipeline-bar-bg">
                  <div
                    className="pipeline-bar-fill"
                    style={{
                      width: `${Math.max(percentage, count > 0 ? 4 : 0)}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </div>

                <div className="pipeline-item-count">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
