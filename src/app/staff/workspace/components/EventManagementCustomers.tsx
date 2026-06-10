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
  school?: string;
  grade?: string;
}

interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
  cellphone?: string;
  [key: string]: unknown;
}

interface Registration {
  id: string;
  title: string;
  first_name: string;
  surname: string;
  email: string;
  cellphone: string;
  selected_events: string[];
  adult_class_dates: string[];
  payment_method: string;
  payment_status: string;
  amount: number | null;
  created_at: string;
  relationship: string | null;
  first_time_portal: string | null;
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
  proof_of_payment_url: string | null;
  notes: string | null;
  registration_code?: string | null;
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

interface EventManagementCustomersProps {
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

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

function formatCurrency(val: number | null | undefined) {
  if (val == null) return '—';
  return `R${Number(val).toFixed(2)}`;
}

export default function EventManagementCustomers({ isSuperAdmin = false }: EventManagementCustomersProps) {
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentStatusOptions, setPaymentStatusOptions] = useState<string[]>(FALLBACK_STATUSES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: regs, error: regsErr } = await supabase
        .from('event_management_registrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (regsErr) throw regsErr;
      if (!regs || regs.length === 0) { setRegistrations([]); return; }

      const regIds = regs.map((r: Registration) => r.id);
      const { data: bookings } = await supabase
        .from('event_management_booking_counts')
        .select('registration_id, event_date_id')
        .in('registration_id', regIds);

      const eventDateIds = [...new Set((bookings || []).map((b: any) => b.event_date_id))];
      let eventDatesMap: Record<string, SessionDate> = {};

      if (eventDateIds.length > 0) {
        const { data: dates } = await supabase
          .from('event_management_event_dates')
          .select('id, event_date, start_time, end_time, location, event_fee, event_id')
          .in('id', eventDateIds);

        if (dates && dates.length > 0) {
          const eventIds = [...new Set(dates.map((d: any) => d.event_id).filter(Boolean))];
          let eventsMap: Record<string, string> = {};
          if (eventIds.length > 0) {
            const { data: events } = await supabase.from('event_management_events').select('id, name').in('id', eventIds);
            (events || []).forEach((e: any) => { eventsMap[e.id] = e.name; });
          }
          dates.forEach((d: any) => {
            eventDatesMap[d.id] = {
              id: d.id,
              event_date: d.event_date,
              start_time: d.start_time,
              end_time: d.end_time,
              location: d.location,
              event_fee: d.event_fee,
              event_name: eventsMap[d.event_id] || null,
            };
          });
        }
      }

      const regSessionMap: Record<string, SessionDate[]> = {};
      (bookings || []).forEach((b: any) => {
        if (!regSessionMap[b.registration_id]) regSessionMap[b.registration_id] = [];
        if (eventDatesMap[b.event_date_id]) regSessionMap[b.registration_id].push(eventDatesMap[b.event_date_id]);
      });

      const enriched: Registration[] = regs.map((r: Registration) => ({ ...r, session_dates: regSessionMap[r.id] || [] }));
      setRegistrations(enriched);

      const dbStatuses = [...new Set(regs.map((r: Registration) => r.payment_status).filter(Boolean))] as string[];
      setPaymentStatusOptions([...new Set([...FALLBACK_STATUSES, ...dbStatuses])].sort());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations');
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

  async function savePaymentStatus(id: string) {
    setSaving(true);
    setSaveError('');
    try {
      const { error } = await supabase.from('event_management_registrations').update({ payment_status: editPaymentStatus, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRegistration() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await supabase.from('event_management_booking_counts').delete().eq('registration_id', deleteTarget.id);
      const { error } = await supabase.from('event_management_registrations').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      setDeleteConfirmText('');
      await loadData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div></div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🧑‍🤝‍🧑</span>
        <h2 className="text-xl font-bold text-[#1A1612]">Event Customers</h2>
        <span className="ml-auto text-sm text-[#8C8278]">{filtered.length} registration{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, phone…"
          className="flex-1 min-w-48 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
        />
        <select
          value={paymentFilter}
          onChange={e => setPaymentFilter(e.target.value)}
          className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
        >
          <option value="all">All Statuses</option>
          {paymentStatusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#8C8278]">
          <p className="text-4xl mb-3">🎪</p>
          <p className="text-sm">No registrations found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(reg => {
            const isExpanded = expandedId === reg.id;
            const statusClass = PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-700 border-gray-200';
            return (
              <div key={reg.id} className="bg-white border border-[#EDE7DA] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF5EE] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1A1612]">{reg.title} {reg.first_name} {reg.surname}</p>
                      <p className="text-xs text-[#8C8278]">{reg.email} · {reg.cellphone}</p>
                      {reg.registration_code && (
                        <p className="text-xs font-mono font-semibold text-[#C4622D] mt-0.5">Reg: {reg.registration_code}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusClass}`}>{reg.payment_status.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-bold text-[#C4622D]">{formatCurrency(reg.amount)}</span>
                    <svg className={`w-4 h-4 text-[#8C8278] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[#EDE7DA] pt-4 space-y-4">
                    {/* Registration info */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><p className="text-xs text-[#8C8278]">Registered</p><p className="font-medium text-[#1A1612]">{formatDate(reg.created_at)}</p></div>
                      <div><p className="text-xs text-[#8C8278]">Payment Method</p><p className="font-medium text-[#1A1612]">{reg.payment_method || '—'}</p></div>
                      <div><p className="text-xs text-[#8C8278]">Amount</p><p className="font-medium text-[#C4622D]">{formatCurrency(reg.amount)}</p></div>
                      {reg.selected_events?.length > 0 && (
                        <div className="col-span-2 md:col-span-3"><p className="text-xs text-[#8C8278]">Events</p><p className="font-medium text-[#1A1612]">{reg.selected_events.join(', ')}</p></div>
                      )}
                      {reg.adult_class_dates?.length > 0 && (
                        <div className="col-span-2 md:col-span-3"><p className="text-xs text-[#8C8278]">Dates</p><p className="font-medium text-[#1A1612]">{reg.adult_class_dates.join(', ')}</p></div>
                      )}
                    </div>

                    {/* Participants */}
                    {Array.isArray(reg.children) && reg.children.filter(c => c.fullName || c.full_name || c.name).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-2">Participants</p>
                        <div className="space-y-2">
                          {reg.children.filter(c => c.fullName || c.full_name || c.name).map((c, i) => (
                            <div key={i} className="bg-[#FAF5EE] rounded-xl px-4 py-2.5 text-sm">
                              <p className="font-medium text-[#1A1612]">{c.fullName || c.full_name || c.name}</p>
                              <p className="text-xs text-[#8C8278]">{[c.gender, c.dietaryRestrictions].filter(Boolean).join(' · ')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment status edit */}
                    <div className="flex items-center gap-3 pt-2 border-t border-[#EDE7DA]">
                      {editingId === reg.id ? (
                        <>
                          <select value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                            {paymentStatusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                          <button onClick={() => savePaymentStatus(reg.id)} disabled={saving} className="bg-[#C4622D] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{saving ? '…' : 'Save'}</button>
                          <button onClick={() => { setEditingId(null); setSaveError(''); }} className="text-sm text-[#5C5347] hover:text-[#C4622D] transition-colors">Cancel</button>
                          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(reg.id); setEditPaymentStatus(reg.payment_status); }} className="text-sm text-[#C4622D] hover:text-[#A04E22] font-medium transition-colors">Edit Payment Status</button>
                          {isSuperAdmin && (
                            <button onClick={() => setDeleteTarget(reg)} className="text-sm text-red-500 hover:text-red-700 transition-colors ml-auto">Delete</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-[#1A1612] mb-2">Delete Registration</h3>
            <p className="text-sm text-[#5C5347] mb-4">Type <strong>DELETE</strong> to confirm deletion of <strong>{deleteTarget.first_name} {deleteTarget.surname}</strong>.</p>
            <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE" className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:border-red-400" />
            {deleteError && <p className="text-xs text-red-500 mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); setDeleteError(''); }} className="flex-1 border border-[#DDD5C8] text-[#5C5347] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FAF5EE] transition-colors">Cancel</button>
              <button onClick={deleteRegistration} disabled={deleteConfirmText !== 'DELETE' || deleting} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
