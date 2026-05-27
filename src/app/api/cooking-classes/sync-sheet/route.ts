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

    // Build base fields
    const events = (reg.selected_events || [])
      .map((e: string) => eventMap[e] || e)
      .join(', ');
    const dates = (reg.adult_class_dates || [])
      .map((d: string) => dateMap[d] || d)
      .join(', ');
    const submittedAt = new Date(reg.created_at).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
    });

    // Emergency contact helpers
    const c1 = reg.emergency_contact1 || {};
    const c2 = reg.emergency_contact2 || {};
    const formatContact = (c: Record<string, string>) => {
      if (!c.firstName && !c.surname) return '';
      const parts = [
        c.title || '',
        c.firstName || '',
        c.surname || '',
        c.cellNo ? `(${c.cellNo})` : '',
        c.relationshipToChild ? `[${c.relationshipToChild}]` : '',
      ].filter(Boolean);
      return parts.join(' ');
    };

    // Children details — each child gets its own set of columns
    const children: Array<Record<string, string>> = Array.isArray(reg.children) ? reg.children : [];

    // Build child columns (up to 10 children)
    const childColumns: string[] = [];
    for (let i = 0; i < 10; i++) {
      const child = children[i];
      if (child && child.fullName) {
        childColumns.push(
          child.fullName || '',
          child.dob || '',
          child.age || '',
          child.gender || '',
          child.grade || '',
          child.dietaryRestrictions || '',
        );
      } else {
        childColumns.push('', '', '', '', '', '');
      }
    }

    const rowValues = [
      [
        // ── Basic registration info ──────────────────────────────────────────
        submittedAt,
        reg.title || '',
        reg.first_name || '',
        reg.surname || '',
        reg.email || '',
        reg.cellphone || '',
        // ── Event & date selection ───────────────────────────────────────────
        events,
        dates,
        // ── Page 2: Personal details ─────────────────────────────────────────
        reg.relationship || '',
        reg.first_time_portal || '',
        reg.allergies_illness || '',
        reg.rsa_id_passport || '',
        // ── Page 3: Emergency contacts ───────────────────────────────────────
        formatContact(c1),
        formatContact(c2),
        // ── Page 4: School holiday attendance ───────────────────────────────
        reg.attend_school_holiday || '',
        // ── Payment ──────────────────────────────────────────────────────────
        reg.payment_method === 'payfast' ? 'PayFast' : 'EFT',
        reg.payment_status || '',
        reg.amount ? `R${Number(reg.amount).toFixed(2)}` : '',
        // ── Internal ID ──────────────────────────────────────────────────────
        reg.id,
        // ── Children (up to 10, 6 columns each) ─────────────────────────────
        ...childColumns,
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

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    const googleError = tokenData.error || 'unknown_error';
    const googleDesc = tokenData.error_description || '';
    const hint = getTokenErrorHint(googleError);
    throw new Error(
      `Failed to get Google access token: ${googleError}${googleDesc ? ` – ${googleDesc}` : ''}. ${hint}`
    );
  }

  return tokenData.access_token;
}

function getTokenErrorHint(error: string): string {
  switch (error) {
    case 'invalid_client':
      return 'The GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is incorrect. Re-check the values in your Google Cloud Console → Credentials.';
    case 'invalid_grant':
      return 'The GOOGLE_REFRESH_TOKEN has expired or been revoked. Go to OAuth Playground (developers.google.com/oauthplayground), re-authorise with your own credentials enabled, and copy the new refresh token.';
    case 'unauthorized_client':
      return 'The OAuth client is not authorised for this grant type. Make sure the OAuth consent screen is published and the client type is "Web application".';
    case 'access_denied':
      return 'Access was denied. Make sure the Google account used in OAuth Playground has access to the Google Sheet and that the Sheets API scope was selected.';
    default:
      return 'Verify that GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are all correctly copied from Google Cloud Console and OAuth Playground.';
  }
}
