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

    // Fetch correspondence settings
    const { data: corrSettings } = await supabase
      .from('correspondence_settings')
      .select('form_header_title, logo_url, terms_and_conditions, sales_representative, office_number, comments')
      .limit(1)
      .single();

    // Fetch the specific order or all outstanding orders
    let query = supabase
      .from('orders')
      .select('id, customer_name, customer_email, total, created_at, items, payment_status')
      .eq('payment_status', 'awaiting_payment');

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
            // Correspondence settings
            formHeaderTitle: corrSettings?.form_header_title || null,
            logoUrl: corrSettings?.logo_url || null,
            termsAndConditions: corrSettings?.terms_and_conditions || null,
            salesRepresentative: corrSettings?.sales_representative || null,
            officeNumber: corrSettings?.office_number || null,
            comments: corrSettings?.comments || null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          results.push({ orderId: order.id, email: order.customer_email, success: false, error: data.error });
        } else {
          results.push({ orderId: order.id, email: order.customer_email, success: true });
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
