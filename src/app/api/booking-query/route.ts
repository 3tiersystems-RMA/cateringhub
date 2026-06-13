import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface SessionDate {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_name: string | null;
  fee: number | null;
}

interface ParticipantRow {
  fullName?: string;
  full_name?: string;
  name?: string;
  ticket_number?: string;
  [key: string]: unknown;
}

interface RawRegistration {
  id: string;
  title: string;
  first_name: string;
  surname: string;
  email: string;
  cellphone: string;
  payment_status: string;
  payment_method: string;
  amount: number | null;
  created_at: string;
  selected_events: string[];
  notes: string | null;
  registration_code: string | null;
  children: ParticipantRow[] | null;
}

interface BookingCount {
  registration_id: string;
  event_date_id: string;
}

interface EventDate {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_id: string | null;
  class_fee?: number | null;
  event_fee?: number | null;
}

interface EventRow {
  id: string;
  name: string;
}

export interface CreditTransaction {
  id: string;
  booking_ref: string;
  booking_type: string;
  amount_applied: number;
  balance_before: number;
  balance_after: number;
  applied_at: string;
  notes: string | null;
}

export interface CustomerCredit {
  id: string;
  customer_email: string;
  customer_name: string;
  original_booking_ref: string;
  booking_type: string;
  total_issued: number;
  total_used: number;
  remaining_balance: number;
  credit_status: "active" | "used";
  issued_at: string;
  notes: string | null;
  transactions: CreditTransaction[];
}

async function enrichWithSessionDates(
  regs: RawRegistration[],
  bookingTable: string,
  datesTable: string,
  eventsTable: string,
  feeField: "class_fee" | "event_fee"
): Promise<Map<string, SessionDate[]>> {
  const result = new Map<string, SessionDate[]>();
  if (regs.length === 0) return result;

  const regIds = regs.map((r) => r.id);

  const { data: bookings } = await supabase
    .from(bookingTable)
    .select("registration_id, event_date_id")
    .in("registration_id", regIds);

  if (!bookings || bookings.length === 0) return result;

  const dateIds = [...new Set((bookings as BookingCount[]).map((b) => b.event_date_id))];

  const { data: dates } = await supabase
    .from(datesTable)
    .select(`id, event_date, start_time, end_time, location, event_id, ${feeField}`)
    .in("id", dateIds);

  if (!dates || dates.length === 0) return result;

  const eventIds = [...new Set((dates as EventDate[]).map((d) => d.event_id).filter(Boolean))];
  const eventsMap: Record<string, string> = {};

  if (eventIds.length > 0) {
    const { data: events } = await supabase
      .from(eventsTable)
      .select("id, name")
      .in("id", eventIds);
    (events as EventRow[] || []).forEach((e) => { eventsMap[e.id] = e.name; });
  }

  const datesMap: Record<string, SessionDate> = {};
  (dates as EventDate[]).forEach((d) => {
    datesMap[d.id] = {
      id: d.id,
      event_date: d.event_date,
      start_time: d.start_time,
      end_time: d.end_time,
      location: d.location,
      event_name: d.event_id ? (eventsMap[d.event_id] ?? null) : null,
      fee: feeField === "class_fee" ? (d.class_fee ?? null) : (d.event_fee ?? null),
    };
  });

  (bookings as BookingCount[]).forEach((b) => {
    if (!result.has(b.registration_id)) result.set(b.registration_id, []);
    const sd = datesMap[b.event_date_id];
    if (sd) result.get(b.registration_id)!.push(sd);
  });

  return result;
}

