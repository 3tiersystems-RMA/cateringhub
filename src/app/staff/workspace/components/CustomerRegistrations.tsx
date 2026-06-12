'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UnifiedRegistration {
  id: string;
  source: 'class' | 'event';
  title: string;
  first_name: string;
  surname: string;
  email: string;
  cellphone: string;
  payment_status: string;
  amount: number | null;
  created_at: string;
  // event/class name(s)
  event_names: string[];
  venue: string | null;
  event_dates: string[];
  participant_count: number;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  awaiting_confirmation: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_payment: 'bg-blue-100 text-blue-700 border-blue-200',
  unpaid: 'bg-amber-100 text-amber-700 border-amber-200',
  discounted: 'bg-purple-100 text-purple-700 border-purple-200',
  'no-show': 'bg-gray-100 text-gray-600 border-gray-300',
};

const PAGE_SIZE = 15;

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function formatCurrency(val: number | null | undefined) {
  if (val == null) return '—';
  return `R${Number(val).toFixed(2)}`;
}

function formatPaymentStatus(status: string) {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function Paginator({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  const btnBase = 'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 text-xs font-medium rounded-lg border transition-all duration-150 select-none';
  const btnActive = 'bg-[#C4622D] text-white border-[#C4622D] shadow-sm shadow-[#C4622D]/30';
  const btnInactive = 'bg-white text-[#5C5347] border-[#E8DDD0] hover:bg-[#FDF6EE] hover:border-[#C4622D] hover:text-[#C4622D]';
  const btnDisabled = 'bg-[#FAF5EE] text-[#C4B8A8] border-[#E8DDD0] cursor-not-allowed opacity-60';

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#FAF5EE] to-[#F5EFE8] border-t border-[#E8DDD0]">
      <p className="text-xs text-[#8C7B6B] font-medium">
        Page <span className="text-[#C4622D] font-semibold">{currentPage}</span> of{' '}
        <span className="font-semibold text-[#5C5347]">{totalPages}</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnInactive}`} title="First page">«</button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnInactive} gap-0.5`} title="Previous page">
          <span>‹</span><span className="hidden sm:inline">Prev</span>
        </button>
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-1 text-[#8C7B6B] text-xs">…</span>
            ) : (
              <button key={p} onClick={() => onPageChange(p as number)} className={`${btnBase} w-8 ${p === currentPage ? btnActive : btnInactive}`}>{p}</button>
            )
          )}
        </div>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnInactive} gap-0.5`} title="Next page">
          <span className="hidden sm:inline">Next</span><span>›</span>
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnInactive}`} title="Last page">»</button>
      </div>
    </div>
  );
}

interface CustomerRegistrationsProps {
  isSuperAdmin?: boolean;
}

