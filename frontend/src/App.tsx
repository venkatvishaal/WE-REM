import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BriefcaseBusiness, Mail, Search, ShieldCheck, Bell, ArrowRight } from 'lucide-react';
import { api } from './api/client';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ApplicationList from './components/ApplicationList';
import NotificationCenter from './components/NotificationCenter';
import Settings from './components/Settings';
import CommandPalette from './components/CommandPalette';
import AddApplicationModal from './components/AddApplicationModal';

function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { url } = await api.auth.getUrl();
      window.location.href = url;
    } catch (e) {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-page)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 'var(--space-7)',
          borderRadius: 'var(--radius-dialog)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <BriefcaseBusiness size={24} style={{ color: 'var(--color-primary)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Job Application Tracker
            </div>
            <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
              Universal Applications Platform
            </div>
          </div>
        </div>

        <p className="text-body" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
          Connect your Gmail account to automatically track all your job applications across Workday, Greenhouse, Lever, SmartRecruiters, Ashby, and direct company emails.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          {[
            { icon: Mail, title: 'Automatic Ingestion', desc: 'Reads application receipts & status emails' },
            { icon: Search, title: 'Smart Parsing', desc: 'Extracts company, job title, and req IDs' },
            { icon: ShieldCheck, title: 'Portal Verification', desc: 'Real-time REST status verification' },
            { icon: Bell, title: 'Instant Alerts', desc: 'Timely updates for interviews and offers' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Icon size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                  <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          id="connect-gmail-btn"
          className="btn btn-primary w-full"
          onClick={handleConnect}
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? 'Connecting...' : <><Mail size={16} /> Connect Gmail Account <ArrowRight size={14} /></>}
        </button>

        <p className="text-caption" style={{ color: 'var(--text-muted)', marginTop: 'var(--space-4)', textAlign: 'center' }}>
          Read-only access requested. Tokens are stored locally and encrypted.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    // Listen for custom palette event
    const handleOpenCmd = () => setIsCmdOpen(true);
    window.addEventListener('open-command-palette', handleOpenCmd);
    return () => window.removeEventListener('open-command-palette', handleOpenCmd);
  }, []);

  useEffect(() => {
    api.auth
      .status()
      .then(({ authenticated }) => setAuthenticated(authenticated))
      .catch(() => setAuthenticated(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setAuthenticated(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => {
      api.notifications
        .list(true)
        .then(({ unreadCount }) => setUnreadCount(unreadCount))
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [authenticated]);

  if (authenticated === null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--surface-page)',
        }}
      >
        <span className="text-body" style={{ color: 'var(--text-muted)' }}>
          Loading application...
        </span>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthScreen onAuth={() => setAuthenticated(true)} />;
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar unreadCount={unreadCount} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/applications" element={<ApplicationList />} />
            <Route path="/notifications" element={<NotificationCenter onRead={() => setUnreadCount(0)} />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <CommandPalette
          isOpen={isCmdOpen}
          onClose={() => setIsCmdOpen(false)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />

        <AddApplicationModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />
      </div>
    </BrowserRouter>
  );
}
