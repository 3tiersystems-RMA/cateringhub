import type { SupabaseClient } from '@supabase/supabase-js';
import { logPayfastTestTransaction } from '@/lib/payfast-test-logs';

export type CompleteCookingClassPendingResult =
  | { status: 'created'; registrationId: string; registrationCode: string }
  | { status: 'updated'; registrationId: string; registrationCode: string }
  | { status: 'already_paid'; registrationId: string; registrationCode: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

interface PendingPayload {
  registration: Record<string, unknown>;
  selectedDateIds: string[];
}

/**
 * Finalize a cooking class registration after PayFast payment — used by ITN webhook and
 * payment-return fallback (same pattern as event bookings).
 */
export async function completeCookingClassPayfast(
  supabaseAdmin: SupabaseClient,
  registrationCode: string,
  payfastPaymentId?: string | null,
  payfastItnData?: Record<string, string> | null,
  testSource: 'payfast-itn' | 'payment-return' | 'complete-payfast' = 'complete-payfast'
): Promise<CompleteCookingClassPendingResult> {
  const code = registrationCode.trim();
  if (!code) {
    logPayfastTestTransaction({
      kind: 'cooking_class',
      source: testSource,
      registrationCode: code,
      payfastPaymentId: payfastPaymentId ?? null,
      outcome: 'not_found',
      success: false,
      reason: 'Empty registration code',
    });
    return { status: 'not_found' };
  }

  const { data: existing } = await supabaseAdmin
    .from('cooking_class_registrations')
    .select('id, payment_status, registration_code')
    .eq('registration_code', code)
    .maybeSingle();

  if (existing?.payment_status === 'paid') {
    const result = {
      status: 'already_paid' as const,
      registrationId: existing.id,
      registrationCode: existing.registration_code || code,
    };
    logPayfastTestTransaction({
      kind: 'cooking_class',
      source: testSource,
      registrationCode: code,
      registrationId: existing.id,
      payfastPaymentId: payfastPaymentId ?? null,
      outcome: result.status,
      success: true,
      reason: 'Registration already marked paid',
    });
    return result;
  }

  const { data: pendingRow } = await supabaseAdmin
    .from('payfast_pending_payments')
    .select('payload')
    .eq('m_payment_id', code)
    .eq('payment_type', 'cooking_class')
    .maybeSingle();

  if (pendingRow) {
    const p = pendingRow.payload as PendingPayload;
    const insertPayload: Record<string, unknown> = {
      ...p.registration,
      payment_status: 'paid',
      payfast_payment_id: payfastPaymentId || code,
    };

    if (payfastItnData && Object.keys(payfastItnData).length > 0) {
      insertPayload.payfast_itn_data = payfastItnData;
    }

    let { data: reg, error: regErr } = await supabaseAdmin
      .from('cooking_class_registrations')
      .insert(insertPayload)
      .select('id')
      .single();

    if ((regErr || !reg) && insertPayload.payfast_itn_data) {
      delete insertPayload.payfast_itn_data;
      ({ data: reg, error: regErr } = await supabaseAdmin
        .from('cooking_class_registrations')
        .insert(insertPayload)
        .select('id')
        .single());
    }

    if (regErr || !reg) {
      const result = {
        status: 'error' as const,
        message: regErr?.message || 'Failed to create registration from pending payment',
      };
      logPayfastTestTransaction({
        kind: 'cooking_class',
        source: testSource,
        registrationCode: code,
        payfastPaymentId: payfastPaymentId ?? null,
        outcome: result.status,
        success: false,
        reason: result.message,
      });
      return result;
    }

    if (Array.isArray(p.selectedDateIds) && p.selectedDateIds.length > 0) {
      await supabaseAdmin.from('cooking_class_booking_counts').insert(
        p.selectedDateIds.map((event_date_id: string) => ({
          event_date_id,
          registration_id: reg.id,
        }))
      );
    }

    await supabaseAdmin.from('payfast_pending_payments').delete().eq('m_payment_id', code);

    const result = { status: 'created' as const, registrationId: reg.id, registrationCode: code };
    logPayfastTestTransaction({
      kind: 'cooking_class',
      source: testSource,
      registrationCode: code,
      registrationId: reg.id,
      payfastPaymentId: payfastPaymentId ?? null,
      outcome: result.status,
      success: true,
      reason: 'Created registration from pending PayFast payment',
    });
    return result;
  }

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      payment_status: 'paid',
      payfast_payment_id: payfastPaymentId || code,
    };
    if (payfastItnData && Object.keys(payfastItnData).length > 0) {
      updatePayload.payfast_itn_data = payfastItnData;
    }

    let { data: updatedRows, error: updateErr } = await supabaseAdmin
      .from('cooking_class_registrations')
      .update(updatePayload)
      .eq('id', existing.id)
      .neq('payment_status', 'paid')
      .select('id');

    if (updateErr && updatePayload.payfast_itn_data) {
      delete updatePayload.payfast_itn_data;
      ({ data: updatedRows, error: updateErr } = await supabaseAdmin
        .from('cooking_class_registrations')
        .update(updatePayload)
        .eq('id', existing.id)
        .neq('payment_status', 'paid')
        .select('id'));
    }

    if (updateErr) {
      const result = { status: 'error' as const, message: updateErr.message };
      logPayfastTestTransaction({
        kind: 'cooking_class',
        source: testSource,
        registrationCode: code,
        registrationId: existing.id,
        payfastPaymentId: payfastPaymentId ?? null,
        outcome: result.status,
        success: false,
        reason: result.message,
      });
      return result;
    }

    if (!updatedRows?.length) {
      const result = {
        status: 'already_paid' as const,
        registrationId: existing.id,
        registrationCode: existing.registration_code || code,
      };
      logPayfastTestTransaction({
        kind: 'cooking_class',
        source: testSource,
        registrationCode: code,
        registrationId: existing.id,
        payfastPaymentId: payfastPaymentId ?? null,
        outcome: result.status,
        success: true,
        reason: 'Update matched no rows — already paid',
      });
      return result;
    }

    const result = {
      status: 'updated' as const,
      registrationId: existing.id,
      registrationCode: existing.registration_code || code,
    };
    logPayfastTestTransaction({
      kind: 'cooking_class',
      source: testSource,
      registrationCode: code,
      registrationId: existing.id,
      payfastPaymentId: payfastPaymentId ?? null,
      outcome: result.status,
      success: true,
      reason: 'Existing registration marked paid',
    });
    return result;
  }

  logPayfastTestTransaction({
    kind: 'cooking_class',
    source: testSource,
    registrationCode: code,
    payfastPaymentId: payfastPaymentId ?? null,
    outcome: 'not_found',
    success: false,
    reason: 'No pending payment or existing registration for code',
  });
  return { status: 'not_found' };
}
