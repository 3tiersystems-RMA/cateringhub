'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = '7d' | '30d' | '90d' | '12m';

interface OrderTrendPoint {
  label: string;
  orders: number;
  revenue: number;
}

interface FulfillmentMetric {
  status: string;
  count: number;
  color: string;
}

interface VoucherUsagePoint {
  label: string;
  mealVouchers: number;
  discountVouchers: number;
}

interface SummaryMetric {
  label: string;
  value: string;
  sub?: string;
  icon: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPeriodRange(period: Period): { from: Date; to: Date; bucketFn: (d: Date) => string } {
  const to = new Date();
  const from = new Date();

  if (period === '7d') {
    from.setDate(to.getDate() - 6);
    return { from, to, bucketFn: (d) => d.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit' }) };
  }
  if (period === '30d') {
    from.setDate(to.getDate() - 29);
    return { from, to, bucketFn: (d) => d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) };
  }
  if (period === '90d') {
    from.setDate(to.getDate() - 89);
    return {
      from, to, bucketFn: (d) => {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return weekStart.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
      }
    };
  }
  // 12m
  from.setMonth(to.getMonth() - 11);
  from.setDate(1);
  return { from, to, bucketFn: (d) => d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }) };
}

function buildDateBuckets(period: Period, bucketFn: (d: Date) => string): string[] {
  const buckets: string[] = [];
  const seen = new Set<string>();
  const to = new Date();
  const from = new Date();

  if (period === '7d') from.setDate(to.getDate() - 6);
  else if (period === '30d') from.setDate(to.getDate() - 29);
  else if (period === '90d') from.setDate(to.getDate() - 89);
  else { from.setMonth(to.getMonth() - 11); from.setDate(1); }

  const cur = new Date(from);
  while (cur <= to) {
    const label = bucketFn(new Date(cur));
    if (!seen.has(label)) { seen.add(label); buckets.push(label); }
    cur.setDate(cur.getDate() + 1);
  }
  return buckets;
}

