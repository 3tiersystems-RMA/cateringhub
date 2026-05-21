// old file:-  /home/ubuntu/app/cateringhub/src/lib/payfast.ts

import crypto from "crypto";

/**
 * PayFast Custom Integration (once-off payments).
 * @see https://developers.payfast.co.za/docs#step_1_form_fields
 * @see https://github.com/PayFast/payfast-php-sdk/blob/master/lib/Auth.php
 *
 * Environment (server-only secrets):
 *   PAYFAST_ENV=test|live          — single switch for gateway + credentials
 *   PAYFAST_SANDBOX_*              — sandbox.payfast.co.za
 *   PAYFAST_LIVE_*                 — www.payfast.co.za
 *   PAYFAST_MERCHANT_EMAIL         — blocked buyer emails (merchant login)
 *   PAYFAST_ITN_TUNNEL_URL         — optional public HTTPS URL for ITN in local sandbox dev
 *   NEXT_PUBLIC_SITE_URL           — return/cancel URLs (required in production)
 */

export type PayFastMode = "test" | "live";

function trimEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Primary switch: `test` = sandbox, `live` = production. */
export function getPayFastMode(): PayFastMode {
  const raw = (process.env.PAYFAST_ENV || "test").toLowerCase();
  if (raw === "live" || raw === "production") return "live";
  return "test";
}

export const PAYFAST_MODE = getPayFastMode();
export const IS_TEST = PAYFAST_MODE === "test";

function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const v of values) {
    const t = trimEnv(v);
    if (t) return t;
  }
  return "";
}

function sandboxCredentials() {
  const merchantId = firstNonEmpty(
    process.env.PAYFAST_SANDBOX_MERCHANT_ID,
    process.env.PF_TEST_MERCHANT_ID,
    process.env.PAYFAST_MERCHANT_ID
  );
  const merchantKey = firstNonEmpty(
    process.env.PAYFAST_SANDBOX_MERCHANT_KEY,
    process.env.PF_TEST_MERCHANT_KEY,
    process.env.PAYFAST_MERCHANT_KEY
  );
  const passphrase = firstNonEmpty(
    process.env.PAYFAST_SANDBOX_PASSPHRASE,
    process.env.PF_TEST_PASSPHRASE,
    process.env.PAYFAST_PASSPHRASE
  );

  if (!merchantId || !merchantKey) {
    throw new Error(
      "PayFast sandbox: set PAYFAST_SANDBOX_MERCHANT_ID and PAYFAST_SANDBOX_MERCHANT_KEY " +
        "(from https://sandbox.payfast.co.za → Settings → Integration)."
    );
  }
  return { merchantId, merchantKey, passphrase };
}

function liveCredentials() {
  const merchantId = firstNonEmpty(
    process.env.PAYFAST_LIVE_MERCHANT_ID,
    process.env.PF_LIVE_MERCHANT_ID,
    process.env.PAYFAST_MERCHANT_ID
  );
  const merchantKey = firstNonEmpty(
    process.env.PAYFAST_LIVE_MERCHANT_KEY,
    process.env.PF_LIVE_MERCHANT_KEY,
    process.env.PAYFAST_MERCHANT_KEY
  );
  const passphrase = firstNonEmpty(
    process.env.PAYFAST_LIVE_PASSPHRASE,
    process.env.PF_LIVE_PASSPHRASE,
    process.env.PAYFAST_PASSPHRASE
  );

  if (!merchantId || !merchantKey) {
    throw new Error(
      "PayFast live: set PAYFAST_LIVE_MERCHANT_ID and PAYFAST_LIVE_MERCHANT_KEY " +
        "(from https://www.payfast.co.za → Settings → Integration)."
    );
  }
  return { merchantId, merchantKey, passphrase };
}

function envCredentials(mode: PayFastMode) {
  return mode === "test" ? sandboxCredentials() : liveCredentials();
}

function buildActiveConfig() {
  if (PAYFAST_MODE === "test") {
    return {
      ...envCredentials("test"),
      gatewayHost: "sandbox.payfast.co.za",
      gatewayPath: "/eng/process",
      validateHost: "sandbox.payfast.co.za",
    } as const;
  }
  return {
    ...envCredentials("live"),
    gatewayHost: "www.payfast.co.za",
    gatewayPath: "/eng/process",
    validateHost: "www.payfast.co.za",
  } as const;
}

