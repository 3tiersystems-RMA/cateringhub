import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateOrderTotal, parseDiscountFromNotes } from '@/lib/order-totals';

interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  detail?: unknown;
}

interface VerificationReport {
  timestamp: string;
  overall: 'pass' | 'fail' | 'warn';
  checks: Record<string, CheckResult>;
}

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, CheckResult> = {};

  // ── 1. Supabase connectivity ──────────────────────────────────────────────
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('orders').select('id').limit(1);
    if (error) {
      checks.supabase_connection = {
        status: 'fail',
        message: 'Supabase query failed',
        detail: error.message,
      };
    } else {
      checks.supabase_connection = {
        status: 'pass',
        message: 'Supabase connection and orders table accessible',
      };
    }
  } catch (err) {
    checks.supabase_connection = {
      status: 'fail',
      message: 'Supabase client initialisation threw an exception',
      detail: String(err),
    };
  }

  // ── 2. Order-total calculation logic ─────────────────────────────────────
  const calcCases: Array<{
    label: string;
    input: Parameters<typeof calculateOrderTotal>[0];
    expected: number;
  }> = [
    {
      label: 'subtotal + delivery, no discount',
      input: { subtotal: 200, delivery_fee: 50, total: 250, notes: null },
      expected: 250,
    },
    {
      label: 'subtotal + delivery minus discount voucher',
      input: {
        subtotal: 200,
        delivery_fee: 50,
        total: 220,
        notes: 'Discount Voucher: SAVE20 (R30.00 credit)',
      },
      expected: 220,
    },
    {
      label: 'falls back to stored total when calculation <= 0',
      input: { subtotal: 0, delivery_fee: 0, total: 150, notes: null },
      expected: 150,
    },
    {
      label: 'discount parsed correctly from notes',
      input: {
        subtotal: 100,
        delivery_fee: 0,
        total: 80,
        notes: 'Discount Voucher: CODE10 (R20.00 credit)',
      },
      expected: 80,
    },
  ];

  const calcFailures: string[] = [];
  for (const c of calcCases) {
    const result = calculateOrderTotal(c.input);
    if (result !== c.expected) {
      calcFailures.push(
        `"${c.label}": expected ${c.expected}, got ${result}`
      );
    }
  }

  checks.order_calculation_logic = calcFailures.length === 0
    ? { status: 'pass', message: `All ${calcCases.length} calculation cases passed` }
    : { status: 'fail', message: 'One or more calculation cases failed', detail: calcFailures };

  // ── 3. Discount parser unit check ─────────────────────────────────────────
  const discountCases: Array<{ notes: string | null; expected: number }> = [
    { notes: null, expected: 0 },
    { notes: 'No voucher here', expected: 0 },
    { notes: 'Discount Voucher: ABC (R15.50 credit)', expected: 15.5 },
    { notes: 'Discount Voucher: XYZ (R100 credit)', expected: 100 },
  ];

  const discountFailures: string[] = [];
  for (const d of discountCases) {
    const result = parseDiscountFromNotes(d.notes);
    if (result !== d.expected) {
      discountFailures.push(
        `notes="${d.notes}": expected ${d.expected}, got ${result}`
      );
    }
  }

  checks.discount_parser = discountFailures.length === 0
    ? { status: 'pass', message: `All ${discountCases.length} discount-parse cases passed` }
    : { status: 'fail', message: 'Discount parser produced unexpected results', detail: discountFailures };

  // ── 4. Data consistency — orders with subtotal/delivery_fee fields ─────────
  try {
    const supabase = await createClient();
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, subtotal, delivery_fee, total, notes, status')
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      checks.data_consistency = {
        status: 'warn',
        message: 'Could not fetch orders for consistency check',
        detail: error.message,
      };
    } else if (!orders || orders.length === 0) {
      checks.data_consistency = {
        status: 'warn',
        message: 'No non-cancelled orders found to verify',
      };
    } else {
      const mismatches: Array<{ id: string; stored: number; calculated: number }> = [];
      for (const order of orders) {
        const calculated = calculateOrderTotal(order);
        const stored = Number(order.total) || 0;
        // Flag only when both subtotal and delivery_fee are present and the
        // calculated value differs from stored total by more than R0.01
        if (
          order.subtotal != null &&
          order.delivery_fee != null &&
          Math.abs(calculated - stored) > 0.01
        ) {
          mismatches.push({ id: order.id, stored, calculated });
        }
      }

      checks.data_consistency =
        mismatches.length === 0
          ? {
              status: 'pass',
              message: `${orders.length} orders checked — calculated totals match stored totals`,
            }
          : {
              status: 'warn',
              message: `${mismatches.length} of ${orders.length} orders have a discrepancy between calculated and stored total`,
              detail: mismatches,
            };
    }
  } catch (err) {
    checks.data_consistency = {
      status: 'warn',
      message: 'Data consistency check threw an exception',
      detail: String(err),
    };
  }

  // ── 5. Environment variables ──────────────────────────────────────────────
  const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const missingEnv = requiredEnv.filter((k) => !process.env[k]);
  checks.environment_variables =
    missingEnv.length === 0
      ? { status: 'pass', message: 'Required environment variables are set' }
      : { status: 'fail', message: 'Missing required env vars', detail: missingEnv };

  // ── Overall result ────────────────────────────────────────────────────────
  const statuses = Object.values(checks).map((c) => c.status);
  const overall: VerificationReport['overall'] = statuses.includes('fail')
    ? 'fail' : statuses.includes('warn')
    ? 'warn' :'pass';

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    overall,
    checks,
  };

  return NextResponse.json(report, {
    status: overall === 'fail' ? 500 : 200,
  });
}
