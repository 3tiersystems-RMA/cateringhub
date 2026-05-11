import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert({
        m_payment_id: body.m_payment_id,
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        customer_phone: body.customer_phone,
        items: body.items,
        subtotal: body.subtotal,
        delivery_fee: body.delivery_fee,
        total: body.total,
        payment_status: body.payment_status,
        payment_method: body.payment_method,
        event_date: body.event_date ?? null,
        delivery_address: body.delivery_address,
        notes: body.notes,
      })
      .select("id, m_payment_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ id: data.id, reference: data.m_payment_id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
