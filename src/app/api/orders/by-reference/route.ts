import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** GET ?ref=ORDER_REF — public lookup for checkout return pages (payment_method only). */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from("orders")
    .select("payment_method, payment_status, m_payment_id")
    .eq("m_payment_id", ref)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    payment_method: data.payment_method,
    payment_status: data.payment_status,
    m_payment_id: data.m_payment_id,
  });
}
