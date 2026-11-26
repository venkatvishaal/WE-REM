const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (res.status === 401 && !path.startsWith('/auth/')) {
    // Session ended (signed out elsewhere, account deleted, cookie expired): back to sign-in
    window.dispatchEvent(new Event('signed-out'));
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Types ──────────────────────────────────────────────────────
export interface Application {
  id: string;
  company_name: string;
  job_title: string;
  requisition_id?: string;
  portal_url?: string;
  portal_tenant?: string;
  status: string;
  portal_verification_mode: string;
  location?: string;
  job_type?: string;
  salary_range?: string;
  notes?: string;
  applied_at: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  interview_at?: string | null;
  interview_note?: string | null;
  interview_count?: number;
  first_response_at?: string | null;
  last_response_type?: 'accepted' | 'moved_forward' | 'interview' | 'rejected' | null;
  last_response_at?: string | null;
  days_to_first_response?: number | null;
  days_to_last_response?: number | null;
  days_since_applied?: number;
  last_response_source?: string | null;
}

export interface PortalHost {
  host: string;
  company: string;
  apps: number;
  open_apps: number;
  state: 'ok' | 'needs_login' | 'error' | 'unchecked';
  error: string | null;
  last_checked: string | null;
}

export interface PortalStatus {
  busy: 'checking' | 'login' | null;
  portals: PortalHost[];
}

export interface TimelineEvent {
  id: string;
  application_id: string;
  event_type: string;
  source: string;
  title: string;
  description?: string;
  metadata?: string;
  occurred_at: string;
}

export interface Notification {
  id: string;
  application_id?: string;
  company_name?: string;
  job_title?: string;
  type: string;
  title: string;
  body: string;
  channels: string;
  read: number;
  sent_at: string;
}

export interface Stats {
  total: number;
  byStatus: Record<string, number>;
  activeCount: number;
  interviewCount: number;
  offerCount: number;
  rejectionCount: number;
  responseRate: number;
  avgDaysToResponse: number;
  responsesByType?: Record<'accepted' | 'moved_forward' | 'interview' | 'rejected' | 'none', number>;
  thisWeek: number;
  thisMonth: number;
}

export interface TrendPoint {
  date: string;
  applied: number;
  interviews: number;
  offers: number;
  rejections: number;
}

export interface AuthStatus {
  authenticated: boolean;
  email: string;
  gmailConnected: boolean;
  reconnectNeeded: boolean;
  telegramConnected: boolean;
  portalChecks: boolean;
}

// ── Auth ────────────────────────────────────────────────────────
export const api = {
  auth: {
    status: () => request<AuthStatus>('/auth/status'),
    getUrl: () => request<{ url: string }>('/auth/gmail/url'),
    logout:  () => request('/auth/logout', { method: 'POST' }),
  },

  // ── Account ───────────────────────────────────────────────────
  account: {
    disconnectGmail: () => request('/account/disconnect-gmail', { method: 'POST' }),
    delete: () => request('/account', { method: 'DELETE' }),
  },

  // ── Applications ─────────────────────────────────────────────
  applications: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ data: Application[]; pagination: { total: number; page: number; limit: number; pages: number } }>(
        `/applications${qs}`,
      );
    },
    get: (id: string) => request<Application>(`/applications/${id}`),
    create: (data: Partial<Application>) =>
      request<Application>('/applications', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Application>) =>
      request<Application>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/applications/${id}`, { method: 'DELETE' }),
    timeline: (id: string) => request<TimelineEvent[]>(`/applications/${id}/timeline`),
    addNote: (id: string, content: string) =>
      request<TimelineEvent>(`/applications/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },

  // ── Notifications ─────────────────────────────────────────────
  notifications: {
    list: (unreadOnly = false) =>
      request<{ data: Notification[]; unreadCount: number }>(
        `/notifications?unread_only=${unreadOnly}`,
      ),
    markRead: (id: string) =>
      request(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
    clearRead: () => request('/notifications', { method: 'DELETE' }),
    testTelegram: () => request<{ message: string }>('/notifications/test-telegram', { method: 'POST' }),
    telegramLink: () => request<{ url: string }>('/notifications/telegram/link', { method: 'POST' }),
    telegramDisconnect: () => request('/notifications/telegram/disconnect', { method: 'POST' }),
  },

  // ── Stats ─────────────────────────────────────────────────────
  stats: {
    get: () => request<Stats>('/stats'),
    trends: (days = 30) => request<TrendPoint[]>(`/stats/trends?days=${days}`),
    companies: () => request<Array<{ company: string; count: number; latestStatus: string }>>('/stats/companies'),
    activity: (limit = 20) => request<any[]>(`/stats/activity?limit=${limit}`),
  },

  // ── Settings ──────────────────────────────────────────────────
  settings: {
    get: () => request<Record<string, string>>('/settings'),
    update: (data: Record<string, string | boolean>) =>
      request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── Monitor ───────────────────────────────────────────────────
  portal: {
    status: () => request<PortalStatus>('/portal/status'),
    login: (host: string) => request<{ message: string }>('/portal/login', { method: 'POST', body: JSON.stringify({ host }) }),
    checkNow: () => request<{ message: string }>('/portal/check-now', { method: 'POST' }),
  },
  monitor: {
    syncNow: (full = false) => request(`/monitor/sync-now?full=${full}`, { method: 'POST' }),
    reparse: () => request('/monitor/reparse', { method: 'POST' }),
    status: () =>
      request<{ isRunning: boolean; lastSync: string | null; lastError: string | null; syncEveryMinutes: number; reconnectNeeded: boolean }>('/monitor/status'),
  },
};

/** Starts Google sign-in; also used to reconnect Gmail (Google's test mode ends access every 7 days). */
export async function signInWithGoogle() {
  const { url } = await api.auth.getUrl();
  window.location.href = url;
}
