import { type TimelineEvent } from './api/client';

export type ResponseType = 'accepted' | 'moved_forward' | 'interview' | 'rejected';

export const RESPONSE_META: Record<ResponseType | 'none', { label: string; color: string }> = {
  accepted: { label: 'Accepted', color: 'var(--status-offer)' },
  interview: { label: 'Interview', color: 'var(--status-interview)' },
  moved_forward: { label: 'Moved forward', color: 'var(--status-screening)' },
  rejected: { label: 'Rejected', color: 'var(--status-rejected)' },
  none: { label: 'No response', color: 'var(--text-muted)' },
};

// Mirrors responseOf() in backend/src/services/parser.service.ts
export function responseOfEvent(e: TimelineEvent): ResponseType | undefined {
  if (e.source !== 'email') return undefined;
  if (e.event_type === 'offer') return 'accepted';
  if (e.event_type === 'interview') return 'interview';
  if (e.event_type === 'assessment') return 'moved_forward';
  if (e.event_type === 'rejected' || e.event_type === 'position_filled') return 'rejected';
  if (e.event_type === 'status_change') {
    try {
      const to = JSON.parse(e.metadata || '{}').status_to;
      if (to === 'under_review' || to === 'screening') return 'moved_forward';
    } catch { /* no metadata */ }
  }
  return undefined;
}
