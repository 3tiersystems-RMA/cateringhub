import crypto from "crypto";

export const PAYFAST_CONFIG = {
  merchantId: process.env.PAYFAST_MERCHANT_ID || "",
  merchantKey: process.env.PAYFAST_MERCHANT_KEY || "",
  passphrase: process.env.PAYFAST_PASSPHRASE || "",
  sandbox: process.env.PAYFAST_SANDBOX === "true",
};

export function getPayFastHost(): string {
  return PAYFAST_CONFIG.sandbox
    ? "sandbox.payfast.co.za" :"www.payfast.co.za";
}

/**
 * Matches PHP urlencode():
 *  - spaces become "+"
 *  - everything else is percent-encoded
 * PayFast's server uses PHP urlencode() when verifying the signature.
 */
function phpUrlencode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

/**
 * Generate MD5 signature using EXACTLY the parameter order specified by PayFast:
 * merchant_id, merchant_key, return_url, cancel_url, notify_url,
 * name_first, name_last, email_address, cell_number, m_payment_id,
 * amount, item_name, item_description, custom_str1
 * Then append &passphrase=... before hashing.
 */
export function generateSignature(
  data: Record<string, string>,
  passphrase?: string
): string {
  // Build param string in the exact order fields are provided
  let pfOutput = "";
  for (const key in data) {
    if (data[key] !== "") {
      pfOutput += `${key}=${phpUrlencode(data[key].trim())}&`;
    }
  }
  // Remove trailing ampersand
  let getString = pfOutput.slice(0, -1);

  // Append passphrase before hashing
  if (passphrase && passphrase.trim() !== "") {
    getString += `&passphrase=${phpUrlencode(passphrase.trim())}`;
  }

  return crypto.createHash("md5").update(getString).digest("hex");
}

export interface PayFastPaymentData {
  merchantId: string;
  merchantKey: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  nameFirst: string;
  nameLast: string;
  emailAddress: string;
  cellNumber?: string;
  mPaymentId: string;
  amount: string;
  itemName: string;
  itemDescription?: string;
  customStr1?: string;
}

/**
 * Build form data in the EXACT parameter order required by PayFast:
 * merchant_id, merchant_key, return_url, cancel_url, notify_url,
 * name_first, name_last, email_address, cell_number (if present),
 * m_payment_id, amount, item_name, item_description (if present), custom_str1 (if present)
 *
 * NO custom_str2, email_confirmation, or confirmation_address.
 */
export function buildPayFastFormData(
  paymentData: PayFastPaymentData
): Record<string, string> {
  // Use an ordered approach — insert keys in exact PayFast-specified order
  const data: Record<string, string> = {};

  data.merchant_id = paymentData.merchantId;
  data.merchant_key = paymentData.merchantKey;
  data.return_url = paymentData.returnUrl;
  data.cancel_url = paymentData.cancelUrl;
  data.notify_url = paymentData.notifyUrl;
  data.name_first = paymentData.nameFirst;
  data.name_last = paymentData.nameLast;
  data.email_address = paymentData.emailAddress;
  if (paymentData.cellNumber) data.cell_number = paymentData.cellNumber;
  data.m_payment_id = paymentData.mPaymentId;
  data.amount = paymentData.amount;
  data.item_name = paymentData.itemName;
  if (paymentData.itemDescription) data.item_description = paymentData.itemDescription;
  if (paymentData.customStr1) data.custom_str1 = paymentData.customStr1;

  return data;
}

export interface ITNPayload {
  m_payment_id?: string;
  pf_payment_id: string;
  payment_status: "COMPLETE" | "CANCELLED" | string;
  item_name: string;
  item_description?: string;
  amount_gross?: string;
  amount_fee?: string;
  amount_net?: string;
  custom_str1?: string;
  custom_str2?: string;
  custom_str3?: string;
  custom_str4?: string;
  custom_str5?: string;
  custom_int1?: string;
  custom_int2?: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  merchant_id: string;
  signature?: string;
  [key: string]: string | undefined;
}

export function validateITNSignature(
  pfData: ITNPayload,
  passphrase?: string
): boolean {
  let pfParamString = "";
  for (const key in pfData) {
    if (key !== "signature") {
      pfParamString += `${key}=${phpUrlencode(pfData[key] || "")}&`;
    } else {
      break;
    }
  }
  pfParamString = pfParamString.slice(0, -1);

  let tempParamString = pfParamString;
  if (passphrase && passphrase.trim() !== "") {
    tempParamString += `&passphrase=${phpUrlencode(passphrase.trim())}`;
  }

  const signature = crypto
    .createHash("md5")
    .update(tempParamString)
    .digest("hex");
  return pfData.signature === signature;
}

export function validatePaymentAmount(
  expectedAmount: number,
  receivedAmount: string
): boolean {
  return Math.abs(expectedAmount - parseFloat(receivedAmount)) <= 0.01;
}

export function generateOrderId(): string {
  return `CH-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}
