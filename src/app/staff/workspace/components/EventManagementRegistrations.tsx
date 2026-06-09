'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ParticipantRow {
  fullName?: string;
  full_name?: string;
  name?: string;
  dob?: string;
  age?: string | number;
  gender?: string;
  dietaryRestrictions?: string;
  allergies?: string;
  [key: string]: unknown;
}

interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
  cellphone?: string;
  [key: string]: unknown;
}

interface RegistrationRow {
  id: string;
  title: string;
  first_name: string;
  surname: string;
  email: string;
  cellphone: string;
  payment_status: string;
  amount: number | null;
  created_at: string;
  relationship: string | null;
  allergies_illness: string | null;
  rsa_id_passport: string | null;
  emergency_contact1: EmergencyContact | null;
  emergency_contact2: EmergencyContact | null;
  children: ParticipantRow[] | null;
  attend_school_holiday: string | null;
  medical_doctor_first_name: string | null;
  medical_doctor_surname: string | null;
  medical_aid_name: string | null;
  medical_aid_number: string | null;
  pictures_taken: string | null;
  indemnity_consent: boolean | null;
  notes: string | null;
  session_dates?: SessionDate[];
}

interface SessionDate {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_name: string | null;
  event_fee: number | null;
}

interface EventManagementRegistrationsProps {
  isSuperAdmin?: boolean;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  awaiting_confirmation: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_payment: 'bg-blue-100 text-blue-700 border-blue-200',
};

const FALLBACK_STATUSES = ['pending', 'paid', 'failed', 'awaiting_payment', 'awaiting_confirmation'];
const PAGE_SIZE = 10;

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

function formatCurrency(val: number | null | undefined) {
  if (val == null) return '—';
  return `R${Number(val).toFixed(2)}`;
}

function Paginator({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const btnBase = 'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 text-xs font-medium rounded-lg border transition-all duration-150 select-none';
  const btnActive = 'bg-[#C4622D] text-white border-[#C4622D] shadow-sm';
  const btnInactive = 'bg-white text-[#5C5347] border-[#E8DDD0] hover:bg-[#FDF6EE] hover:border-[#C4622D] hover:text-[#C4622D]';
  const btnDisabled = 'bg-[#FAF5EE] text-[#C4B8A8] border-[#E8DDD0] cursor-not-allowed opacity-60';
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    if (currentPage > 3) pages.push('ellipsis');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#FAF5EE] to-[#F5EFE8] border-t border-[#E8DDD0]">
      <p className="text-xs text-[#8C7B6B] font-medium">Page <span className="text-[#C4622D] font-semibold">{currentPage}</span> of <span className="font-semibold text-[#5C5347]">{totalPages}</span></p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnInactive}`}>«</button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnInactive}`}>‹</button>
        {pages.map((p, i) => p === 'ellipsis' ? <span key={`e-${i}`} className="px-1 text-[#8C7B6B] text-xs">…</span> : <button key={p} onClick={() => onPageChange(p as number)} className={`${btnBase} w-8 ${p === currentPage ? btnActive : btnInactive}`}>{p}</button>)}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnInactive}`}>›</button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnInactive}`}>»</button>
      </div>
    </div>
  );
}