export default function CustomerRegistrations({ isSuperAdmin = false }: CustomerRegistrationsProps) {
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<UnifiedRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [sourceFilter, setSourceFilter] = useState<'all' | 'class' | 'event'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // ── 1. Fetch Cooking Class Registrations ──────────────────────────────
      const { data: classRegs, error: classErr } = await supabase
        .from('cooking_class_registrations')
        .select('id, title, first_name, surname, email, cellphone, payment_status, amount, created_at, selected_events, adult_class_dates, children')
        .order('created_at', { ascending: false });

      if (classErr) throw classErr;

      // Fetch cooking class event dates for class registrations
      const allClassEventIds: string[] = [];
      (classRegs || []).forEach((r: { selected_events?: string[]; adult_class_dates?: string[] }) => {
        (r.selected_events || []).forEach((id: string) => { if (id) allClassEventIds.push(id); });
        (r.adult_class_dates || []).forEach((id: string) => { if (id) allClassEventIds.push(id); });
      });
      const uniqueClassEventIds = [...new Set(allClassEventIds)];

      let classEventDatesMap: Record<string, { event_date: string | null; event_name: string | null; location: string | null }> = {};
      if (uniqueClassEventIds.length > 0) {
        const { data: classDates } = await supabase
          .from('cooking_class_event_dates')
          .select('id, event_date, location, event_id')
          .in('id', uniqueClassEventIds);

        const classEventIds = [...new Set((classDates || []).map((d: { event_id: string }) => d.event_id).filter(Boolean))];
        let classEventsMap: Record<string, string> = {};
        if (classEventIds.length > 0) {
          const { data: classEvents } = await supabase
            .from('cooking_class_events')
            .select('id, name')
            .in('id', classEventIds);
          (classEvents || []).forEach((e: { id: string; name: string }) => { classEventsMap[e.id] = e.name; });
        }

        (classDates || []).forEach((d: { id: string; event_date: string | null; location: string | null; event_id: string }) => {
          classEventDatesMap[d.id] = {
            event_date: d.event_date,
            event_name: classEventsMap[d.event_id] || null,
            location: d.location,
          };
        });
      }

      const classUnified: UnifiedRegistration[] = (classRegs || []).map((r: {
        id: string; title: string; first_name: string; surname: string; email: string;
        cellphone: string; payment_status: string; amount: number | null; created_at: string;
        selected_events?: string[]; adult_class_dates?: string[]; children?: unknown[];
      }) => {
        const allIds = [...(r.selected_events || []), ...(r.adult_class_dates || [])];
        const eventNames = [...new Set(allIds.map(id => classEventDatesMap[id]?.event_name).filter(Boolean))] as string[];
        const eventDates = [...new Set(allIds.map(id => classEventDatesMap[id]?.event_date).filter(Boolean))] as string[];
        const venue = allIds.map(id => classEventDatesMap[id]?.location).find(Boolean) || null;
        const filledChildren = Array.isArray(r.children)
          ? r.children.filter((c: unknown) => {
              if (!c || typeof c !== 'object') return false;
              const p = c as Record<string, unknown>;
              return p.fullName || p.full_name || p.name;
            })
          : [];
        return {
          id: r.id,
          source: 'class' as const,
          title: r.title,
          first_name: r.first_name,
          surname: r.surname,
          email: r.email,
          cellphone: r.cellphone,
          payment_status: r.payment_status,
          amount: r.amount,
          created_at: r.created_at,
          event_names: eventNames,
          venue,
          event_dates: eventDates,
          participant_count: filledChildren.length,
        };
      });

      // ── 2. Fetch Event Management Registrations ───────────────────────────
      const { data: eventRegs, error: eventErr } = await supabase
        .from('event_management_registrations')
        .select('id, title, first_name, surname, email, cellphone, payment_status, amount, created_at, children')
        .order('created_at', { ascending: false });

      if (eventErr) throw eventErr;

      const eventRegIds = (eventRegs || []).map((r: { id: string }) => r.id);
      let eventUnified: UnifiedRegistration[] = [];

      if (eventRegIds.length > 0) {
        const { data: bookings } = await supabase
          .from('event_management_booking_counts')
          .select('registration_id, event_date_id')
          .in('registration_id', eventRegIds);

        const eventDateIds = [...new Set((bookings || []).map((b: { event_date_id: string }) => b.event_date_id))];
        let eventDatesMap: Record<string, { event_date: string | null; event_name: string | null; location: string | null }> = {};

        if (eventDateIds.length > 0) {
          const { data: dates } = await supabase
            .from('event_management_event_dates')
            .select('id, event_date, location, event_id')
            .in('id', eventDateIds);

          const evIds = [...new Set((dates || []).map((d: { event_id: string }) => d.event_id).filter(Boolean))];
          let eventsMap: Record<string, string> = {};
          if (evIds.length > 0) {
            const { data: events } = await supabase
              .from('event_management_events')
              .select('id, name')
              .in('id', evIds);
            (events || []).forEach((e: { id: string; name: string }) => { eventsMap[e.id] = e.name; });
          }
          (dates || []).forEach((d: { id: string; event_date: string | null; location: string | null; event_id: string }) => {
            eventDatesMap[d.id] = {
              event_date: d.event_date,
              event_name: eventsMap[d.event_id] || null,
              location: d.location,
            };
          });
        }

        const regBookingsMap: Record<string, string[]> = {};
        (bookings || []).forEach((b: { registration_id: string; event_date_id: string }) => {
          if (!regBookingsMap[b.registration_id]) regBookingsMap[b.registration_id] = [];
          regBookingsMap[b.registration_id].push(b.event_date_id);
        });

        eventUnified = (eventRegs || []).map((r: {
          id: string; title: string; first_name: string; surname: string; email: string;
          cellphone: string; payment_status: string; amount: number | null; created_at: string;
          children?: unknown[];
        }) => {
          const dateIds = regBookingsMap[r.id] || [];
          const eventNames = [...new Set(dateIds.map(id => eventDatesMap[id]?.event_name).filter(Boolean))] as string[];
          const eventDates = [...new Set(dateIds.map(id => eventDatesMap[id]?.event_date).filter(Boolean))] as string[];
          const venue = dateIds.map(id => eventDatesMap[id]?.location).find(Boolean) || null;
          const filledParticipants = Array.isArray(r.children)
            ? r.children.filter((c: unknown) => {
                if (!c || typeof c !== 'object') return false;
                const p = c as Record<string, unknown>;
                return p.fullName || p.full_name || p.name;
              })
            : [];
          return {
            id: r.id,
            source: 'event' as const,
            title: r.title,
            first_name: r.first_name,
            surname: r.surname,
            email: r.email,
            cellphone: r.cellphone,
            payment_status: r.payment_status,
            amount: r.amount,
            created_at: r.created_at,
            event_names: eventNames,
            venue,
            event_dates: eventDates,
            participant_count: filledParticipants.length,
          };
        });
      }

      // ── 3. Merge & sort by created_at desc ────────────────────────────────
      const merged = [...classUnified, ...eventUnified].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRegistrations(merged);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setCurrentPage(1); }, [sourceFilter, searchQuery, paymentFilter]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalRegistrations = registrations.length;
  const totalPaid = registrations.filter(r => r.payment_status === 'paid').length;
  const totalRevenue = registrations.reduce((sum, r) => sum + (r.payment_status === 'paid' ? (r.amount || 0) : 0), 0);
  const classCount = registrations.filter(r => r.source === 'class').length;
  const eventCount = registrations.filter(r => r.source === 'event').length;
  const totalParticipants = registrations.reduce((sum, r) => sum + r.participant_count, 0);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = registrations.filter(r => {
    if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
    if (paymentFilter !== 'all' && r.payment_status !== paymentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fullName = `${r.first_name} ${r.surname}`.toLowerCase();
      if (!fullName.includes(q) && !r.email.toLowerCase().includes(q) && !r.cellphone.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Unique payment statuses for filter dropdown
  const allStatuses = [...new Set(registrations.map(r => r.payment_status))].sort();

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1612]">Customer Registrations</h2>
          <p className="text-sm text-[#8C8278] mt-1">Combined class and event booking registrations</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#DDD5C8] text-[#5C5347] rounded-xl text-sm font-medium hover:bg-[#FAF5EE] hover:text-[#C4622D] transition-colors disabled:opacity-50"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>↺</span>
          Refresh
        </button>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E8DDD0] p-5">
          <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-2">Total Registrations</p>
          <p className="text-3xl font-bold text-[#1A1612]">{totalRegistrations}</p>
          <p className="text-xs text-[#8C8278] mt-1">{classCount} classes · {eventCount} events</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8DDD0] p-5">
          <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-2">Participants</p>
          <p className="text-3xl font-bold text-[#1A1612]">{totalParticipants}</p>
          <p className="text-xs text-[#8C8278] mt-1">across classes &amp; events</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8DDD0] p-5">
          <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-2">Paid</p>
          <p className="text-3xl font-bold text-green-600">{totalPaid}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E8DDD0] p-5">
          <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-2">Filtered Results</p>
          <p className="text-3xl font-bold text-[#C4622D]">{filtered.length}</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-[#E8DDD0] p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Source filter tabs */}
          <div className="flex gap-1 bg-[#F5F0E8] rounded-xl p-1">
            {(['all', 'class', 'event'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  sourceFilter === s
                    ? 'bg-[#C4622D] text-white shadow-sm'
                    : 'text-[#5C5347] hover:text-[#C4622D]'
                }`}
              >
                {s === 'all' ? 'All' : s === 'class' ? '👨‍🍳 Classes' : '🎪 Events'}
              </button>
            ))}
          </div>

          {/* Payment status filter */}
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="text-sm border border-[#DDD5C8] rounded-xl px-3 py-2 bg-white text-[#5C5347] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
          >
            <option value="all">All Statuses</option>
            {allStatuses.map(s => (
              <option key={s} value={s}>{formatPaymentStatus(s)}</option>
            ))}
          </select>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name, email or phone…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-sm border border-[#DDD5C8] rounded-xl px-3 py-2 bg-white text-[#5C5347] placeholder-[#B8AFA8] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
            />
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#8C8278]">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">No registrations found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F5F0E8] border-b border-[#E8DDD0]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5347] uppercase tracking-wider">REGISTRANT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5347] uppercase tracking-wider">CONTACT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5347] uppercase tracking-wider">TYPE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5347] uppercase tracking-wider">EVENT / CLASS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5347] uppercase tracking-wider">VENUE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5347] uppercase tracking-wider">DATE(S)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5347] uppercase tracking-wider">STATUS</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#5C5347] uppercase tracking-wider">AMOUNT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#5C5347] uppercase tracking-wider">REGISTERED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E8DE]">
                  {paginated.map(r => {
                    const fullName = `${r.title ? r.title + ' ' : ''}${r.first_name} ${r.surname}`.trim();
                    const statusColor = PAYMENT_STATUS_COLORS[r.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200';
                    return (
                      <tr key={`${r.source}-${r.id}`} className="hover:bg-[#FAF5EE] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#1A1612] text-sm">{fullName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-[#5C5347]">{r.email}</p>
                          <p className="text-xs text-[#8C8278]">{r.cellphone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
                            r.source === 'class' ?'bg-orange-50 text-orange-700 border-orange-200' :'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {r.source === 'class' ? '👨‍🍳 Class' : '🎪 Event'}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          {r.event_names.length > 0 ? (
                            <div className="space-y-1">
                              {r.event_names.map((name, i) => (
                                <span key={i} className="block text-xs font-medium text-[#C4622D] bg-[#FDF6EE] border border-[#F0D5C0] rounded-lg px-2 py-1 leading-snug">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[#8C8278]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-[#5C5347] whitespace-normal break-words min-w-[120px]">
                            {r.venue || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {r.event_dates.length > 0 ? (
                            <div className="space-y-0.5">
                              {r.event_dates.slice(0, 2).map((d, i) => (
                                <p key={i} className="text-xs text-[#5C5347] whitespace-nowrap">{formatDate(d)}</p>
                              ))}
                              {r.event_dates.length > 2 && (
                                <p className="text-xs text-[#8C8278]">+{r.event_dates.length - 2} more</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#8C8278]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                            {formatPaymentStatus(r.payment_status)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#1A1612] whitespace-nowrap text-sm">
                          {formatCurrency(r.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#5C5347] whitespace-nowrap">
                          {formatDate(r.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginator currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </div>
    </div>
  );
}
