import { filterFilledChildren } from '@/lib/cooking-class-participants';
import {
  COOKING_CLASS_TABLES,
  sessionHasEnded,
  type SessionDateTimeFields,
} from '@/lib/cooking-class-db';

export { sessionHasEnded };

export const PAID_BOOKING_STATUSES = ['paid', 'awaiting_confirmation', 'awaiting_payment'] as const;

export type SessionRow = SessionDateTimeFields & {
  id?: string;
  status_id?: string | null;
  seating?: number | null;
};

/** Each registration occupies at least one seat (adult) plus one per child participant. */
export function participantsPerRegistration(children: unknown): number {
  return filterFilledChildren(children).length + 1;
}

export function normalizeStatusLabel(label: string | null | undefined): string {
  return (label ?? '').trim().toLowerCase();
}

/** Completed sessions are treated as Bookings Closed even before DB sync runs. */
export function effectiveSessionStatusLabel(
  session: SessionRow,
  dbLabel: string | null | undefined,
  now: Date = new Date()
): string {
  if (sessionHasEnded(session, now)) return 'Bookings Closed';
  return dbLabel?.trim() || 'Active';
}

export function isSessionFullyBooked(
  session: SessionRow,
  bookedCount: number,
  dbLabel: string | null | undefined
): boolean {
  if (normalizeStatusLabel(dbLabel) === 'fully booked') return true;
  const seating = session.seating ?? 0;
  return seating > 0 && bookedCount >= seating;
}

/** Registration is open only when seats remain and the session is not greyed out. */
export function isSessionBookable(
  session: SessionRow,
  dbLabel: string | null | undefined,
  bookedCount: number,
  now: Date = new Date()
): boolean {
  if (!session.event_date) return false;
  const effective = normalizeStatusLabel(effectiveSessionStatusLabel(session, dbLabel, now));
  if (effective !== 'active') return false;
  return !isSessionFullyBooked(session, bookedCount, dbLabel);
}

export function sessionAvailabilityDisplay(
  session: SessionRow,
  dbLabel: string | null | undefined,
  bookedCount: number,
  now: Date = new Date()
): { text: string; color: string } {
  const effective = effectiveSessionStatusLabel(session, dbLabel, now);
  const lower = normalizeStatusLabel(effective);

  if (lower === 'bookings closed') {
    return { text: 'Bookings Closed', color: 'text-amber-700' };
  }
  if (lower === 'fully booked' || isSessionFullyBooked(session, bookedCount, dbLabel)) {
    return { text: 'Fully Booked', color: 'text-red-600' };
  }
  if (lower !== 'active' && lower !== '') {
    const colorMap: Record<string, string> = {
      cancelled: 'text-red-500',
      'venue change': 'text-amber-600',
    };
    return { text: effective, color: colorMap[lower] || 'text-[#8C8278]' };
  }

  const seating = session.seating ?? 0;
  if (seating > 0) {
    const available = Math.max(0, seating - bookedCount);
    if (available === 0) {
      return { text: 'Fully Booked', color: 'text-red-600' };
    }
    return {
      text: `${available} seat${available === 1 ? '' : 's'} available`,
      color: 'text-green-700',
    };
  }

  return { text: effective, color: 'text-[#5C5347]' };
}

/** Build session_id → participant count from booking rows + registrations. */
export function buildParticipantCountMap(
  bookingRows: Array<{ event_date_id: string; registration_id: string }>,
  registrations: Array<{ id: string; children: unknown }>
): Map<string, number> {
  const regMap = new Map<string, number>();
  for (const reg of registrations) {
    regMap.set(reg.id, participantsPerRegistration(reg.children));
  }

  const counts = new Map<string, number>();
  for (const row of bookingRows) {
    const participants = regMap.get(row.registration_id);
    if (participants === undefined) continue;
    counts.set(row.event_date_id, (counts.get(row.event_date_id) ?? 0) + participants);
  }
  return counts;
}

export type SessionStatusRow = { id: string; label: string | null };

/**
 * Persist Bookings Closed on sessions whose end time has passed while still Active.
 * Returns the number of rows updated.
 */
export async function syncEndedSessionsToBookingsClosed(
  supabase: { from: (table: string) => any },
  sessions: Array<SessionRow & { id: string; status_id: string | null }>,
  statuses: SessionStatusRow[],
  now: Date = new Date()
): Promise<number> {
  const activeStatus = statuses.find(s => normalizeStatusLabel(s.label) === 'active');
  const closedStatus = statuses.find(s => normalizeStatusLabel(s.label) === 'bookings closed');
  if (!activeStatus || !closedStatus) return 0;

  const toClose = sessions.filter(
    s =>
      s.status_id === activeStatus.id &&
      sessionHasEnded(s, now)
  );
  if (toClose.length === 0) return 0;

  const { error } = await supabase
    .from(COOKING_CLASS_TABLES.sessions)
    .update({ status_id: closedStatus.id })
    .in(
      'id',
      toClose.map(s => s.id)
    );

  return error ? 0 : toClose.length;
}

/** True when every scheduled session for the class has finished. */
export function isClassProgramPast(
  sessions: SessionRow[],
  now: Date = new Date()
): boolean {
  if (sessions.length === 0) return true;
  return sessions.every(s => sessionHasEnded(s, now));
}

/** Next display/booking session: today or future, not yet ended. */
export function pickNextOpenSession<T extends SessionRow>(
  sessions: T[],
  isBookable: (session: T) => boolean,
  now: Date = new Date()
): T | undefined {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const candidates = sessions
    .filter(s => {
      const day = new Date(`${s.event_date.slice(0, 10)}T00:00:00`);
      return day.getTime() >= todayStart.getTime() && !sessionHasEnded(s, now);
    })
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  return candidates.find(isBookable) ?? candidates[0];
}
