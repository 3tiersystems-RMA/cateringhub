import crypto from "crypto";

// ─── Environment Switch ────────────────────────────────────────────────────
const IS_SANDBOX = process.env.PAYFAST_SANDBOX !== "false";

export const PAYFAST_CONFIG = {
  merchantId:  process.env.PAYFAST_MERCHANT_ID  || "10000100",
  merchantKey: process.env.PAYFAST_MERCHANT_KEY || "46f0cd694581a",
  passphrase:  process.env.PAYFAST_PASSPHRASE   || "",
  gatewayHost: IS_SANDBOX ? "sandbox.payfast.co.za" : "www.payfast.co.za",
  gatewayPath: "/eng/process",
  validateHost: IS_SANDBOX ? "sandbox.payfast.co.za" : "www.payfast.co.za",
  isSandbox: IS_SANDBOX,
};

export const PAYFAST_GATEWAY_URL = `https://${PAYFAST_CONFIG.gatewayHost}${PAYFAST_CONFIG.gatewayPath}`;

// ─── Parameter Order (as required by PayFast docs) ─────────────────────────
const PARAM_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
];

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
  signature?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build the ordered parameter string for MD5 signature.
 * Follows PayFast's required encoding: encodeURIComponent with spaces as +
 */
export function buildSignatureString(
  params: Record<string, string | undefined>,
  withPassphrase = true
): string {
  const parts = PARAM_ORDER
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .map((k) => `${k}=${encodeURIComponent(String(params[k])).replace(/%20/g, "+")}`);

  if (withPassphrase && PAYFAST_CONFIG.passphrase) {
    parts.push(
      `passphrase=${encodeURIComponent(PAYFAST_CONFIG.passphrase).replace(/%20/g, "+")}`
    );
  }

  return parts.join("&");
}

/**
 * Compute MD5 hash of the signature string.
 */
export function computeMD5(sigString: string): string {
  return crypto.createHash("md5").update(sigString).digest("hex");
}

/**
 * Build a fully-signed PayFast payment payload ready for form submission.
 */
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
  if (!PAYFAST_CONFIG.merchantId || !PAYFAST_CONFIG.merchantKey) {
    throw new Error("Missing PayFast credentials. Check environment variables.");
  }

  const params: Record<string, string> = {
    merchant_id:      PAYFAST_CONFIG.merchantId,
    merchant_key:     PAYFAST_CONFIG.merchantKey,
    return_url:       `${baseUrl}/checkout/success`,
    cancel_url:       `${baseUrl}/checkout/cancel`,
    notify_url:       `${baseUrl}/api/payfast/itn`,
    name_first:       buyer.firstName,
    name_last:        buyer.lastName,
    email_address:    buyer.email,
    cell_number:      buyer.cell || "",
    m_payment_id:     order.paymentId,
    amount:           order.amount.toFixed(2),
    item_name:        order.itemName,
    item_description: order.itemDescription || "",
  };

  const sigString = buildSignatureString(params, true);
  const signature = computeMD5(sigString);

  return {
    params: { ...params, signature } as PayFastParams,
    gatewayUrl: PAYFAST_GATEWAY_URL,
  };
}

/**
 * Validate ITN signature from PayFast POST data.
 */
export function validateITNSignature(
  pfData: Record<string, string>,
  receivedSig: string
): boolean {
  const paramKeys = Object.keys(pfData);
  const parts = paramKeys
    .filter((k) => pfData[k] !== "")
    .map((k) => `${k}=${encodeURIComponent(pfData[k]).replace(/%20/g, "+")}`);

  if (PAYFAST_CONFIG.passphrase) {
    parts.push(
      `passphrase=${encodeURIComponent(PAYFAST_CONFIG.passphrase).replace(/%20/g, "+")}`
    );
  }

  const sigString = parts.join("&");
  const computed = computeMD5(sigString);
  return computed === receivedSig;
}

/**
 * Validate the ITN with PayFast's own /eng/query/validate endpoint.
 * Returns true if PayFast responds with 'VALID'.
 */
export function validateWithPayFast(pfData: Record<string, string>): Promise<boolean> {
  return new Promise((resolve) => {
    const https = require("https");
    const body = Object.keys(pfData)
      .map((k) => `${k}=${encodeURIComponent(pfData[k]).replace(/%20/g, "+")}`)
      .join("&");

    const options = {
      host:   PAYFAST_CONFIG.validateHost,
      port:   443,
      path:   "/eng/query/validate",
      method: "POST",
      headers: {
        "Content-Type":   "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res: any) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => resolve(data.trim() === "VALID"));
    });

    req.on("error", (e: Error) => {
      console.error("[validateWithPayFast] Request error:", e);
      resolve(false);
    });

    req.write(body);
    req.end();
  });
}

// PayFast published IP ranges for ITN validation
export const PAYFAST_IPS = [
  "197.97.145.144",
  "41.74.179.194",
  "41.74.179.195",
  "41.74.179.196",
  // Sandbox / local
  "127.0.0.1",
  "::1",
];
