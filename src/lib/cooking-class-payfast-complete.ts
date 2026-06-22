import type { SupabaseClient } from '@supabase/supabase-js';

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
  payfastItnData?: Record<string, string> | null
): Promise<CompleteCookingClassPendingResult> {
  const code = registrationCode.trim();
  if (!code) {
    return { status: 'not_found' };
  }

  const { data: existing } = await supabaseAdmin
    .from('cooking_class_registrations')
    .select('id, payment_status, registration_code')
    .eq('registration_code', code)
    .maybeSingle();

  if (existing?.payment_status === 'paid') {
    return {
      status: 'already_paid',
      registrationId: existing.id,
      registrationCode: existing.registration_code || code,
    };
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
      return {
        status: 'error',
        message: regErr?.message || 'Failed to create registration from pending payment',
      };
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

    return { status: 'created', registrationId: reg.id, registrationCode: code };
  }

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      payment_status: 'paid',
      payfast_payment_id: payfastPaymentId || code,
    };
    if (payfastItnData && Object.keys(payfastItnData).length > 0) {
      updatePayload.payfast_itn_data = payfastItnData;
    }

    let { error: updateErr } = await supabaseAdmin
      .from('cooking_class_registrations')
      .update(updatePayload)
      .eq('id', existing.id);

    if (updateErr && updatePayload.payfast_itn_data) {
      delete updatePayload.payfast_itn_data;
      ({ error: updateErr } = await supabaseAdmin
        .from('cooking_class_registrations')
        .update(updatePayload)
        .eq('id', existing.id));
    }

    if (updateErr) {
      return { status: 'error', message: updateErr.message };
    }

    return {
      status: 'updated',
      registrationId: existing.id,
      registrationCode: existing.registration_code || code,
    };
  }

  return { status: 'not_found' };
}
