import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { api, type Application } from '../api/client';
import { RESPONSE_META } from '../responses';
import ApplicationDetail from './ApplicationDetail';
import AddApplicationModal from './AddApplicationModal';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'interviewed', label: 'Had an interview' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'position_filled', label: 'Position filled' },
];

const STATUS_DOT_CLASSES: Record<string, string> = {
  applied: 'applied',
  screening: 'screening',
  interview: 'interview',
  assessment: 'screening',
  offer: 'offer',
  rejected: 'rejected',
};

const days = (n?: number | null) => `${n ?? 0} day${n === 1 ? '' : 's'}`;

function formatAgo(iso?: string) {
  if (!iso) return '—';
  try {
    return `${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return iso;
  }
}

export default function ApplicationList() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('last_activity_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {
      page: String(page),
      limit: '25',
      sort: sortField,
      order: sortOrder,
    };
    if (search) params.search = search;
    if (statusFilter !== 'all') params.status = statusFilter;

    try {
      const res = await api.applications.list(params);
      setApps(res.data);
      setPagination({ total: res.pagination.total, pages: res.pagination.pages });
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortOrder, search, statusFilter]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const selectedApp = apps.find((a) => a.id === selectedId) || null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Applications</h1>
          <p className="page-subtitle">{pagination.total} total job applications tracked</p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={14} />
          <span>Add application</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="card-body-sm" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter by company, role, requisition ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 14 }}
              />
            </div>
          </div>

          <select
            className="select"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button className="btn btn-ghost btn-sm" onClick={fetchApps} title="Refresh application list">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <span className="text-body" style={{ color: 'var(--text-muted)' }}>
              Loading applications…
            </span>
          </div>
        ) : apps.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No applications found</div>
            <div className="empty-desc">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Applications you add or sync from Gmail will appear here.'}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={14} /> Add application
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="app-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('company_name')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Company</span>
                      {sortField === 'company_name' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th>Role</th>
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Status</span>
                      {sortField === 'status' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('last_response_at')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Response</span>
                      {sortField === 'last_response_at' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('interview_at')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Interview</span>
                      {sortField === 'interview_at' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('applied_at')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Applied</span>
                      {sortField === 'applied_at' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('last_activity_at')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Last Activity</span>
                      {sortField === 'last_activity_at' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr
                    key={app.id}
                    className="table-row"
                    onClick={() => setSelectedId(app.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{app.company_name}</div>
                      {app.requisition_id && (
                        <div className="font-mono text-caption" style={{ color: 'var(--text-muted)' }}>
                          {app.requisition_id}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{app.job_title}</div>
                      {app.location && <div className="text-caption" style={{ color: 'var(--text-muted)' }}>{app.location}</div>}
                    </td>
                    <td>
                      <span className="status-badge">
                        <span className={`status-dot ${STATUS_DOT_CLASSES[app.status] || 'applied'}`} />
                        <span style={{ textTransform: 'capitalize' }}>{app.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const meta = RESPONSE_META[app.last_response_type || 'none'];
                        return (
                          <>
                            <span className="status-badge">
                              <span className="status-dot" style={{ backgroundColor: meta.color }} />
                              <span>{meta.label}</span>
                            </span>
                            <div className="text-caption font-mono" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                              {app.last_response_at
                                ? `${app.last_response_source === 'portal' ? 'seen ' : ''}${format(parseISO(app.last_response_at), 'd MMM yyyy')} · after ${days(app.days_to_last_response)}`
                                : `waiting ${days(app.days_since_applied)}`}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      {app.interview_at ? (
                        <>
                          <div className="text-small" style={{ color: 'var(--text-primary)', fontWeight: 500 }} title={app.interview_note || ''}>
                            {(app.interview_note || 'Interview').slice(0, 60)}
                          </div>
                          <div className="text-caption font-mono" style={{ color: 'var(--text-muted)' }}>
                            {format(parseISO(app.interview_at), 'd MMM yyyy')}
                            {(app.interview_count ?? 0) > 1 && ` · ${app.interview_count} emails`}
                          </div>
                        </>
                      ) : (
                        <span className="text-small" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div className="text-small font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {format(parseISO(app.applied_at), 'd MMM yyyy')}
                      </div>
                      <div className="text-caption font-mono" style={{ color: 'var(--text-muted)' }}>
                        {app.days_since_applied != null ? `${days(app.days_since_applied)} ago` : formatAgo(app.applied_at)}
                      </div>
                    </td>
                    <td>
                      <span className="text-small font-mono" style={{ color: 'var(--text-muted)' }}>
                        {formatAgo(app.last_activity_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div
            className="card-header"
            style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: 'none', justifyContent: 'space-between' }}
          >
            <span className="text-caption font-mono" style={{ color: 'var(--text-muted)' }}>
              Page {page} of {pagination.pages} ({pagination.total} total)
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          onClose={() => setSelectedId(null)}
          onUpdate={(updated) => setApps(apps.map((a) => (a.id === updated.id ? updated : a)))}
          onDelete={(id) => {
            setApps(apps.filter((a) => a.id !== id));
            setSelectedId(null);
          }}
        />
      )}

      {/* Add Modal */}
      <AddApplicationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchApps}
      />
    </>
  );
}
