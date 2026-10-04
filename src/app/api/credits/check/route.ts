import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/supabase-admin';

// GET /api/credits/check?email=...  — check active credits for an email
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) return NextResponse.json({ credits: [] });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('customer_credits')
    .select('*')
    .eq('customer_email', email.toLowerCase().trim())
    .eq('credit_status', 'active')
    .gt('remaining_balance', 0)
    .order('issued_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credits: data || [] });
}

// POST /api/credits/check — apply a credit to a booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creditId, bookingRef, bookingType, amountToApply } = body;

    if (!creditId || !bookingRef || !bookingType || !amountToApply) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch current credit
    const { data: credit, error: fetchErr } = await admin
      .from('customer_credits')
      .select('*')
      .eq('id', creditId)
      .eq('credit_status', 'active')
      .single();

    if (fetchErr || !credit) {
      return NextResponse.json({ error: 'Credit not found or inactive' }, { status: 404 });
    }

    const apply = Math.min(Number(amountToApply), Number(credit.remaining_balance));
    if (apply <= 0) {
      return NextResponse.json({ error: 'No credit balance available' }, { status: 400 });
    }

    const balanceBefore = Number(credit.remaining_balance);
    const balanceAfter = Math.max(0, balanceBefore - apply);
    const newTotalUsed = Number(credit.total_used) + apply;
    const newStatus = balanceAfter <= 0 ? 'used' : 'active';

    // Update credit
    const { error: updateErr } = await admin
      .from('customer_credits')
      .update({
        remaining_balance: balanceAfter,
        total_used: newTotalUsed,
        credit_status: newStatus,
      })
      .eq('id', creditId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Log transaction
    const { error: txErr } = await admin
      .from('customer_credit_transactions')
      .insert({
        credit_id: creditId,
        booking_ref: bookingRef,
        booking_type: bookingType,
        amount_applied: apply,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        applied_by: 'system',
        notes: `Credit applied to ${bookingType} booking ${bookingRef}`,
      });

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    return NextResponse.json({
      applied: apply,
      balanceBefore,
      balanceAfter,
      creditStatus: newStatus,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
