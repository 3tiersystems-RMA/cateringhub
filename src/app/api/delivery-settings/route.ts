import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('correspondence_settings')
      .select('default_despatch_address, cost_per_km')
      .limit(1)
      .single();

    if (error) {
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
  } catch {
    return NextResponse.json({ error: 'Could not read CorrespondenceSettings' }, { status: 500 });
  }
}