async function fetchCreditsForEmails(emails: string[]): Promise<CustomerCredit[]> {
  if (emails.length === 0) return [];

  const { data: credits, error } = await supabase
    .from("customer_credits")
    .select("*")
    .in("customer_email", emails)
    .order("issued_at", { ascending: false });

  if (error || !credits || credits.length === 0) return [];

  const creditIds = credits.map((c: CustomerCredit) => c.id);

  const { data: transactions } = await supabase
    .from("customer_credit_transactions")
    .select("*")
    .in("credit_id", creditIds)
    .order("applied_at", { ascending: true });

  const txByCredit: Record<string, CreditTransaction[]> = {};
  (transactions || []).forEach((tx: CreditTransaction & { credit_id: string }) => {
    if (!txByCredit[tx.credit_id]) txByCredit[tx.credit_id] = [];
    txByCredit[tx.credit_id].push(tx);
  });

  return credits.map((c: CustomerCredit) => ({
    ...c,
    transactions: txByCredit[c.id] || [],
  }));
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type")?.trim();
  const value = req.nextUrl.searchParams.get("value")?.trim();

  if (!type || !value) {
    return NextResponse.json({ error: "Missing search parameters" }, { status: 400 });
  }

  if (!["reference", "email", "cellphone"].includes(type)) {
    return NextResponse.json({ error: "Invalid search type" }, { status: 400 });
  }

  // Build filter column
  let ccColumn: string;
  let emColumn: string;

  if (type === "reference") {
    ccColumn = "registration_code";
    emColumn = "registration_code";
  } else if (type === "email") {
    ccColumn = "email";
    emColumn = "email";
  } else {
    ccColumn = "cellphone";
    emColumn = "cellphone";
  }

  const searchValue = type === "email" ? value.toLowerCase() : value;

  // Fetch from both tables in parallel
  const [ccResult, emResult] = await Promise.all([
    supabase
      .from("cooking_class_registrations")
      .select("id, title, first_name, surname, email, cellphone, payment_status, payment_method, amount, created_at, selected_events, notes, registration_code, children")
      .ilike(ccColumn, searchValue)
      .order("created_at", { ascending: false }),
    supabase
      .from("event_management_registrations")
      .select("id, title, first_name, surname, email, cellphone, payment_status, payment_method, amount, created_at, selected_events, notes, registration_code, children")
      .ilike(emColumn, searchValue)
      .order("created_at", { ascending: false }),
  ]);

  const ccRegs: RawRegistration[] = (ccResult.data as RawRegistration[]) || [];
  const emRegs: RawRegistration[] = (emResult.data as RawRegistration[]) || [];

  // Enrich with session dates
  const [ccDates, emDates] = await Promise.all([
    enrichWithSessionDates(
      ccRegs,
      "cooking_class_booking_counts",
      "cooking_class_event_dates",
      "cooking_class_events",
      "class_fee"
    ),
    enrichWithSessionDates(
      emRegs,
      "event_management_booking_counts",
      "event_management_event_dates",
      "event_management_events",
      "event_fee"
    ),
  ]);

  // Collect all registration codes to look up credit transactions applied against them
  const allRegs = [...ccRegs, ...emRegs];
  const allRegCodes = allRegs
    .map((r) => r.registration_code)
    .filter((code): code is string => !!code);

  // Build a map: registration_code -> total credit amount applied
  const creditAppliedMap: Record<string, number> = {};
  if (allRegCodes.length > 0) {
    const { data: txRows } = await supabase
      .from("customer_credit_transactions")
      .select("booking_ref, amount_applied")
      .in("booking_ref", allRegCodes);

    if (txRows && txRows.length > 0) {
      for (const tx of txRows as { booking_ref: string; amount_applied: number }[]) {
        creditAppliedMap[tx.booking_ref] = (creditAppliedMap[tx.booking_ref] || 0) + Number(tx.amount_applied);
      }
    }
  }

  const bookings = [
    ...ccRegs.map((r) => {
      const creditApplied = r.registration_code ? (creditAppliedMap[r.registration_code] || 0) : 0;
      const rawAmount = r.amount != null ? Number(r.amount) : null;
      // NOTE: rawAmount already reflects the post-credit amount stored in the DB.
      // credit_applied is shown as informational context only — do NOT subtract again.
      const effectiveAmount = rawAmount;
      return {
        ...r,
        type: "cooking_class" as const,
        session_dates: ccDates.get(r.id) || [],
        credit_applied: creditApplied > 0 ? creditApplied : null,
        effective_amount: effectiveAmount,
      };
    }),
    ...emRegs.map((r) => {
      const creditApplied = r.registration_code ? (creditAppliedMap[r.registration_code] || 0) : 0;
      const rawAmount = r.amount != null ? Number(r.amount) : null;
      // NOTE: rawAmount already reflects the post-credit amount stored in the DB.
      // credit_applied is shown as informational context only — do NOT subtract again.
      const effectiveAmount = rawAmount;
      return {
        ...r,
        type: "event" as const,
        session_dates: emDates.get(r.id) || [],
        credit_applied: creditApplied > 0 ? creditApplied : null,
        effective_amount: effectiveAmount,
      };
    }),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Collect unique emails from results to fetch credits
  let credits: CustomerCredit[] = [];

  if (allRegs.length > 0) {
    const uniqueEmails = [...new Set(allRegs.map((r) => r.email.toLowerCase().trim()))];
    credits = await fetchCreditsForEmails(uniqueEmails);
  } else if (type === "email") {
    // Even if no bookings found, try to fetch credits by email directly
    credits = await fetchCreditsForEmails([searchValue.toLowerCase().trim()]);
  }

  return NextResponse.json({ bookings, credits });
}
