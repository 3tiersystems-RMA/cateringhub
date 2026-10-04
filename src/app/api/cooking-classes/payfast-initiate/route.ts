import { NextRequest, NextResponse } from 'next/server';
import {
  buildPaymentPayload,
  getPayFastBaseUrl,
  getPayFastItnBaseUrl,
  PAYFAST_MODE,
  validateBuyerEmailForPayFast,
  PAYFAST_GATEWAY_URL,
  formatPayFastAmount,
} from '@/lib/payfast';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order, buyer, registrationCode } = body;

    if (!order?.amount || !registrationCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const amount = Number(order.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }
    if (!buyer?.firstName || !buyer?.email) {
      return NextResponse.json({ error: 'Missing buyer fields' }, { status: 400 });
    }

    const emailError = validateBuyerEmailForPayFast(buyer.email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    const host = req.headers.get('host') || '';
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = getPayFastBaseUrl({ proto, host });
    const siteBase = baseUrl.replace(/\/$/, '');
    const itnBase = getPayFastItnBaseUrl(siteBase);

    // Clean URLs — no & in return/cancel, no query params in notify_url.
    // ITN identifies the registration via pfData.m_payment_id (= registrationCode).
    const returnUrl = `${siteBase}/cooking-classes/payment-return?status=success`;
    const cancelUrl = `${siteBase}/cooking-classes/payment-return?status=cancel`;
    const notifyUrl = `${itnBase}/api/cooking-classes/payfast-itn`;

    const payload = buildPaymentPayload(
      {
        paymentId: registrationCode,
        amount,
        itemName: 'Cooking & Baking Class Registration',
        itemDescription: order.itemDescription || undefined,
      },
      {
        firstName: buyer.firstName,
        lastName: buyer.lastName || '-',
        email: buyer.email,
        cell: buyer.cell || undefined,
      },
      siteBase,
      { returnUrl, cancelUrl, notifyUrl }
    );

    console.log('[CC PayFast initiate] env:', PAYFAST_MODE);
    console.log('[CC PayFast initiate] m_payment_id:', registrationCode);
    console.log('[CC PayFast initiate] amount:', formatPayFastAmount(amount));
    console.log('[CC PayFast initiate] notify_url:', notifyUrl);
    console.log('[CC PayFast initiate] gateway:', PAYFAST_GATEWAY_URL);

    return NextResponse.json({
      success: true,
      env: PAYFAST_MODE,
      gatewayUrl: payload.gatewayUrl,
      params: payload.params,
      fields: payload.fields,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[CC PayFast initiate]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
