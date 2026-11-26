import { useEffect, useState } from 'react';
import { Plus, Search, ArrowRight } from 'lucide-react';
import { api, type Stats, type TrendPoint, type Application } from '../api/client';
import StatsCards from './StatsCards';
import Charts from './Charts';
import Pipeline from './Pipeline';
import NeedsAttention from './NeedsAttention';
import Timeline from './Timeline';
import AddApplicationModal from './AddApplicationModal';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [staleApps, setStaleApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadDashboardData = () => {
    setLoading(true);
    Promise.all([
      api.stats.get(),
      api.stats.trends(30),
      api.stats.activity(10),
      api.applications.list({ limit: '100' }),
    ])
      .then(([s, t, a, appsRes]) => {
        setStats(s);
        setTrends(t);
        setActivity(a);

        // Filter stale applications (applied > 7 days ago and still applied/screening)
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const stale = (appsRes.data || []).filter((app: Application) => {
          const appliedTime = new Date(app.applied_at || app.created_at).getTime();
          const isPending = app.status === 'applied' || app.status === 'screening';
          return isPending && now - appliedTime > sevenDaysMs;
        });
        setStaleApps(stale);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const openCmd = () => {
    window.dispatchEvent(new CustomEvent('open-command-palette'));
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <div className="text-body" style={{ color: 'var(--text-muted)' }}>
          Loading application overview…
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Your application pipeline at a glance.</p>
          {stats && (
            <div className="page-meta">
              {stats.total} {stats.total === 1 ? 'application' : 'applications'} · {stats.thisWeek} added this week
            </div>
          )}
        </div>

        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={openCmd}>
            <Search size={14} />
            <span>Search</span>
            <span className="kbd-shortcut">⌘K</span>
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={14} />
            <span>Add application</span>
          </button>
        </div>
      </div>

      {/* Hero Metrics */}
      {stats && <StatsCards stats={stats} />}

      {/* Grid: Charts & Pipeline */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Applications Over Time</span>
            <span className="text-caption font-mono" style={{ color: 'var(--text-muted)' }}>
              Last 30 days
            </span>
          </div>
          <div className="card-body">
            <Charts trends={trends} />
          </div>
        </div>

        {stats && <Pipeline byStatus={stats.byStatus} total={stats.total} />}
      </div>

      {/* Needs Attention Operational Banner */}
      <NeedsAttention staleApplications={staleApps as any} />

      {/* Recent Activity Timeline */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activity</span>
          <a
            href="/applications"
            className="text-caption"
            style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View all applications <ArrowRight size={12} />
          </a>
        </div>
        <div className="card-body-sm">
          <Timeline events={activity} />
        </div>
      </div>

      {/* Modal */}
      <AddApplicationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadDashboardData}
      />
    </>
  );
}
