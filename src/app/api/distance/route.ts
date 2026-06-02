import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const destination = searchParams.get('destination');

  if (!destination) {
    return NextResponse.json({ error: 'destination is required' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Maps API key not configured' }, { status: 500 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('correspondence_settings')
      .select('default_despatch_address')
      .limit(1)
      .single();

    if (error || !data?.default_despatch_address) {
      return NextResponse.json({ error: 'DefaultDespatchAddress not configured' }, { status: 500 });
    }

    const origin = data.default_despatch_address;

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', origin);
    url.searchParams.set('destinations', destination);
    url.searchParams.set('units', 'metric');
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', key);

    const upstream = await fetch(url.toString());
    const responseData = await upstream.json();

    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ error: 'Distance calculation failed' }, { status: 500 });
  }
}
