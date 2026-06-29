import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ConfirmationEmailRecipientsMap,
  type ConfirmationRecipientKey,
  type EdgeRecipientResult,
  allApplicableRecipientsSent,
  mergeRecipientDeliveryResults,
  resolveConfirmationRecipients,
  isConfirmationRecipientsColumnError,
  persistConfirmationRecipientStatus,
  isCustomerConfirmationDelivered,
  markDeliveryLoggingFailed,
  synthesizeEdgeResultsFromLegacyResponse,
  alignBatchRecipientsWithCustomer,
} from "@/lib/confirmation-email-recipients";

export interface EventBookingConfirmationSendResult {
  sent: boolean;
  skipped?: boolean;
  partial?: boolean;
  error?: string;
  resendId?: string;
  persisted?: boolean;
  persistError?: string;
  results?: Partial<Record<ConfirmationRecipientKey, EdgeRecipientResult>>;
  recipients?: ConfirmationEmailRecipientsMap;
}

function normalizeEmail(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

function buildAdminEmails(infoEmail: string | null, adminEmail: string | null): string[] {
  const adminEmails: string[] = [];
  if (infoEmail) adminEmails.push(infoEmail);
  if (adminEmail && adminEmail !== infoEmail) adminEmails.push(adminEmail);
  return adminEmails;
}

async function loadSessionDates(
  supabaseAdmin: SupabaseClient,
  registrationId: string
) {
  const { data: sessionData } = await supabaseAdmin
    .from("event_management_booking_counts")
    .select(
      "event_date_id, event_management_event_dates(id, event_date, start_time, end_time, location, event_fee, event_management_events(name))"
    )
    .eq("registration_id", registrationId);

  if (!sessionData?.length) return [];

  const sessions: Array<{
    id: string;
    event_date: string | null;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    event_fee: number | null;
    event_name: string | null;
  }> = [];

  for (const row of sessionData as unknown as Array<{
    event_management_event_dates: {
      id: string;
      event_date: string | null;
      start_time: string | null;
      end_time: string | null;
      location: string | null;
      event_fee: number | null;
      event_management_events: { name: string } | null;
    } | null;
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

async function loadRegistration(
  supabaseAdmin: SupabaseClient,
  registrationId: string
) {
  const extendedSelect =
    "id, title, first_name, surname, email, cellphone, amount, created_at, notes, registration_code, children, payment_method, payment_status, payfast_payment_id, payfast_confirmation_email_sent_at, payfast_confirmation_email_resend_id, confirmation_email_recipients";

  const { data: reg, error: regErr } = await supabaseAdmin
    .from("event_management_registrations")
    .select(extendedSelect)
    .eq("id", registrationId)
    .maybeSingle();

  if (!regErr && reg) {
    return { reg, recipientsColumnEnabled: true };
  }

  if (regErr && isConfirmationRecipientsColumnError(regErr.message)) {
    const { data: legacy, error: legacyErr } = await supabaseAdmin
      .from("event_management_registrations")
      .select(
        "id, title, first_name, surname, email, cellphone, amount, created_at, notes, registration_code, children, payment_method, payment_status, payfast_payment_id, payfast_confirmation_email_sent_at, payfast_confirmation_email_resend_id"
      )
      .eq("id", registrationId)
      .maybeSingle();

    if (legacyErr || !legacy) {
      return { reg: null, recipientsColumnEnabled: false, error: legacyErr?.message || "Registration not found" };
    }

    return { reg: legacy, recipientsColumnEnabled: false };
  }

  return { reg: null, recipientsColumnEnabled: false, error: regErr?.message || "Registration not found" };
}

// Legacy inline persist — replaced by persistConfirmationRecipientStatus in confirmation-email-recipients.ts
// async function persistRecipientStatus(...) { ... }

export async function sendEventBookingConfirmationEmail(
  supabaseAdmin: SupabaseClient,
  registrationId: string,
  options?: {
    targets?: ConfirmationRecipientKey[];
    forceResend?: boolean;
  }
): Promise<EventBookingConfirmationSendResult> {
  const loaded = await loadRegistration(supabaseAdmin, registrationId);
  const reg = loaded.reg;

  if (!reg) {
    return { sent: false, error: loaded.error || "Registration not found" };
  }

  if (!reg.email?.trim()) {
    return { sent: false, error: "customerEmail is required" };
  }

  const { data: corrSettings } = await supabaseAdmin
    .from("correspondence_settings")
    .select("info_email, admin_email, form_header_title, logo_url")
    .limit(1)
    .maybeSingle();

  const infoEmail = normalizeEmail(corrSettings?.info_email);
  const adminEmail = normalizeEmail(corrSettings?.admin_email);
  const adminEmails = buildAdminEmails(infoEmail, adminEmail);

  const resolved = resolveConfirmationRecipients(
    (reg as { confirmation_email_recipients?: ConfirmationEmailRecipientsMap | null })
      .confirmation_email_recipients ?? null,
    reg.email,
    infoEmail,
    adminEmail,
    reg.payfast_confirmation_email_sent_at,
    reg.payfast_confirmation_email_resend_id
  );

  const applicable = resolved.filter((r) => r.email && r.status !== "not_applicable");
  const requestedKeys =
    options?.targets && options.targets.length > 0
      ? options.targets
      : applicable.map((r) => r.key);

  const targetsToSend = applicable.filter((r) => {
    if (!requestedKeys.includes(r.key)) return false;
    if (options?.forceResend) return true;
    return r.status !== "sent";
  });

  if (targetsToSend.length === 0) {
    return {
      sent: false,
      skipped: true,
      error: options?.forceResend
        ? "No valid recipients selected for resend"
        : "Selected recipients are already notified — check the box to resend",
    };
  }

  const sessionDates = await loadSessionDates(supabaseAdmin, registrationId);
  const fullName = `${reg.title ? `${reg.title} ` : ""}${reg.first_name} ${reg.surname}`;

  const recipientTargets = targetsToSend.map((r) => ({
    key: r.key,
    email: r.email as string,
  }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { sent: false, error: "Missing Supabase configuration" };
  }

  const edgeRes = await fetch(`${supabaseUrl}/functions/v1/send-event-booking-confirmation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      registrationId: reg.id,
      registrationCode: reg.registration_code,
      fullName,
      customerEmail: reg.email,
      cellphone: reg.cellphone,
      amount: reg.amount,
      createdAt: reg.created_at,
      notes: reg.notes,
      sessionDates,
      participants: Array.isArray(reg.children) ? reg.children : [],
      formHeaderTitle: (corrSettings?.form_header_title || "").trim() || "Cardamom Kitchen",
      logoUrl: corrSettings?.logo_url || null,
      adminEmails,
      recipientTargets,
    }),
  });

  const responseData = (await edgeRes.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    emailId?: string;
    success?: boolean;
    results?: Partial<Record<ConfirmationRecipientKey, EdgeRecipientResult>>;
  };

  if (!edgeRes.ok && !responseData.results && !responseData.emailId) {
    return {
      sent: false,
      error:
        responseData.error ||
        responseData.message ||
        `Edge function failed with status ${edgeRes.status}`,
    };
  }

  let edgeResults = responseData.results || {};
  if (
    Object.keys(edgeResults).length === 0 &&
    (responseData.emailId || responseData.success)
  ) {
    edgeResults = synthesizeEdgeResultsFromLegacyResponse(
      recipientTargets,
      responseData.emailId
    );
  }

  const emailByKey: Partial<Record<ConfirmationRecipientKey, string>> = {};
  for (const t of targetsToSend) {
    emailByKey[t.key] = t.email as string;
  }

  let merged = mergeRecipientDeliveryResults(
    (reg as { confirmation_email_recipients?: ConfirmationEmailRecipientsMap | null })
      .confirmation_email_recipients ?? null,
    edgeResults,
    emailByKey
  );

  merged = alignBatchRecipientsWithCustomer(
    merged,
    targetsToSend.map((t) => t.key),
    emailByKey
  );

  const mergedResolved = resolveConfirmationRecipients(
    merged,
    reg.email,
    infoEmail,
    adminEmail
  );
  const allSent = allApplicableRecipientsSent(mergedResolved);
  const anySent = Object.values(edgeResults).some((r) => r?.sent);
  const anyFailed = Object.values(edgeResults).some((r) => r && !r.sent);
  const aggregateError = anyFailed
    ? Object.entries(edgeResults)
        .filter(([, r]) => r && !r.sent)
        .map(([k, r]) => `${k}: ${r?.error || "failed"}`)
        .join("; ")
    : null;

  const customerDelivered = isCustomerConfirmationDelivered(merged);

  const persistResult = await persistConfirmationRecipientStatus(supabaseAdmin, {
    tableName: "event_management_registrations",
    registrationId,
    recipientsMap: merged,
    allSent,
    recipientsColumnEnabled: loaded.recipientsColumnEnabled,
    anySent,
    customerDelivered,
    primaryResendId: responseData.emailId,
    aggregateError,
    logPrefix: "[event-booking-confirmation-send]",
  });

  if (!persistResult.ok && customerDelivered) {
    await markDeliveryLoggingFailed(
      supabaseAdmin,
      "event_management_registrations",
      registrationId,
      persistResult.error
    );
  }

  if (!anySent) {
    return {
      sent: false,
      error: aggregateError || "Failed to send confirmation email",
      results: edgeResults,
      recipients: merged,
      persisted: persistResult.ok,
      persistError: persistResult.error,
    };
  }

  return {
    sent: true,
    partial: anyFailed,
    resendId: responseData.emailId,
    results: edgeResults,
    recipients: merged,
    persisted: persistResult.ok,
    persistError: persistResult.ok
      ? undefined
      : persistResult.error ||
        "Email was sent but delivery status could not be saved to the database",
  };
}
