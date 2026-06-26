/**
 * Test / resend PayFast auto-confirmation email for a cooking class or event registration.
 * Usage: node scripts/test-payfast-confirmation-email.mjs <registrationId|email>
 *
 * Uses the same sendPayfastBookingConfirmationEmail path as ITN / complete-pending-payment.
 * Does not touch manual EFT staff confirmation flows.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/test-payfast-confirmation-email.mjs <registrationId|email>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function findRegistration(lookup) {
  const isEmail = lookup.includes('@');
  const filter = isEmail ? { email: lookup } : { id: lookup };

  const { data: cc } = await supabase
    .from('cooking_class_registrations')
    .select('*')
    .match(filter)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cc) return { kind: 'cooking_class', reg: cc };

  const { data: ev } = await supabase
    .from('event_management_registrations')
    .select('*')
    .match(filter)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ev) return { kind: 'event', reg: ev };

  return null;
}

async function sendConfirmation(kind, registrationId) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4028';
  const res = await fetch(`${base}/api/bookings/send-payfast-confirmation-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, registrationId }),
  });

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body;

  throw new Error(body.error || `API status ${res.status} — is the dev server running?`);
}

async function main() {
  console.log(`\n=== PayFast confirmation email test ===`);
  console.log(`Lookup: ${arg}\n`);

  const found = await findRegistration(arg);
  if (!found) {
    console.error('No registration found for:', arg);
    process.exit(1);
  }

  const { kind, reg } = found;
  console.log('Registration:', {
    id: reg.id,
    kind,
    name: `${reg.title || ''} ${reg.first_name} ${reg.surname}`.trim(),
    email: reg.email,
    payment_status: reg.payment_status,
    payment_method: reg.payment_method,
    registration_code: reg.registration_code,
    payfast_confirmation_email_sent_at: reg.payfast_confirmation_email_sent_at,
    payfast_confirmation_email_error: reg.payfast_confirmation_email_error,
  });

  if (reg.payfast_confirmation_email_sent_at) {
    console.log('\nNote: payfast_confirmation_email_sent_at already set — send will be skipped by production code.');
    console.log('Clear sent_at in DB first if you need a true resend test.');
  }

  if (reg.payment_method && reg.payment_method.toLowerCase() !== 'payfast') {
    console.warn('\nWARN: payment_method is not payfast — auto PayFast path would skip in production.');
  }

  console.log('\nSending...\n');
  try {
    const result = await sendConfirmation(kind, reg.id);
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\n✅ Done. Check Resend (Today) and inbox:', reg.email);
  } catch (err) {
    console.error('\n❌ Failed:', err.message || err);
    process.exit(1);
  }
}

main();
