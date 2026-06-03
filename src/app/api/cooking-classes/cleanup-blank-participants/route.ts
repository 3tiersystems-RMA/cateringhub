import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all registrations that have children data
    const { data: registrations, error: fetchErr } = await supabaseAdmin
      .from('cooking_class_registrations')
      .select('id, children')
      .not('children', 'is', null);

    if (fetchErr) throw fetchErr;

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ message: 'No registrations found', updated: 0 });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const reg of registrations) {
      const children = Array.isArray(reg.children) ? reg.children : [];

      // Filter out blank rows (where fullName / full_name / name is empty)
      const filledChildren = children.filter((c: Record<string, unknown>) => {
        const name = (
          (c.fullName as string) ||
          (c.full_name as string) ||
          (c.name as string) ||
          ''
        ).trim();
        return name.length > 0;
      });

      // Only update if there were blank rows to remove
      if (filledChildren.length < children.length) {
        const { error: updateErr } = await supabaseAdmin
          .from('cooking_class_registrations')
          .update({ children: filledChildren })
          .eq('id', reg.id);

        if (updateErr) {
          errors.push(`Failed to update registration ${reg.id}: ${updateErr.message}`);
        } else {
          updatedCount++;
        }
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
