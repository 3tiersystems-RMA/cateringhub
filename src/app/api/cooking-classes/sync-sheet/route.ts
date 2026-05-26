import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { registrationId } = await req.json();
    if (!registrationId) {
      return NextResponse.json({ error: 'Missing registrationId' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Load registration
    const { data: reg, error: regErr } = await supabaseAdmin
      .from('cooking_class_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regErr || !reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Load settings
    const { data: settings } = await supabaseAdmin
      .from('cooking_class_settings')
      .select('sheet_id, sheet_name')
      .limit(1)
      .single();

    if (!settings?.sheet_id || !settings?.sheet_name) {
      return NextResponse.json({ error: 'Google Sheet not configured in settings' }, { status: 400 });
    }

    // Get OAuth access token
    const accessToken = await getOAuthAccessToken();

    // Load event names from DB for better labels
    const { data: eventsData } = await supabaseAdmin
      .from('cooking_class_events')
      .select('id, name');
    const eventMap: Record<string, string> = {};
    (eventsData || []).forEach((e: { id: string; name: string }) => {
      eventMap[e.id] = e.name;
    });

    // Load event date labels from DB
    const { data: datesData } = await supabaseAdmin
      .from('cooking_class_event_dates')
      .select('id, event_date, start_time, end_time');
    const dateMap: Record<string, string> = {};
    (datesData || []).forEach((d: { id: string; event_date: string; start_time: string; end_time: string }) => {
      const dateStr = new Date(d.event_date).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Johannesburg',
      });
      const startH = d.start_time ? d.start_time.slice(0, 5) : '';
      const endH = d.end_time ? d.end_time.slice(0, 5) : '';
      dateMap[d.id] = `${dateStr} (${startH} - ${endH})`;
    });

    // Build row data
    const events = (reg.selected_events || [])
      .map((e: string) => eventMap[e] || e)
      .join(', ');
    const dates = (reg.adult_class_dates || [])
      .map((d: string) => dateMap[d] || d)
      .join(', ');
    const submittedAt = new Date(reg.created_at).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
    });

    const rowValues = [
      [
        submittedAt,
        reg.title || '',
        reg.first_name || '',
        reg.surname || '',
        reg.email || '',
        reg.cellphone || '',
        events,
        dates,
        reg.payment_method === 'payfast' ? 'PayFast' : 'EFT',
        reg.payment_status || '',
        reg.amount ? `R${Number(reg.amount).toFixed(2)}` : '',
        reg.id,
      ],
    ];

    // Append to Google Sheet via Sheets API
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${settings.sheet_id}/values/${encodeURIComponent(settings.sheet_name)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const sheetsRes = await fetch(sheetsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values: rowValues }),
    });

    if (!sheetsRes.ok) {
      const errText = await sheetsRes.text();
      console.error('[Sheets sync] API error:', errText);
      return NextResponse.json(
        { error: 'Failed to write to Google Sheet', details: errText },
        { status: 500 }
      );
    }

    // Mark as synced
    await supabaseAdmin
      .from('cooking_class_registrations')
      .update({ synced_to_sheet: true })
      .eq('id', registrationId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[Sheets sync]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getOAuthAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google OAuth not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables.'
    );
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(
      `Failed to get Google access token: ${tokenData.error_description || tokenData.error || JSON.stringify(tokenData)}`
    );
  }

  return tokenData.access_token;
}
