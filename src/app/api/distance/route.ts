import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const destination = searchParams.get('destination');

  if (!destination) {
    return NextResponse.json({ error: 'destination is required' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    // Notify admin and return structured error code
    void notifyAdmin(
      'Google Maps API key is not configured (GOOGLE_MAPS_SERVER_KEY is missing). Delivery distance calculation is unavailable.',
      destination
    );
    return NextResponse.json(
      {
        error: 'Delivery distance calculation is temporarily unavailable.',
        errorCode: 'API_NOT_CONFIGURED',
      },
      { status: 503 }
    );
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

    // Check top-level status first (REQUEST_DENIED, INVALID_REQUEST, MAX_ELEMENTS_EXCEEDED, etc.)
    const topStatus: string = responseData?.status ?? 'UNKNOWN';
    if (topStatus !== 'OK') {
      const isConfigError = topStatus === 'REQUEST_DENIED' || topStatus === 'INVALID_REQUEST';
      const errorCode = isConfigError ? 'API_NOT_CONFIGURED' : 'MAPS_API_ERROR';
      const errorMessage = isConfigError
        ? 'Delivery distance calculation is temporarily unavailable.' :'Distance Matrix API error';

      void notifyAdmin(
        `Google Maps Distance Matrix API returned status: ${topStatus}. This may indicate the API key is invalid, billing is not enabled, or the Distance Matrix API is not activated for this project.`,
        destination
      );

      return NextResponse.json(
        {
          error: errorMessage,
          errorCode,
          googleStatus: topStatus,
        },
        { status: 422 }
      );
    }

    const el = responseData?.rows?.[0]?.elements?.[0];
    if (!el || el.status !== 'OK') {
      const googleStatus = el?.status ?? 'NO_ELEMENT';

      void notifyAdmin(
        `Google Maps could not find a route to the customer's address. Element status: ${googleStatus}. Customer destination: "${destination}".`,
        destination
      );

      return NextResponse.json(
        {
          error: 'Route not found',
          errorCode: 'ROUTE_NOT_FOUND',
          googleStatus,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(responseData);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void notifyAdmin(`Unexpected error during delivery calculation: ${message}`, destination);
    return NextResponse.json(
      { error: 'Distance calculation failed', errorCode: 'UNKNOWN_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Sends an email notification to the admin email address stored in correspondence_settings.
 * Fires-and-forgets — never throws so it never blocks the main response.
 */
async function notifyAdmin(errorDetail: string, destination: string): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !serviceRoleKey) return;

    const supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data } = await supabase
      .from('correspondence_settings')
      .select('admin_email, form_header_title')
      .limit(1)
      .maybeSingle();

    const adminEmail = data?.admin_email;
    if (!adminEmail) return;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || 'https://cateringhu2257.builtwithrocket.new';
    const headerTitle = data?.form_header_title || 'Cardamom Catering';
    const timestamp = new Date().toISOString();

    // Call the internal admin-alert API route
    await fetch(`${siteUrl}/api/admin-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminEmail,
        headerTitle,
        subject: '⚠️ Delivery Calculation Error – Action Required',
        errorDetail,
        context: `Customer destination: "${destination}"`,
        timestamp,
        siteUrl,
      }),
    });
  } catch {
    // Silently swallow — admin notification must never break the user flow
    console.error('[distance] Failed to send admin error notification');
  }
}
