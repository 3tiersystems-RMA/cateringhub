import { NextRequest, NextResponse } from 'next/server';
import { requireStaffMember } from '@/lib/api/staff-auth';

type ItnData = Record<string, string>;

function formatReceiptCurrency(value: string | number | null | undefined) {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `R ${num.toFixed(2)}`;
}

function isPayfastRegistration(reg: {
  payment_method?: string | null;
  payment_status?: string | null;
  payfast_payment_id?: string | null;
}) {
  if (!reg.payment_status || !['paid', 'awaiting_confirmation'].includes(reg.payment_status)) {
    return false;
  }
  if (reg.payment_method === 'eft' || reg.payment_method === 'credit') return false;
  if (reg.payment_method === 'payfast') return true;
  if (reg.payfast_payment_id) return true;
  // Legacy paid rows often omit payment_method; DB default is payfast.
  return !reg.payment_method;
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffMember();
  if ('error' in auth) return auth.error;

  const registrationId = req.nextUrl.searchParams.get('registrationId')?.trim();
  if (!registrationId) {
    return NextResponse.json({ error: 'registrationId is required' }, { status: 400 });
  }

  const { data: reg, error } = await auth.supabase
    .from('cooking_class_registrations')
    .select('*')
    .eq('id', registrationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!reg) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  }
  if (!isPayfastRegistration(reg)) {
    return NextResponse.json({ error: 'This registration was not paid via PayFast' }, { status: 400 });
  }

  const itn = (reg.payfast_itn_data || null) as ItnData | null;
  const payerName = [reg.title, reg.first_name, reg.surname].filter(Boolean).join(' ').trim();
  const classNames = Array.isArray(reg.selected_events) ? reg.selected_events.filter(Boolean).join(', ') : '';
  const mPaymentId = itn?.m_payment_id || reg.registration_code || null;
  const storedPfId = reg.payfast_payment_id || null;
  const pfPaymentId =
    itn?.pf_payment_id ||
    (storedPfId && storedPfId !== mPaymentId ? storedPfId : null);

  return NextResponse.json({
    receipt: {
      payerName,
      email: reg.email,
      cellphone: reg.cellphone,
      paymentStatus: itn?.payment_status || reg.payment_status,
      paymentDate: reg.created_at,
      registrationCode: reg.registration_code,
      mPaymentId,
      pfPaymentId,
      itemName: itn?.item_name || 'Cooking & Baking Class Registration',
      itemDescription: itn?.item_description || classNames || null,
      amountGross: formatReceiptCurrency(itn?.amount_gross ?? reg.amount),
      amountFee: formatReceiptCurrency(itn?.amount_fee),
      amountNet: formatReceiptCurrency(itn?.amount_net),
      hasItnData: Boolean(itn && Object.keys(itn).length > 0),
    },
  });
}
