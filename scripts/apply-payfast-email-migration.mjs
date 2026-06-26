/**
 * Apply PayFast confirmation email tracking columns.
 * Run: node scripts/apply-payfast-email-migration.mjs
 *
 * If automatic apply is unavailable, prints SQL for Supabase SQL Editor.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  if (!process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkColumn(column) {
  const { error } = await supabase
    .from('cooking_class_registrations')
    .select(column)
    .limit(1);
  return !error;
}

async function main() {
  console.log('Checking confirmation email tracking columns...');
  const hasPayfast = await checkColumn('payfast_confirmation_email_sent_at');
  const hasRecipients = await checkColumn('confirmation_email_recipients');

  if (hasPayfast && hasRecipients) {
    console.log('✅ All columns exist — migrations applied.');
    return;
  }

  const parts = [];
  if (!hasPayfast) {
    parts.push(readFileSync(
      join(__dirname, '..', 'supabase/migrations/20260625140000_payfast_confirmation_email_tracking.sql'),
      'utf8'
    ));
  }
  if (!hasRecipients) {
    parts.push(readFileSync(
      join(__dirname, '..', 'supabase/migrations/20260625150000_confirmation_email_recipients.sql'),
      'utf8'
    ));
  }

  console.log(`\n⚠️  Missing: ${!hasPayfast ? 'payfast_* columns ' : ''}${!hasRecipients ? 'confirmation_email_recipients ' : ''}`);
  console.log('Apply this SQL in Supabase → SQL Editor:\n');
  console.log('---');
  console.log(parts.join('\n'));
  console.log('---\n');
  console.log('Then re-run: node scripts/apply-payfast-email-migration.mjs');
  process.exit(1);
}

main();
