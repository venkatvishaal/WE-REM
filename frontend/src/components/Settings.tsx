import { useState, useEffect } from 'react';
import { Check, Mail, Bell, Shield, Sliders, RefreshCw, Key, Send } from 'lucide-react';
import { api, AuthStatus, signInWithGoogle } from '../api/client';
import CompanyPortals from './CompanyPortals';

type SettingsMap = Record<string, string>;

function Toggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      <div
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          backgroundColor: checked ? 'var(--color-primary)' : 'var(--border-strong)',
          transition: 'background-color 140ms var(--ease-standard)',
          position: 'relative',
          padding: 2,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform 140ms var(--ease-standard)',
          }}
        />
      </div>
    </label>
  );
}

export default function Settings({ auth }: { auth?: AuthStatus }) {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<boolean | null>(null);
  const [telegramConnected, setTelegramConnected] = useState(!!auth?.telegramConnected);

  useEffect(() => {
    Promise.all([api.settings.get(), api.monitor.status(), api.auth.status()])
      .then(([s, sync, auth]) => {
        setSettings(s);
        setSyncStatus(sync);
        setAuthStatus(auth.gmailConnected && !auth.reconnectNeeded);
        setTelegramConnected(auth.telegramConnected);
      })
      .finally(() => setLoading(false));
  }, []);

  const setSetting = (key: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: String(value) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.settings.update(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGmail = () => signInWithGoogle();

  const handleDisconnectGmail = async () => {
    if (!confirm('Disconnect Gmail? Job Tracker loses Gmail access and stops syncing. Your saved applications stay.')) return;
    await api.account.disconnectGmail();
    setAuthStatus(false);
  };

  const handleSignOut = async () => {
    await api.auth.logout();
    window.location.href = '/';
  };

  const handleDeleteAccount = async () => {
    const typed = prompt('This permanently deletes your account, every saved application and email, and revokes Gmail access. It cannot be undone.\n\nType DELETE to confirm.');
    if (typed !== 'DELETE') return;
    await api.account.delete();
    window.location.href = '/';
  };

  const connectTelegram = async () => {
    setTelegramStatus(null);
    try {
      const { url } = await api.notifications.telegramLink();
      window.open(url, '_blank', 'noopener');
      setTelegramStatus('Press Start in the Telegram chat that opened, then reload this page.');
    } catch (err: any) {
      setTelegramStatus(err?.message || 'Could not create a Telegram link');
    }
  };

  const disconnectTelegram = async () => {
    await api.notifications.telegramDisconnect();
    setTelegramConnected(false);
    setSetting('notify_telegram', false);
    setTelegramStatus('Telegram disconnected.');
  };

  const [reparsing, setReparsing] = useState(false);
  const [reparseStatus, setReparseStatus] = useState<string | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  const testTelegram = async () => {
    setTelegramStatus('Sending…');
    try {
      setTelegramStatus((await api.notifications.testTelegram()).message);
    } catch (err: any) {
      setTelegramStatus(err?.message || 'Test failed');
    }
  };

  const handleSyncNow = async () => {
    await api.monitor.syncNow(false);
    const status = await api.monitor.status();
    setSyncStatus(status);
  };

  const handleFullScrape = async () => {
    await api.monitor.syncNow(true);
    const status = await api.monitor.status();
    setSyncStatus(status);
  };

  const handleReparse = async () => {
    setReparsing(true);
    setReparseStatus(null);
    try {
      const res: any = await api.monitor.reparse();
      setReparseStatus(`Reparsed ${res.parsed}/${res.total} emails (${res.appsCreated} new, ${res.appsUpdated} updated)`);
    } catch (e: any) {
      setReparseStatus('Reparse error: ' + e.message);
    } finally {
      setReparsing(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <span className="text-body" style={{ color: 'var(--text-muted)' }}>
          Loading settings…
        </span>
      </div>
    );
  }

  const renderSaveLabel = () => {
    if (saving) return 'Saving...';
    if (saved) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Check size={14} /> Saved
        </span>
      );
    }
    return 'Save changes';
  };

  const renderAuthAction = () => {
    if (authStatus) {
      return (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleSyncNow} disabled={syncStatus?.isRunning}>
            <RefreshCw size={14} className={syncStatus?.isRunning ? 'spinning' : ''} /> Sync Now
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleFullScrape} disabled={syncStatus?.isRunning} title="Scrape all applications across all platforms from the last 365 days">
            <RefreshCw size={14} className={syncStatus?.isRunning ? 'spinning' : ''} /> Scrape All
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleReparse} disabled={reparsing} title="Reparse all emails already saved in your database">
            {reparsing ? 'Reparsing...' : 'Reparse DB Emails'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleDisconnectGmail} style={{ color: 'var(--error)' }}>
            Disconnect Gmail
          </button>
        </div>
      );
    }
    return (
      <button className="btn btn-primary btn-sm" onClick={handleConnectGmail}>
        <Key size={14} /> Connect Gmail
      </button>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage connection, monitoring preferences, and security</p>
        </div>

        <button className={`btn ${saved ? 'btn-secondary' : 'btn-primary'} btn-sm`} onClick={handleSave} disabled={saving}>
          {renderSaveLabel()}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Section 1: Account & Gmail */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Mail size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">Gmail Integration</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Connection Status</div>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                  {authStatus ? `Read-only access to ${auth?.email || 'your Gmail'}` : 'Not connected'}
                </div>
              </div>

              {renderAuthAction()}
            </div>

            {reparseStatus && (
              <div className="text-caption" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                {reparseStatus}
              </div>
            )}

            {syncStatus && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div className="text-caption" style={{ color: 'var(--text-muted)' }}>Last Automated Sync</div>
                  <div className="font-mono text-small" style={{ color: 'var(--text-primary)' }}>
                    {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}
                  </div>
                </div>
                <div className="font-mono text-caption" style={{ color: 'var(--text-muted)' }}>
                  Every {syncStatus.syncEveryMinutes || 15} min
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Application Monitoring */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Sliders size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">Application Ingestion & Monitoring</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Automated Gmail Ingestion</div>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>Automatically check for application and status emails across all platforms every 15 minutes</div>
              </div>
              <Toggle
                id="toggle-gmail-sync"
                checked={settings.gmail_sync_enabled === 'true'}
                onChange={(v) => setSetting('gmail_sync_enabled', v)}
              />
            </div>

            {auth?.portalChecks && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Automatic portal checks</div>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>Every 6 hours, read your status on the company portals you are signed in to</div>
              </div>
              <Toggle
                id="toggle-portal-verify"
                checked={settings.portal_verify_enabled === 'true'}
                onChange={(v) => setSetting('portal_verify_enabled', v)}
              />
            </div>}
          </div>
        </div>

        {auth?.portalChecks && <CompanyPortals />}

        {/* Section 3: Notifications */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Bell size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">Notifications</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>In-App Activity Notifications</div>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>Record status changes in notification feed</div>
              </div>
              <Toggle
                id="toggle-notify-in-app"
                checked={settings.notify_in_app !== 'false'}
                onChange={(v) => setSetting('notify_in_app', v)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Telegram alerts</div>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                  {telegramConnected
                    ? 'Connected. You get a phone message for every new job email.'
                    : 'Get a phone message for every new job email. Click Connect Telegram, then press Start in the chat that opens.'}
                </div>
                {telegramStatus && (
                  <div className="text-caption" style={{ color: 'var(--color-primary)', marginTop: 4 }}>{telegramStatus}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                {telegramConnected ? (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={testTelegram}>Send test message</button>
                    <button className="btn btn-ghost btn-sm" onClick={disconnectTelegram}>Disconnect</button>
                  </>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={connectTelegram}><Send size={14} /> Connect Telegram</button>
                )}
                <Toggle
                  id="toggle-notify-telegram"
                  checked={settings.notify_telegram === 'true'}
                  onChange={(v) => setSetting('notify_telegram', v)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Architecture & Security */}
        <div className="card" style={{ background: 'var(--surface-secondary)' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Shield size={18} style={{ color: 'var(--color-primary)' }} />
              <span className="card-title">Account & Privacy</span>
            </div>
          </div>
          <div className="card-body">
            <p className="text-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Signed in as <strong>{auth?.email}</strong>. Job Tracker has read-only Gmail access and stores only job emails (first 4 KB of text), encrypted tokens and your applications. <a href="/privacy">Read the privacy note</a>.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>Sign out</button>
              <button className="btn btn-ghost btn-sm" onClick={handleDeleteAccount} style={{ color: 'var(--error)' }}>Delete my data</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
