import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STAFF_ROLES = ["staff", "admin", "super_admin"];

function normalisePhone(raw: string): string {
  // Strip spaces, dashes, parentheses
  let p = raw.replace(/[\s\-().]/g, "");
  // Convert leading 0 to +27 (South Africa)
  if (p.startsWith("0") && p.length === 10) {
    p = "+27" + p.slice(1);
  }
  return p;
}

function looksLikePhone(input: string): boolean {
  // Matches strings that are mostly digits (with optional +, spaces, dashes)
  return /^[\d\s\+\-\(\)]{7,}$/.test(input.trim());
}

export async function POST(req: NextRequest) {
  // ── POPIA: require authenticated session ──────────────────────────────────
  const supabaseServer = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be logged in to look up customer details." },
      { status: 401 }
    );
  }

  // Check if caller is a staff member (staff may look up any account)
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isStaff = profile?.role && STAFF_ROLES.includes(profile.role);

  try {
    const body = await req.json();
    const { identifier } = body as { identifier: string };

    if (!identifier || identifier.trim().length < 2) {
      return NextResponse.json({ error: "Please provide a name, email or phone number." }, { status: 400 });
    }

    const trimmed = identifier.trim();
    const trimmedLower = trimmed.toLowerCase();
    const isEmail = trimmedLower.includes("@");
    const isPhone = !isEmail && looksLikePhone(trimmed);

    // ── POPIA: non-staff users may only look up their own email account ──────
    if (!isStaff && isEmail && trimmedLower !== user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "You are not authorised to view details for a different account." },
        { status: 403 }
      );
    }

    // Non-staff users may not search by name or phone (would expose other accounts)
    if (!isStaff && !isEmail) {
      return NextResponse.json(
        { error: "Please use your registered email address to look up your account." },
        { status: 403 }
      );
    }

    let query = supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (isEmail) {
      query = query.ilike("customer_email", trimmedLower);
    } else if (isPhone) {
      // Try multiple phone formats
      const normalised = normalisePhone(trimmed);
      const raw = trimmed;
      query = query.or(
        `customer_phone.ilike.${raw},customer_phone.ilike.${normalised}`
      );
    } else {
      // Name search — use ilike with wildcard for partial match
      query = query.ilike("customer_name", `%${trimmed}%`);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Customer lookup error:", error);
      return NextResponse.json({ error: "Lookup failed. Please try again." }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: "No orders found for that name, email or phone number. Please check and try again." },
        { status: 404 }
      );
    }

    // Build profile from order data (most recent order has latest name)
    const latestOrder = orders[0];
    const profile = {
      customer_name: latestOrder.customer_name || "",
      customer_email: latestOrder.customer_email || "",
      customer_phone: latestOrder.customer_phone || "",
      first_order_date: orders[orders.length - 1].created_at,
    };

    return NextResponse.json({ profile, orders });
  } catch (err) {
    console.error("Customer lookup unexpected error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
