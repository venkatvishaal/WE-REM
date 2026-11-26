import { ShieldCheck } from 'lucide-react';

// Public page: Google's OAuth consent screen links here, so it must work without signing in.
export default function Privacy({ standalone = false }: { standalone?: boolean }) {
  const section = (title: string, body: React.ReactNode) => (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>{title}</div>
      <div className="text-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{body}</div>
    </div>
  );

  const content = (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="card-title">Privacy</span>
        </div>
      </div>
      <div className="card-body">
        {section('What Job Tracker reads', <>
          With your permission, Job Tracker gets <strong>read-only</strong> access to your Gmail. It searches only for
          job-application emails (applications, assessments, interviews, offers, rejections). It cannot send, delete or
          change any email.
        </>)}
        {section('What we store', <>
          For each job email: the subject, sender, date and the first 4 KB of its text, plus the applications, statuses
          and timeline built from them. We also store your Google email address, your Gmail access token (encrypted with
          AES-256), and your Telegram chat ID if you connect Telegram. Other emails are never stored.
        </>)}
        {section('Where it is stored', <>
          In a Postgres database hosted by Neon, on servers in the cloud. Only this app can read it. We never sell,
          share or send your data to anyone, and we use no ads or trackers.
        </>)}
        {section('Telegram alerts', <>
          If you connect Telegram, each new job email sends you a short message: the company, the role, the email
          subject and its date.
        </>)}
        {section('Stop or delete', <>
          <strong>Settings → Disconnect Gmail</strong> revokes our Gmail access and stops syncing.
          <strong> Settings → Delete my data</strong> deletes your account and everything stored for it, immediately and
          permanently. You can also revoke access any time at{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
        </>)}
        {section('Google API data', <>
          Job Tracker's use of information received from Google APIs follows the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
          including the Limited Use requirements.
        </>)}
      </div>
    </div>
  );

  if (!standalone) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Privacy</h1>
            <p className="page-subtitle">What Job Tracker reads, stores and how to delete it</p>
          </div>
        </div>
        {content}
      </>
    );
  }
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface-page)', padding: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <a href="/" className="text-caption" style={{ display: 'inline-block', marginBottom: 'var(--space-4)' }}>← Back to Job Tracker</a>
        {content}
      </div>
    </div>
  );
}
