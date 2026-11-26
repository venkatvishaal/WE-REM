import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BriefcaseBusiness, Mail, Search, ShieldCheck, Bell, ArrowRight, AlertTriangle } from 'lucide-react';
import { api, AuthStatus, signInWithGoogle } from './api/client';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ApplicationList from './components/ApplicationList';
import NotificationCenter from './components/NotificationCenter';
import Settings from './components/Settings';
import CommandPalette from './components/CommandPalette';
import AddApplicationModal from './components/AddApplicationModal';
import Privacy from './components/Privacy';

function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const error = new URLSearchParams(window.location.search).get('auth') === 'error'
    ? new URLSearchParams(window.location.search).get('msg') || 'Sign-in failed'
    : null;

  const handleConnect = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
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
            { icon: ShieldCheck, title: 'Private by design', desc: 'Read-only Gmail access, delete your data any time' },
            { icon: Bell, title: 'Telegram Alerts', desc: 'A phone message for every new job email' },
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
          {loading ? 'Connecting...' : <><Mail size={16} /> Sign in with Google <ArrowRight size={14} /></>}
        </button>

        {error && (
          <p className="text-caption" role="alert" style={{ color: 'var(--error)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <p className="text-caption" style={{ color: 'var(--text-muted)', marginTop: 'var(--space-4)', lineHeight: 1.5 }}>
          Google will show <strong>"Google hasn't verified this app"</strong> because Job Tracker is in a private test.
          Click <strong>Advanced → Continue</strong>, then allow read-only Gmail access. Your email address must be on the
          tester list; ask the person who invited you.
        </p>
        <p className="text-caption" style={{ marginTop: 'var(--space-2)', textAlign: 'center' }}>
          <a href="/privacy">What we read and store</a>
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthStatus | null | false>(null);
  const authenticated = auth === null ? null : !!auth;
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
      .then(setAuth)
      .catch(() => setAuth(false));

    if (new URLSearchParams(window.location.search).get('auth') === 'success') {
      window.history.replaceState({}, '', '/');
    }
    const onSignedOut = () => setAuth(false);
    window.addEventListener('signed-out', onSignedOut);
    return () => window.removeEventListener('signed-out', onSignedOut);
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

  // The privacy page is public: Google's consent screen links to it
  if (window.location.pathname === '/privacy' && !authenticated) {
    return <Privacy standalone />;
  }

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
    return <AuthScreen />;
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar unreadCount={unreadCount} />
        <main className="main-content">
          {auth && (auth.reconnectNeeded || !auth.gmailConnected) && (
            <div className="card" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', borderColor: 'var(--warning, #d97706)' }}>
              <AlertTriangle size={18} style={{ color: 'var(--warning, #d97706)', flexShrink: 0 }} />
              <span className="text-body" style={{ flex: 1 }}>
                {auth.reconnectNeeded
                  ? 'Google ended Gmail access (this happens every 7 days during testing). Reconnect to keep tracking.'
                  : 'Gmail is not connected, so new job emails are not being tracked.'}
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => signInWithGoogle()}>Reconnect Gmail</button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/applications" element={<ApplicationList />} />
            <Route path="/notifications" element={<NotificationCenter onRead={() => setUnreadCount(0)} />} />
            <Route path="/settings" element={<Settings auth={auth || undefined} />} />
            <Route path="/privacy" element={<Privacy />} />
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
