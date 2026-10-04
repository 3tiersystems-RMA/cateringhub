import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfirmationRecipientKey = "customer" | "info_admin" | "main_admin";

export interface RecipientDeliveryRecord {
  email: string;
  sent_at: string | null;
  error: string | null;
  resend_id: string | null;
}

export type ConfirmationEmailRecipientsMap = Partial<
  Record<ConfirmationRecipientKey, RecipientDeliveryRecord>
>;

export type RecipientUiStatus = "sent" | "pending" | "failed" | "not_applicable";

export interface ResolvedRecipient {
  key: ConfirmationRecipientKey;
  label: string;
  email: string | null;
  status: RecipientUiStatus;
  sent_at: string | null;
  error: string | null;
  resend_id: string | null;
}

const RECIPIENT_LABELS: Record<ConfirmationRecipientKey, string> = {
  customer: "Registrant",
  info_admin: "Info admin copy",
  main_admin: "Main admin copy",
};

function normalizeEmail(val: string | null | undefined): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

function recordUiStatus(record: RecipientDeliveryRecord | null | undefined): RecipientUiStatus {
  if (!record) return "pending";
  if (record.sent_at) return "sent";
  if (record.error) return "failed";
  return "pending";
}

/** Build legacy all-sent map when only payfast_confirmation_email_sent_at exists. */
function legacyAllSentMap(
  legacySentAt: string | null | undefined,
  customerEmail: string,
  infoEmail: string | null,
  mainAdminEmail: string | null,
  legacyResendId?: string | null
): ConfirmationEmailRecipientsMap | null {
  if (!legacySentAt) return null;
  const map: ConfirmationEmailRecipientsMap = {
    customer: {
      email: customerEmail,
      sent_at: legacySentAt,
      error: null,
      resend_id: legacyResendId || null,
    },
  };
  if (infoEmail) {
    map.info_admin = {
      email: infoEmail,
      sent_at: legacySentAt,
      error: null,
      resend_id: legacyResendId || null,
    };
  }
  if (mainAdminEmail && mainAdminEmail !== infoEmail) {
    map.main_admin = {
      email: mainAdminEmail,
      sent_at: legacySentAt,
      error: null,
      resend_id: legacyResendId || null,
    };
  }
  return map;
}

export function resolveConfirmationRecipients(
  stored: ConfirmationEmailRecipientsMap | null | undefined,
  customerEmail: string,
  infoEmail: string | null | undefined,
  mainAdminEmail: string | null | undefined,
  legacySentAt?: string | null,
  legacyResendId?: string | null
): ResolvedRecipient[] {
  const info = normalizeEmail(infoEmail);
  const main = normalizeEmail(mainAdminEmail);
  const customer = normalizeEmail(customerEmail);

  const effectiveMap =
    stored && Object.keys(stored).length > 0
      ? stored
      : legacyAllSentMap(legacySentAt, customer || "", info, main, legacyResendId);

  const rows: ResolvedRecipient[] = [];

  rows.push({
    key: "customer",
    label: RECIPIENT_LABELS.customer,
    email: customer,
    status: customer ? recordUiStatus(effectiveMap?.customer) : "not_applicable",
    sent_at: effectiveMap?.customer?.sent_at || null,
    error: effectiveMap?.customer?.error || null,
    resend_id: effectiveMap?.customer?.resend_id || null,
  });

  rows.push({
    key: "info_admin",
    label: RECIPIENT_LABELS.info_admin,
    email: info,
    status: info ? recordUiStatus(effectiveMap?.info_admin) : "not_applicable",
    sent_at: effectiveMap?.info_admin?.sent_at || null,
    error: effectiveMap?.info_admin?.error || null,
    resend_id: effectiveMap?.info_admin?.resend_id || null,
  });

  if (main && main !== info) {
    rows.push({
      key: "main_admin",
      label: RECIPIENT_LABELS.main_admin,
      email: main,
      status: recordUiStatus(effectiveMap?.main_admin),
      sent_at: effectiveMap?.main_admin?.sent_at || null,
      error: effectiveMap?.main_admin?.error || null,
      resend_id: effectiveMap?.main_admin?.resend_id || null,
    });
  }

  return rows;
}

export function getApplicableRecipients(
  resolved: ResolvedRecipient[]
): ResolvedRecipient[] {
  return resolved.filter((r) => r.status !== "not_applicable" && r.email);
}

export function formatRecipientUiStatus(status: RecipientUiStatus): string {
  switch (status) {
    case "sent":
      return "Notified";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    default:
      return "—";
  }
}

