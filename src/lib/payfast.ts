import crypto from "crypto";

// ─── Environment Switch ────────────────────────────────────────────────────
// Set PAYFAST_ENV=live in .env to go LIVE. Default is 'test' (sandbox).
const PAYFAST_ENV = (process.env.PAYFAST_ENV || "test").toLowerCase();
export const IS_TEST = PAYFAST_ENV !== "live";

const CONFIG = {
  test: {
    merchantId:   process.env.PF_TEST_MERCHANT_ID  || process.env.PAYFAST_MERCHANT_ID  || "10000100",
    merchantKey:  process.env.PF_TEST_MERCHANT_KEY || process.env.PAYFAST_MERCHANT_KEY || "46f0cd694581a",
    passphrase:   process.env.PF_TEST_PASSPHRASE   || process.env.PAYFAST_PASSPHRASE   || "jt7NOE43FZPn",
    gatewayHost:  "sandbox.payfast.co.za",
    gatewayPath:  "/eng/process",
    validateHost: "sandbox.payfast.co.za",
  },
  live: {
    merchantId:   process.env.PF_LIVE_MERCHANT_ID  || process.env.PAYFAST_MERCHANT_ID  || "",
    merchantKey:  process.env.PF_LIVE_MERCHANT_KEY || process.env.PAYFAST_MERCHANT_KEY || "",
    passphrase:   process.env.PF_LIVE_PASSPHRASE   || process.env.PAYFAST_PASSPHRASE   || "",
    gatewayHost:  "www.payfast.co.za",
    gatewayPath:  "/eng/process",
    validateHost: "www.payfast.co.za",
  },
};

export const pfConfig = CONFIG[IS_TEST ? "test" : "live"];

export const PAYFAST_GATEWAY_URL = `https://${pfConfig.gatewayHost}${pfConfig.gatewayPath}`;

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
  // Add custom_str1–5, payment_method etc. here if needed
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
 * PayFast requires parameters in a specific order, URL-encoded with spaces as +.
 */
export function buildSignatureString(
  params: Record<string, string | undefined>,
  withPassphrase = true
): string {
  const parts = PARAM_ORDER
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .map((k) => `${k}=${encodeURIComponent(String(params[k])).replace(/%20/g, "+")}`);

  if (withPassphrase && pfConfig.passphrase) {
    parts.push(
      `passphrase=${encodeURIComponent(pfConfig.passphrase).replace(/%20/g, "+")}`
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
  if (!pfConfig.merchantId || !pfConfig.merchantKey) {
    throw new Error(
      `Missing PayFast ${PAYFAST_ENV} credentials. Check .env (PF_${PAYFAST_ENV.toUpperCase()}_MERCHANT_ID / PF_${PAYFAST_ENV.toUpperCase()}_MERCHANT_KEY)`
    );
  }

  // For ITN (notify_url): use NGROK_URL in sandbox/test mode so PayFast can POST
  // callbacks to a locally-running server exposed via ngrok.
  // In production (IS_TEST=false) or when NGROK_URL is not set, fall back to baseUrl.
  const ngrokUrl = process.env.NGROK_URL?.replace(/\/$/, "");
  const itnBase = IS_TEST && ngrokUrl ? ngrokUrl : baseUrl;

  const params: Record<string, string> = {
    merchant_id:      pfConfig.merchantId,
    merchant_key:     pfConfig.merchantKey,
    return_url:       `${baseUrl}/checkout/success`,
    cancel_url:       `${baseUrl}/checkout/cancel`,
    notify_url:       `${itnBase}/api/payfast/itn`,
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
 * The signature field must already be removed from pfData before calling this.
 */
export function validateITNSignature(
  pfData: Record<string, string>,
  receivedSig: string
): boolean {
  const paramKeys = Object.keys(pfData);
  const parts = paramKeys
    .filter((k) => pfData[k] !== "")
    .map((k) => `${k}=${encodeURIComponent(pfData[k]).replace(/%20/g, "+")}`);

  if (pfConfig.passphrase) {
    parts.push(
      `passphrase=${encodeURIComponent(pfConfig.passphrase).replace(/%20/g, "+")}`
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const https = require("https");
    const body = Object.keys(pfData)
      .map((k) => `${k}=${encodeURIComponent(pfData[k]).replace(/%20/g, "+")}`)
      .join("&");

    const options = {
      host:   pfConfig.validateHost,
      port:   443,
      path:   "/eng/query/validate",
      method: "POST",
      headers: {
        "Content-Type":   "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(
      options,
      (res: { on: (event: string, cb: (chunk?: string) => void) => void }) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => resolve(data.trim() === "VALID"));
      }
    );

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
