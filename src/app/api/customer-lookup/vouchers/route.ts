import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { codes } = body as { codes: string[] };

    if (!codes || codes.length === 0) {
      return NextResponse.json({ vouchers: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .select("voucher_code, total_meals")
      .in("voucher_code", codes);

    if (error) {
      return NextResponse.json({ vouchers: [] });
    }

    return NextResponse.json({ vouchers: data || [] });
  } catch {
    return NextResponse.json({ vouchers: [] });
  }
}
