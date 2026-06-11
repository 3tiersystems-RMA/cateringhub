'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { filterFilledChildren, getChildDisplayName } from '@/lib/cooking-class-participants';

interface ChildParticipant {
  fullName?: string;
  full_name?: string;
  name?: string;
  dob?: string;
  age?: string | number;
  gender?: string;
  allergies?: string;
  dietaryRestrictions?: string;
  school?: string;
  grade?: string;
  ticket_number?: string;
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
  children: ChildParticipant[] | null;
  medical_doctor_first_name: string | null;
  medical_doctor_surname: string | null;
  medical_aid_name: string | null;
  medical_aid_number: string | null;
  pictures_taken: string | null;
  indemnity_consent: boolean | null;
  proof_of_payment_url: string | null;
  indemnity_file_url: string | null;
  notes: string | null;
  registration_code?: string | null;
  // joined
  session_dates?: SessionDate[];
}

interface SessionDate {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_name: string | null;
  class_fee: number | null;
}

interface CookingClassCustomersProps {
  isSuperAdmin?: boolean;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  awaiting_confirmation: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_payment: 'bg-blue-100 text-blue-700 border-blue-200',
};

// Fallback statuses in case DB has no distinct values yet
const FALLBACK_STATUSES = ['pending', 'paid', 'failed', 'awaiting_payment', 'awaiting_confirmation'];

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

function calcAge(dob: string | null | undefined): string {
  if (!dob) return '—';
  try {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? String(age) : '—';
  } catch { return '—'; }
}

