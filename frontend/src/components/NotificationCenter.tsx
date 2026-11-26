import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, Monitor, AlertCircle, Info, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { api, type Notification as NotificationType } from '../api/client';

interface Props {
  onRead: () => void;
}

function timeAgo(iso: string) {
  try {
    return `${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return iso;
  }
}

export default function NotificationCenter({ onRead }: Props) {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.notifications.list(unreadOnly);
      setNotifications(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [unreadOnly]);

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifications(notifications.map((n) => ({ ...n, read: 1 })));
    onRead();
  };

  const handleMarkRead = async (id: string) => {
    await api.notifications.markRead(id);
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: 1 } : n)));
  };

  const handleClearRead = async () => {
    await api.notifications.clearRead();
    setNotifications(notifications.filter((n) => n.read === 0));
  };

  const unreadCount = notifications.filter((n) => n.read === 0).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread updates` : 'All caught up'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            {unreadOnly ? 'Show all' : 'Unread only'}
          </button>

          {unreadCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )}

          <button className="btn btn-ghost btn-sm" onClick={handleClearRead} title="Clear read notifications">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <span className="text-body" style={{ color: 'var(--text-muted)' }}>
              Loading notifications…
            </span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <Bell size={24} className="empty-icon" />
            <div className="empty-title">No notifications</div>
            <div className="empty-desc">
              You will receive notifications when application statuses update or interviews are scheduled.
            </div>
          </div>
        ) : (
          <div className="timeline-list">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="timeline-item"
                onClick={() => notif.read === 0 && handleMarkRead(notif.id)}
                style={{
                  cursor: notif.read === 0 ? 'pointer' : 'default',
                  paddingInline: 'var(--space-5)',
                  backgroundColor: notif.read === 0 ? 'var(--surface-primary)' : 'transparent',
                }}
              >
                <div className="timeline-indicator">
                  <div
                    className="timeline-node"
                    style={{
                      backgroundColor: notif.read === 0 ? 'var(--color-primary)' : 'var(--border-strong)',
                    }}
                  />
                </div>

                <div className="timeline-content">
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                    <div style={{ fontWeight: notif.read === 0 ? 650 : 500, color: 'var(--text-primary)', fontSize: 14 }}>
                      {notif.title}
                    </div>
                    <span className="timeline-time">{timeAgo(notif.sent_at)}</span>
                  </div>

                  <div className="timeline-sub" style={{ marginTop: 2 }}>
                    {notif.body}
                  </div>

                  {notif.company_name && (
                    <div className="text-caption font-mono" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                      {notif.company_name} — {notif.job_title}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Push Helper */}
      <DesktopPushSetup />
    </>
  );
}

function DesktopPushSetup() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  if (permission === 'granted') return null;

  return (
    <div className="card" style={{ background: 'var(--surface-secondary)' }}>
      <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <Monitor size={20} style={{ color: 'var(--color-primary)' }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
            Enable Desktop Notifications
          </div>
          <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            Receive instant alerts for interview requests and offer status updates.
          </div>
        </div>
        {permission === 'denied' ? (
          <span className="text-caption" style={{ color: 'var(--text-muted)' }}>Blocked in browser</span>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={requestPermission}>
            Enable
          </button>
        )}
      </div>
    </div>
  );
}
