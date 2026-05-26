import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const EVENT_LABELS: Record<string, string> = {
  kids_cooking_baking: 'Kids Cooking and Baking Classes',
  adult_classes: 'Adult Classes',
  luncheon: 'Luncheon',
  other: 'Other',
};

const DATE_LABELS: Record<string, string> = {
  wed_13_may: 'Wed 13 May',
  sun_31_may: 'Sun 31 May',
};

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
      return NextResponse.json({ error: 'Google Sheet not configured' }, { status: 400 });
    }

    // Build row data
    const events = (reg.selected_events || []).map((e: string) => EVENT_LABELS[e] || e).join(', ');
    const dates = (reg.adult_class_dates || []).map((d: string) => DATE_LABELS[d] || d).join(', ');
    const submittedAt = new Date(reg.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });

    const rowValues = [
      [
        submittedAt,
        reg.title,
        reg.first_name,
        reg.surname,
        reg.email,
        reg.cellphone,
        events,
        dates,
        reg.payment_method === 'payfast' ? 'PayFast' : 'EFT',
        reg.payment_status,
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
        Authorization: `Bearer ${await getAccessToken()}`,
      },
      body: JSON.stringify({
        values: rowValues,
      }),
    });

    if (!sheetsRes.ok) {
      const errText = await sheetsRes.text();
      console.error('[Sheets sync] API error:', errText);
      return NextResponse.json({ error: 'Failed to write to Google Sheet', details: errText }, { status: 500 });
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

async function getAccessToken(): Promise<string> {
  // Use service account credentials from environment
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  }

  const credentials = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const signingInput = `${base64url(header)}.${base64url(payload)}`;

  // Sign with private key
  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}
