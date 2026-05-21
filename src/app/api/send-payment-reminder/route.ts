import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch correspondence settings — non-fatal: if table missing or empty, proceed without settings
    let corrSettings: {
      form_header_title?: string | null;
      logo_url?: string | null;
      terms_and_conditions?: string | null;
      sales_representative?: string | null;
      office_number?: string | null;
      comments?: string | null;
      info_email?: string | null;
      admin_email?: string | null;
      banking_details?: string | null;
    } | null = null;

    try {
      const { data } = await supabase
        .from('correspondence_settings')
        .select('form_header_title, logo_url, terms_and_conditions, sales_representative, office_number, comments, info_email, admin_email, banking_details')
        .limit(1)
        .maybeSingle();
      corrSettings = data;
    } catch {
      // Table may not exist yet — continue without correspondence settings
      corrSettings = null;
    }

    // Normalize: treat empty strings as null so the template skips empty fields
    const normalize = (val: string | null | undefined): string | null => {
      if (!val || val.trim() === '') return null;
      return val.trim();
    };

    const formHeaderTitle = normalize(corrSettings?.form_header_title) ?? null;
    const logoUrl = normalize(corrSettings?.logo_url) ?? null;
    const termsAndConditions = normalize(corrSettings?.terms_and_conditions) ?? null;
    const salesRepresentative = normalize(corrSettings?.sales_representative) ?? null;
    const officeNumber = normalize(corrSettings?.office_number) ?? null;
    const comments = normalize(corrSettings?.comments) ?? null;
    const infoEmail = normalize(corrSettings?.info_email) ?? null;
    const bankingDetails = normalize(corrSettings?.banking_details) ?? null;

    // Fetch the specific order or all outstanding orders
    let query = supabase
      .from('orders')
      .select('id, customer_name, customer_email, total, created_at, items, payment_status')
      .eq('payment_status', 'unpaid');

    if (orderId) {
      query = query.eq('id', orderId);
    }

    const { data: orders, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ message: 'No outstanding orders found', sent: 0 });
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-payment-reminder`;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const results: { orderId: string; email: string; success: boolean; error?: string }[] = [];

    for (const order of orders) {
      if (!order.customer_email) {
        results.push({ orderId: order.id, email: '', success: false, error: 'No email address' });
        continue;
      }

      const orderDate = new Date(order.created_at).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      try {
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            customerName: order.customer_name || 'Valued Customer',
            customerEmail: order.customer_email,
            orderId: order.id,
            orderTotal: order.total,
            orderDate,
            items: order.items || [],
            // Correspondence settings — null means field is empty and will be hidden on the email
            formHeaderTitle,
            logoUrl,
            termsAndConditions,
            salesRepresentative,
            officeNumber,
            comments,
            bankingDetails,
            // CC info_email on payment reminders if set
            ccEmails: infoEmail ? [infoEmail] : [],
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          results.push({ orderId: order.id, email: order.customer_email, success: false, error: data.error });
        } else {
          results.push({ orderId: order.id, email: order.customer_email, success: true });
          // Record the date this reminder was sent on the order
          await supabase
            .from('orders')
            .update({ last_reminder_sent_at: new Date().toISOString() })
            .eq('id', order.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ orderId: order.id, email: order.customer_email, success: false, error: message });
      }
    }

    const sentCount = results.filter((r) => r.success).length;

    return NextResponse.json({ message: `Sent ${sentCount} reminder(s)`, sent: sentCount, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