export function getRecipientStatusBadgeClass(status: RecipientUiStatus): string {
  switch (status) {
    case "sent":
      return "bg-green-50 text-green-700 border-green-200";
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    case "pending":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

export function aggregateRecipientStatus(
  resolved: ResolvedRecipient[]
): RecipientUiStatus {
  const applicable = getApplicableRecipients(resolved);
  if (applicable.length === 0) return "not_applicable";
  if (applicable.every((r) => r.status === "sent")) return "sent";
  if (applicable.some((r) => r.status === "failed")) return "failed";
  if (applicable.some((r) => r.status === "sent")) return "pending";
  return "pending";
}

export interface EdgeRecipientResult {
  sent: boolean;
  emailId?: string;
  error?: string;
}

export function mergeRecipientDeliveryResults(
  current: ConfirmationEmailRecipientsMap | null | undefined,
  results: Partial<Record<ConfirmationRecipientKey, EdgeRecipientResult>>,
  emails: Partial<Record<ConfirmationRecipientKey, string>>
): ConfirmationEmailRecipientsMap {
  const merged: ConfirmationEmailRecipientsMap = { ...(current || {}) };
  const now = new Date().toISOString();

  for (const key of Object.keys(results) as ConfirmationRecipientKey[]) {
    const result = results[key];
    const email = emails[key];
    if (!result || !email) continue;

    const prev = merged[key];
    if (result.sent) {
      merged[key] = {
        email,
        sent_at: now,
        error: null,
        resend_id: result.emailId || null,
      };
    } else {
      merged[key] = {
        email,
        sent_at: prev?.sent_at || null,
        error: result.error || "Send failed",
        resend_id: prev?.resend_id || null,
      };
    }
  }

  return merged;
}

/**
 * Legacy edge responses return success + emailId only. Each recipientTarget in the
 * same invoke was sent by the edge function — mark all requested targets as sent.
 */
export function synthesizeEdgeResultsFromLegacyResponse(
  targetsToSend: Array<{ key: ConfirmationRecipientKey; email: string }>,
  emailId?: string | null
): Partial<Record<ConfirmationRecipientKey, EdgeRecipientResult>> {
  const edgeResults: Partial<Record<ConfirmationRecipientKey, EdgeRecipientResult>> =
    {};
  for (const t of targetsToSend) {
    edgeResults[t.key] = { sent: true, emailId: emailId || undefined };
  }
  return edgeResults;
}

/**
 * When customer copy is logged but co-admin copies from the same batch are still
 * pending (legacy logging), align their sent_at with the customer record.
 */
export function alignBatchRecipientsWithCustomer(
  map: ConfirmationEmailRecipientsMap,
  batchKeys: ConfirmationRecipientKey[],
  emails: Partial<Record<ConfirmationRecipientKey, string>>
): ConfirmationEmailRecipientsMap {
  const customer = map.customer;
  if (!customer?.sent_at) return map;

  const out: ConfirmationEmailRecipientsMap = { ...map };
  for (const key of batchKeys) {
    if (key === "customer") continue;
    const email = emails[key];
    if (!email) continue;
    const existing = out[key];
    if (existing?.sent_at || existing?.error) continue;
    out[key] = {
      email,
      sent_at: customer.sent_at,
      error: null,
      resend_id: customer.resend_id,
    };
  }
  return out;
}

/** Align info/main admin copies from stored customer delivery (DB backfill). */
export function alignCoAdminRecipientsWithCustomer(
  map: ConfirmationEmailRecipientsMap | null | undefined,
  infoEmail: string | null | undefined,
  mainAdminEmail: string | null | undefined
): ConfirmationEmailRecipientsMap {
  if (!map?.customer?.sent_at) return map ? { ...map } : {};

  const info = infoEmail?.trim() || null;
  const main = mainAdminEmail?.trim() || null;
  const out: ConfirmationEmailRecipientsMap = { ...map };
  const sentAt = map.customer.sent_at;
  const resendId = map.customer.resend_id;

  if (info && !out.info_admin?.sent_at && !out.info_admin?.error) {
    out.info_admin = {
      email: info,
      sent_at: sentAt,
      error: null,
      resend_id: resendId,
    };
  }
  if (
    main &&
    main !== info &&
    !out.main_admin?.sent_at &&
    !out.main_admin?.error
  ) {
    out.main_admin = {
      email: main,
      sent_at: sentAt,
      error: null,
      resend_id: resendId,
    };
  }
  return out;
}

export function allApplicableRecipientsSent(
  resolved: ResolvedRecipient[]
): boolean {
  const applicable = getApplicableRecipients(resolved);
  return applicable.length > 0 && applicable.every((r) => r.status === "sent");
}

export function isConfirmationRecipientsColumnError(message?: string): boolean {
  return Boolean(message?.includes("confirmation_email_recipients"));
}

/** Stored in payfast_confirmation_email_error when Resend delivered but DB logging failed. */
export const DELIVERY_LOGGING_FAILED_PREFIX = "DELIVERY_LOGGING_FAILED:";

export function isDeliveryLoggingFailedError(
  error: string | null | undefined
): boolean {
  return Boolean(error?.startsWith(DELIVERY_LOGGING_FAILED_PREFIX));
}

export function formatDeliveryLoggingFailedError(detail?: string): string {
  const msg =
    detail?.trim() ||
    "Confirmation was delivered via Resend but delivery status could not be saved";
  return `${DELIVERY_LOGGING_FAILED_PREFIX} ${msg}`;
}

export interface PersistRecipientStatusResult {
  ok: boolean;
  error?: string;
  legacyWritten: boolean;
  recipientsWritten: boolean;
}

const PERSIST_RETRY_DELAYS_MS = [0, 200, 500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistConfirmationRecipientStatusOnce(
  supabaseAdmin: SupabaseClient,
  options: {
    tableName: string;
    registrationId: string;
    recipientsMap: ConfirmationEmailRecipientsMap;
    allSent: boolean;
    recipientsColumnEnabled: boolean;
    anySent: boolean;
    customerDelivered: boolean;
    primaryResendId?: string | null;
    aggregateError?: string | null;
    logPrefix: string;
  }
): Promise<PersistRecipientStatusResult> {
  const {
    tableName,
    registrationId,
    recipientsMap,
    allSent,
    recipientsColumnEnabled,
    anySent,
    customerDelivered,
    primaryResendId,
    aggregateError,
    logPrefix,
  } = options;

  const legacyUpdate: Record<string, unknown> = {};
  const shouldMarkLegacySent =
    allSent || customerDelivered || (anySent && !recipientsColumnEnabled);

  if (shouldMarkLegacySent) {
    legacyUpdate.payfast_confirmation_email_sent_at = new Date().toISOString();
    legacyUpdate.payfast_confirmation_email_resend_id = primaryResendId || null;
    if (allSent || customerDelivered) {
      legacyUpdate.payfast_confirmation_email_error = null;
    } else if (aggregateError) {
      legacyUpdate.payfast_confirmation_email_error = aggregateError;
    }
  } else if (aggregateError) {
    legacyUpdate.payfast_confirmation_email_error = aggregateError;
  }

  const writeLegacy = async (): Promise<{ ok: boolean; error?: string }> => {
    if (Object.keys(legacyUpdate).length === 0) {
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from(tableName)
      .update(legacyUpdate)
      .eq("id", registrationId);
    if (error) {
      console.warn(
        `${logPrefix} Legacy persist failed for ${registrationId}:`,
        error.message
      );
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const writeRecipientsOnly = async (): Promise<{ ok: boolean; error?: string }> => {
    if (Object.keys(recipientsMap).length === 0) {
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from(tableName)
      .update({ confirmation_email_recipients: recipientsMap })
      .eq("id", registrationId);
    if (error) {
      console.warn(
        `${logPrefix} JSONB-only persist failed for ${registrationId}:`,
        error.message
      );
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  if (!recipientsColumnEnabled) {
    const legacyResult = await writeLegacy();
    return {
      ok: legacyResult.ok,
      error: legacyResult.error,
      legacyWritten: legacyResult.ok && Object.keys(legacyUpdate).length > 0,
      recipientsWritten: false,
    };
  }

  const combinedUpdate: Record<string, unknown> = {
    confirmation_email_recipients: recipientsMap,
    ...legacyUpdate,
  };

  const { error: combinedError } = await supabaseAdmin
    .from(tableName)
    .update(combinedUpdate)
    .eq("id", registrationId);

  if (!combinedError) {
    return {
      ok: true,
      legacyWritten: Object.keys(legacyUpdate).length > 0,
      recipientsWritten: true,
    };
  }

  console.warn(
    `${logPrefix} Combined persist failed for ${registrationId}:`,
    combinedError.message
  );

  // Fallback: legacy columns first (clears "Email pending" badge), then JSONB alone.
  if (Object.keys(legacyUpdate).length > 0) {
    const legacyResult = await writeLegacy();
    if (legacyResult.ok) {
      const jsonbResult = await writeRecipientsOnly();
      return {
        ok: true,
        legacyWritten: true,
        recipientsWritten: jsonbResult.ok,
        error: jsonbResult.error,
      };
    }
  }

  const jsonbResult = await writeRecipientsOnly();
  if (jsonbResult.ok) {
    return {
      ok: true,
      legacyWritten: false,
      recipientsWritten: true,
    };
  }

  const legacyResult = await writeLegacy();
  return {
    ok: legacyResult.ok,
    error: combinedError.message || legacyResult.error || jsonbResult.error,
    legacyWritten: legacyResult.ok && Object.keys(legacyUpdate).length > 0,
    recipientsWritten: false,
  };
}

/**
 * Persist per-recipient delivery state and legacy PayFast tracking columns.
 * Retries with backoff, then emergency minimal writes via recoverConfirmationDeliveryPersistence.
 */
export async function persistConfirmationRecipientStatus(
  supabaseAdmin: SupabaseClient,
  options: {
    tableName: string;
    registrationId: string;
    recipientsMap: ConfirmationEmailRecipientsMap;
    allSent: boolean;
    recipientsColumnEnabled: boolean;
    anySent: boolean;
    customerDelivered: boolean;
    primaryResendId?: string | null;
    aggregateError?: string | null;
    logPrefix: string;
  }
): Promise<PersistRecipientStatusResult> {
  let lastResult: PersistRecipientStatusResult = {
    ok: false,
    legacyWritten: false,
    recipientsWritten: false,
    error: "No persist attempt made",
  };

  for (let attempt = 0; attempt < PERSIST_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(PERSIST_RETRY_DELAYS_MS[attempt]);
    }
    lastResult = await persistConfirmationRecipientStatusOnce(supabaseAdmin, options);
    if (lastResult.ok) {
      return lastResult;
    }
  }

  if (options.customerDelivered || options.anySent) {
    const recovered = await recoverConfirmationDeliveryPersistence(
      supabaseAdmin,
      options
    );
    if (recovered.ok) {
      return recovered;
    }
    lastResult = recovered;
  }

  return lastResult;
}

/**
 * Last-resort recovery: minimal legacy timestamp and/or customer JSONB only.
 */
export async function recoverConfirmationDeliveryPersistence(
  supabaseAdmin: SupabaseClient,
  options: {
    tableName: string;
    registrationId: string;
    recipientsMap: ConfirmationEmailRecipientsMap;
    customerDelivered: boolean;
    primaryResendId?: string | null;
    logPrefix: string;
  }
): Promise<PersistRecipientStatusResult> {
  const {
    tableName,
    registrationId,
    recipientsMap,
    customerDelivered,
    primaryResendId,
    logPrefix,
  } = options;

  if (customerDelivered) {
    const minimalLegacy: Record<string, unknown> = {
      payfast_confirmation_email_sent_at: new Date().toISOString(),
      payfast_confirmation_email_resend_id: primaryResendId || null,
      payfast_confirmation_email_error: null,
    };
    const { error: legacyErr } = await supabaseAdmin
      .from(tableName)
      .update(minimalLegacy)
      .eq("id", registrationId);
    if (!legacyErr) {
      return { ok: true, legacyWritten: true, recipientsWritten: false };
    }
    console.warn(
      `${logPrefix} Emergency legacy persist failed for ${registrationId}:`,
      legacyErr.message
    );
  }

  const customerOnly: ConfirmationEmailRecipientsMap = recipientsMap.customer
    ? { customer: recipientsMap.customer }
    : {};
  if (Object.keys(customerOnly).length > 0) {
    const { error: jsonbErr } = await supabaseAdmin
      .from(tableName)
      .update({ confirmation_email_recipients: customerOnly })
      .eq("id", registrationId);
    if (!jsonbErr) {
      return { ok: true, legacyWritten: false, recipientsWritten: true };
    }
    console.warn(
      `${logPrefix} Emergency JSONB persist failed for ${registrationId}:`,
      jsonbErr.message
    );
  }

  return {
    ok: false,
    legacyWritten: false,
    recipientsWritten: false,
    error: "All delivery status persistence attempts failed",
  };
}

/** Record that Resend delivered but DB could not be updated (avoids plain "pending"). */
export async function markDeliveryLoggingFailed(
  supabaseAdmin: SupabaseClient,
  tableName: string,
  registrationId: string,
  detail?: string
): Promise<void> {
  const message = formatDeliveryLoggingFailedError(detail);
  const { error } = await supabaseAdmin
    .from(tableName)
    .update({ payfast_confirmation_email_error: message })
    .eq("id", registrationId);
  if (error) {
    console.warn(
      `[confirmation-email] Could not record delivery logging failure for ${registrationId}:`,
      error.message
    );
  }
}

/** True when the registrant (customer) copy has been delivered per stored map. */
export function isCustomerConfirmationDelivered(
  recipientsMap: ConfirmationEmailRecipientsMap | null | undefined
): boolean {
  return Boolean(recipientsMap?.customer?.sent_at);
}