export const pfConfig = buildActiveConfig();

export const PAYFAST_GATEWAY_URL = `https://${pfConfig.gatewayHost}${pfConfig.gatewayPath}`;

/** Fields allowed in payment signature (order from PayFast PHP SDK Auth::generateSignature). */
const PAYMENT_SIGNATURE_FIELDS = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "notify_method",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "currency",
  "payment_method",
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
  "subscription_notify_email",
  "subscription_notify_webhook",
  "subscription_notify_buyer",
] as const;

export interface PayFastParams {
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first: string;
  name_last: string;
  email_address: string;
  cell_number?: string;
  m_payment_id: string;
  amount: string;
  item_name: string;
  item_description?: string;
  signature: string;
}

export function getPayFastBaseUrl(req?: { proto: string; host: string }): string {
  const fromEnv = trimEnv(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (req?.host) return `${req.proto}://${req.host}`;
  return "http://localhost:4028";
}

/** Public HTTPS base used for ITN when testing locally (ngrok, cloudflared, etc.). */
export function getPayFastItnBaseUrl(siteBase: string): string {
  const tunnel = firstNonEmpty(
    process.env.PAYFAST_ITN_TUNNEL_URL,
    process.env.NGROK_URL
  ).replace(/\/$/, "");

  if (IS_TEST && tunnel) return tunnel;
  return siteBase.replace(/\/$/, "");
}

/** PayFast login email(s) — buyer must use a different address (PayFast policy). */
export function getMerchantBlockedEmails(): string[] {
  const raw = trimEnv(process.env.PAYFAST_MERCHANT_EMAIL);
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * PayFast rejects checkout when email_address matches the merchant account email.
 * @see https://developers.payfast.co.za/docs#step_1_form_fields
 */
export function validateBuyerEmailForPayFast(buyerEmail: string): string | null {
  const buyer = normalizeEmail(buyerEmail);
  if (!buyer || !buyer.includes("@")) {
    return "A valid buyer email is required for PayFast checkout.";
  }

  const blocked = getMerchantBlockedEmails();
  if (blocked.length === 0) {
    return null;
  }

  if (blocked.includes(buyer)) {
    return (
      "PayFast cannot process a payment when the customer email is the same as your PayFast merchant account. " +
      "Use a different email in Event Details (e.g. a personal or test address), then try again."
    );
  }

  return null;
}

/** PHP-compatible urlencode (spaces as +). */
export function phpUrlencode(value: string): string {
  return encodeURIComponent(String(value).trim()).replace(/%20/g, "+");
}

function isNonEmpty(value: string | undefined): boolean {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

/**
 * Payment redirect signature — mirrors PayFast\Auth::generateSignature().
 * Only non-empty whitelisted fields; passphrase double-encoded per SDK.
 */
export function generatePaymentSignature(
  data: Record<string, string>,
  passPhrase: string | null
): string {
  const parts: string[] = [];

  for (const field of PAYMENT_SIGNATURE_FIELDS) {
    const value = data[field];
    if (isNonEmpty(value)) {
      parts.push(`${field}=${phpUrlencode(String(value))}`);
    }
  }

  if (passPhrase !== null && passPhrase.trim() !== "") {
    const encodedOnce = phpUrlencode(passPhrase.trim());
    parts.push(`passphrase=${phpUrlencode(encodedOnce)}`);
  }

  return computeMD5(parts.join("&"));
}

/** Drop empty values so form POST matches signature (PayFast rejects mismatches). */
export function stripEmptyPayFastFields(
  data: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isNonEmpty(value)) {
      out[key] = String(value).trim();
    }
  }
  return out;
}

export function computeMD5(sigString: string): string {
  return crypto.createHash("md5").update(sigString).digest("hex");
}

export function formatPayFastAmount(amount: number): string {
  return Number(amount).toFixed(2);
}

export function buildPaymentPayload(
  order: {
    paymentId: string;
    amount: number;
    itemName: string;
    itemDescription?: string;
  },
  buyer: {
    firstName: string;
    lastName: string;
    email: string;
    cell?: string;
  },
  baseUrl: string
): { params: PayFastParams; gatewayUrl: string } {
  if (!pfConfig.merchantId || !pfConfig.merchantKey) {
    throw new Error(
      `Missing PayFast ${PAYFAST_MODE} credentials. Set PAYFAST_${PAYFAST_MODE === "live" ? "LIVE" : "SANDBOX"}_MERCHANT_ID and PAYFAST_${PAYFAST_MODE === "live" ? "LIVE" : "SANDBOX"}_MERCHANT_KEY in .env`
    );
  }

  const siteBase = baseUrl.replace(/\/$/, "");
  const itnBase = getPayFastItnBaseUrl(siteBase);

  const raw: Record<string, string> = {
    merchant_id: pfConfig.merchantId,
    merchant_key: pfConfig.merchantKey,
    return_url: `${siteBase}/checkout/success?from=payfast`,
    cancel_url: `${siteBase}/checkout/cancel?from=payfast`,
    notify_url: `${itnBase}/api/payfast/itn`,
    name_first: buyer.firstName,
    name_last: buyer.lastName,
    email_address: buyer.email,
    m_payment_id: order.paymentId,
    amount: formatPayFastAmount(order.amount),
    item_name: order.itemName.slice(0, 100),
  };

  if (isNonEmpty(buyer.cell)) {
    raw.cell_number = buyer.cell!.trim();
  }
  if (isNonEmpty(order.itemDescription)) {
    raw.item_description = order.itemDescription!.trim().slice(0, 255);
  }

  const passPhrase = pfConfig.passphrase || null;
  const signature = generatePaymentSignature(raw, passPhrase);
  const cleaned = stripEmptyPayFastFields({ ...raw, signature });

  const params: PayFastParams = {
    merchant_id: cleaned.merchant_id,
    merchant_key: cleaned.merchant_key,
    return_url: cleaned.return_url,
    cancel_url: cleaned.cancel_url,
    notify_url: cleaned.notify_url,
    name_first: cleaned.name_first,
    name_last: cleaned.name_last,
    email_address: cleaned.email_address,
    m_payment_id: cleaned.m_payment_id,
    amount: cleaned.amount,
    item_name: cleaned.item_name,
    signature: cleaned.signature,
    ...(cleaned.cell_number ? { cell_number: cleaned.cell_number } : {}),
    ...(cleaned.item_description ? { item_description: cleaned.item_description } : {}),
  };

  return {
    params,
    gatewayUrl: PAYFAST_GATEWAY_URL,
  };
}

/** ITN: alphabetical order + single passphrase encode (PayFast\Auth::generateApiSignature). */
export function validateITNSignature(
  pfData: Record<string, string>,
  receivedSig: string
): boolean {
  const data = { ...pfData };
  const passPhrase = pfConfig.passphrase || null;

  if (passPhrase) {
    data.passphrase = passPhrase;
  }

  const keys = Object.keys(data)
    .filter((k) => k !== "signature" && isNonEmpty(data[k]))
    .sort();

  const pfParamString = keys
    .map((k) => `${k}=${phpUrlencode(data[k])}`)
    .join("&");

  return computeMD5(pfParamString) === receivedSig;
}

export function validateWithPayFast(pfData: Record<string, string>): Promise<boolean> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const https = require("https");
    const body = Object.keys(pfData)
      .filter((k) => isNonEmpty(pfData[k]))
      .sort()
      .map((k) => `${k}=${phpUrlencode(pfData[k])}`)
      .join("&");

    const options = {
      host: pfConfig.validateHost,
      port: 443,
      path: "/eng/query/validate",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(
      options,
      (res: { on: (event: string, cb: (chunk?: string) => void) => void }) => {
        let data = "";
        res.on("data", (chunk?: string) => (data += chunk ?? ""));
        res.on("end", () => resolve(data.trim() === "VALID"));
      }
    );

    req.on("error", (e: Error) => {
      console.error("[validateWithPayFast] Request error:", e.message);
      resolve(false);
    });

    req.write(body);
    req.end();
  });
}

/** PayFast server IPs for ITN validation (live only). */
export const PAYFAST_IPS = [
  "197.97.145.144",
  "41.74.179.194",
  "41.74.179.195",
  "41.74.179.196",
  "127.0.0.1",
  "::1",
];
