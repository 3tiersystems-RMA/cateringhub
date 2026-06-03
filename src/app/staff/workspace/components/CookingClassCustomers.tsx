'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ChildParticipant {
  full_name?: string;
  name?: string;
  dob?: string;
  age?: string | number;
  gender?: string;
  allergies?: string;
  school?: string;
  grade?: string;
  [key: string]: unknown;
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
  attend_school_holiday: string | null;
  medical_doctor_first_name: string | null;
  medical_doctor_surname: string | null;
  medical_aid_name: string | null;
  medical_aid_number: string | null;
  pictures_taken: string | null;
  indemnity_consent: boolean | null;
  proof_of_payment_url: string | null;
  notes: string | null;
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

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  awaiting_confirmation: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_payment: 'bg-blue-100 text-blue-700 border-blue-200',
};

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

export default function CookingClassCustomers() {
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'awaiting_payment' | 'failed'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Record<string, 'registrant' | 'participants' | 'sessions' | 'medical'>>({});

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

      // 2. Fetch booking counts (links registrations → event_dates)
      const regIds = regs.map((r: Registration) => r.id);
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
      const enriched: Registration[] = regs.map((r: Registration) => ({
        ...r,
        session_dates: regSessionMap[r.id] || [],
      }));

      setRegistrations(enriched);
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
    setExpandedId(prev => prev === id ? null : id);
    setActiveSection(prev => ({ ...prev, [id]: prev[id] || 'registrant' }));
  };

  const setSection = (id: string, section: 'registrant' | 'participants' | 'sessions' | 'medical') => {
    setActiveSection(prev => ({ ...prev, [id]: section }));
  };

  const totalPaid = filtered.reduce((sum, r) => sum + (r.payment_status === 'paid' ? (r.amount || 0) : 0), 0);
  const totalPending = filtered.filter(r => r.payment_status !== 'paid').length;

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
            const children: ChildParticipant[] = Array.isArray(reg.children) ? reg.children : [];
            const participantCount = 1 + children.length; // registrant + children
            const sessions = reg.session_dates || [];
            const isPast = sessions.some(s => s.event_date && new Date(s.event_date) < new Date());
            const isUpcoming = sessions.some(s => s.event_date && new Date(s.event_date) >= new Date());

            return (
              <div key={reg.id} className="bg-white border border-[#EDE7DA] rounded-2xl overflow-hidden">
                {/* Row Header */}
                <button
                  onClick={() => toggleExpand(reg.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#FAF5EE] transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#F5F0E8] border border-[#DDD5C8] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#C4622D]">
                      {reg.first_name?.[0]?.toUpperCase()}{reg.surname?.[0]?.toUpperCase()}
                    </span>
                  </div>

                  {/* Name + Email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1A1612] truncate">
                      {reg.title ? `${reg.title} ` : ''}{reg.first_name} {reg.surname}
                    </p>
                    <p className="text-xs text-[#8C8278] truncate">{reg.email} · {reg.cellphone}</p>
                  </div>

                  {/* Sessions badge */}
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    {isPast && (
                      <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">Past</span>
                    )}
                    {isUpcoming && (
                      <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">Upcoming</span>
                    )}
                    <span className="text-xs bg-[#F5F0E8] text-[#5C5347] border border-[#DDD5C8] px-2 py-0.5 rounded-full">
                      {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs bg-[#F5F0E8] text-[#5C5347] border border-[#DDD5C8] px-2 py-0.5 rounded-full">
                      {participantCount} participant{participantCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Amount + Payment Status */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-[#1A1612]">{formatCurrency(reg.amount)}</p>
                      <p className="text-xs text-[#8C8278]">{formatDate(reg.created_at)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {reg.payment_status.replace(/_/g, ' ')}
                    </span>
                    <svg
                      className={`w-4 h-4 text-[#8C8278] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

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
                          <Field label="Attend School Holiday" value={reg.attend_school_holiday} />
                          <Field label="RSA ID / Passport" value={reg.rsa_id_passport} />
                          <Field label="Allergies / Illness" value={reg.allergies_illness} />
                          <Field label="Pictures Consent" value={reg.pictures_taken} />
                          <Field label="Indemnity Consent" value={reg.indemnity_consent ? 'Yes' : 'No'} />
                          <Field label="Payment Method" value={reg.payment_method} />
                          <Field label="Amount Paid" value={formatCurrency(reg.amount)} highlight />
                          <Field label="Payment Status" value={reg.payment_status?.replace(/_/g, ' ')} />
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
                            <div className="col-span-2 sm:col-span-3">
                              <a
                                href={reg.proof_of_payment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-xs text-[#C4622D] font-medium hover:underline"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                View Proof of Payment
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── PARTICIPANTS SECTION ── */}
                      {section === 'participants' && (
                        <div className="space-y-4">
                          {/* Registrant as participant */}
                          <div className="border border-[#EDE7DA] rounded-xl overflow-hidden">
                            <div className="bg-[#F5F0E8] px-4 py-2.5 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-[#C4622D] text-white text-xs font-bold flex items-center justify-center">1</span>
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
                          {children.length > 0 ? children.map((child, idx) => {
                            const childName = child.full_name || child.name || `Child ${idx + 1}`;
                            const childAge = child.age ? String(child.age) : calcAge(child.dob);
                            return (
                              <div key={idx} className="border border-[#EDE7DA] rounded-xl overflow-hidden">
                                <div className="bg-[#F5F0E8] px-4 py-2.5 flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-[#C4622D] text-white text-xs font-bold flex items-center justify-center">{idx + 2}</span>
                                  <span className="text-sm font-semibold text-[#1A1612]">{childName}</span>
                                  {childAge !== '—' && (
                                    <span className="text-xs bg-white border border-[#DDD5C8] text-[#5C5347] px-2 py-0.5 rounded-full">Age {childAge}</span>
                                  )}
                                  <span className="ml-auto text-xs text-[#8C8278]">Child Participant</span>
                                </div>
                                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  <Field label="Full Name" value={childName} />
                                  <Field label="Date of Birth" value={child.dob ? formatDate(child.dob) : undefined} />
                                  <Field label="Age" value={childAge} />
                                  {child.gender && <Field label="Gender" value={child.gender} />}
                                  {child.school && <Field label="School" value={child.school} />}
                                  {child.grade && <Field label="Grade" value={child.grade} />}
                                  {child.allergies && <Field label="Allergies" value={child.allergies} />}
                                  {/* Render any other fields */}
                                  {Object.entries(child)
                                    .filter(([k]) => !['full_name', 'name', 'dob', 'age', 'gender', 'school', 'grade', 'allergies'].includes(k))
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
                            <div className="bg-[#F5F0E8] rounded-xl p-4 flex flex-wrap gap-4">
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
                          {children.map((child, idx) => {
                            const childName = child.full_name || child.name || `Child ${idx + 1}`;
                            if (!child.allergies) return null;
                            return (
                              <Field key={idx} label={`${childName} – Allergies`} value={child.allergies} />
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