const FULFILLMENT_COLORS: Record<string, string> = {
  new: '#3B82F6',
  confirmed: '#8B5CF6',
  preparing: '#F97316',
  ready: '#14B8A6',
  delivered: '#22C55E',
  cancelled: '#EF4444',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#DDD5C8] rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-[#1A1612] mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name === 'Revenue' ? `R${Number(p.value).toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StaffAnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [orderTrend, setOrderTrend] = useState<OrderTrendPoint[]>([]);
  const [voucherUsage, setVoucherUsage] = useState<VoucherUsagePoint[]>([]);
  const [fulfillmentMetrics, setFulfillmentMetrics] = useState<FulfillmentMetric[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetric[]>([]);
  const [error, setError] = useState('');

  // Auth guard
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/staff/login');
    });
  }, []);

  const loadAnalytics = useCallback(async (p: Period) => {
    setLoading(true);
    setError('');
    try {
      const { from, to, bucketFn } = getPeriodRange(p);
      const fromISO = from.toISOString();
      const toISO = to.toISOString();

      // Fetch orders in range
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, total, payment_status, fulfillment_status, created_at')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: true });

      if (ordersErr) throw ordersErr;

      // Fetch voucher redemptions in range
      const { data: redemptions, error: redemptionsErr } = await supabase
        .from('voucher_redemptions')
        .select('id, redeemed_at')
        .gte('redeemed_at', fromISO)
        .lte('redeemed_at', toISO);

      if (redemptionsErr) throw redemptionsErr;

      // Fetch discount voucher usage (orders with discounted payment_status or orders that used discount vouchers)
      // We use discount_vouchers times_used changes as proxy — instead fetch orders with discounted status in range
      const { data: dvOrders, error: dvErr } = await supabase
        .from('orders')
        .select('id, created_at, payment_status')
        .eq('payment_status', 'discounted')
        .gte('created_at', fromISO)
        .lte('created_at', toISO);

      if (dvErr) throw dvErr;

      // Build buckets
      const buckets = buildDateBuckets(p, bucketFn);
      const orderMap: Record<string, { orders: number; revenue: number }> = {};
      const voucherMap: Record<string, { mealVouchers: number; discountVouchers: number }> = {};
      buckets.forEach(b => {
        orderMap[b] = { orders: 0, revenue: 0 };
        voucherMap[b] = { mealVouchers: 0, discountVouchers: 0 };
      });

      // Populate order trend
      (orders || []).forEach(o => {
        const label = bucketFn(new Date(o.created_at));
        if (orderMap[label] !== undefined) {
          orderMap[label].orders += 1;
          orderMap[label].revenue += Number(o.total) || 0;
        }
      });

      // Populate voucher usage
      (redemptions || []).forEach(r => {
        const label = bucketFn(new Date(r.redeemed_at));
        if (voucherMap[label] !== undefined) {
          voucherMap[label].mealVouchers += 1;
        }
      });
      (dvOrders || []).forEach(o => {
        const label = bucketFn(new Date(o.created_at));
        if (voucherMap[label] !== undefined) {
          voucherMap[label].discountVouchers += 1;
        }
      });

      setOrderTrend(buckets.map(b => ({ label: b, ...orderMap[b] })));
      setVoucherUsage(buckets.map(b => ({ label: b, ...voucherMap[b] })));

      // Fulfillment breakdown
      const fulfillmentCount: Record<string, number> = {};
      (orders || []).forEach(o => {
        fulfillmentCount[o.fulfillment_status] = (fulfillmentCount[o.fulfillment_status] || 0) + 1;
      });
      const fulfillmentOrder = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
      setFulfillmentMetrics(
        fulfillmentOrder
          .filter(s => fulfillmentCount[s] !== undefined)
          .map(s => ({
            status: FULFILLMENT_LABELS[s] || s,
            count: fulfillmentCount[s],
            color: FULFILLMENT_COLORS[s] || '#8C8278',
          }))
      );

      // Summary metrics
      const totalOrders = (orders || []).length;
      const totalRevenue = (orders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const paidOrders = (orders || []).filter(o => o.payment_status === 'paid' || o.payment_status === 'discounted').length;
      const deliveredOrders = (orders || []).filter(o => o.fulfillment_status === 'delivered').length;
      const totalMealRedemptions = (redemptions || []).length;
      const totalDvUsed = (dvOrders || []).length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

      setSummaryMetrics([
        { label: 'Total Orders', value: String(totalOrders), sub: `${paidOrders} paid`, icon: '📋' },
        { label: 'Total Revenue', value: `R${totalRevenue.toFixed(2)}`, sub: `Avg R${avgOrderValue.toFixed(2)}/order`, icon: '💰' },
        { label: 'Meal Vouchers Used', value: String(totalMealRedemptions), sub: 'Redemptions', icon: '🎟️' },
        { label: 'Discount Vouchers', value: String(totalDvUsed), sub: 'Orders with discount', icon: '🏷️' },
        { label: 'Delivered Orders', value: String(deliveredOrders), sub: `${fulfillmentRate}% fulfillment rate`, icon: '✅' },
        { label: 'Cancelled Orders', value: String(fulfillmentCount['cancelled'] || 0), sub: 'In period', icon: '❌' },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics(period);
  }, [period, loadAnalytics]);

  const periodOptions: { value: Period; label: string }[] = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '12m', label: 'Last 12 Months' },
  ];

  const maxRevenue = Math.max(...orderTrend.map(d => d.revenue), 1);

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <header className="bg-white border-b border-[#EDE7DA] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo className="h-8 w-auto" />
            <div className="h-5 w-px bg-[#DDD5C8]" />
            <span className="text-sm font-semibold text-[#5C5347]">Analytics Dashboard</span>
          </div>
          <Link
            href="/staff/workspace"
            className="flex items-center gap-2 text-sm font-medium text-[#5C5347] hover:text-[#C4622D] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Workspace
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title + Period Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1612]">Analytics Dashboard</h1>
            <p className="text-sm text-[#8C8278] mt-1">Order trends, revenue, voucher usage &amp; fulfillment metrics</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-[#DDD5C8] rounded-xl p-1 shadow-sm">
            {periodOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === opt.value
                    ? 'bg-[#C4622D] text-white shadow-sm'
                    : 'text-[#5C5347] hover:bg-[#F5F0E8]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-black rounded-2xl p-4 animate-pulse h-24" />
              ))
            : summaryMetrics.map((m, i) => (
                <div key={i} className="bg-black rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-white/60 text-xs font-medium leading-tight">{m.label}</span>
                  </div>
                  <p className="text-white text-xl font-bold leading-tight">{m.value}</p>
                  {m.sub && <p className="text-white/50 text-xs">{m.sub}</p>}
                </div>
              ))}
        </div>

        {/* Charts Row 1: Order Trends + Revenue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Order Trends */}
          <div className="bg-white border border-[#EDE7DA] rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-bold text-[#1A1612] mb-1">Order Trends</h2>
            <p className="text-xs text-[#8C8278] mb-5">Number of orders over time</p>
            {loading ? (
              <div className="h-56 bg-[#F5F0E8] rounded-xl animate-pulse" />
            ) : orderTrend.every(d => d.orders === 0) ? (
              <div className="h-56 flex items-center justify-center text-[#B5ADA5] text-sm">No order data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={orderTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C4622D" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#C4622D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8C8278' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#8C8278' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="orders" name="Orders" stroke="#C4622D" strokeWidth={2} fill="url(#ordersGrad)" dot={false} activeDot={{ r: 4, fill: '#C4622D' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Revenue Chart */}
          <div className="bg-white border border-[#EDE7DA] rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-bold text-[#1A1612] mb-1">Revenue</h2>
            <p className="text-xs text-[#8C8278] mb-5">Total revenue (R) over time</p>
            {loading ? (
              <div className="h-56 bg-[#F5F0E8] rounded-xl animate-pulse" />
            ) : orderTrend.every(d => d.revenue === 0) ? (
              <div className="h-56 flex items-center justify-center text-[#B5ADA5] text-sm">No revenue data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={orderTrend} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8C8278' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#8C8278' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#C4622D" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Charts Row 2: Voucher Usage + Fulfillment */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Voucher Usage Over Time */}
          <div className="bg-white border border-[#EDE7DA] rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-bold text-[#1A1612] mb-1">Voucher Usage Over Time</h2>
            <p className="text-xs text-[#8C8278] mb-5">Meal voucher redemptions &amp; discount voucher orders</p>
            {loading ? (
              <div className="h-56 bg-[#F5F0E8] rounded-xl animate-pulse" />
            ) : voucherUsage.every(d => d.mealVouchers === 0 && d.discountVouchers === 0) ? (
              <div className="h-56 flex items-center justify-center text-[#B5ADA5] text-sm">No voucher data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={voucherUsage} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8C8278' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#8C8278' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#5C5347' }} />
                  <Line type="monotone" dataKey="mealVouchers" name="Meal Vouchers" stroke="#C4622D" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="discountVouchers" name="Discount Vouchers" stroke="#8B5CF6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Fulfillment Metrics */}
          <div className="bg-white border border-[#EDE7DA] rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-bold text-[#1A1612] mb-1">Fulfillment Breakdown</h2>
            <p className="text-xs text-[#8C8278] mb-5">Order counts by fulfillment status in period</p>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-[#F5F0E8] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : fulfillmentMetrics.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-[#B5ADA5] text-sm">No fulfillment data for this period</div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const total = fulfillmentMetrics.reduce((s, m) => s + m.count, 0);
                  return fulfillmentMetrics.map((m, i) => {
                    const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                            <span className="text-sm font-medium text-[#1A1612]">{m.status}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#1A1612]">{m.count}</span>
                            <span className="text-xs text-[#8C8278] w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-[#F5F0E8] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: m.color }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
                <div className="pt-2 border-t border-[#F5F0E8] flex items-center justify-between">
                  <span className="text-xs text-[#8C8278] font-medium">Total orders in period</span>
                  <span className="text-sm font-bold text-[#1A1612]">
                    {fulfillmentMetrics.reduce((s, m) => s + m.count, 0)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Refresh button */}
        <div className="flex justify-end">
          <button
            onClick={() => loadAnalytics(period)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#DDD5C8] rounded-xl text-sm font-medium text-[#5C5347] hover:bg-[#F5F0E8] hover:text-[#C4622D] transition-all disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </main>
    </div>
  );
}
