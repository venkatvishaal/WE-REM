import { useState, useEffect } from 'react';
import { ExternalLink, X, Trash2, Plus, Edit2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api, type Application, type TimelineEvent } from '../api/client';
import Timeline from './Timeline';
import { RESPONSE_META } from '../responses';

interface Props {
  application: Application;
  onClose: () => void;
  onUpdate: (app: Application) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS = [
  'applied', 'screening', 'interview', 'assessment', 'offer', 'rejected', 'withdrawn',
];

function DetailRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          color: 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          fontWeight: mono ? 500 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

export default function ApplicationDetail({ application, onClose, onUpdate, onDelete }: Props) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState(application.status);
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.applications.timeline(application.id)
      .then(setTimeline)
      .finally(() => setLoadingTimeline(false));
  }, [application.id]);

  const handleSaveStatus = async () => {
    setSaving(true);
    try {
      const updated = await api.applications.update(application.id, { status: editStatus });
      onUpdate(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setAddingNote(true);
    try {
      const event = await api.applications.addNote(application.id, noteContent);
      setTimeline([...timeline, event]);
      setNoteContent('');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${application.company_name} — ${application.job_title}"?`)) return;
    setDeleting(true);
    try {
      await api.applications.delete(application.id);
      onDelete(application.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          borderRadius: 'var(--radius-dialog)',
          boxShadow: 'var(--shadow-floating)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="card-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
              <span className="status-badge">
                <span className={`status-dot ${application.status}`} />
                <span style={{ textTransform: 'capitalize' }}>{application.status.replace('_', ' ')}</span>
              </span>
            </div>
            <h2 className="h2">{application.company_name}</h2>
            <div className="text-body" style={{ color: 'var(--text-secondary)' }}>
              {application.job_title}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {application.portal_url && (
              <a
                href={application.portal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={14} /> Portal
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-4)',
              background: 'var(--surface-secondary)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <DetailRow label="Applied Date" value={formatDate(application.applied_at)} />
            <DetailRow label="Last Activity" value={formatDate(application.last_activity_at)} />
            <DetailRow label="Requisition ID" value={application.requisition_id} mono />
            <DetailRow label="Portal Tenant" value={application.portal_tenant} mono />
            <DetailRow label="Location" value={application.location} />
            <DetailRow label="Salary Range" value={application.salary_range} />
          </div>

          {/* Edit Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>
              Status Transition
            </span>

            {editing ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <select className="select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleSaveStatus} disabled={saving}>
                  <Check size={14} />
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                <Edit2 size={14} /> Change Status
              </button>
            )}
          </div>

          {/* Add Note */}
          <div>
            <span className="text-caption" style={{ display: 'block', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
              Notes & Follow-ups
            </span>
            {application.notes && (
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', whiteSpace: 'pre-wrap' }}>
                {application.notes}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="text"
                className="input"
                placeholder="Add a quick note or update..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleAddNote}
                disabled={addingNote || !noteContent.trim()}
              >
                <Plus size={14} /> Note
              </button>
            </div>
          </div>

          {/* Activity Timeline */}
          <div>
            <div className="card-header" style={{ paddingInline: 0, paddingTop: 0, marginBottom: 'var(--space-3)' }}>
              <span className="card-title">Activity History</span>
              <span className="text-caption font-mono" style={{ color: 'var(--text-muted)' }}>
                {timeline.length} events
              </span>
            </div>

            {loadingTimeline ? (
              <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
                Loading activity history…
              </div>
            ) : (
              <>
                <div className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                  Applied {formatDate(application.applied_at)}
                  {application.first_response_at
                    ? ` → first reply in ${application.days_to_first_response ?? 0} days → latest: ${
                        RESPONSE_META[application.last_response_type || 'none'].label
                      } (${formatDate(application.last_response_at || undefined)})`
                    : ' → no reply from the company yet'}
                </div>
                <Timeline events={timeline} appliedAt={application.applied_at} />
              </>
            )}
          </div>

          {/* Delete Action */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={14} /> Delete Application
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
