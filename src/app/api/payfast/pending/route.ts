import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/payfast/pending
 * Stores the full order/registration payload in payfast_pending_payments
 * BEFORE redirecting the user to PayFast.
 * The ITN handler reads this record and creates the actual DB row on COMPLETE.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { m_payment_id, payment_type, payload } = body;

    if (!m_payment_id || !payment_type || !payload) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['order', 'event_booking', 'cooking_class'].includes(payment_type)) {
      return NextResponse.json({ error: 'Invalid payment_type' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { error } = await supabaseAdmin
      .from('payfast_pending_payments')
      .upsert(
        { m_payment_id, payment_type, payload },
        { onConflict: 'm_payment_id' }
      );

    if (error) {
      console.error('[payfast/pending] DB error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[payfast/pending]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
