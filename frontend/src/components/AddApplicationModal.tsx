import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { api } from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddApplicationModal({ isOpen, onClose, onSuccess }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [status, setStatus] = useState('applied');
  const [requisitionId, setRequisitionId] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !jobTitle.trim()) {
      setError('Company name and job title are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.applications.create({
        company_name: companyName.trim(),
        job_title: jobTitle.trim(),
        status,
        requisition_id: requisitionId.trim() || undefined,
        location: location.trim() || undefined,
        applied_at: new Date().toISOString(),
      });
      setSubmitting(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setSubmitting(false);
      setError(err.message || 'Failed to create application.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          borderRadius: 'var(--radius-dialog)',
          boxShadow: 'var(--shadow-floating)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header">
          <span className="card-title">Add Application</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {error && (
              <div style={{ color: 'var(--error)', fontSize: 13, background: 'var(--error-soft)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-control)' }}>
                {error}
              </div>
            )}

            <div>
              <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                Company Name *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Accenture, Microsoft"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                Job Title *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Software Engineer, Product Analyst"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                  Status
                </label>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="applied">Applied</option>
                  <option value="screening">Screening</option>
                  <option value="interview">Interview</option>
                  <option value="assessment">Assessment</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                  Req ID (Optional)
                </label>
                <input
                  type="text"
                  className="input font-mono"
                  placeholder="e.g. R-10923"
                  value={requisitionId}
                  onChange={(e) => setRequisitionId(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                Location (Optional)
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. New York, NY / Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div
            className="card-header"
            style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: 'none', justifyContent: 'flex-end' }}
          >
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving...' : <><Check size={14} /> Save Application</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
