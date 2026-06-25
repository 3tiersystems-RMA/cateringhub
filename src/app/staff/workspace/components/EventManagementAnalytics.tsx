'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type TimeBucket = '7d' | '30d' | '90d' | '12m';

interface RegistrationRow {
  id: string;
  first_name: string;
  surname: string;
  email: string;
  payment_status: string;
  payment_method: string;
  amount: number | null;
  created_at: string;
  children?: Array<{ fullName?: string; full_name?: string; name?: string; [key: string]: unknown }> | null;
}

interface BookingRow {
  registration_id: string;
  event_date_id: string;
}

interface EventDateRow {
  id: string;
  event_date: string | null;
  event_fee: number | null;
  event_id: string;
  seating: number | null;
}

interface EventRow {
  id: string;
  name: string;
}

const BRAND = '#C4622D';
const PALETTE = ['#C4622D', '#E8956D', '#8B4513', '#F5C5A3', '#5C5347', '#A0856C', '#DDD5C8', '#1A1612'];

function formatCurrency(val: number) {
  return `R ${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function getTimeBucketRange(bucket: TimeBucket): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from: Date;
  if (bucket === '7d') {
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    from = new Date(now);
    from.setDate(now.getDate() + diffToMon);
    from.setHours(0, 0, 0, 0);
  } else if (bucket === '30d') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
  } else if (bucket === '90d') {
    const quarter = Math.floor(now.getMonth() / 3);
    from = new Date(now.getFullYear(), quarter * 3, 1);
    from.setHours(0, 0, 0, 0);
  } else {
    from = new Date(now.getFullYear(), 0, 1);
    from.setHours(0, 0, 0, 0);
  }
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function getPeriodLabel(bucket: TimeBucket): string {
  const now = new Date();
  if (bucket === '7d') {
    const day = now.getDay();
    const diffToSunday = day === 0 ? 0 : 7 - day;
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + diffToSunday);
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const weekNum = Math.ceil(((now.getTime() - startOfWeek1.getTime()) / 86400000 + 1) / 7);
    const dd = String(weekEnd.getDate()).padStart(2, '0');
    const mm = String(weekEnd.getMonth() + 1).padStart(2, '0');
    const yyyy = weekEnd.getFullYear();
    return `Week ${weekNum}, ending ${dd}/${mm}/${yyyy}`;
  }
  if (bucket === '30d') {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthNum = now.getMonth() + 1;
    const monthName = monthNames[now.getMonth()];
    const year = now.getFullYear();
    return `Month ${monthNum} – ${monthName} ${year}`;
  }
  if (bucket === '90d') {
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `Q${quarter} ${now.getFullYear()}`;
  }
  return `${now.getFullYear()}`;
}

interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function KpiCard({ icon, label, value, sub, color = 'text-[#1A1612]' }: KpiCardProps) {
  return (
    <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-2xl">{icon}</span>
      <p className="text-xs text-[#8C8278] mt-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-[#8C8278]">{sub}</p>}
    </div>
  );
}

export default function EventManagementAnalytics() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeBucket, setTimeBucket] = useState<TimeBucket>('30d');
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [eventDates, setEventDates] = useState<EventDateRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const loadData = useCallback(async (bucket: TimeBucket = timeBucket) => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = getTimeBucketRange(bucket);
      const fromISO = from.toISOString();
      const toISO = to.toISOString();

      const [regsRes, bookingsRes, datesRes, eventsRes] = await Promise.all([
        supabase
          .from('event_management_registrations')
          .select('id, first_name, surname, email, payment_status, payment_method, amount, created_at, children')
          .gte('created_at', fromISO)
          .lte('created_at', toISO),
        supabase.from('event_management_booking_counts').select('registration_id, event_date_id'),
        supabase.from('event_management_event_dates').select('id, event_date, event_fee, event_id, seating'),
        supabase.from('event_management_events').select('id, name'),
      ]);
      if (regsRes.error) throw regsRes.error;
      setRegistrations(regsRes.data || []);
      setBookings(bookingsRes.data || []);
      setEventDates(datesRes.data || []);
      setEvents(eventsRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [supabase, timeBucket]);

  useEffect(() => { loadData(timeBucket); }, []);

  const handleBucketChange = (bucket: TimeBucket) => {
    setTimeBucket(bucket);
    loadData(bucket);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const totalRegs = registrations.length;
  const paidRegs = registrations.filter(r => r.payment_status === 'paid');
  const totalRevenue = paidRegs.reduce((s, r) => s + (r.amount || 0), 0);
  const pendingRevenue = registrations
    .filter(r => r.payment_status !== 'paid' && r.payment_status !== 'failed' && r.payment_status !== 'failed_payment_transaction')
    .reduce((s, r) => s + (r.amount || 0), 0);
  const totalBookings = bookings.length;
  const avgBookingsPerReg = totalRegs > 0 ? (totalBookings / totalRegs).toFixed(1) : '0';
  const conversionRate = totalRegs > 0 ? ((paidRegs.length / totalRegs) * 100).toFixed(0) : '0';

  // ── Total participants ────────────────────────────────────────────────────────
  const totalParticipants = registrations.reduce((sum, r) => {
    const filledChildren = Array.isArray(r.children)
      ? r.children.filter(c => !!(c.fullName || c.full_name || c.name)).length
      : 0;
    return sum + filledChildren;
  }, 0);

  // ── Payment status breakdown (pie) ──────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  registrations.forEach(r => {
    const key = r.payment_status.replace(/_/g, ' ');
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  });
  const paymentStatusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // ── Payment method breakdown ─────────────────────────────────────────────────
  const methodCounts: Record<string, number> = {};
  registrations.forEach(r => {
    const key = r.payment_method || 'Unknown';
    methodCounts[key] = (methodCounts[key] || 0) + 1;
  });
  const paymentMethodData = Object.entries(methodCounts).map(([name, value]) => ({ name, value }));

  // ── Registrations over time (bucketed by selected period) ────────────────────
  const { from: periodFrom } = getTimeBucketRange(timeBucket);
  const monthlyMap: Record<string, { registrations: number; revenue: number }> = {};

  if (timeBucket === '7d') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(periodFrom);
      d.setDate(periodFrom.getDate() + i);
      const key = d.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short' });
      monthlyMap[key] = { registrations: 0, revenue: 0 };
    }
    registrations.forEach(r => {
      const d = new Date(r.created_at);
      const key = d.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short' });
      if (monthlyMap[key]) {
        monthlyMap[key].registrations += 1;
        if (r.payment_status === 'paid') monthlyMap[key].revenue += r.amount || 0;
      }
    });
  } else if (timeBucket === '30d') {
    const now = new Date();
    const weeksInMonth = Math.ceil(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() / 7);
    for (let w = 1; w <= weeksInMonth; w++) {
      monthlyMap[`Week ${w}`] = { registrations: 0, revenue: 0 };
    }
    registrations.forEach(r => {
      const d = new Date(r.created_at);
      const weekNum = Math.ceil(d.getDate() / 7);
      const key = `Week ${weekNum}`;
      if (monthlyMap[key]) {
        monthlyMap[key].registrations += 1;
        if (r.payment_status === 'paid') monthlyMap[key].revenue += r.amount || 0;
      }
    });
  } else if (timeBucket === '90d') {
    const quarter = Math.floor(new Date().getMonth() / 3);
    for (let m = 0; m < 3; m++) {
      const d = new Date(new Date().getFullYear(), quarter * 3 + m, 1);
      const key = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      monthlyMap[key] = { registrations: 0, revenue: 0 };
    }
    registrations.forEach(r => {
      const d = new Date(r.created_at);
      const key = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      if (monthlyMap[key]) {
        monthlyMap[key].registrations += 1;
        if (r.payment_status === 'paid') monthlyMap[key].revenue += r.amount || 0;
      }
    });
  } else {
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), i, 1);
      const key = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      monthlyMap[key] = { registrations: 0, revenue: 0 };
    }
    registrations.forEach(r => {
      const d = new Date(r.created_at);
      const key = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
      if (monthlyMap[key]) {
        monthlyMap[key].registrations += 1;
        if (r.payment_status === 'paid') monthlyMap[key].revenue += r.amount || 0;
      }
    });
  }
  const monthlyTrendData = Object.entries(monthlyMap).map(([label, v]) => ({ label, ...v }));

  // ── Revenue by event ─────────────────────────────────────────────────────────
  const eventsMap: Record<string, string> = {};
  events.forEach(e => { eventsMap[e.id] = e.name; });

  const eventDateMap: Record<string, EventDateRow> = {};
  eventDates.forEach(d => { eventDateMap[d.id] = d; });

  const revenueByEvent: Record<string, number> = {};
  const regIds = new Set(registrations.map(r => r.id));
  bookings.forEach(b => {
    if (!regIds.has(b.registration_id)) return;
    const ed = eventDateMap[b.event_date_id];
    if (!ed) return;
    const eventName = eventsMap[ed.event_id] || 'Unknown Event';
    const reg = registrations.find(r => r.id === b.registration_id);
    if (reg && reg.payment_status === 'paid') {
      const revenueAmount = (reg.amount != null && reg.amount > 0)
        ? reg.amount
        : (ed.event_fee || 0);
      revenueByEvent[eventName] = (revenueByEvent[eventName] || 0) + revenueAmount;
    }
  });

  const revenueByEventData = Object.entries(revenueByEvent)
    .map(([name, revenue]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, revenue, fullName: name }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const fallbackRevenueData = revenueByEventData.length === 0
    ? (() => {
        const fallback: Record<string, number> = {};
        paidRegs.forEach(r => {
          if ((r.amount || 0) > 0) {
            const regBookings = bookings.filter(b => b.registration_id === r.id);
            if (regBookings.length > 0) {
              regBookings.forEach(b => {
                const ed = eventDateMap[b.event_date_id];
                const eventName = ed ? (eventsMap[ed.event_id] || 'Unknown Event') : 'Unknown Event';
                fallback[eventName] = (fallback[eventName] || 0) + (r.amount || 0);
              });
            } else {
              fallback['Unassigned'] = (fallback['Unassigned'] || 0) + (r.amount || 0);
            }
          }
        });
        return Object.entries(fallback)
          .map(([name, revenue]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, revenue, fullName: name }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 8);
      })()
    : revenueByEventData;

  // ── Upcoming sessions capacity ────────────────────────────────────────────────
  const upcomingSessions = eventDates
    .filter(d => d.event_date && new Date(d.event_date) >= new Date())
    .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime())
    .slice(0, 6)
    .map(d => {
      const capacity = d.seating || 0;
      const sessionBookings = bookings.filter(b => b.event_date_id === d.id);
      const totalSessionParticipants = sessionBookings.reduce((sum, b) => {
        const reg = registrations.find(r => r.id === b.registration_id);
        if (!reg) return sum;
        const filledChildren = Array.isArray(reg.children)
          ? reg.children.filter(c => !!(c.fullName || c.full_name || c.name)).length
          : 0;
        return sum + 1 + filledChildren;
      }, 0);
      return {
        label: formatDate(d.event_date!),
        eventName: eventsMap[d.event_id] || 'Event',
        capacity,
        booked: totalSessionParticipants,
        available: Math.max(0, capacity - totalSessionParticipants),
        fillPct: capacity ? Math.round((totalSessionParticipants / capacity) * 100) : 0,
      };
    });

  // ── Top spenders ──────────────────────────────────────────────────────────────
  const topSpenders = [...registrations]
    .filter(r => r.payment_status === 'paid' && (r.amount || 0) > 0)
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5);

  const trendLabel = timeBucket === '7d' ? 'Daily overview — current week'
    : timeBucket === '30d' ? 'Weekly overview — current month'
    : timeBucket === '90d'? 'Monthly overview — current quarter' :'Monthly overview — current year';

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1A1612]">
            Events Analytics
            {getPeriodLabel(timeBucket) && (
              <span className="ml-2 text-base font-medium text-[#C4622D]">
                for ({getPeriodLabel(timeBucket)})
              </span>
            )}
          </h2>
          <p className="text-sm text-[#8C8278] mt-0.5">Booking registration and revenue insights for the selected period</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-[#EDE7DA] rounded-xl p-1">
            {([['7d', 'Week'], ['30d', 'Month'], ['90d', 'Quarter'], ['12m', 'Year']] as [TimeBucket, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => handleBucketChange(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${timeBucket === val ? 'bg-[#C4622D] text-white' : 'text-[#5C5347] hover:bg-[#FAF5EE]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadData(timeBucket)}
            disabled={loading}
            className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon="📋" label="Total Registrations" value={String(totalRegs)} />
        <KpiCard icon="✅" label="Paid Registrations" value={String(paidRegs.length)} color="text-green-700" />
        <KpiCard icon="💰" label="Total Revenue" value={formatCurrency(totalRevenue)} color="text-green-700" sub="Confirmed paid" />
        <KpiCard icon="⏳" label="Pending Revenue" value={formatCurrency(pendingRevenue)} color="text-amber-600" sub="Awaiting payment" />
        <KpiCard icon="🎟️" label="Participants" value={String(totalParticipants)} sub={`${totalRegs} registrations`} />
        <KpiCard icon="📈" label="Conversion Rate" value={`${conversionRate}%`} color={Number(conversionRate) >= 70 ? 'text-green-700' : 'text-amber-600'} sub="Paid / Total" />
      </div>

      {/* Trend Chart */}
      <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#1A1612] mb-1">Registrations &amp; Revenue Trend</h3>
        <p className="text-xs text-[#8C8278] mb-4">{trendLabel}</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={monthlyTrendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C8278' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#8C8278' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#8C8278' }} tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }}
              formatter={(value: number, name: string) => [
                name === 'revenue' ? formatCurrency(value) : value,
                name === 'revenue' ? 'Revenue' : 'Registrations',
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="registrations" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} name="Registrations" />
            <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#5C5347" strokeWidth={2} dot={{ r: 3 }} name="Revenue (R)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue by Event + Payment Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue by Event */}
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">Revenue by Event</h3>
          <p className="text-xs text-[#8C8278] mb-4">Confirmed paid revenue per event (top 8)</p>
          {fallbackRevenueData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-[#8C8278]">No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fallbackRevenueData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8C8278' }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#8C8278' }} tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }}
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                />
                <Bar dataKey="revenue" fill={BRAND} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment Status Pie */}
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">Payment Status Breakdown</h3>
          <p className="text-xs text-[#8C8278] mb-4">Distribution of all registration payment statuses</p>
          {paymentStatusData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-[#8C8278]">No data yet</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={paymentStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {paymentStatusData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {paymentStatusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#1A1612] capitalize truncate">{d.name}</p>
                      <p className="text-xs text-[#8C8278]">{d.value} ({totalRegs > 0 ? Math.round((d.value / totalRegs) * 100) : 0}%)</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Method + Bookings per Event */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">Payment Method Preference</h3>
          <p className="text-xs text-[#8C8278] mb-4">How customers prefer to pay</p>
          {paymentMethodData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-[#8C8278]">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={paymentMethodData} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#8C8278' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#5C5347' }} width={56} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }} />
                <Bar dataKey="value" fill={BRAND} radius={[0, 6, 6, 0]} name="Registrations" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bookings per Event */}
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">Bookings per Event</h3>
          <p className="text-xs text-[#8C8278] mb-4">Total booking count per event (top 8)</p>
          {(() => {
            const bookingsByEvent: Record<string, number> = {};
            bookings.forEach(b => {
              if (!regIds.has(b.registration_id)) return;
              const ed = eventDateMap[b.event_date_id];
              if (!ed) return;
              const eventName = eventsMap[ed.event_id] || 'Unknown Event';
              bookingsByEvent[eventName] = (bookingsByEvent[eventName] || 0) + 1;
            });
            const data = Object.entries(bookingsByEvent)
              .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, value, fullName: name }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 8);
            return data.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-[#8C8278]">No booking data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#8C8278' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#5C5347' }} width={56} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Bar dataKey="value" fill="#5C5347" radius={[0, 6, 6, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>

      {/* Upcoming Session Capacity */}
      {upcomingSessions.length > 0 && (
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">Upcoming Session Capacity</h3>
          <p className="text-xs text-[#8C8278] mb-4">Seat availability for the next {upcomingSessions.length} sessions</p>
          <div className="space-y-5">
            {(() => {
              const grouped: Record<string, typeof upcomingSessions> = {};
              upcomingSessions.forEach(s => {
                if (!grouped[s.eventName]) grouped[s.eventName] = [];
                grouped[s.eventName].push(s);
              });
              return Object.entries(grouped).map(([eventName, sessions]) => (
                <div key={eventName}>
                  <p className="text-xs font-bold text-[#C4622D] uppercase tracking-wide mb-2 pb-1 border-b border-[#EDE7DA]">{eventName}</p>
                  <div className="space-y-3">
                    {sessions.map((s, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-44 flex-shrink-0">
                          <p className="text-xs text-[#8C8278]">{s.label}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-[#8C8278]">{s.booked} booked</span>
                            <span className="text-xs font-medium text-[#1A1612]">{s.fillPct}% full</span>
                          </div>
                          <div className="h-2 bg-[#e9e0cf] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(s.fillPct, 100)}%`,
                                backgroundColor: s.fillPct >= 90 ? '#DC2626' : s.fillPct >= 70 ? '#D97706' : BRAND,
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-20 text-right flex-shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            s.available === 0
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : s.available <= 3
                              ? 'bg-amber-100 text-amber-700 border-amber-200' :'bg-green-100 text-green-700 border-green-200'
                          }`}>
                            {s.available === 0 ? 'Full' : `${s.available} left`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Top Spenders */}
      {topSpenders.length > 0 && (
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">Top Customers by Spend</h3>
          <p className="text-xs text-[#8C8278] mb-4">Highest-value paid registrations</p>
          <div className="space-y-2">
            {topSpenders.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-[#e9e0cf] last:border-0">
                <div className="w-7 h-7 rounded-full bg-[#e9e0cf] border border-[#DDD5C8] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#C4622D]">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1A1612] truncate">{r.first_name} {r.surname}</p>
                  <p className="text-xs text-[#8C8278] truncate">{r.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-green-700">{formatCurrency(r.amount || 0)}</p>
                  <p className="text-xs text-[#8C8278]">{formatDate(r.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
