import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COOKING_CLASS_TABLES } from '@/lib/cooking-class-db';
import { syncEndedSessionsToBookingsClosed } from '@/lib/cooking-class-sessions';

/** Close ended sessions still marked Active → Bookings Closed (SSHP daily sessions). */
export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const [sessionsRes, statusesRes] = await Promise.all([
      supabase
        .from(COOKING_CLASS_TABLES.sessions)
        .select('id, event_date, start_time, end_time, status_id')
        .not('event_date', 'is', null),
      supabase.from(COOKING_CLASS_TABLES.sessionStatuses).select('id, label'),
    ]);

    if (sessionsRes.error) {
      return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
    }

    const updated = await syncEndedSessionsToBookingsClosed(
      supabase,
      (sessionsRes.data ?? []) as Array<{
        id: string;
        event_date: string;
        start_time: string | null;
        end_time: string | null;
        status_id: string | null;
      }>,
      (statusesRes.data ?? []) as Array<{ id: string; label: string | null }>
    );

    return NextResponse.json({ updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
