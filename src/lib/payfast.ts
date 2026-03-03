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

export function generateSignature(
  data: Record<string, string>,
  passphrase?: string
): string {
  // Build param string in the order fields are provided (NOT alphabetical)
  let pfOutput = "";
  for (const key in data) {
    if (data[key] !== "") {
      pfOutput += `${key}=${encodeURIComponent(data[key].trim())}&`;
    }
  }
  // Remove trailing ampersand
  let getString = pfOutput.slice(0, -1);

  if (passphrase && passphrase.trim() !== "") {
    getString += `&passphrase=${encodeURIComponent(passphrase.trim())}`;
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
  customStr2?: string;
  emailConfirmation?: string;
  confirmationAddress?: string;
}

export function buildPayFastFormData(
  paymentData: PayFastPaymentData
): Record<string, string> {
  const data: Record<string, string> = {
    merchant_id: paymentData.merchantId,
    merchant_key: paymentData.merchantKey,
    return_url: paymentData.returnUrl,
    cancel_url: paymentData.cancelUrl,
    notify_url: paymentData.notifyUrl,
    name_first: paymentData.nameFirst,
    name_last: paymentData.nameLast,
    email_address: paymentData.emailAddress,
    m_payment_id: paymentData.mPaymentId,
    amount: paymentData.amount,
    item_name: paymentData.itemName,
  };

  if (paymentData.cellNumber) data.cell_number = paymentData.cellNumber;
  if (paymentData.itemDescription) data.item_description = paymentData.itemDescription;
  if (paymentData.customStr1) data.custom_str1 = paymentData.customStr1;
  if (paymentData.customStr2) data.custom_str2 = paymentData.customStr2;
  if (paymentData.emailConfirmation) data.email_confirmation = paymentData.emailConfirmation;
  if (paymentData.confirmationAddress) data.confirmation_address = paymentData.confirmationAddress;

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
      pfParamString += `${key}=${encodeURIComponent(pfData[key] || "")}&`;
    } else {
      break;
    }
  }
  pfParamString = pfParamString.slice(0, -1);

  let tempParamString = pfParamString;
  if (passphrase && passphrase.trim() !== "") {
    tempParamString += `&passphrase=${encodeURIComponent(passphrase.trim())}`;
  }

  const signature = crypto.createHash("md5").update(tempParamString).digest("hex");
  return pfData.signature === signature;
}

export function validatePaymentAmount(
  expectedAmount: number,
  receivedAmount: string
): boolean {
  return Math.abs(expectedAmount - parseFloat(receivedAmount)) <= 0.01;
}

export function generateOrderId(): string {
  return `CH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
