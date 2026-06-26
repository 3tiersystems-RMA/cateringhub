import type { SupabaseClient } from "@supabase/supabase-js";
import {
  logPayfastTestEmailRecipients,
  logPayfastTestEmailResult,
  type PayfastTestTransactionSource,
} from "@/lib/payfast-test-logs";
import { sendCookingClassConfirmationEmail } from "@/lib/cooking-class-confirmation-send";
import { sendEventBookingConfirmationEmail } from "@/lib/event-booking-confirmation-send";

export type PayfastBookingKind = "cooking_class" | "event";

export interface PayfastCompleteOutcome {
  status: "created" | "updated" | "already_paid" | "not_found" | "error";
  registrationId?: string;
  registrationCode?: string;
  message?: string;
}

export interface PayfastConfirmationEmailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
  resendId?: string;
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
  payment_status: string | null;
  payfast_confirmation_email_sent_at?: string | null;
}

function isPfEmailColumnError(message: string | undefined): boolean {
  return Boolean(
    message?.includes("payfast_confirmation_email_sent_at") ||
    message?.includes("payfast_confirmation_email_error") ||
    message?.includes("payfast_confirmation_email_resend_id")
  );
}

async function loadRegistrationRow(
  supabaseAdmin: SupabaseClient,
  table: string,
  registrationId: string
): Promise<{ row: RegistrationRow | null; trackingEnabled: boolean; error?: string }> {
  const extendedSelect =
    "id, title, first_name, surname, email, cellphone, amount, created_at, notes, registration_code, children, payment_method, payment_status, payfast_confirmation_email_sent_at";

  const { data: reg, error: regErr } = await supabaseAdmin
    .from(table)
    .select(extendedSelect)
    .eq("id", registrationId)
    .maybeSingle();

  if (!regErr && reg) {
    return { row: reg as RegistrationRow, trackingEnabled: true };
  }

  if (regErr && isPfEmailColumnError(regErr.message)) {
    const { data: legacy, error: legacyErr } = await supabaseAdmin
      .from(table)
      .select(
        "id, title, first_name, surname, email, cellphone, amount, created_at, notes, registration_code, children, payment_method, payment_status"
      )
      .eq("id", registrationId)
      .maybeSingle();

    if (legacyErr || !legacy) {
      return {
        row: null,
        trackingEnabled: false,
        error: legacyErr?.message || "Registration not found",
      };
    }

    return { row: legacy as RegistrationRow, trackingEnabled: false };
  }

  return {
    row: null,
    trackingEnabled: true,
    error: regErr?.message || "Registration not found",
  };
}

