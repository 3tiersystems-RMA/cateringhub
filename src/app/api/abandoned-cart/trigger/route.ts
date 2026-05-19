import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse?.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const edgeFnUrl = `${supabaseUrl}/functions/v1/send-abandoned-cart-reminder`;

    const res = await fetch(edgeFnUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const data = await res?.json();

    if (!res?.ok) {
      return NextResponse?.json({ error: data?.error || "Edge function failed" }, { status: 500 });
    }

    return NextResponse?.json(data);
  } catch (err) {
    const message = err instanceof Error ? err?.message : "Unknown error";
    return NextResponse?.json({ error: message }, { status: 500 });
  }
}
