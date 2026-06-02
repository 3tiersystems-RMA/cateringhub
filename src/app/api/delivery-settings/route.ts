import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Use service role key to bypass RLS — this is a server-only route
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('correspondence_settings')
      .select('default_despatch_address, cost_per_km')
      .limit(1)
      .single();

    if (error) {
      console.error('[delivery-settings] Supabase error:', error.message);
      return NextResponse.json({ error: 'Could not read CorrespondenceSettings' }, { status: 500 });
    }

    const defaultDespatchAddress = data?.default_despatch_address ?? null;
    const ratePerKm = data?.cost_per_km != null ? parseFloat(String(data.cost_per_km)) : null;

    if (!defaultDespatchAddress || !ratePerKm) {
      return NextResponse.json(
        { error: 'DefaultDespatchAddress or RatePerKm not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({ defaultDespatchAddress, ratePerKm });
  } catch (err) {
    console.error('[delivery-settings] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not read CorrespondenceSettings' }, { status: 500 });
  }
}
