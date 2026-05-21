import { NextResponse } from "next/server";
import {
  getPayFastBaseUrl,
  getPayFastItnBaseUrl,
  IS_TEST,
  PAYFAST_GATEWAY_URL,
  PAYFAST_MODE,
  pfConfig,
} from "@/lib/payfast";

/** GET — verify PayFast config loaded on server (no secrets). */
export async function GET() {
  const id = pfConfig?.merchantId;
  const siteBase = getPayFastBaseUrl();
  const itnBase = getPayFastItnBaseUrl(siteBase);

  return NextResponse?.json({
    env: PAYFAST_MODE,
    isSandbox: IS_TEST,
    gatewayUrl: PAYFAST_GATEWAY_URL,
    merchantIdMasked: id?.length > 4 ? `***${id?.slice(-4)}` : "****",
    passphraseConfigured: Boolean(pfConfig?.passphrase),
    merchantEmailGuardConfigured: Boolean(process.env.PAYFAST_MERCHANT_EMAIL?.trim()),
    siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
    returnUrl: `${siteBase}/checkout/success`,
    notifyUrl: `${itnBase}/api/payfast/itn`,
    itnUsesTunnel: IS_TEST && Boolean(
      process.env.PAYFAST_ITN_TUNNEL_URL?.trim() || process.env.NGROK_URL?.trim()
    ),
    hint: IS_TEST
      ? "Sandbox: credentials from https://sandbox.payfast.co.za. Buyer email must differ from PAYFAST_MERCHANT_EMAIL. For local ITN, set PAYFAST_ITN_TUNNEL_URL to your public HTTPS URL."
      : "Live: credentials from https://www.payfast.co.za. Ensure NEXT_PUBLIC_SITE_URL matches your production domain.",
  });
}
