'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface RegistrationRow {
  id: string;
  first_name: string;
  surname: string;
  email: string;
  payment_status: string;
  payment_method: string;
  amount: number | null;
  created_at: string;
  children: unknown[] | null;
  attend_school_holiday: string | null;
}

interface BookingRow {
  registration_id: string;
  event_date_id: string;
}

interface EventDateRow {
  id: string;
  event_date: string | null;
  class_fee: number | null;
  event_id: string;
  seating_capacity: number | null;
  seats_booked: number | null;
}

interface EventRow {
  id: string;
  name: string;
}

const BRAND = '#C4622D';
const PALETTE = ['#C4622D', '#E8956D', '#8B4513', '#F5C5A3', '#5C5347', '#A0856C', '#DDD5C8', '#1A1612'];

function formatCurrency(val: number) {
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
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

export default function CookingClassAnalytics() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Raw data
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [eventDates, setEventDates] = useState<EventDateRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [regsRes, bookingsRes, datesRes, eventsRes] = await Promise.all([
        supabase.from('cooking_class_registrations').select('id, first_name, surname, email, payment_status, payment_method, amount, created_at, children, attend_school_holiday'),
        supabase.from('cooking_class_booking_counts').select('registration_id, event_date_id'),
        supabase.from('cooking_class_event_dates').select('id, event_date, class_fee, event_id, seating_capacity, seats_booked'),
        supabase.from('cooking_class_events').select('id, name'),
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
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

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
    .filter(r => r.payment_status !== 'paid' && r.payment_status !== 'failed')
    .reduce((s, r) => s + (r.amount || 0), 0);
  const totalParticipants = registrations.reduce((s, r) => {
    const kids = Array.isArray(r.children) ? r.children.length : 0;
    return s + 1 + kids;
  }, 0);
  const avgParticipantsPerReg = totalRegs > 0 ? (totalParticipants / totalRegs).toFixed(1) : '0';
  const conversionRate = totalRegs > 0 ? ((paidRegs.length / totalRegs) * 100).toFixed(0) : '0';

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

  // ── Registrations over time (last 12 months) ─────────────────────────────────
  const monthlyMap: Record<string, { registrations: number; revenue: number }> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
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
  const monthlyTrendData = Object.entries(monthlyMap).map(([label, v]) => ({ label, ...v }));

  // ── Revenue by event ─────────────────────────────────────────────────────────
  const eventsMap: Record<string, string> = {};
  events.forEach(e => { eventsMap[e.id] = e.name; });

  const eventDateMap: Record<string, EventDateRow> = {};
  eventDates.forEach(d => { eventDateMap[d.id] = d; });

  const revenueByEvent: Record<string, number> = {};
  const bookingsByEvent: Record<string, number> = {};
  bookings.forEach(b => {
    const ed = eventDateMap[b.event_date_id];
    if (!ed) return;
    const eventName = eventsMap[ed.event_id] || 'Unknown Event';
    bookingsByEvent[eventName] = (bookingsByEvent[eventName] || 0) + 1;
    const reg = registrations.find(r => r.id === b.registration_id);
    if (reg && reg.payment_status === 'paid') {
      revenueByEvent[eventName] = (revenueByEvent[eventName] || 0) + (ed.class_fee || 0);
    }
  });
  const revenueByEventData = Object.entries(revenueByEvent)
    .map(([name, revenue]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, revenue, fullName: name }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // ── Upcoming sessions capacity ────────────────────────────────────────────────
  const upcomingSessions = eventDates
    .filter(d => d.event_date && new Date(d.event_date) >= new Date())
    .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime())
    .slice(0, 6)
    .map(d => ({
      label: formatDate(d.event_date!),
      eventName: eventsMap[d.event_id] || 'Event',
      capacity: d.seating_capacity || 0,
      booked: d.seats_booked || 0,
      available: Math.max(0, (d.seating_capacity || 0) - (d.seats_booked || 0)),
      fillPct: d.seating_capacity ? Math.round(((d.seats_booked || 0) / d.seating_capacity) * 100) : 0,
    }));

  // ── School holiday attendance ─────────────────────────────────────────────────
  const holidayYes = registrations.filter(r => r.attend_school_holiday?.toLowerCase() === 'yes').length;
  const holidayNo = registrations.filter(r => r.attend_school_holiday?.toLowerCase() === 'no').length;
  const holidayData = [
    { name: 'School Holiday', value: holidayYes },
    { name: 'Regular Session', value: holidayNo },
  ].filter(d => d.value > 0);

  // ── Top registrants by spend ──────────────────────────────────────────────────
  const topSpenders = [...registrations]
    .filter(r => r.payment_status === 'paid' && (r.amount || 0) > 0)
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1A1612]">Cooking Class Analytics</h2>
          <p className="text-sm text-[#8C8278] mt-0.5">Registration, revenue, and capacity insights</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#DDD5C8] text-xs font-medium text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon="📋" label="Total Registrations" value={String(totalRegs)} />
        <KpiCard icon="✅" label="Paid Registrations" value={String(paidRegs.length)} color="text-green-700" />
        <KpiCard icon="💰" label="Total Revenue" value={formatCurrency(totalRevenue)} color="text-green-700" sub="Confirmed paid" />
        <KpiCard icon="⏳" label="Pending Revenue" value={formatCurrency(pendingRevenue)} color="text-amber-600" sub="Awaiting payment" />
        <KpiCard icon="👥" label="Total Participants" value={String(totalParticipants)} sub={`${avgParticipantsPerReg} avg per reg`} />
        <KpiCard icon="📈" label="Conversion Rate" value={`${conversionRate}%`} color={Number(conversionRate) >= 70 ? 'text-green-700' : 'text-amber-600'} sub="Paid / Total" />
      </div>

      {/* Monthly Trend */}
      <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#1A1612] mb-1">Registrations &amp; Revenue Trend</h3>
        <p className="text-xs text-[#8C8278] mb-4">Monthly overview — last 12 months</p>
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
          {revenueByEventData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-[#8C8278]">No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByEventData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
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

      {/* Payment Method + School Holiday */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payment Method */}
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

        {/* School Holiday Attendance */}
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">School Holiday Attendance</h3>
          <p className="text-xs text-[#8C8278] mb-4">Registrants attending school holiday sessions</p>
          {holidayData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-[#8C8278]">No data yet</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={holidayData} cx="50%" cy="50%" outerRadius={75} paddingAngle={4} dataKey="value">
                    {holidayData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? BRAND : '#DDD5C8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EDE7DA', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {holidayData.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i === 0 ? BRAND : '#DDD5C8' }} />
                      <p className="text-xs font-medium text-[#1A1612]">{d.name}</p>
                    </div>
                    <p className="text-xl font-bold text-[#1A1612] ml-5">{d.value}</p>
                    <p className="text-xs text-[#8C8278] ml-5">
                      {totalRegs > 0 ? Math.round((d.value / totalRegs) * 100) : 0}% of total
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Session Capacity */}
      {upcomingSessions.length > 0 && (
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">Upcoming Session Capacity</h3>
          <p className="text-xs text-[#8C8278] mb-4">Seat availability for the next {upcomingSessions.length} sessions</p>
          <div className="space-y-3">
            {upcomingSessions.map((s, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-32 flex-shrink-0">
                  <p className="text-xs font-semibold text-[#1A1612] truncate">{s.eventName}</p>
                  <p className="text-xs text-[#8C8278]">{s.label}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#8C8278]">{s.booked} booked</span>
                    <span className="text-xs font-medium text-[#1A1612]">{s.fillPct}% full</span>
                  </div>
                  <div className="h-2 bg-[#F5F0E8] rounded-full overflow-hidden">
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
      )}

      {/* Top Spenders */}
      {topSpenders.length > 0 && (
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#1A1612] mb-1">Top Customers by Spend</h3>
          <p className="text-xs text-[#8C8278] mb-4">Highest-value paid registrations</p>
          <div className="space-y-2">
            {topSpenders.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-[#F5F0E8] last:border-0">
                <div className="w-7 h-7 rounded-full bg-[#F5F0E8] border border-[#DDD5C8] flex items-center justify-center flex-shrink-0">
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
