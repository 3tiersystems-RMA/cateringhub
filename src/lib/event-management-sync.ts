/**
 * Shared helpers for syncing Event Bookings → Settings with Events Marketing.
 */

export interface BookableSession {
  id: string;
  event_id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_fee: number | null;
}

export interface BookableEvent {
  id: string;
  name: string;
  sessions: BookableSession[];
}

export const SAST_OFFSET_MINUTES = 120;

/** Convert stored UTC ISO to a datetime-local value interpreted in SAST. */
export function toSASTDateTimeInput(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const sastMs = d.getTime() + SAST_OFFSET_MINUTES * 60 * 1000;
  const sast = new Date(sastMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    sast.getUTCFullYear() +
    '-' + pad(sast.getUTCMonth() + 1) +
    '-' + pad(sast.getUTCDate()) +
    'T' + pad(sast.getUTCHours()) +
    ':' + pad(sast.getUTCMinutes())
  );
}

/** Parse datetime-local (treated as SAST wall-clock) and return UTC ISO string. */
export function fromSASTDateTimeInputToUTCISO(input: string): string | null {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - SAST_OFFSET_MINUTES * 60 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function padTimePart(value: string | null | undefined): string {
  if (!value) return '00:00';
  const parts = value.split(':');
  const h = parts[0]?.padStart(2, '0') ?? '00';
  const m = parts[1]?.padStart(2, '0') ?? '00';
  return `${h}:${m}`;
}

/** Map a Settings session row to marketing datetime-local fields. */
export function sessionToMarketingDateTimes(session: BookableSession): {
  event_date: string;
  event_date_to: string;
} {
  const datePart = session.event_date || '';
  const start = padTimePart(session.start_time);
  const end = padTimePart(session.end_time || session.start_time);
  return {
    event_date: datePart ? `${datePart}T${start}` : '',
    event_date_to: datePart ? `${datePart}T${end}` : '',
  };
}

/** Map marketing datetime-local fields back to Settings session columns. */
export function marketingDateTimesToSession(
  event_date: string,
  event_date_to: string
): { event_date: string; start_time: string; end_time: string } | null {
  const fromMatch = event_date.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (!fromMatch) return null;
  const toSource = event_date_to || event_date;
  const toMatch = toSource.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  const endTime = toMatch ? toMatch[2] : fromMatch[2];
  return {
    event_date: fromMatch[1],
    start_time: `${fromMatch[2]}:00`,
    end_time: `${endTime}:00`,
  };
}

/**
 * Per-session fee wins when set (> 0); otherwise fall back to Default Event Fee.
 * Keeps marketing cards, Settings, and checkout aligned for each session.
 */
export function resolveCheckoutFee(defaultEventFee: number, sessionFee: number | null | undefined): number {
  if (sessionFee != null && sessionFee > 0) return sessionFee;
  if (defaultEventFee > 0) return defaultEventFee;
  return 0;
}

/** Public registration form URL for the current origin (no event pre-selected). */
export function getEnrollmentUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/event-bookings`;
  }
  return '/event-bookings';
}

/** Deep link so Enroll Now skips "Select an Event" on the booking form. */
export function getEnrollmentUrlForBookableEvent(
  eventManagementEventId: string,
  sessionId?: string | null
): string {
  const params = new URLSearchParams({ eventId: eventManagementEventId });
  if (sessionId) params.set('sessionId', sessionId);
  const path = `/event-bookings?${params.toString()}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** Append eventId/sessionId to an enrollment URL if missing (legacy rows). */
export function resolveEnrollmentUrl(
  storedUrl: string | null | undefined,
  eventManagementEventId: string | null | undefined,
  sessionId?: string | null
): string {
  if (eventManagementEventId) {
    const base =
      storedUrl && storedUrl.includes('/event-bookings')
        ? storedUrl
        : getEnrollmentUrl();
    try {
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost';
      const url = new URL(base, origin);
      if (!url.searchParams.has('eventId')) {
        url.searchParams.set('eventId', eventManagementEventId);
        if (sessionId) url.searchParams.set('sessionId', sessionId);
      }
      return url.pathname + url.search;
    } catch {
      return getEnrollmentUrlForBookableEvent(eventManagementEventId, sessionId);
    }
  }
  if (storedUrl?.trim()) return storedUrl.trim();
  return getEnrollmentUrl();
}

/** Prefer the next upcoming session; otherwise the first configured session. */
export function pickDefaultSession(sessions: BookableSession[]): BookableSession | undefined {
  if (!sessions.length) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sessions.find(s => s.event_date && s.event_date >= today);
  return upcoming ?? sessions[0];
}

export function formatSessionLabel(session: BookableSession): string {
  const date = session.event_date || 'No date';
  const start = padTimePart(session.start_time);
  const end = padTimePart(session.end_time);
  const loc = session.location ? ` · ${session.location}` : '';
  return `${date} ${start}–${end}${loc}`;
}

/** Build marketing `events` row fields from a linked Settings session. */
export function marketingFieldsFromSession(
  eventName: string,
  session: BookableSession,
  defaultEventFee: number
): {
  title: string;
  event_date: string;
  event_date_to: string;
  location: string;
  cost: number;
  enrollment_url: string;
} {
  const { event_date, event_date_to } = sessionToMarketingDateTimes(session);
  const fromIso = fromSASTDateTimeInputToUTCISO(event_date);
  const toIso = fromSASTDateTimeInputToUTCISO(event_date_to || event_date);
  const fee = resolveCheckoutFee(defaultEventFee, session.event_fee);
  return {
    title: eventName,
    event_date: fromIso || new Date().toISOString(),
    event_date_to: toIso || fromIso || new Date().toISOString(),
    location: session.location || '',
    cost: fee,
    enrollment_url: getEnrollmentUrlForBookableEvent(session.event_id, session.id),
  };
}
