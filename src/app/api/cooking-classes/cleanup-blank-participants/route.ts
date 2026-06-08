import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaffMember } from '@/lib/api/staff-auth';
import { filterFilledChildren } from '@/lib/cooking-class-participants';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireStaffMember();
  if ('error' in auth && auth.error) return auth.error;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set' },
      { status: 500 }
    );
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: registrations, error: fetchErr } = await supabaseAdmin
      .from('cooking_class_registrations')
      .select('id, children')
      .not('children', 'is', null);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ message: 'No registrations with participants found', updated: 0 });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const reg of registrations) {
      const original = Array.isArray(reg.children) ? reg.children : [];
      const filledChildren = filterFilledChildren(reg.children);

      if (filledChildren.length >= original.length) continue;

      const { error: updateErr } = await supabaseAdmin
        .from('cooking_class_registrations')
        .update({
          children: filledChildren,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reg.id);

      if (updateErr) {
        errors.push(`Registration ${reg.id}: ${updateErr.message}`);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({
      message: `Cleanup complete. Updated ${updatedCount} registration(s).`,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