function registrationTable(kind: PayfastBookingKind): string {
  return kind === "cooking_class"
    ? "cooking_class_registrations"
    : "event_management_registrations";
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

function isPayfastPaidRegistration(row: {
  payment_method: string | null;
  payment_status: string | null;
}): boolean {
  const paymentMethod = (row.payment_method || "").toLowerCase();
  if (paymentMethod && paymentMethod !== "payfast") return false;
  return row.payment_status === "paid";
}

async function markPayfastConfirmationEmailError(
  supabaseAdmin: SupabaseClient,
  kind: PayfastBookingKind,
  registrationId: string,
  error: string
): Promise<void> {
  const { error: updateErr } = await supabaseAdmin
    .from(registrationTable(kind))
    .update({ payfast_confirmation_email_error: error })
    .eq("id", registrationId);

  if (updateErr && !isPfEmailColumnError(updateErr.message)) {
    console.warn(
      `[payfast-confirmation-email] Could not record error for ${registrationId}:`,
      updateErr.message
    );
  }
}

async function markPayfastConfirmationEmailSent(
  supabaseAdmin: SupabaseClient,
  kind: PayfastBookingKind,
  registrationId: string,
  resendId?: string | null
): Promise<void> {
  const sentAt = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from(registrationTable(kind))
    .update({
      payfast_confirmation_email_sent_at: sentAt,
      payfast_confirmation_email_error: null,
      payfast_confirmation_email_resend_id: resendId || null,
    })
    .eq("id", registrationId);

  if (updateErr && !isPfEmailColumnError(updateErr.message)) {
    console.warn(
      `[payfast-confirmation-email] Sent but failed to mark ${registrationId}:`,
      updateErr.message
    );
  }
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
): Promise<{ ok: boolean; error?: string; emailId?: string }> {
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

  let responseData: { error?: string; message?: string; emailId?: string } = {};
  try {
    responseData = (await edgeRes.json()) as {
      error?: string;
      message?: string;
      emailId?: string;
    };
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

  return { ok: true, emailId: responseData.emailId };
}

/**
 * Sends class/event booking confirmation email (customer + admin copies) after
 * PayFast payment is finalized. Idempotent via payfast_confirmation_email_sent_at.
 * Non-blocking on failure — payment status is not rolled back.
 * Manual EFT staff confirmation does NOT update these columns.
 */
export async function sendPayfastBookingConfirmationEmail(
  supabaseAdmin: SupabaseClient,
  kind: PayfastBookingKind,
  registrationId: string,
  testSource: PayfastTestTransactionSource = "send-confirmation-email",
  options?: { forceResend?: boolean }
): Promise<PayfastConfirmationEmailResult> {
  const table = registrationTable(kind);

  const loaded = await loadRegistrationRow(supabaseAdmin, table, registrationId);
  if (!loaded.row) {
    return { sent: false, error: loaded.error || "Registration not found" };
  }

  const row = loaded.row;

  if (!isPayfastPaidRegistration(row)) {
    // EFT confirmations are sent manually from staff workspace — do not duplicate.
    logPayfastTestEmailResult({
      kind,
      source: testSource,
      registrationId,
      registrationCode: row.registration_code,
      customerEmail: row.email,
      sent: false,
      skipped: true,
      error: "Not a PayFast paid registration — manual EFT flow",
    });
    return { sent: false, skipped: true };
  }

  const { data: corrSettings } = await supabaseAdmin
    .from("correspondence_settings")
    .select("info_email, admin_email, form_header_title, logo_url")
    .limit(1)
    .maybeSingle();

  const infoEmail = normalizeEmail(corrSettings?.info_email);
  const adminEmail = normalizeEmail(corrSettings?.admin_email);
  const adminEmails = buildAdminEmails(infoEmail, adminEmail);
  const fullName = `${row.title ? `${row.title} ` : ""}${row.first_name} ${row.surname}`;

  logPayfastTestEmailRecipients({
    kind,
    source: testSource,
    registrationId: row.id,
    registrationCode: row.registration_code,
    registrantName: fullName,
    customerEmail: row.email,
    infoEmail,
    adminEmail,
    adminEmails,
  });

  if (kind === "cooking_class") {
    const result = await sendCookingClassConfirmationEmail(
      supabaseAdmin,
      registrationId,
      { forceResend: options?.forceResend }
    );

    logPayfastTestEmailResult({
      kind,
      source: testSource,
      registrationId,
      registrationCode: row.registration_code,
      customerEmail: row.email,
      sent: result.sent,
      skipped: result.skipped,
      error: result.error,
      resendId: result.resendId,
      willRetry: Boolean(result.error && !result.sent),
    });

    return {
      sent: result.sent,
      skipped: result.skipped,
      error: result.error,
      resendId: result.resendId,
    };
  }

  if (kind === "event") {
    const result = await sendEventBookingConfirmationEmail(
      supabaseAdmin,
      registrationId,
      { forceResend: options?.forceResend }
    );

    logPayfastTestEmailResult({
      kind,
      source: testSource,
      registrationId,
      registrationCode: row.registration_code,
      customerEmail: row.email,
      sent: result.sent,
      skipped: result.skipped,
      error: result.error,
      resendId: result.resendId,
      willRetry: Boolean(result.error && !result.sent),
    });

    return {
      sent: result.sent,
      skipped: result.skipped,
      error: result.error,
      resendId: result.resendId,
    };
  }

  if (loaded.trackingEnabled && row.payfast_confirmation_email_sent_at && !options?.forceResend) {
    logPayfastTestEmailResult({
      kind,
      source: testSource,
      registrationId,
      registrationCode: row.registration_code,
      customerEmail: row.email,
      sent: false,
      skipped: true,
      error: "Confirmation email already sent (payfast_confirmation_email_sent_at set)",
    });
    return { sent: false, skipped: true };
  }

  if (!row.email?.trim()) {
    const err = "customerEmail is required";
    if (loaded.trackingEnabled) {
      await markPayfastConfirmationEmailError(supabaseAdmin, kind, registrationId, err);
    }
    logPayfastTestEmailResult({
      kind,
      source: testSource,
      registrationId,
      registrationCode: row.registration_code,
      customerEmail: row.email,
      sent: false,
      error: err,
    });
    return { sent: false, error: err };
  }

  const sessionDates = await loadEventSessionDates(supabaseAdmin, registrationId);

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
      (corrSettings?.form_header_title || "").trim() || "Cardamom Kitchen",
    logoUrl: corrSettings?.logo_url || null,
    adminEmails,
  };

  const result = await invokeBookingConfirmationEdgeFunction(kind, payload);
  if (!result.ok) {
    const err = result.error || "Failed to send confirmation email";
    console.error(
      `[payfast-confirmation-email] ${kind} ${registrationId}:`,
      err
    );
    if (loaded.trackingEnabled) {
      await markPayfastConfirmationEmailError(supabaseAdmin, kind, registrationId, err);
    }
    logPayfastTestEmailResult({
      kind,
      source: testSource,
      registrationId,
      registrationCode: row.registration_code,
      customerEmail: row.email,
      sent: false,
      error: err,
      willRetry: true,
    });
    return { sent: false, error: err };
  }

  if (loaded.trackingEnabled) {
    await markPayfastConfirmationEmailSent(
      supabaseAdmin,
      kind,
      registrationId,
      result.emailId
    );
  }

  console.log(
    `[payfast-confirmation-email] Sent for ${kind} registration ${registrationId}`
  );
  logPayfastTestEmailResult({
    kind,
    source: testSource,
    registrationId,
    registrationCode: row.registration_code,
    customerEmail: row.email,
    sent: true,
    resendId: result.emailId,
  });
  return { sent: true, resendId: result.emailId };
}

/**
 * Call after completeCookingClassPayfast / completeEventBookingPayfast succeeds.
 * Sends on created/updated. On already_paid, retries if payfast_confirmation_email_sent_at is null.
 */
export async function maybeSendPayfastBookingConfirmationEmail(
  supabaseAdmin: SupabaseClient,
  kind: PayfastBookingKind,
  outcome: PayfastCompleteOutcome,
  testSource: PayfastTestTransactionSource = "send-confirmation-email"
): Promise<void> {
  if (!outcome.registrationId) {
    return;
  }

  const shouldSendOnOutcome =
    outcome.status === "created" || outcome.status === "updated";

  if (!shouldSendOnOutcome && outcome.status !== "already_paid") {
    return;
  }

  if (outcome.status === "already_paid") {
    const table = registrationTable(kind);
    const { data: row, error: rowErr } = await supabaseAdmin
      .from(table)
      .select(
        "payfast_confirmation_email_sent_at, payment_method, payment_status"
      )
      .eq("id", outcome.registrationId)
      .maybeSingle();

    if (rowErr && isPfEmailColumnError(rowErr.message)) {
      // Migration not applied yet — still attempt send (no idempotency column).
    } else if (row?.payfast_confirmation_email_sent_at) {
      return;
    }

    if (!isPayfastPaidRegistration(row || {})) {
      return;
    }
  }

  try {
    await sendPayfastBookingConfirmationEmail(
      supabaseAdmin,
      kind,
      outcome.registrationId,
      testSource
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[payfast-confirmation-email] Unexpected error for ${kind}:`,
      message
    );
    await markPayfastConfirmationEmailError(
      supabaseAdmin,
      kind,
      outcome.registrationId,
      message
    );
    logPayfastTestEmailResult({
      kind,
      source: testSource,
      registrationId: outcome.registrationId,
      sent: false,
      error: message,
      willRetry: true,
    });
  }
}

export interface ReconcilePayfastConfirmationResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    kind: PayfastBookingKind;
    registrationId: string;
    email: string;
    result: PayfastConfirmationEmailResult;
  }>;
}

/**
 * Safety net: resend PayFast confirmation for paid rows missing sent_at.
 * Does not affect manual EFT confirmation flows.
 */
export async function reconcilePayfastConfirmationEmails(
  supabaseAdmin: SupabaseClient,
  options?: { maxAgeDays?: number; limit?: number }
): Promise<ReconcilePayfastConfirmationResult> {
  const maxAgeDays = options?.maxAgeDays ?? 7;
  const limit = options?.limit ?? 50;
  const since = new Date();
  since.setDate(since.getDate() - maxAgeDays);
  const sinceIso = since.toISOString();

  const result: ReconcilePayfastConfirmationResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  const kinds: PayfastBookingKind[] = ["cooking_class", "event"];

  for (const kind of kinds) {
    const table = registrationTable(kind);
    let rows: Array<{ id: string; email: string }> | null = null;

    const extended = await supabaseAdmin
      .from(table)
      .select("id, email")
      .eq("payment_status", "paid")
      .eq("payment_method", "payfast")
      .is("payfast_confirmation_email_sent_at", null)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (extended.error && isPfEmailColumnError(extended.error.message)) {
      const legacy = await supabaseAdmin
        .from(table)
        .select("id, email")
        .eq("payment_status", "paid")
        .eq("payment_method", "payfast")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (legacy.error) {
        console.error(
          `[payfast-confirmation-email] Reconcile query failed (${kind}):`,
          legacy.error.message
        );
        continue;
      }
      rows = legacy.data;
    } else if (extended.error) {
      console.error(
        `[payfast-confirmation-email] Reconcile query failed (${kind}):`,
        extended.error.message
      );
      continue;
    } else {
      rows = extended.data;
    }

    for (const row of rows || []) {
      if (result.attempted >= limit) break;

      result.attempted += 1;
      const sendResult = await sendPayfastBookingConfirmationEmail(
        supabaseAdmin,
        kind,
        row.id,
        "reconcile-emails"
      );

      result.details.push({
        kind,
        registrationId: row.id,
        email: row.email,
        result: sendResult,
      });

      if (sendResult.sent) result.sent += 1;
      else if (sendResult.skipped) result.skipped += 1;
      else result.failed += 1;
    }
  }

  return result;
}
