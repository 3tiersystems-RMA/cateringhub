'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { calculateOrderTotal } from '@/lib/order-totals';
import {
  AnalyticsPeriod,
  OrderTrendPoint,
  FulfillmentMetric,
  VoucherUsagePoint,
  SummaryMetric,
  getAnalyticsPeriodRange,
  buildAnalyticsBuckets,
  ANALYTICS_FULFILLMENT_COLORS,
  ANALYTICS_FULFILLMENT_LABELS,
  AnalyticsLineChart,
  AnalyticsBarChart,
  AnalyticsVoucherChart,
} from './AnalyticsCharts';

export default function AnalyticsTab() {
  const supabase = createClient();

  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('30d');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [orderTrend, setOrderTrend] = useState<OrderTrendPoint[]>([]);
  const [voucherUsage, setVoucherUsage] = useState<VoucherUsagePoint[]>([]);
  const [fulfillmentMetrics, setFulfillmentMetrics] = useState<FulfillmentMetric[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetric[]>([]);

  function getPeriodLabel(period: AnalyticsPeriod): string {
    const now = new Date();
    if (period === '7d') {
      // Week number (ISO) and week-ending date (Sunday or today)
      const day = now.getDay(); // 0=Sun, 1=Mon, ...
      const diffToSunday = day === 0 ? 0 : 7 - day;
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + diffToSunday);
      // ISO week number
      const jan4 = new Date(now.getFullYear(), 0, 4);
      const startOfWeek1 = new Date(jan4);
      startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
      const weekNum = Math.ceil(((now.getTime() - startOfWeek1.getTime()) / 86400000 + 1) / 7);
      const dd = String(weekEnd.getDate()).padStart(2, '0');
      const mm = String(weekEnd.getMonth() + 1).padStart(2, '0');
      const yyyy = weekEnd.getFullYear();
      return `Week ${weekNum}, ending ${dd}/${mm}/${yyyy}`;
    }
    if (period === '30d') {
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthNum = now.getMonth() + 1;
      const monthName = monthNames[now.getMonth()];
      const year = now.getFullYear();
      return `Month ${monthNum} – ${monthName} ${year}`;
    }
    if (period === '90d') {
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      const year = now.getFullYear();
      return `Q${quarter} ${year}`;
    }
    if (period === '12m') {
      return `${now.getFullYear()}`;
    }
    return '';
  }

  const loadAnalytics = useCallback(async (p: AnalyticsPeriod) => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const { from, to, bucketFn } = getAnalyticsPeriodRange(p);
      const fromISO = from.toISOString();
      const toISO = to.toISOString();

      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, total, payment_status, fulfillment_status, created_at')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: true });
      if (ordersErr) throw ordersErr;

      const { data: redemptions, error: redemptionsErr } = await supabase
        .from('voucher_redemptions')
        .select('id, redeemed_at')
        .gte('redeemed_at', fromISO)
        .lte('redeemed_at', toISO);
      if (redemptionsErr) throw redemptionsErr;

      const { data: dvOrders, error: dvErr } = await supabase
        .from('orders')
        .select('id, created_at, payment_status')
        .eq('payment_status', 'discounted')
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      if (dvErr) throw dvErr;

      const buckets = buildAnalyticsBuckets(p, bucketFn);
      const orderMap: Record<string, { orders: number; revenue: number }> = {};
      const voucherMap: Record<string, { mealVouchers: number; discountVouchers: number }> = {};
      buckets.forEach(b => { orderMap[b] = { orders: 0, revenue: 0 }; voucherMap[b] = { mealVouchers: 0, discountVouchers: 0 }; });

      const isPaid = (o: any) => o.payment_status === 'paid' || o.payment_status === 'discounted';
      (orders || []).forEach(o => {
        const label = bucketFn(new Date(o.created_at));
        if (orderMap[label] !== undefined) {
          orderMap[label].orders += 1;
          if (isPaid(o)) orderMap[label].revenue += calculateOrderTotal(o);
        }
      });
      (redemptions || []).forEach(r => {
        const label = bucketFn(new Date(r.redeemed_at));
        if (voucherMap[label] !== undefined) voucherMap[label].mealVouchers += 1;
      });
      (dvOrders || []).forEach(o => {
        const label = bucketFn(new Date(o.created_at));
        if (voucherMap[label] !== undefined) voucherMap[label].discountVouchers += 1;
      });

      setOrderTrend(buckets.map(b => ({ label: b, ...orderMap[b] })));
      setVoucherUsage(buckets.map(b => ({ label: b, ...voucherMap[b] })));

      const fulfillmentCount: Record<string, number> = {};
      (orders || []).forEach(o => { fulfillmentCount[o.fulfillment_status] = (fulfillmentCount[o.fulfillment_status] || 0) + 1; });
      const fulfillmentOrder = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
      setFulfillmentMetrics(
        fulfillmentOrder.filter(s => fulfillmentCount[s] !== undefined).map(s => ({
          status: ANALYTICS_FULFILLMENT_LABELS[s] || s,
          count: fulfillmentCount[s],
          color: ANALYTICS_FULFILLMENT_COLORS[s] || '#8C8278',
        }))
      );

      const totalOrders = (orders || []).length;
      const paidOrders = (orders || []).filter(isPaid).length;
      const totalRevenue = (orders || []).filter(isPaid).reduce((sum, o) => sum + calculateOrderTotal(o), 0);
      const deliveredOrders = (orders || []).filter(o => o.fulfillment_status === 'delivered').length;
      const totalMealRedemptions = (redemptions || []).length;
      const totalDvUsed = (dvOrders || []).length;
      const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;
      const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

      setSummaryMetrics([
        { label: 'Total Orders', value: String(totalOrders), sub: `${paidOrders} paid`, icon: '📋' },
        { label: 'Total Revenue', value: `R ${Math.round(totalRevenue).toLocaleString('en-US')}`, sub: paidOrders > 0 ? `Avg R ${Math.round(avgOrderValue).toLocaleString('en-US')}/paid order` : 'From paid orders', icon: '💰' },
        { label: 'Meal Vouchers Used', value: String(totalMealRedemptions), sub: 'Redemptions', icon: '🎟️' },
        { label: 'Discount Vouchers', value: String(totalDvUsed), sub: 'Orders with discount', icon: '🏷️' },
        { label: 'Delivered Orders', value: String(deliveredOrders), sub: `${fulfillmentRate}% fulfillment rate`, icon: '✅' },
        { label: 'Cancelled Orders', value: String(fulfillmentCount['cancelled'] || 0), sub: 'In period', icon: '❌' },
      ]);
    } catch (err: any) {
      setAnalyticsError(err?.message || 'Failed to load analytics data');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadAnalytics(analyticsPeriod);
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1A1612]">
            Analytics
            {getPeriodLabel(analyticsPeriod) && (
              <span className="ml-2 text-base font-medium text-[#C4622D]">
                for ({getPeriodLabel(analyticsPeriod)})
              </span>
            )}
          </h2>
          <p className="text-sm text-[#8C8278] mt-0.5">Order trends and performance metrics for the selected period</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-[#EDE7DA] rounded-xl p-1">
            {([['7d', 'Week'], ['30d', 'Month'], ['90d', 'Quarter'], ['12m', 'Year']] as [AnalyticsPeriod, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setAnalyticsPeriod(val); loadAnalytics(val); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${analyticsPeriod === val ? 'bg-[#C4622D] text-white' : 'text-[#5C5347] hover:bg-[#FAF5EE]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadAnalytics(analyticsPeriod)}
            disabled={analyticsLoading}
            className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
          >
            {analyticsLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {analyticsError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{analyticsError}</div>
      )}

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {summaryMetrics.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {summaryMetrics.map((m) => (
                <div key={m.label} className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{m.icon}</span>
                    <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide">{m.label}</p>
                  </div>
                  <p className="text-2xl font-bold text-[#1A1612]">{m.value}</p>
                  {m.sub && <p className="text-xs text-[#8C8278] mt-1">{m.sub}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5 mb-6">
            <h3 className="text-base font-bold text-[#1A1612] mb-4">Order Trend</h3>
            {orderTrend.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[#8C8278] text-sm">No data for this period.</div>
            ) : (
              <AnalyticsLineChart data={orderTrend} />
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5 mb-6">
            <h3 className="text-base font-bold text-[#1A1612] mb-4">Revenue by Period</h3>
            {orderTrend.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[#8C8278] text-sm">No data for this period.</div>
            ) : (
              <AnalyticsBarChart data={orderTrend} />
            )}
          </div>

          {voucherUsage.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5 mb-6">
              <h3 className="text-base font-bold text-[#1A1612] mb-4">Voucher Usage</h3>
              <AnalyticsVoucherChart data={voucherUsage} />
            </div>
          )}

          {fulfillmentMetrics.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
              <h3 className="text-base font-bold text-[#1A1612] mb-4">Fulfillment Breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {fulfillmentMetrics.map((m) => (
                  <div key={m.status} className="rounded-xl border border-[#EDE7DA] p-4 text-center">
                    <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: m.color }} />
                    <p className="text-xl font-bold text-[#1A1612]">{m.count}</p>
                    <p className="text-xs text-[#8C8278] mt-0.5 capitalize">{m.status.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orderTrend.length === 0 && summaryMetrics.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#EDE7DA] p-12 text-center">
              <p className="text-4xl mb-3">📈</p>
              <p className="text-[#1A1612] font-semibold mb-1">No analytics data yet</p>
              <p className="text-[#8C8278] text-sm">Select a period and click Refresh to load analytics.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
