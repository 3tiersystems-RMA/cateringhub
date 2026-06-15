import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COOKING_CLASS_TABLES } from '@/lib/cooking-class-db';

export async function POST(req: NextRequest) {
  // ── TEMPORARILY DISABLED ─────────────────────────────────────────────────
  // Google Sheets sync has been deactivated until further notice.
  // All code, attributes, and configuration below remain intact for re-activation.
  // To re-enable: remove the early-return block below.
  return NextResponse.json(
    { disabled: true, message: 'Google Sheets sync is temporarily disabled.' },
    { status: 503 }
  );
  // ── END DISABLE BLOCK ─────────────────────────────────────────────────────

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
      .from(COOKING_CLASS_TABLES.registrations)
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regErr || !reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Load settings
    const { data: settings } = await supabaseAdmin
      .from(COOKING_CLASS_TABLES.settings)
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
      .from(COOKING_CLASS_TABLES.classes)
      .select('id, name');
    const eventMap: Record<string, string> = {};
    (eventsData || []).forEach((e: { id: string; name: string }) => {
      eventMap[e.id] = e.name;
    });

    // Load event date labels from DB
    const { data: datesData } = await supabaseAdmin
      .from(COOKING_CLASS_TABLES.sessions)
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

    // ── Helpers ──────────────────────────────────────────────────────────────
    const events = (reg.selected_events || [])
      .map((e: string) => eventMap[e] || e)
      .join(', ');

    const dates = (reg.adult_class_dates || [])
      .map((d: string) => dateMap[d] || d)
      .join(', ');

    const submittedAt = new Date(reg.created_at).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
    });

    // ── Emergency contacts ────────────────────────────────────────────────────
    const ec1 = reg.emergency_contact1 || {};
    const ec2 = reg.emergency_contact2 || {};

    // ── Children (up to 10) ───────────────────────────────────────────────────
    const children: Array<{
      fullName: string;
      dob: string;
      age: string;
      gender: string;
      grade: string;
      dietaryRestrictions: string;
    }> = Array.isArray(reg.children) ? reg.children : [];

    // Pad to 10 children so columns are always consistent
    const childrenPadded = Array.from({ length: 10 }, (_, i) => children[i] || {
      fullName: '',
      dob: '',
      age: '',
      gender: '',
      grade: '',
      dietaryRestrictions: '',
    });

    // ── Build child columns (6 columns × 10 children = 60 columns) ───────────
    const childColumns: string[] = [];
    childrenPadded.forEach(child => {
      childColumns.push(
        child.fullName || '',
        child.dob || '',
        child.age || '',
        child.gender || '',
        child.grade || '',
        child.dietaryRestrictions || '',
      );
    });

    // ── Build the full row in Google Sheet column sequence ────────────────────
    // Column sequence mirrors the multi-page form layout:
    //
    // [Page 1]  Timestamp | Title | First Name | Surname | Email | Cellphone | Event | Date(s)
    // [Page 2]  Relationship | First Time Portal | Allergies/Illness | RSA ID/Passport
    // [Page 3]  EC1 Title | EC1 First Name | EC1 Surname | EC1 Cell | EC1 Relationship to Child
    //           EC2 Title | EC2 First Name | EC2 Surname | EC2 Cell | EC2 Relationship to Child
    //           Medical Doctor First Name | Medical Doctor Surname | Medical Aid Name | Medical Aid Number
    // [Page 4]  Child 1-10 (Full Name | DOB | Age | Gender | Grade | Dietary) × 10
    //           Attend School Holiday
    //           Pictures Taken | Indemnity Consent | Indemnity File (Drive URL)
    // [Page 5]  Payment Method | Payment Status | Amount | Proof of Payment (Drive URL)
    // [Meta]    Registration ID
    const rowValues = [
      [
        // ── Page 1 — Personal Details ──────────────────────────────────────
        submittedAt,
        reg.title || '',
        reg.first_name || '',
        reg.surname || '',
        reg.email || '',
        reg.cellphone || '',
        events,
        dates,

        // ── Page 2 — Relationship & Important Information ──────────────────
        reg.relationship || '',
        reg.first_time_portal || '',
        reg.allergies_illness || '',
        reg.rsa_id_passport || '',

        // ── Page 3 — Emergency Contact 1 ──────────────────────────────────
        ec1.title || '',
        ec1.firstName || '',
        ec1.surname || '',
        ec1.cellNo || '',
        ec1.relationshipToChild || '',

        // ── Page 3 — Emergency Contact 2 ──────────────────────────────────
        ec2.title || '',
        ec2.firstName || '',
        ec2.surname || '',
        ec2.cellNo || '',
        ec2.relationshipToChild || '',

        // ── Page 3 — Medical Details ───────────────────────────────────────
        reg.medical_doctor_first_name || '',
        reg.medical_doctor_surname || '',
        reg.medical_aid_name || '',
        reg.medical_aid_number || '',

        // ── Page 4 — Children (10 × 6 columns) ────────────────────────────
        ...childColumns,

        // ── Page 4 — School Holiday & Consent ─────────────────────────────
        reg.attend_school_holiday || '',
        reg.pictures_taken || '',
        reg.indemnity_consent ? 'Yes' : 'No',
        reg.indemnity_file_url || '',

        // ── Page 5 — Payment ───────────────────────────────────────────────
        reg.payment_method === 'payfast' ? 'PayFast' : 'EFT',
        reg.payment_status || '',
        reg.amount ? `R${Number(reg.amount).toFixed(2)}` : '',
        reg.proof_of_payment_drive_url || '',

        // ── Meta ───────────────────────────────────────────────────────────
        reg.id,
      ],
    ];

    // Append to Google Sheet via Sheets API — use the configured tab name
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
      .from(COOKING_CLASS_TABLES.registrations)
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
    case 'invalid_grant':
      return 'The refresh token has expired or been revoked. Re-authorise the Google account in the workspace settings.';
    case 'invalid_client':
      return 'Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.';
    case 'unauthorized_client':
      return 'The OAuth client is not authorised for this grant type. Verify your Google Cloud Console settings.';
    default:
      return 'Check your Google OAuth environment variables and ensure the refresh token is valid.';
  }
}
