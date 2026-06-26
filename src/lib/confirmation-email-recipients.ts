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

export function allApplicableRecipientsSent(
  resolved: ResolvedRecipient[]
): boolean {
  const applicable = getApplicableRecipients(resolved);
  return applicable.length > 0 && applicable.every((r) => r.status === "sent");
}

export function isConfirmationRecipientsColumnError(message?: string): boolean {
  return Boolean(message?.includes("confirmation_email_recipients"));
}
