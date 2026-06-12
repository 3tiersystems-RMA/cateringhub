import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/supabase-admin';

// POST /api/credits/issue — issue a credit when a booking is marked no-show
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerEmail, customerName, bookingRef, bookingType, amount } = body;

    if (!customerEmail || !customerName || !bookingRef || !bookingType || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Check if credit already issued for this booking ref
    const { data: existing } = await admin
      .from('customer_credits')
      .select('id')
      .eq('original_booking_ref', bookingRef)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Credit already issued for this booking' }, { status: 409 });
    }

    // Create credit
    const { data: credit, error: creditErr } = await admin
      .from('customer_credits')
      .insert({
        customer_email: customerEmail.toLowerCase().trim(),
        customer_name: customerName,
        original_booking_ref: bookingRef,
        booking_type: bookingType,
        total_issued: Number(amount),
        total_used: 0,
        remaining_balance: Number(amount),
        credit_status: 'active',
      })
      .select('id')
      .single();

    if (creditErr || !credit) {
      return NextResponse.json({ error: creditErr?.message || 'Failed to create credit' }, { status: 500 });
    }

    // Fetch admin emails from correspondence_settings
    const { data: corrSettings } = await admin
      .from('correspondence_settings')
      .select('info_email, admin_email, form_header_title')
      .limit(1)
      .single();

    const adminEmails: string[] = [];
    if (corrSettings?.info_email) adminEmails.push(corrSettings.info_email);
    if (corrSettings?.admin_email) adminEmails.push(corrSettings.admin_email);
    const brandName = corrSettings?.form_header_title || 'Cardamom Kitchen';

    // Trigger email notification via edge function
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/functions/v1/send-credit-issued-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            creditId: credit.id,
            customerEmail: customerEmail.toLowerCase().trim(),
            customerName,
            bookingRef,
            bookingType,
            amount: Number(amount),
            adminEmails,
            brandName,
          }),
        });
      }
    } catch {
      // Non-blocking — credit is already created
    }

    return NextResponse.json({ creditId: credit.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
