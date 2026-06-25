import type { SupabaseClient } from "@supabase/supabase-js";

export type PayfastBookingKind = "cooking_class" | "event";

export interface PayfastCompleteOutcome {
  status: "created" | "updated" | "already_paid" | "not_found" | "error";
  registrationId?: string;
  registrationCode?: string;
  message?: string;
}

interface SessionDatePayload {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_name: string | null;
  class_fee?: number | null;
  event_fee?: number | null;
}

interface RegistrationRow {
  id: string;
  title: string | null;
  first_name: string;
  surname: string;
  email: string;
  cellphone: string | null;
  amount: number | null;
  created_at: string;
  notes: string | null;
  registration_code: string | null;
  children: unknown;
  payment_method: string | null;
}

function normalizeEmail(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

function buildAdminEmails(
  infoEmail: string | null,
  adminEmail: string | null
): string[] {
  const adminEmails: string[] = [];
  if (infoEmail) adminEmails.push(infoEmail);
  if (adminEmail && adminEmail !== infoEmail) adminEmails.push(adminEmail);
  return adminEmails;
}

async function loadCookingClassSessionDates(
  supabaseAdmin: SupabaseClient,
  registrationId: string
): Promise<SessionDatePayload[]> {
  const { data: bookings } = await supabaseAdmin
    .from("cooking_class_booking_counts")
    .select("event_date_id")
    .eq("registration_id", registrationId);

  const eventDateIds = [
    ...new Set((bookings || []).map((b: { event_date_id: string }) => b.event_date_id)),
  ];
  if (eventDateIds.length === 0) return [];

  const { data: dates } = await supabaseAdmin
    .from("cooking_class_sessions")
    .select("id, event_date, start_time, end_time, location, class_fee, class_id")
    .in("id", eventDateIds);

  if (!dates?.length) return [];

  const classIds = [
    ...new Set(dates.map((d: { class_id: string }) => d.class_id).filter(Boolean)),
  ];
  const eventsMap: Record<string, string> = {};
  if (classIds.length > 0) {
    const { data: events } = await supabaseAdmin
      .from("cooking_classes")
      .select("id, name")
      .in("id", classIds);
    (events || []).forEach((e: { id: string; name: string }) => {
      eventsMap[e.id] = e.name;
    });
  }

  return dates.map(
    (d: {
      id: string;
      event_date: string | null;
      start_time: string | null;
      end_time: string | null;
      location: string | null;
      class_fee: number | null;
      class_id: string;
    }) => ({
      id: d.id,
      event_date: d.event_date,
      start_time: d.start_time,
      end_time: d.end_time,
      location: d.location,
      class_fee: d.class_fee,
      event_name: eventsMap[d.class_id] || null,
    })
  );
}

async function loadEventSessionDates(
  supabaseAdmin: SupabaseClient,
  registrationId: string
): Promise<SessionDatePayload[]> {
  const { data: sessionData } = await supabaseAdmin
    .from("event_management_booking_counts")
    .select(
      "event_date_id, event_management_event_dates(id, event_date, start_time, end_time, location, event_fee, event_management_events(name))"
    )
    .eq("registration_id", registrationId);

  if (!sessionData?.length) return [];

  const sessions: SessionDatePayload[] = [];
  for (const row of (sessionData || []) as unknown as Array<{
    event_management_event_dates: (Omit<SessionDatePayload, "event_name"> & {
      event_management_events: { name: string } | null;
    }) | null;
  }>) {
    const d = row.event_management_event_dates;
    if (!d) continue;
    sessions.push({
      id: d.id,
      event_date: d.event_date,
      start_time: d.start_time,
      end_time: d.end_time,
      location: d.location,
      event_fee: d.event_fee,
      event_name: d.event_management_events?.name || null,
    });
  }
  return sessions;
}

async function invokeBookingConfirmationEdgeFunction(
  kind: PayfastBookingKind,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, error: "Missing Supabase configuration" };
  }

  const functionName =
    kind === "cooking_class"
      ? "send-cooking-class-confirmation"
      : "send-event-booking-confirmation";

  const edgeRes = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(body),
  });

  let responseData: { error?: string; message?: string } = {};
  try {
    responseData = (await edgeRes.json()) as { error?: string; message?: string };
  } catch {
    responseData = { error: `Edge function returned status ${edgeRes.status}` };
  }

  if (!edgeRes.ok) {
    return {
      ok: false,
      error:
        responseData.error ||
        responseData.message ||
        `Edge function failed with status ${edgeRes.status}`,
    };
  }

  return { ok: true };
}

