import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Prefer service role key (bypasses RLS); fall back to anon key if not set
  const key = serviceRoleKey || anonKey;

  if (!supabaseUrl || !key) {
    console.error('[delivery-settings] Missing Supabase env vars', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      hasAnonKey: !!anonKey,
    });
    return NextResponse?.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, key, {
      auth: { persistSession: false },
    });

    // Use maybeSingle() — returns null (not an error) when no row exists
    const { data, error } = await supabase?.from('correspondence_settings')?.select('default_despatch_address, cost_per_km')?.order('updated_at', { ascending: false })?.limit(1)?.maybeSingle();

    if (error) {
      console.error('[delivery-settings] Supabase query error:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      return NextResponse?.json(
        { error: `Database error: ${error?.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      console.warn('[delivery-settings] No correspondence_settings row found');
      return NextResponse?.json(
        { error: 'No delivery settings configured. Please add a row in Correspondence Settings.' },
        { status: 404 }
      );
    }

    const defaultDespatchAddress = data?.default_despatch_address ?? null;
    const ratePerKm =
      data?.cost_per_km != null ? parseFloat(String(data?.cost_per_km)) : null;

    // Return whatever is available — let the frontend decide how to handle nulls
    return NextResponse?.json(
      { defaultDespatchAddress, ratePerKm },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    console.error('[delivery-settings] Unexpected error:', err);
    return NextResponse?.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
