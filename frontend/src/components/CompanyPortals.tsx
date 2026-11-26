import { useState, useEffect, useCallback } from 'react';
import { Globe, LogIn, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { api, type PortalStatus } from '../api/client';

const STATE_LABEL: Record<string, { label: string; color: string }> = {
  ok: { label: 'Signed in', color: 'var(--status-offer)' },
  needs_login: { label: 'Needs login', color: 'var(--warning)' },
  error: { label: 'Could not read', color: 'var(--status-rejected)' },
  unchecked: { label: 'Not checked yet', color: 'var(--text-muted)' },
};

export default function CompanyPortals() {
  const [data, setData] = useState<PortalStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => api.portal.status().then(setData).catch(() => {}), []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000); // shows progress of a running check / login window
    return () => clearInterval(t);
  }, [refresh]);

  const run = async (fn: () => Promise<{ message: string }>) => {
    try {
      setMessage((await fn()).message);
    } catch (err: any) {
      setMessage(err?.message || 'Request failed');
    }
    refresh();
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Globe size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Company portals</span>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={!!data?.busy} onClick={() => run(api.portal.checkNow)}>
          <RefreshCw size={14} /> {data?.busy === 'checking' ? 'Checking…' : 'Check portals now'}
        </button>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
          Some companies never email a rejection; their portal just changes your status. Click <b>Log in</b>, sign in
          yourself in the window that opens, then close it. Only the browser session is kept (in
          backend/data/portal-browser) — your password is never stored.
        </div>
        {message && <div className="text-caption" style={{ color: 'var(--color-primary)' }}>{message}</div>}
        {!data ? (
          <div className="text-caption" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : data.portals.length === 0 ? (
          <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
            No portal links found yet. Run Reparse after a Gmail sync.
          </div>
        ) : (
          data.portals.map((p) => {
            const st = STATE_LABEL[p.state] || STATE_LABEL.unchecked;
            return (
              <div
                key={p.host}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{p.company}</div>
                  <div className="text-caption font-mono" style={{ color: 'var(--text-muted)' }}>
                    {p.host} · {p.open_apps}/{p.apps} open
                    {p.last_checked && ` · checked ${formatDistanceToNow(parseISO(p.last_checked))} ago`}
                    {p.error && ` · ${p.error}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <span className="status-badge">
                    <span className="status-dot" style={{ backgroundColor: st.color }} />
                    {st.label}
                  </span>
                  <button className="btn btn-ghost btn-sm" disabled={!!data.busy} onClick={() => run(() => api.portal.login(p.host))}>
                    <LogIn size={14} /> Log in
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