/**
 * Sends class/event booking confirmation email (customer + admin copies) after
 * PayFast payment is finalized. Idempotent: only runs for created/updated outcomes.
 * Non-blocking on failure — payment status is not rolled back.
 */
export async function sendPayfastBookingConfirmationEmail(
  supabaseAdmin: SupabaseClient,
  kind: PayfastBookingKind,
  registrationId: string
): Promise<{ sent: boolean; error?: string }> {
  const table =
    kind === "cooking_class"
      ? "cooking_class_registrations"
      : "event_management_registrations";

  const { data: reg, error: regErr } = await supabaseAdmin
    .from(table)
    .select(
      "id, title, first_name, surname, email, cellphone, amount, created_at, notes, registration_code, children, payment_method"
    )
    .eq("id", registrationId)
    .maybeSingle();

  if (regErr || !reg) {
    return { sent: false, error: regErr?.message || "Registration not found" };
  }

  const row = reg as RegistrationRow;
  const paymentMethod = (row.payment_method || "").toLowerCase();
  if (paymentMethod && paymentMethod !== "payfast") {
    // EFT confirmations are sent manually from staff workspace — do not duplicate.
    return { sent: false };
  }

  const { data: corrSettings } = await supabaseAdmin
    .from("correspondence_settings")
    .select("info_email, admin_email, form_header_title, logo_url")
    .limit(1)
    .maybeSingle();

  const infoEmail = normalizeEmail(corrSettings?.info_email);
  const adminEmail = normalizeEmail(corrSettings?.admin_email);
  const adminEmails = buildAdminEmails(infoEmail, adminEmail);

  const sessionDates =
    kind === "cooking_class"
      ? await loadCookingClassSessionDates(supabaseAdmin, registrationId)
      : await loadEventSessionDates(supabaseAdmin, registrationId);

  const fullName = `${row.title ? `${row.title} ` : ""}${row.first_name} ${row.surname}`;

  const payload = {
    registrationId: row.id,
    registrationCode: row.registration_code,
    fullName,
    customerEmail: row.email,
    cellphone: row.cellphone,
    amount: row.amount,
    createdAt: row.created_at,
    notes: row.notes,
    sessionDates,
    participants: Array.isArray(row.children) ? row.children : [],
    formHeaderTitle:
      normalizeEmail(corrSettings?.form_header_title) || "Cardamom Kitchen",
    logoUrl: corrSettings?.logo_url || null,
    adminEmails,
  };

  const result = await invokeBookingConfirmationEdgeFunction(kind, payload);
  if (!result.ok) {
    console.error(
      `[payfast-confirmation-email] ${kind} ${registrationId}:`,
      result.error
    );
    return { sent: false, error: result.error };
  }

  console.log(
    `[payfast-confirmation-email] Sent for ${kind} registration ${registrationId}`
  );
  return { sent: true };
}

/**
 * Call after completeCookingClassPayfast / completeEventBookingPayfast succeeds.
 * Skips already_paid (duplicate ITN / payment-return).
 */
export async function maybeSendPayfastBookingConfirmationEmail(
  supabaseAdmin: SupabaseClient,
  kind: PayfastBookingKind,
  outcome: PayfastCompleteOutcome
): Promise<void> {
  if (outcome.status !== "created" && outcome.status !== "updated") {
    return;
  }
  if (!outcome.registrationId) {
    return;
  }

  try {
    await sendPayfastBookingConfirmationEmail(
      supabaseAdmin,
      kind,
      outcome.registrationId
    );
  } catch (err) {
    console.error(
      `[payfast-confirmation-email] Unexpected error for ${kind}:`,
      err instanceof Error ? err.message : err
    );
  }
}