export default function EventManagementRegistrations({ isSuperAdmin = false }: EventManagementRegistrationsProps) {
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentStatusOptions, setPaymentStatusOptions] = useState<string[]>(FALLBACK_STATUSES);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: regs, error: regsErr } = await supabase.from('event_management_registrations').select('*').order('created_at', { ascending: false });
      if (regsErr) throw regsErr;
      if (!regs || regs.length === 0) { setRegistrations([]); return; }

      const regIds = regs.map((r: RegistrationRow) => r.id);
      const { data: bookings } = await supabase.from('event_management_booking_counts').select('registration_id, event_date_id').in('registration_id', regIds);
      const eventDateIds = [...new Set((bookings || []).map((b: any) => b.event_date_id))];
      let eventDatesMap: Record<string, SessionDate> = {};

      if (eventDateIds.length > 0) {
        const { data: dates } = await supabase.from('event_management_event_dates').select('id, event_date, start_time, end_time, location, event_fee, event_id').in('id', eventDateIds);
        if (dates && dates.length > 0) {
          const eventIds = [...new Set(dates.map((d: any) => d.event_id).filter(Boolean))];
          let eventsMap: Record<string, string> = {};
          if (eventIds.length > 0) {
            const { data: events } = await supabase.from('event_management_events').select('id, name').in('id', eventIds);
            (events || []).forEach((e: any) => { eventsMap[e.id] = e.name; });
          }
          dates.forEach((d: any) => {
            eventDatesMap[d.id] = { id: d.id, event_date: d.event_date, start_time: d.start_time, end_time: d.end_time, location: d.location, event_fee: d.event_fee, event_name: eventsMap[d.event_id] || null };
          });
        }
      }

      const regSessionMap: Record<string, SessionDate[]> = {};
      (bookings || []).forEach((b: any) => {
        if (!regSessionMap[b.registration_id]) regSessionMap[b.registration_id] = [];
        if (eventDatesMap[b.event_date_id]) regSessionMap[b.registration_id].push(eventDatesMap[b.event_date_id]);
      });

      const enriched = regs.map((r: RegistrationRow) => ({ ...r, session_dates: regSessionMap[r.id] || [] }));
      setRegistrations(enriched);
      const dbStatuses = [...new Set(regs.map((r: RegistrationRow) => r.payment_status).filter(Boolean))] as string[];
      setPaymentStatusOptions([...new Set([...FALLBACK_STATUSES, ...dbStatuses])].sort());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = registrations.filter(r => {
    const fullName = `${r.first_name} ${r.surname}`.toLowerCase();
    const matchSearch = !searchQuery || fullName.includes(searchQuery.toLowerCase()) || r.email.toLowerCase().includes(searchQuery.toLowerCase()) || r.cellphone.includes(searchQuery);
    const matchPayment = paymentFilter === 'all' || r.payment_status === paymentFilter;
    return matchSearch && matchPayment;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div></div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">📋</span>
        <h2 className="text-xl font-bold text-[#1A1612]">Event Registrations</h2>
        <span className="ml-auto text-sm text-[#8C8278]">{filtered.length} registration{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="Search by name, email, phone…" className="flex-1 min-w-48 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
        <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setCurrentPage(1); }} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
          <option value="all">All Statuses</option>
          {paymentStatusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#8C8278]"><p className="text-4xl mb-3">📋</p><p className="text-sm">No registrations found.</p></div>
      ) : (
        <div className="bg-white border border-[#EDE7DA] rounded-2xl overflow-hidden">
          <div className="divide-y divide-[#EDE7DA]">
            {paginated.map(reg => {
              const isExpanded = expandedId === reg.id;
              const statusClass = PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-700 border-gray-200';
              return (
                <div key={reg.id}>
                  <button type="button" onClick={() => setExpandedId(isExpanded ? null : reg.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF5EE] transition-colors text-left">
                    <div>
                      <p className="text-sm font-semibold text-[#1A1612]">{reg.title} {reg.first_name} {reg.surname}</p>
                      <p className="text-xs text-[#8C8278]">{reg.email} · {formatDate(reg.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusClass}`}>{reg.payment_status.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-bold text-[#C4622D]">{formatCurrency(reg.amount)}</span>
                      <svg className={`w-4 h-4 text-[#8C8278] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-[#EDE7DA] pt-4 space-y-4 bg-[#FAF5EE]">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div><p className="text-xs text-[#8C8278]">Cellphone</p><p className="font-medium text-[#1A1612]">{reg.cellphone}</p></div>
                        <div><p className="text-xs text-[#8C8278]">Payment Method</p><p className="font-medium text-[#1A1612]">{reg.payment_method || '—'}</p></div>
                        <div><p className="text-xs text-[#8C8278]">Amount</p><p className="font-medium text-[#C4622D]">{formatCurrency(reg.amount)}</p></div>
                        {reg.relationship && <div><p className="text-xs text-[#8C8278]">Relationship</p><p className="font-medium text-[#1A1612]">{reg.relationship}</p></div>}
                        {reg.allergies_illness && <div className="col-span-2"><p className="text-xs text-[#8C8278]">Allergies/Illness</p><p className="font-medium text-[#1A1612]">{reg.allergies_illness}</p></div>}
                      </div>

                      {/* Session dates */}
                      {reg.session_dates && reg.session_dates.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-2">Booked Sessions</p>
                          <div className="space-y-1">
                            {reg.session_dates.map((s, i) => (
                              <div key={i} className="bg-white rounded-xl px-4 py-2 text-xs text-[#5C5347] border border-[#EDE7DA]">
                                <span className="font-medium text-[#1A1612]">{s.event_name || '—'}</span> · {formatDate(s.event_date)} {s.start_time ? `· ${s.start_time}` : ''} {s.location ? `· ${s.location}` : ''}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Participants */}
                      {Array.isArray(reg.children) && reg.children.filter(c => c.fullName || c.full_name || c.name).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-2">Participants</p>
                          <div className="space-y-1">
                            {reg.children.filter(c => c.fullName || c.full_name || c.name).map((c, i) => (
                              <div key={i} className="bg-white rounded-xl px-4 py-2 text-xs border border-[#EDE7DA]">
                                <span className="font-medium text-[#1A1612]">{c.fullName || c.full_name || c.name}</span>
                                {c.gender && <span className="text-[#8C8278]"> · {c.gender}</span>}
                                {c.dietaryRestrictions && <span className="text-[#8C8278]"> · {c.dietaryRestrictions}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Emergency contacts */}
                      {reg.emergency_contact1 && (
                        <div>
                          <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-2">Emergency Contact</p>
                          <div className="bg-white rounded-xl px-4 py-2 text-xs border border-[#EDE7DA]">
                            <span className="font-medium text-[#1A1612]">{[reg.emergency_contact1.title, reg.emergency_contact1.firstName, reg.emergency_contact1.surname].filter(Boolean).join(' ')}</span>
                            {reg.emergency_contact1.cellNo && <span className="text-[#8C8278]"> · {String(reg.emergency_contact1.cellNo)}</span>}
                            {reg.emergency_contact1.relationshipToChild && <span className="text-[#8C8278]"> · {String(reg.emergency_contact1.relationshipToChild)}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Paginator currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
}
