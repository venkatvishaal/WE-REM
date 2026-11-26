import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Bell,
  Settings as SettingsIcon,
  RefreshCw,
  BriefcaseBusiness,
  Command,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';

interface SidebarProps {
  unreadCount: number;
}

export default function Sidebar({ unreadCount }: SidebarProps) {
  const [syncStatus, setSyncStatus] = useState<{ isRunning: boolean; lastSync: string | null; lastError: string | null }>({
    isRunning: false,
    lastSync: null,
    lastError: null,
  });

  useEffect(() => {
    const refresh = () => {
      api.monitor.status().then(setSyncStatus).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
    await api.monitor.syncNow().catch(() => {});
    setTimeout(() => api.monitor.status().then(setSyncStatus).catch(() => {}), 1000);
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const openCmd = () => {
    window.dispatchEvent(new CustomEvent('open-command-palette'));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <BriefcaseBusiness size={20} style={{ color: 'var(--color-primary)' }} />
          <div>
            <div className="sidebar-brand-title">Job Tracker</div>
            <div className="sidebar-brand-sub">All Applications Platform</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Workspace</div>

        <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <div className="sidebar-link-content">
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </div>
        </NavLink>

        <NavLink to="/applications" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <div className="sidebar-link-content">
            <Briefcase size={18} />
            <span>Applications</span>
          </div>
        </NavLink>

        <NavLink to="/notifications" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <div className="sidebar-link-content">
            <Bell size={18} />
            <span>Notifications</span>
          </div>
          {unreadCount > 0 && <span className="sidebar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </NavLink>

        <div className="sidebar-section-label">System</div>

        <NavLink to="/settings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <div className="sidebar-link-content">
            <SettingsIcon size={18} />
            <span>Settings</span>
          </div>
        </NavLink>

        <NavLink to="/privacy" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <div className="sidebar-link-content">
            <ShieldCheck size={18} />
            <span>Privacy</span>
          </div>
        </NavLink>

        <button
          className="sidebar-link"
          onClick={openCmd}
          style={{ background: 'transparent', border: 'none', width: '100%', cursor: 'pointer' }}
        >
          <div className="sidebar-link-content">
            <Command size={18} />
            <span>Command Menu</span>
          </div>
          <span className="kbd-shortcut">⌘K</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: syncStatus.isRunning
                ? 'var(--warning)'
                : syncStatus.lastError
                ? 'var(--error)'
                : 'var(--success)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="text-caption"
              style={{
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {syncStatus.isRunning ? 'Syncing...' : `Synced ${formatLastSync(syncStatus.lastSync)}`}
            </div>
          </div>
        </div>

        <button
          id="sync-now-btn"
          className="btn btn-ghost btn-sm"
          onClick={handleSyncNow}
          disabled={syncStatus.isRunning}
          title="Sync Gmail applications now"
          style={{ padding: 4 }}
        >
          <RefreshCw size={14} className={syncStatus.isRunning ? 'spinning' : ''} />
        </button>
      </div>
    </aside>
  );
}
