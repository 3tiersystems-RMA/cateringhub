import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const registration = body?.registration;
    const selectedDateIds: string[] = Array.isArray(body?.selectedDateIds) ? body.selectedDateIds : [];

    if (!registration || typeof registration !== 'object') {
      return NextResponse.json({ error: 'Registration data is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: reg, error: regErr } = await admin
      .from('event_management_registrations')
      .insert(registration)
      .select('id')
      .single();

    if (regErr || !reg) {
      return NextResponse.json({ error: regErr?.message || 'Failed to save registration' }, { status: 400 });
    }

    if (selectedDateIds.length > 0) {
      const { error: countsErr } = await admin.from('event_management_booking_counts').insert(
        selectedDateIds.map((event_date_id) => ({ event_date_id, registration_id: reg.id }))
      );
      if (countsErr) {
        return NextResponse.json({ error: countsErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ id: reg.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
