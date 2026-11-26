import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ApplicationItem {
  id: string;
  company_name: string;
  job_title: string;
  applied_at: string;
  updated_at: string;
  status: string;
}

interface NeedsAttentionProps {
  staleApplications: ApplicationItem[];
}

export default function NeedsAttention({ staleApplications }: NeedsAttentionProps) {
  const navigate = useNavigate();

  if (!staleApplications || staleApplications.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 'var(--space-4) var(--space-5)',
          backgroundColor: 'var(--surface-primary)',
          borderColor: 'var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            All applications are active. Nothing requires immediate attention.
          </span>
        </div>
      </div>
    );
  }

  const count = staleApplications.length;

  return (
    <div className="needs-attention-banner">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <AlertTriangle size={18} style={{ color: 'var(--warning)', marginTop: 2, flexShrink: 0 }} />
        <div>
          <div className="needs-attention-title">Needs Attention</div>
          <div className="needs-attention-desc">
            {count} {count === 1 ? 'application has' : 'applications have'} not received an update in more than 7 days.
          </div>
        </div>
      </div>

      <button
        className="btn btn-secondary btn-sm"
        onClick={() => navigate('/applications?filter=stale')}
        style={{ whiteSpace: 'nowrap' }}
      >
        Review applications <ArrowRight size={14} />
      </button>
    </div>
  );
}
