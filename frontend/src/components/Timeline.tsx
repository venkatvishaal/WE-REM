import { type TimelineEvent } from '../api/client';
import { formatDistanceToNow, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { RESPONSE_META, responseOfEvent } from '../responses';

interface Props {
  events: TimelineEvent[];
  /** When set, each event shows "Day N" counted from the application date */
  appliedAt?: string;
}

const EVENT_DOT_COLORS: Record<string, string> = {
  applied: 'var(--status-applied)',
  acknowledged: 'var(--status-screening)',
  status_change: 'var(--color-primary)',
  interview: 'var(--status-interview)',
  assessment: 'var(--warning)',
  offer: 'var(--status-offer)',
  rejected: 'var(--status-rejected)',
  position_filled: 'var(--status-rejected)',
  default: 'var(--text-muted)',
};

function formatTimeAgo(iso: string) {
  try {
    const d = parseISO(iso);
    return `${formatDistanceToNow(d)} ago`;
  } catch {
    return iso;
  }
}

function formatExactDate(iso: string) {
  try {
    return format(parseISO(iso), 'MMM d, yyyy · HH:mm');
  } catch {
    return iso;
  }
}

export default function Timeline({ events, appliedAt }: Props) {
  if (events.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
        <div className="empty-title">No activity events</div>
        <div className="empty-desc">Events will be logged automatically as your application status updates.</div>
      </div>
    );
  }

  return (
    <div className="timeline-list">
      {events.map((event) => {
        const dotColor = EVENT_DOT_COLORS[event.event_type] || EVENT_DOT_COLORS.default;
        const response = responseOfEvent(event);
        let day: number | null = null;
        if (appliedAt) {
          try { day = Math.max(0, differenceInCalendarDays(parseISO(event.occurred_at), parseISO(appliedAt))); } catch { /* bad date */ }
        }

        return (
          <div key={event.id} className="timeline-item">
            <div className="timeline-indicator">
              <div className="timeline-node" style={{ backgroundColor: dotColor }} />
            </div>

            <div className="timeline-content">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                <span className="timeline-title">
                  {response && (
                    <span className="status-badge" style={{ marginRight: 6, fontWeight: 600 }}>
                      <span className="status-dot" style={{ backgroundColor: RESPONSE_META[response].color }} />
                      {RESPONSE_META[response].label}
                    </span>
                  )}
                  {event.title}
                </span>
                <span className="timeline-time" title={formatExactDate(event.occurred_at)}>
                  {day !== null ? `Day ${day} · ${format(parseISO(event.occurred_at), 'd MMM')}` : formatTimeAgo(event.occurred_at)}
                </span>
              </div>

              {event.description && (
                <div className="timeline-sub" style={{ marginTop: 2 }}>
                  {event.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
