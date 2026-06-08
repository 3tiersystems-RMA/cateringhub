'use client';

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export type AnalyticsPeriod = '7d' | '30d' | '90d' | '12m';

export interface OrderTrendPoint { label: string; orders: number; revenue: number; }
export interface FulfillmentMetric { status: string; count: number; color: string; }
export interface VoucherUsagePoint { label: string; mealVouchers: number; discountVouchers: number; }
export interface SummaryMetric { label: string; value: string; sub?: string; icon: string; }

export function getAnalyticsPeriodRange(period: AnalyticsPeriod): { from: Date; to: Date; bucketFn: (d: Date) => string } {
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
    return { from, to, bucketFn: (d) => { const w = new Date(d); w.setDate(d.getDate() - d.getDay()); return w.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }); } };
  }
  from.setMonth(to.getMonth() - 11); from.setDate(1);
  return { from, to, bucketFn: (d) => d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }) };
}

export function buildAnalyticsBuckets(period: AnalyticsPeriod, bucketFn: (d: Date) => string): string[] {
  const buckets: string[] = [];
  const seen = new Set<string>();
  const to = new Date(); const from = new Date();
  if (period === '7d') from.setDate(to.getDate() - 6);
  else if (period === '30d') from.setDate(to.getDate() - 29);
  else if (period === '90d') from.setDate(to.getDate() - 89);
  else { from.setMonth(to.getMonth() - 11); from.setDate(1); }
  const cur = new Date(from);
  while (cur <= to) { const label = bucketFn(new Date(cur)); if (!seen.has(label)) { seen.add(label); buckets.push(label); } cur.setDate(cur.getDate() + 1); }
  return buckets;
}

export const ANALYTICS_FULFILLMENT_COLORS: Record<string, string> = { new: '#3B82F6', confirmed: '#8B5CF6', preparing: '#F97316', ready: '#14B8A6', delivered: '#22C55E', cancelled: '#EF4444' };
export const ANALYTICS_FULFILLMENT_LABELS: Record<string, string> = { new: 'New', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', delivered: 'Delivered', cancelled: 'Cancelled' };

export function AnalyticsTooltip({ active, payload, label }: any) {
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

export function AnalyticsLineChart({ data }: { data: { label: string; orders: number; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C8278' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8C8278' }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="orders" stroke="#C4622D" strokeWidth={2} dot={{ r: 3 }} name="Orders" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsBarChart({ data }: { data: { label: string; orders: number; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C8278' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8C8278' }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }} formatter={(v: number) => [`R ${v.toFixed(2)}`, 'Revenue']} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" fill="#C4622D" radius={[4, 4, 0, 0]} name="Revenue (R)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsVoucherChart({ data }: { data: { label: string; mealVouchers: number; discountVouchers: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C8278' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8C8278' }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="mealVouchers" fill="#C4622D" radius={[4, 4, 0, 0]} name="Meal Vouchers" />
        <Bar dataKey="discountVouchers" fill="#E8A87C" radius={[4, 4, 0, 0]} name="Discount Vouchers" />
      </BarChart>
    </ResponsiveContainer>
  );
}
