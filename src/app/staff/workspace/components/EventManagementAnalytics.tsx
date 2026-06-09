'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,  } from 'recharts';

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
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

interface KpiCardProps { icon: string; label: string; value: string; sub?: string; color?: string; }
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
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [eventDates, setEventDates] = useState<EventDateRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [regsRes, bookingsRes, datesRes, eventsRes] = await Promise.all([
        supabase.from('event_management_registrations').select('id, first_name, surname, email, payment_status, payment_method, amount, created_at, children'),
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
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div></div>;

  const totalRegs = registrations.length;
  const paidRegs = registrations.filter(r => r.payment_status === 'paid');
  const totalRevenue = paidRegs.reduce((s, r) => s + (r.amount || 0), 0);
  const pendingRevenue = registrations.filter(r => r.payment_status !== 'paid' && r.payment_status !== 'failed').reduce((s, r) => s + (r.amount || 0), 0);
  const totalParticipants = registrations.reduce((s, r) => s + 1 + (Array.isArray(r.children) ? r.children.length : 0), 0);
  const conversionRate = totalRegs > 0 ? ((paidRegs.length / totalRegs) * 100).toFixed(0) : '0';

  const statusCounts: Record<string, number> = {};
  registrations.forEach(r => { const key = r.payment_status.replace(/_/g, ' '); statusCounts[key] = (statusCounts[key] || 0) + 1; });
  const paymentStatusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const methodCounts: Record<string, number> = {};
  registrations.forEach(r => { const key = r.payment_method || 'Unknown'; methodCounts[key] = (methodCounts[key] || 0) + 1; });
  const paymentMethodData = Object.entries(methodCounts).map(([name, value]) => ({ name, value }));

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
    if (monthlyMap[key]) { monthlyMap[key].registrations += 1; if (r.payment_status === 'paid') monthlyMap[key].revenue += r.amount || 0; }
  });
  const monthlyTrendData = Object.entries(monthlyMap).map(([label, v]) => ({ label, ...v }));

  const eventsMap: Record<string, string> = {};
  events.forEach(e => { eventsMap[e.id] = e.name; });
  const eventDateMap: Record<string, EventDateRow> = {};
  eventDates.forEach(d => { eventDateMap[d.id] = d; });

  const revenueByEvent: Record<string, number> = {};
  bookings.forEach(b => {
    const ed = eventDateMap[b.event_date_id];
    if (!ed) return;
    const eventName = eventsMap[ed.event_id] || 'Unknown Event';
    const reg = registrations.find(r => r.id === b.registration_id);
    if (reg && reg.payment_status === 'paid') {
      revenueByEvent[eventName] = (revenueByEvent[eventName] || 0) + ((reg.amount != null && reg.amount > 0) ? reg.amount : (ed.event_fee || 0));
    }
  });
  const revenueByEventData = Object.entries(revenueByEvent).map(([name, revenue]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, revenue, fullName: name })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  const upcomingSessions = eventDates
    .filter(d => d.event_date && new Date(d.event_date) >= new Date())
    .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime())
    .slice(0, 6)
    .map(d => {
      const capacity = d.seating || 0;
      const booked = bookings.filter(b => b.event_date_id === d.id).length;
      return { label: formatDate(d.event_date!), eventName: eventsMap[d.event_id] || 'Event', capacity, booked, available: Math.max(0, capacity - booked), fillPct: capacity ? Math.round((booked / capacity) * 100) : 0 };
    });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">📊</span>
        <h2 className="text-xl font-bold text-[#1A1612]">Event Management Analytics</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon="📝" label="Total Registrations" value={String(totalRegs)} />
        <KpiCard icon="💰" label="Total Revenue" value={formatCurrency(totalRevenue)} color="text-[#C4622D]" />
        <KpiCard icon="⏳" label="Pending Revenue" value={formatCurrency(pendingRevenue)} color="text-amber-600" />
        <KpiCard icon="✅" label="Conversion Rate" value={`${conversionRate}%`} sub={`${paidRegs.length} paid`} color="text-green-600" />
      </div>

      {/* Monthly Trend */}
      <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[#1A1612] mb-4">Registrations Over Time (12 months)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8C8278' }} />
            <YAxis tick={{ fontSize: 11, fill: '#8C8278' }} />
            <Tooltip />
            <Line type="monotone" dataKey="registrations" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} name="Registrations" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Status */}
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#1A1612] mb-4">Payment Status Breakdown</h3>
          {paymentStatusData.length === 0 ? <p className="text-sm text-[#8C8278] italic">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={paymentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {paymentStatusData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue by Event */}
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#1A1612] mb-4">Revenue by Event</h3>
          {revenueByEventData.length === 0 ? <p className="text-sm text-[#8C8278] italic">No revenue data yet.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueByEventData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DA" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8C8278' }} tickFormatter={v => `R${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8C8278' }} width={80} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill={BRAND} radius={[0, 4, 4, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Upcoming Sessions Capacity */}
      {upcomingSessions.length > 0 && (
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#1A1612] mb-4">Upcoming Sessions — Capacity</h3>
          <div className="space-y-3">
            {upcomingSessions.map((s, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs text-[#5C5347] mb-1">
                  <span className="font-medium">{s.eventName} — {s.label}</span>
                  <span>{s.booked}/{s.capacity} booked</span>
                </div>
                <div className="w-full bg-[#EDE7DA] rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${s.fillPct >= 90 ? 'bg-red-500' : s.fillPct >= 70 ? 'bg-amber-500' : 'bg-[#C4622D]'}`} style={{ width: `${s.fillPct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
