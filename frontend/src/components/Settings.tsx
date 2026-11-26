import { useState, useEffect } from 'react';
import { Check, Mail, Bell, Shield, Sliders, RefreshCw, Key } from 'lucide-react';
import { api } from '../api/client';
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

export default function Settings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([api.settings.get(), api.monitor.status(), api.auth.status()])
      .then(([s, sync, auth]) => {
        setSettings(s);
        setSyncStatus(sync);
        setAuthStatus(auth.authenticated);
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

  const handleConnectGmail = async () => {
    const { url } = await api.auth.getUrl();
    window.location.href = url;
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Disconnect Gmail connection? Syncing will stop until reconnected.')) return;
    await api.auth.logout();
    setAuthStatus(false);
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
            Disconnect
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
                  {authStatus ? 'Active read-only access to application emails' : 'Not connected'}
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
                  Cron: {syncStatus.gmailCron || '*/15 * * * *'}
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Automatic portal checks</div>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>Every 6 hours, read your status on the company portals you are signed in to</div>
              </div>
              <Toggle
                id="toggle-portal-verify"
                checked={settings.portal_verify_enabled === 'true'}
                onChange={(v) => setSetting('portal_verify_enabled', v)}
              />
            </div>
          </div>
        </div>

        <CompanyPortals />

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
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Email Notifications</div>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>Send instant email summaries for interview invites or offers</div>
              </div>
              <Toggle
                id="toggle-notify-email"
                checked={settings.notify_email === 'true'}
                onChange={(v) => setSetting('notify_email', v)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Telegram alerts</div>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                  Phone alert for every new job email. Setup: create a bot with @BotFather, put its token in backend/.env as TELEGRAM_BOT_TOKEN, press Start in the bot, then send a test.
                </div>
                {telegramStatus && (
                  <div className="text-caption" style={{ color: 'var(--color-primary)', marginTop: 4 }}>{telegramStatus}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={testTelegram}>Send test message</button>
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
              <span className="card-title">Security & Data Privacy</span>
            </div>
          </div>
          <div className="card-body">
            <p className="text-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Workday Tracker runs locally on your system with OAuth2 read-only tokens. Your tokens are stored locally and encrypted. No application telemetry is transmitted externally.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