function normalizeConsent(value: string | null | undefined): string | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (lower.startsWith('yes')) return 'Yes';
  if (lower.startsWith('no')) return 'No';
  // Capitalize first letter of whatever is stored
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function CookingClassCustomers({ isSuperAdmin = false }: CookingClassCustomersProps) {
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'awaiting_payment' | 'failed'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Record<string, 'registrant' | 'participants' | 'sessions' | 'medical'>>({});

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Edit payment status state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [paymentStatusOptions, setPaymentStatusOptions] = useState<string[]>(FALLBACK_STATUSES);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch all registrations
      const { data: regs, error: regsErr } = await supabase
        .from('cooking_class_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (regsErr) throw regsErr;
      if (!regs || regs.length === 0) { setRegistrations([]); return; }

      // 1b. Strip blank participant slots (staff RLS allows update)
      const cleanedRegs: Registration[] = await Promise.all(
        (regs as Registration[]).map(async (reg) => {
          const original = Array.isArray(reg.children) ? reg.children : [];
          const filled = filterFilledChildren(reg.children) as ChildParticipant[];
          if (filled.length >= original.length) return reg;

          const { error: cleanErr } = await supabase
            .from('cooking_class_registrations')
            .update({ children: filled, updated_at: new Date().toISOString() })
            .eq('id', reg.id);

          return cleanErr ? reg : { ...reg, children: filled };
        })
      );

      // 2. Fetch booking counts (links registrations → event_dates)
      const regIds = cleanedRegs.map((r: Registration) => r.id);
      const { data: bookings } = await supabase
        .from('cooking_class_booking_counts')
        .select('registration_id, event_date_id')
        .in('registration_id', regIds);

      // 3. Fetch event dates with event names
      const eventDateIds = [...new Set((bookings || []).map((b: { event_date_id: string }) => b.event_date_id))];
      let eventDatesMap: Record<string, SessionDate> = {};

      if (eventDateIds.length > 0) {
        const { data: dates } = await supabase
          .from('cooking_class_event_dates')
          .select('id, event_date, start_time, end_time, location, class_fee, event_id')
          .in('id', eventDateIds);

        if (dates && dates.length > 0) {
          const eventIds = [...new Set(dates.map((d: { event_id: string }) => d.event_id).filter(Boolean))];
          let eventsMap: Record<string, string> = {};
          if (eventIds.length > 0) {
            const { data: events } = await supabase
              .from('cooking_class_events')
              .select('id, name')
              .in('id', eventIds);
            (events || []).forEach((e: { id: string; name: string }) => { eventsMap[e.id] = e.name; });
          }
          dates.forEach((d: { id: string; event_date: string | null; start_time: string | null; end_time: string | null; location: string | null; class_fee: number | null; event_id: string }) => {
            eventDatesMap[d.id] = {
              id: d.id,
              event_date: d.event_date,
              start_time: d.start_time,
              end_time: d.end_time,
              location: d.location,
              class_fee: d.class_fee,
              event_name: eventsMap[d.event_id] || null,
            };
          });
        }
      }

      // 4. Build registration → session_dates map
      const regSessionMap: Record<string, SessionDate[]> = {};
      (bookings || []).forEach((b: { registration_id: string; event_date_id: string }) => {
        if (!regSessionMap[b.registration_id]) regSessionMap[b.registration_id] = [];
        if (eventDatesMap[b.event_date_id]) {
          regSessionMap[b.registration_id].push(eventDatesMap[b.event_date_id]);
        }
      });

      // 5. Merge
      const enriched: Registration[] = cleanedRegs.map((r: Registration) => ({
        ...r,
        session_dates: regSessionMap[r.id] || [],
      }));

      setRegistrations(enriched);

      // 6. Build distinct payment status options from DB values + fallbacks
      const dbStatuses = [...new Set(cleanedRegs.map((r: Registration) => r.payment_status).filter(Boolean))] as string[];
      const merged = [...new Set([...FALLBACK_STATUSES, ...dbStatuses])].sort();
      setPaymentStatusOptions(merged);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = registrations.filter(r => {
    const fullName = `${r.first_name} ${r.surname}`.toLowerCase();
    const matchSearch = !searchQuery ||
      fullName.includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cellphone.includes(searchQuery);
    const matchPayment = paymentFilter === 'all' || r.payment_status === paymentFilter;
    return matchSearch && matchPayment;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => {
      if (prev === id) {
        // Collapsing — cancel any active edit for this card
        if (editingId === id) {
          setEditingId(null);
          setSaveError('');
        }
        return null;
      }
      return id;
    });
    setActiveSection(prev => ({ ...prev, [id]: prev[id] || 'registrant' }));
  };

  const setSection = (id: string, section: 'registrant' | 'participants' | 'sessions' | 'medical') => {
    setActiveSection(prev => ({ ...prev, [id]: section }));
  };

  const totalPaid = filtered.reduce((sum, r) => sum + (r.payment_status === 'paid' ? (r.amount || 0) : 0), 0);
  const totalPending = filtered.filter(r => r.payment_status !== 'paid').length;

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const openDeleteModal = (reg: Registration, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(reg);
    setDeleteConfirmText('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteConfirmText('');
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      // Delete booking counts first (FK dependency)
      const { error: bookingErr } = await supabase
        .from('cooking_class_booking_counts')
        .delete()
        .eq('registration_id', deleteTarget.id);
      if (bookingErr) throw bookingErr;

      // Delete the registration record
      const { error: regErr } = await supabase
        .from('cooking_class_registrations')
        .delete()
        .eq('id', deleteTarget.id);
      if (regErr) throw regErr;

      setRegistrations(prev => prev.filter(r => r.id !== deleteTarget.id));
      if (expandedId === deleteTarget.id) setExpandedId(null);
      closeDeleteModal();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  // ── Edit payment status handlers ─────────────────────────────────────────────
  const openEdit = (reg: Registration, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(reg.id);
    setEditPaymentStatus(reg.payment_status);
    setSaveError('');
    // Ensure registrant tab is active so the dropdown is visible
    setActiveSection(prev => ({ ...prev, [reg.id]: 'registrant' }));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError('');
  };

  const savePaymentStatus = async (regId: string) => {
    setSaving(true);
    setSaveError('');
    try {
      const { error: updateErr } = await supabase
        .from('cooking_class_registrations')
        .update({ payment_status: editPaymentStatus, updated_at: new Date().toISOString() })
        .eq('id', regId);
      if (updateErr) throw updateErr;

      // Update local state
      setRegistrations(prev =>
        prev.map(r => r.id === regId ? { ...r, payment_status: editPaymentStatus } : r)
      );
      setEditingId(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1612]">Cooking Class Customers</h2>
        <p className="text-sm text-[#8C8278] mt-0.5">All past and upcoming cooking class registrations</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-[#EDE7DA] rounded-xl p-4">
          <p className="text-xs text-[#8C8278] mb-1">Total Registrations</p>
          <p className="text-2xl font-bold text-[#1A1612]">{registrations.length}</p>
        </div>
        <div className="bg-white border border-[#EDE7DA] rounded-xl p-4">
          <p className="text-xs text-[#8C8278] mb-1">Showing</p>
          <p className="text-2xl font-bold text-[#1A1612]">{filtered.length}</p>
        </div>
        <div className="bg-white border border-[#EDE7DA] rounded-xl p-4">
          <p className="text-xs text-[#8C8278] mb-1">Total Paid (filtered)</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white border border-[#EDE7DA] rounded-xl p-4">
          <p className="text-xs text-[#8C8278] mb-1">Awaiting Payment</p>
          <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B5ADA5] hover:text-[#5C5347]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'paid', 'pending', 'awaiting_payment', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setPaymentFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                paymentFilter === s
                  ? 'bg-[#C4622D] text-white'
                  : 'bg-white border border-[#DDD5C8] text-[#5C5347] hover:border-[#C4622D]/40'
              }`}
            >
              {s === 'all' ? 'All' : s === 'awaiting_payment' ? 'Awaiting' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{error}</div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#EDE7DA] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">👨‍🍳</p>
          <p className="text-[#5C5347] font-medium">No registrations found</p>
          <p className="text-sm text-[#8C8278] mt-1">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(reg => {
            const isExpanded = expandedId === reg.id;
            const section = activeSection[reg.id] || 'registrant';
            const filledChildren = filterFilledChildren(reg.children) as ChildParticipant[];
            const participantCount = 1 + filledChildren.length;
            const sessions = reg.session_dates || [];
            const isPast = sessions.some(s => s.event_date && new Date(s.event_date) < new Date());
            const isUpcoming = sessions.some(s => s.event_date && new Date(s.event_date) >= new Date());
            const isEditing = editingId === reg.id;

            return (
              <div key={reg.id} className="bg-white border border-[#EDE7DA] rounded-2xl overflow-hidden">
                {/* Row Header */}
                <div
                  onClick={() => toggleExpand(reg.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 transition-colors text-left cursor-pointer ${
                    isExpanded ? 'bg-black hover:bg-black' : 'hover:bg-[#FAF5EE]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#e9e0cf] border border-[#DDD5C8] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#C4622D]">
                      {reg.first_name?.[0]?.toUpperCase()}{reg.surname?.[0]?.toUpperCase()}
                    </span>
                  </div>

                  {/* Name + Email */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isExpanded ? 'text-white' : 'text-[#1A1612]'}`}>
                      {reg.title ? `${reg.title} ` : ''}{reg.first_name} {reg.surname}
                    </p>
                    <p className={`text-xs truncate ${isExpanded ? 'text-gray-400' : 'text-[#8C8278]'}`}>{reg.email} · {reg.cellphone}</p>
                    {reg.registration_code && (
                      <p className={`text-xs font-mono font-semibold mt-0.5 ${isExpanded ? 'text-orange-300' : 'text-[#C4622D]'}`}>Reg: {reg.registration_code}</p>
                    )}
                  </div>

                  {/* Sessions badge */}
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    {isPast && (
                      <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">Past</span>
                    )}
                    {isUpcoming && (
                      <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">Upcoming</span>
                    )}
                    <span className="text-xs bg-[#e9e0cf] text-[#5C5347] border border-[#DDD5C8] px-2 py-0.5 rounded-full">
                      {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs bg-[#e9e0cf] text-[#5C5347] border border-[#DDD5C8] px-2 py-0.5 rounded-full">
                      {participantCount} participant{participantCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Amount + Payment Status */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className={`text-sm font-bold ${isExpanded ? 'text-white' : 'text-[#1A1612]'}`}>{formatCurrency(reg.amount)}</p>
                      <p className={`text-xs ${isExpanded ? 'text-gray-400' : 'text-[#8C8278]'}`}>{formatDate(reg.created_at)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {reg.payment_status.replace(/_/g, ' ')}
                    </span>

                    {/* EDIT button — visible to all admin staff, only when expanded */}
                    {isExpanded && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEditing) {
                            cancelEdit();
                          } else {
                            openEdit(reg, e);
                          }
                        }}
                        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          isEditing
                            ? 'bg-gray-100 border border-gray-300 text-gray-600 hover:bg-gray-200' :'bg-[#FDF6EE] border border-[#C4622D]/30 text-[#C4622D] hover:bg-[#C4622D]/10 hover:border-[#C4622D]/50'
                        }`}
                        title={isEditing ? 'Cancel editing' : 'Edit payment status'}
                      >
                        {isEditing ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Cancel
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </>
                        )}
                      </button>
                    )}

                    {/* Super Admin DELETE button */}
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={(e) => openDeleteModal(reg, e)}
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 hover:border-red-300 transition-colors"
                        title="Delete this registration (Super Admin only)"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    )}

                    <svg
                      className={`w-4 h-4 transition-transform flex-shrink-0 ${isExpanded ? 'text-gray-400 rotate-180' : 'text-[#8C8278]'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-[#EDE7DA]">
                    {/* Section Tabs */}
                    <div className="flex gap-1 px-5 pt-4 pb-0 border-b border-[#EDE7DA]">
                      {(['registrant', 'participants', 'sessions', 'medical'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setSection(reg.id, s)}
                          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                            section === s
                              ? 'text-[#C4622D] border-[#C4622D] bg-[#FDF6EE]'
                              : 'text-[#8C8278] border-transparent hover:text-[#5C5347]'
                          }`}
                        >
                          {s === 'registrant' && '👤 Registrant'}
                          {s === 'participants' && `👨‍👩‍👧 Participants (${participantCount})`}
                          {s === 'sessions' && `📅 Sessions (${sessions.length})`}
                          {s === 'medical' && '🏥 Medical'}
                        </button>
                      ))}
                    </div>

                    <div className="p-5">
                      {/* ── REGISTRANT SECTION ── */}
                      {section === 'registrant' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <Field label="Full Name" value={`${reg.title ? reg.title + ' ' : ''}${reg.first_name} ${reg.surname}`} />
                          <Field label="Email" value={reg.email} />
                          <Field label="Cellphone" value={reg.cellphone} />
                          <Field label="Relationship to Participants" value={reg.relationship} />
                          <Field label="First Time at Portal" value={reg.first_time_portal} />
                          <Field label="RSA ID / Passport" value={reg.rsa_id_passport} />
                          <Field label="Allergies / Illness" value={reg.allergies_illness} />
                          <Field label="Pictures Consent" value={normalizeConsent(reg.pictures_taken)} />
                          <Field label="Indemnity Consent" value={reg.indemnity_consent ? 'Yes' : 'No'} />
                          <Field label="Payment Method" value={reg.payment_method} />
                          <Field label="Amount Paid" value={formatCurrency(reg.amount)} highlight />

                          {/* Payment Status — editable dropdown when in edit mode */}
                          <div>
                            <p className="text-xs text-[#8C8278] mb-0.5 capitalize">Payment Status</p>
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <select
                                  value={editPaymentStatus}
                                  onChange={e => setEditPaymentStatus(e.target.value)}
                                  className="border border-[#C4622D] rounded-lg px-2 py-1.5 text-sm text-[#1A1612] bg-white focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 w-full"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {paymentStatusOptions.map(opt => (
                                    <option key={opt} value={opt}>
                                      {opt.replace(/_/g, ' ')}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); savePaymentStatus(reg.id); }}
                                    disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-[#C4622D] text-white text-xs font-semibold hover:bg-[#A8501F] transition-colors disabled:opacity-50"
                                  >
                                    {saving ? (
                                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Save
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); cancelEdit(); }}
                                    disabled={saving}
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#DDD5C8] text-xs font-medium text-[#5C5347] hover:bg-[#FAF5EE] transition-colors disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                {saveError && (
                                  <p className="text-xs text-red-600">{saveError}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm font-medium text-[#1A1612]">
                                {reg.payment_status?.replace(/_/g, ' ') || '—'}
                              </p>
                            )}
                          </div>

                          <Field label="Registered On" value={formatDate(reg.created_at)} />
                          {reg.notes && <Field label="Notes" value={reg.notes} span2 />}
                          {/* Emergency Contacts */}
                          {reg.emergency_contact1 && Object.keys(reg.emergency_contact1).length > 0 && (
                            <div className="col-span-2 sm:col-span-3">
                              <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-2">Emergency Contact 1</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAF5EE] rounded-xl p-3">
                                {Object.entries(reg.emergency_contact1).map(([k, v]) => v ? (
                                  <Field key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                                ) : null)}
                              </div>
                            </div>
                          )}
                          {reg.emergency_contact2 && Object.keys(reg.emergency_contact2).length > 0 && (
                            <div className="col-span-2 sm:col-span-3">
                              <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide mb-2">Emergency Contact 2</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAF5EE] rounded-xl p-3">
                                {Object.entries(reg.emergency_contact2).map(([k, v]) => v ? (
                                  <Field key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                                ) : null)}
                              </div>
                            </div>
                          )}
                          {reg.proof_of_payment_url && (
                            <div className="col-span-2 sm:col-span-3 flex flex-wrap items-center gap-4">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    // Extract the storage path from the stored URL
                                    // URL format: .../storage/v1/object/public/cooking-class-proofs/<path>
                                    // or: .../storage/v1/object/sign/cooking-class-proofs/<path>
                                    const url = reg.proof_of_payment_url!;
                                    const bucketName = 'cooking-class-proofs';
                                    const marker = `/${bucketName}/`;
                                    const markerIdx = url.indexOf(marker);
                                    if (markerIdx === -1) {
                                      // Fallback: open URL directly (e.g. Google Drive URL)
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                      return;
                                    }
                                    const storagePath = url.slice(markerIdx + marker.length).split('?')[0];
                                    const supabase = createClient();
                                    const { data, error } = await supabase.storage
                                      .from(bucketName)
                                      .createSignedUrl(storagePath, 60 * 60); // 1 hour
                                    if (error || !data?.signedUrl) {
                                      alert('Could not generate a view link. Please try again.');
                                      return;
                                    }
                                    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                                  } catch {
                                    alert('Could not open proof of payment. Please try again.');
                                  }
                                }}
                                className="inline-flex items-center gap-2 text-xs text-[#C4622D] font-medium hover:underline cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                View Proof of Payment
                              </button>

                              {reg.indemnity_consent && reg.indemnity_file_url && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const url = reg.indemnity_file_url!;
                                      const bucketName = 'cooking-class-proofs';
                                      const marker = `/${bucketName}/`;
                                      const markerIdx = url.indexOf(marker);
                                      if (markerIdx === -1) {
                                        // Fallback: open URL directly (e.g. Google Drive URL)
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                        return;
                                      }
                                      const storagePath = url.slice(markerIdx + marker.length).split('?')[0];
                                      const supabase = createClient();
                                      const { data, error } = await supabase.storage
                                        .from(bucketName)
                                        .createSignedUrl(storagePath, 60 * 60); // 1 hour
                                      if (error || !data?.signedUrl) {
                                        alert('Could not generate a view link. Please try again.');
                                        return;
                                      }
                                      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                                    } catch {
                                      alert('Could not open signed indemnity form. Please try again.');
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 text-xs text-[#C4622D] font-medium hover:underline cursor-pointer"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  View Signed Indemnity Form
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── PARTICIPANTS SECTION ── */}
                      {section === 'participants' && (
                        <div className="space-y-4">
                          {/* Registrant as participant */}
                          <div className="border border-[#EDE7DA] rounded-xl overflow-hidden">
                            <div className="bg-[#e9e0cf] px-4 py-2.5 flex items-center gap-2">
                              <span className="text-sm font-semibold text-[#1A1612]">
                                {reg.title ? `${reg.title} ` : ''}{reg.first_name} {reg.surname}
                              </span>
                              <span className="ml-auto text-xs text-[#8C8278]">Registrant / Adult</span>
                            </div>
                            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <Field label="Full Name" value={`${reg.title ? reg.title + ' ' : ''}${reg.first_name} ${reg.surname}`} />
                              <Field label="Email" value={reg.email} />
                              <Field label="Cellphone" value={reg.cellphone} />
                              <Field label="RSA ID / Passport" value={reg.rsa_id_passport} />
                              <Field label="Allergies / Illness" value={reg.allergies_illness} />
                              <Field label="Relationship" value={reg.relationship} />
                            </div>
                          </div>

                          {/* Children participants */}
                          {filledChildren.length > 0 ? filledChildren.map((child, idx) => {
                            const childName = getChildDisplayName(child) || `Child ${idx + 1}`;
                            const childAge = child.age != null && child.age !== '' ? String(child.age) : calcAge(child.dob);
                            const childAllergies = child.allergies || child.dietaryRestrictions;
                            return (
                              <div key={idx} className="border border-[#EDE7DA] rounded-xl overflow-hidden">
                                <div className="bg-[#e9e0cf] px-4 py-2.5 flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-[#C4622D] text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                                  <span className="text-sm font-semibold text-[#1A1612]">{childName}</span>
                                  {childAge !== '—' && (
                                    <span className="text-xs bg-white border border-[#DDD5C8] text-[#5C5347] px-2 py-0.5 rounded-full">Age {childAge}</span>
                                  )}
                                  {child.ticket_number && (
                                    <span className="text-xs font-mono font-semibold bg-[#FDF6EE] border border-[#C4622D]/30 text-[#C4622D] px-2 py-0.5 rounded-full">{child.ticket_number}</span>
                                  )}
                                  <span className="ml-auto text-xs text-[#8C8278]">Child Participant</span>
                                </div>
                                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  <Field label="Full Name" value={childName} />
                                  {child.ticket_number && <Field label="Ticket Number" value={child.ticket_number} highlight />}
                                  <Field label="Date of Birth" value={child.dob ? formatDate(child.dob) : undefined} />
                                  <Field label="Age" value={childAge} />
                                  {child.gender && <Field label="Gender" value={child.gender} />}
                                  {child.school && <Field label="School" value={child.school} />}
                                  {child.grade && <Field label="Grade" value={child.grade} />}
                                  {childAllergies && <Field label="Allergies / Dietary" value={childAllergies} />}
                                  {child.picturesTaken !== undefined && child.picturesTaken !== null && child.picturesTaken !== '' && (
                                    <Field label="Pictures Taken" value={String(child.picturesTaken)} />
                                  )}
                                  {(child as Record<string, unknown>).indemnityConsent !== undefined && (child as Record<string, unknown>).indemnityConsent !== null && (child as Record<string, unknown>).indemnityConsent !== '' && (
                                    <Field label="Indemnity Consent" value={(child as Record<string, unknown>).indemnityConsent === true || (child as Record<string, unknown>).indemnityConsent === 'true' ? 'Yes' : 'No'} />
                                  )}
                                  {/* Render any other fields */}
                                  {Object.entries(child)
                                    .filter(([k]) => !['full_name', 'fullName', 'name', 'dob', 'age', 'gender', 'school', 'grade', 'allergies', 'dietaryRestrictions', 'picturesTaken', 'indemnityConsent', 'ticket_number'].includes(k))
                                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                    .map(([k, v]) => (
                                      <Field key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                                    ))}
                                </div>
                              </div>
                            );
                          }) : (
                            <div className="text-center py-6 text-sm text-[#8C8278]">No additional child participants registered</div>
                          )}
                        </div>
                      )}

                      {/* ── SESSIONS SECTION ── */}
                      {section === 'sessions' && (
                        <div className="space-y-3">
                          {sessions.length === 0 ? (
                            <div className="text-center py-8 text-sm text-[#8C8278]">No session dates linked to this registration</div>
                          ) : (
                            sessions
                              .sort((a, b) => {
                                if (!a.event_date) return 1;
                                if (!b.event_date) return -1;
                                return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
                              })
                              .map((session, idx) => {
                                const sessionDate = session.event_date ? new Date(session.event_date) : null;
                                const isPastSession = sessionDate && sessionDate < new Date();
                                return (
                                  <div key={session.id} className="border border-[#EDE7DA] rounded-xl p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${isPastSession ? 'bg-gray-100 text-gray-500' : 'bg-[#FDF6EE] text-[#C4622D]'}`}>
                                          {idx + 1}
                                        </div>
                                        <div>
                                          {session.event_name && (
                                            <p className="text-xs font-semibold text-[#C4622D] mb-0.5">{session.event_name}</p>
                                          )}
                                          <p className="text-sm font-semibold text-[#1A1612]">
                                            {session.event_date ? formatDate(session.event_date) : '—'}
                                          </p>
                                          {(session.start_time || session.end_time) && (
                                            <p className="text-xs text-[#8C8278]">
                                              {session.start_time || ''}{session.start_time && session.end_time ? ' – ' : ''}{session.end_time || ''}
                                            </p>
                                          )}
                                          {session.location && (
                                            <p className="text-xs text-[#8C8278] mt-0.5">{session.location}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        {session.class_fee != null && (
                                          <p className="text-sm font-bold text-[#1A1612]">{formatCurrency(session.class_fee)}</p>
                                        )}
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${isPastSession ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                          {isPastSession ? 'Past' : 'Upcoming'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                          )}

                          {/* Summary */}
                          {sessions.length > 0 && (
                            <div className="bg-[#e9e0cf] rounded-xl p-4 flex flex-wrap gap-4">
                              <div>
                                <p className="text-xs text-[#8C8278]">Total Sessions</p>
                                <p className="text-lg font-bold text-[#1A1612]">{sessions.length}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#8C8278]">Participants</p>
                                <p className="text-lg font-bold text-[#1A1612]">{participantCount}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#8C8278]">Amount Paid</p>
                                <p className="text-lg font-bold text-green-700">{formatCurrency(reg.amount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#8C8278]">Payment Status</p>
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                  {reg.payment_status.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── MEDICAL SECTION ── */}
                      {section === 'medical' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <Field label="Medical Aid Name" value={reg.medical_aid_name} />
                          <Field label="Medical Aid Number" value={reg.medical_aid_number} />
                          <Field label="Doctor First Name" value={reg.medical_doctor_first_name} />
                          <Field label="Doctor Surname" value={reg.medical_doctor_surname} />
                          <Field label="Allergies / Illness" value={reg.allergies_illness} />
                          {filledChildren.map((child, idx) => {
                            const childName = getChildDisplayName(child) || `Child ${idx + 1}`;
                            const childAllergies = child.allergies || child.dietaryRestrictions;
                            if (!childAllergies) return null;
                            return (
                              <Field key={idx} label={`${childName} – Allergies / Dietary`} value={childAllergies} />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL (Super Admin only) ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-red-100">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1612]">Delete Customer Record</h3>
                <p className="text-xs text-red-600 font-medium">This action is permanent and cannot be undone</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-[#5C5347] mb-1">You are about to permanently delete the complete record for:</p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-sm font-bold text-[#1A1612]">
                  {deleteTarget.title ? `${deleteTarget.title} ` : ''}{deleteTarget.first_name} {deleteTarget.surname}
                </p>
                <p className="text-xs text-[#8C8278]">{deleteTarget.email} · {deleteTarget.cellphone}</p>
                <p className="text-xs text-[#8C8278] mt-0.5">
                  Registered: {formatDate(deleteTarget.created_at)} · Amount: {formatCurrency(deleteTarget.amount)}
                </p>
              </div>
              <p className="text-xs text-[#8C8278] mb-3">
                This will permanently remove the registration, all participant data, session bookings, and payment records associated with this customer.
              </p>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">
                Type <span className="text-red-600 font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE here"
                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 bg-white"
                autoFocus
              />
              {deleteError && (
                <p className="text-xs text-red-600 mt-2">{deleteError}</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-medium text-[#5C5347] hover:bg-[#FAF5EE] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, highlight, span2 }: { label: string; value?: string | null; highlight?: boolean; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <p className="text-xs text-[#8C8278] mb-0.5 capitalize">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-green-700' : 'text-[#1A1612]'} ${!value ? 'text-[#B5ADA5]' : ''}`}>
        {value || '—'}
      </p>
    </div>
  );
}
