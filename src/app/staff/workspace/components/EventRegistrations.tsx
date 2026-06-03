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
  children: ChildParticipant[] | null;
  attend_school_holiday: string | null;
  medical_doctor_first_name: string | null;
  medical_doctor_surname: string | null;
  medical_aid_name: string | null;
  medical_aid_number: string | null;
  pictures_taken: string | null;
  indemnity_consent: boolean | null;
  notes: string | null;
  // enriched
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

type FilterTab = 'event' | 'registrant' | 'venue';

export default function EventRegistrations() {
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter tab
  const [filterTab, setFilterTab] = useState<FilterTab>('event');

  // Filter values
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [registrantSearch, setRegistrantSearch] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<string>('all');

  // Derived filter options
  const [eventOptions, setEventOptions] = useState<string[]>([]);
  const [venueOptions, setVenueOptions] = useState<string[]>([]);

  // Expanded row for participant details
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: regs, error: regsErr } = await supabase
        .from('cooking_class_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (regsErr) throw regsErr;
      if (!regs || regs.length === 0) { setRegistrations([]); return; }

      const regIds = regs.map((r: RegistrationRow) => r.id);
      const { data: bookings } = await supabase
        .from('cooking_class_booking_counts')
        .select('registration_id, event_date_id')
        .in('registration_id', regIds);

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

      const regSessionMap: Record<string, SessionDate[]> = {};
      (bookings || []).forEach((b: { registration_id: string; event_date_id: string }) => {
        if (!regSessionMap[b.registration_id]) regSessionMap[b.registration_id] = [];
        if (eventDatesMap[b.event_date_id]) {
          regSessionMap[b.registration_id].push(eventDatesMap[b.event_date_id]);
        }
      });

      const enriched: RegistrationRow[] = regs.map((r: RegistrationRow) => ({
        ...r,
        session_dates: regSessionMap[r.id] || [],
      }));

      setRegistrations(enriched);

      // Build filter options
      const allEvents = new Set<string>();
      const allVenues = new Set<string>();
      enriched.forEach(r => {
        (r.session_dates || []).forEach(sd => {
          if (sd.event_name) allEvents.add(sd.event_name);
          if (sd.location) allVenues.add(sd.location);
        });
      });
      setEventOptions([...allEvents].sort());
      setVenueOptions([...allVenues].sort());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // Apply filters
  const filtered = registrations.filter(r => {
    if (filterTab === 'event' && selectedEvent !== 'all') {
      const hasEvent = (r.session_dates || []).some(sd => sd.event_name === selectedEvent);
      if (!hasEvent) return false;
    }
    if (filterTab === 'registrant' && registrantSearch.trim()) {
      const fullName = `${r.first_name} ${r.surname}`.toLowerCase();
      const q = registrantSearch.toLowerCase();
      if (!fullName.includes(q) && !r.email.toLowerCase().includes(q) && !r.cellphone.includes(q)) return false;
    }
    if (filterTab === 'venue' && selectedVenue !== 'all') {
      const hasVenue = (r.session_dates || []).some(sd => sd.location === selectedVenue);
      if (!hasVenue) return false;
    }
    return true;
  });

  const totalPaid = filtered.filter(r => r.payment_status === 'paid').length;
  const totalAmount = filtered.reduce((sum, r) => sum + (r.payment_status === 'paid' ? (r.amount || 0) : 0), 0);

  const filterTabConfig: { key: FilterTab; label: string; icon: string }[] = [
    { key: 'event', label: 'By Event', icon: '🎓' },
    { key: 'registrant', label: 'By Registrant', icon: '👤' },
    { key: 'venue', label: 'By Venue Location', icon: '📍' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#2C2420]">Event Registrations</h2>
          <p className="text-sm text-[#8C7B6B] mt-0.5">Cooking &amp; Baking Class registrations with participant details</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-[#E8DDD0] rounded-lg text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
        >
          <span>↻</span> Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E8DDD0] rounded-xl p-4">
          <p className="text-xs text-[#8C7B6B] uppercase tracking-wide font-medium">Total Registrations</p>
          <p className="text-2xl font-bold text-[#2C2420] mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white border border-[#E8DDD0] rounded-xl p-4">
          <p className="text-xs text-[#8C7B6B] uppercase tracking-wide font-medium">Paid</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalPaid}</p>
        </div>
        <div className="bg-white border border-[#E8DDD0] rounded-xl p-4">
          <p className="text-xs text-[#8C7B6B] uppercase tracking-wide font-medium">Revenue Collected</p>
          <p className="text-2xl font-bold text-[#C4622D] mt-1">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border border-[#E8DDD0] rounded-xl overflow-hidden">
        <div className="flex border-b border-[#E8DDD0]">
          {filterTabConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                filterTab === tab.key
                  ? 'border-[#C4622D] text-[#C4622D] bg-[#FDF6EE]'
                  : 'border-transparent text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter controls */}
        <div className="px-5 py-3 bg-[#FAF5EE] border-b border-[#E8DDD0]">
          {filterTab === 'event' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-[#5C5347] whitespace-nowrap">Filter by Event:</label>
              <select
                value={selectedEvent}
                onChange={e => setSelectedEvent(e.target.value)}
                className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-[#E8DDD0] rounded-lg bg-white text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
              >
                <option value="all">All Events</option>
                {eventOptions.map(ev => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
              {selectedEvent !== 'all' && (
                <button onClick={() => setSelectedEvent('all')} className="text-xs text-[#C4622D] hover:underline">Clear</button>
              )}
            </div>
          )}
          {filterTab === 'registrant' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-[#5C5347] whitespace-nowrap">Search Registrant:</label>
              <input
                type="text"
                value={registrantSearch}
                onChange={e => setRegistrantSearch(e.target.value)}
                placeholder="Name, email or phone..."
                className="flex-1 max-w-sm px-3 py-1.5 text-sm border border-[#E8DDD0] rounded-lg bg-white text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
              />
              {registrantSearch && (
                <button onClick={() => setRegistrantSearch('')} className="text-xs text-[#C4622D] hover:underline">Clear</button>
              )}
            </div>
          )}
          {filterTab === 'venue' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-[#5C5347] whitespace-nowrap">Filter by Venue:</label>
              <select
                value={selectedVenue}
                onChange={e => setSelectedVenue(e.target.value)}
                className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-[#E8DDD0] rounded-lg bg-white text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
              >
                <option value="all">All Venues</option>
                {venueOptions.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {selectedVenue !== 'all' && (
                <button onClick={() => setSelectedVenue('all')} className="text-xs text-[#C4622D] hover:underline">Clear</button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-[#5C5347] font-medium">No registrations found</p>
            <p className="text-sm text-[#8C7B6B] mt-1">Try adjusting your filter criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5EFE8] text-[#5C5347] text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold">Registrant</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">Event(s)</th>
                  <th className="px-4 py-3 text-left font-semibold">Venue</th>
                  <th className="px-4 py-3 text-left font-semibold">Date(s)</th>
                  <th className="px-4 py-3 text-left font-semibold">Payment</th>
                  <th className="px-4 py-3 text-left font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Registered</th>
                  <th className="px-4 py-3 text-center font-semibold">Participants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E8DE]">
                {filtered.map(reg => {
                  const isExpanded = expandedId === reg.id;
                  const sessions = reg.session_dates || [];
                  const uniqueEvents = [...new Set(sessions.map(s => s.event_name).filter(Boolean))];
                  const uniqueVenues = [...new Set(sessions.map(s => s.location).filter(Boolean))];
                  const childCount = (reg.children || []).length;
                  const participantCount = 1 + childCount; // registrant + children

                  return (
                    <>
                      <tr
                        key={reg.id}
                        className={`hover:bg-[#FAF5EE] transition-colors cursor-pointer ${isExpanded ? 'bg-[#FDF6EE]' : 'bg-white'}`}
                        onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                      >
                        {/* Registrant Name */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#2C2420]">
                            {reg.title} {reg.first_name} {reg.surname}
                          </div>
                          <div className="text-xs text-[#8C7B6B] mt-0.5">{reg.relationship || '—'}</div>
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-3">
                          <div className="text-[#2C2420]">{reg.email}</div>
                          <div className="text-xs text-[#8C7B6B] mt-0.5">{reg.cellphone}</div>
                        </td>
                        {/* Events */}
                        <td className="px-4 py-3">
                          {uniqueEvents.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {uniqueEvents.map((ev, i) => (
                                <span key={i} className="inline-block px-2 py-0.5 bg-[#F5EFE8] text-[#C4622D] text-xs rounded-full border border-[#E8DDD0]">
                                  {ev}
                                </span>
                              ))}
                            </div>
                          ) : <span className="text-[#8C7B6B]">—</span>}
                        </td>
                        {/* Venue */}
                        <td className="px-4 py-3">
                          {uniqueVenues.length > 0 ? (
                            <div className="space-y-0.5">
                              {uniqueVenues.map((v, i) => (
                                <div key={i} className="text-xs text-[#5C5347] truncate max-w-[160px]" title={v ?? undefined}>{v}</div>
                              ))}
                            </div>
                          ) : <span className="text-[#8C7B6B]">—</span>}
                        </td>
                        {/* Dates */}
                        <td className="px-4 py-3">
                          {sessions.length > 0 ? (
                            <div className="space-y-0.5">
                              {sessions.slice(0, 2).map((s, i) => (
                                <div key={i} className="text-xs text-[#5C5347]">{formatDate(s.event_date)}</div>
                              ))}
                              {sessions.length > 2 && (
                                <div className="text-xs text-[#8C7B6B]">+{sessions.length - 2} more</div>
                              )}
                            </div>
                          ) : <span className="text-[#8C7B6B]">—</span>}
                        </td>
                        {/* Payment Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {reg.payment_status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        {/* Amount */}
                        <td className="px-4 py-3 font-medium text-[#2C2420]">
                          {formatCurrency(reg.amount)}
                        </td>
                        {/* Registered date */}
                        <td className="px-4 py-3 text-xs text-[#5C5347]">
                          {formatDate(reg.created_at)}
                        </td>
                        {/* Participants toggle */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : reg.id); }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                              isExpanded
                                ? 'bg-[#C4622D] text-white border-[#C4622D]'
                                : 'bg-white text-[#C4622D] border-[#C4622D] hover:bg-[#FDF6EE]'
                            }`}
                          >
                            <span>{participantCount}</span>
                            <span>{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Expanded participant details */}
                      {isExpanded && (
                        <tr key={`${reg.id}-expanded`} className="bg-[#FDF6EE]">
                          <td colSpan={9} className="px-6 py-5">
                            <div className="space-y-5">
                              {/* Registrant (Adult) participant row */}
                              <div>
                                <h4 className="text-xs font-semibold text-[#8C7B6B] uppercase tracking-wide mb-2 flex items-center gap-2">
                                  <span className="w-5 h-5 bg-[#C4622D] text-white rounded-full flex items-center justify-center text-xs">R</span>
                                  Registrant (Adult Participant)
                                </h4>
                                <div className="overflow-x-auto rounded-lg border border-[#E8DDD0]">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-[#F5EFE8] text-[#5C5347]">
                                        <th className="px-3 py-2 text-left font-semibold">Full Name</th>
                                        <th className="px-3 py-2 text-left font-semibold">ID / Passport</th>
                                        <th className="px-3 py-2 text-left font-semibold">Allergies / Illness</th>
                                        <th className="px-3 py-2 text-left font-semibold">First Time</th>
                                        <th className="px-3 py-2 text-left font-semibold">Photos Consent</th>
                                        <th className="px-3 py-2 text-left font-semibold">Indemnity</th>
                                        <th className="px-3 py-2 text-left font-semibold">Emergency Contact 1</th>
                                        <th className="px-3 py-2 text-left font-semibold">Emergency Contact 2</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="bg-white">
                                        <td className="px-3 py-2 font-medium text-[#2C2420]">{reg.title} {reg.first_name} {reg.surname}</td>
                                        <td className="px-3 py-2 text-[#5C5347]">{reg.rsa_id_passport || '—'}</td>
                                        <td className="px-3 py-2 text-[#5C5347]">{reg.allergies_illness || '—'}</td>
                                        <td className="px-3 py-2 text-[#5C5347]">{reg.first_time_portal || '—'}</td>
                                        <td className="px-3 py-2 text-[#5C5347]">{reg.pictures_taken || '—'}</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${reg.indemnity_consent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                            {reg.indemnity_consent ? 'Signed' : 'Pending'}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-[#5C5347]">
                                          {reg.emergency_contact1?.name ? (
                                            <div>
                                              <div className="font-medium">{reg.emergency_contact1.name}</div>
                                              <div className="text-[#8C7B6B]">{reg.emergency_contact1.relationship} · {reg.emergency_contact1.phone || reg.emergency_contact1.cellphone}</div>
                                            </div>
                                          ) : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-[#5C5347]">
                                          {reg.emergency_contact2?.name ? (
                                            <div>
                                              <div className="font-medium">{reg.emergency_contact2.name}</div>
                                              <div className="text-[#8C7B6B]">{reg.emergency_contact2.relationship} · {reg.emergency_contact2.phone || reg.emergency_contact2.cellphone}</div>
                                            </div>
                                          ) : '—'}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Medical info */}
                              {(reg.medical_doctor_first_name || reg.medical_aid_name) && (
                                <div>
                                  <h4 className="text-xs font-semibold text-[#8C7B6B] uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">M</span>
                                    Medical Information
                                  </h4>
                                  <div className="overflow-x-auto rounded-lg border border-[#E8DDD0]">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-[#F5EFE8] text-[#5C5347]">
                                          <th className="px-3 py-2 text-left font-semibold">Doctor</th>
                                          <th className="px-3 py-2 text-left font-semibold">Medical Aid</th>
                                          <th className="px-3 py-2 text-left font-semibold">Medical Aid No.</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr className="bg-white">
                                          <td className="px-3 py-2 text-[#5C5347]">
                                            {[reg.medical_doctor_first_name, reg.medical_doctor_surname].filter(Boolean).join(' ') || '—'}
                                          </td>
                                          <td className="px-3 py-2 text-[#5C5347]">{reg.medical_aid_name || '—'}</td>
                                          <td className="px-3 py-2 text-[#5C5347]">{reg.medical_aid_number || '—'}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Children / additional participants */}
                              {childCount > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-[#8C7B6B] uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">C</span>
                                    Child Participants ({childCount})
                                  </h4>
                                  <div className="overflow-x-auto rounded-lg border border-[#E8DDD0]">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-[#F5EFE8] text-[#5C5347]">
                                          <th className="px-3 py-2 text-left font-semibold">#</th>
                                          <th className="px-3 py-2 text-left font-semibold">Full Name</th>
                                          <th className="px-3 py-2 text-left font-semibold">Date of Birth</th>
                                          <th className="px-3 py-2 text-left font-semibold">Age</th>
                                          <th className="px-3 py-2 text-left font-semibold">Gender</th>
                                          <th className="px-3 py-2 text-left font-semibold">School</th>
                                          <th className="px-3 py-2 text-left font-semibold">Grade</th>
                                          <th className="px-3 py-2 text-left font-semibold">Allergies</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#F0E8DE]">
                                        {(reg.children || []).map((child, idx) => (
                                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF5EE]'}>
                                            <td className="px-3 py-2 text-[#8C7B6B] font-medium">{idx + 1}</td>
                                            <td className="px-3 py-2 font-medium text-[#2C2420]">{child.full_name || child.name || '—'}</td>
                                            <td className="px-3 py-2 text-[#5C5347]">{formatDate(child.dob)}</td>
                                            <td className="px-3 py-2 text-[#5C5347]">
                                              {child.age != null ? String(child.age) : calcAge(child.dob)}
                                            </td>
                                            <td className="px-3 py-2 text-[#5C5347] capitalize">{child.gender || '—'}</td>
                                            <td className="px-3 py-2 text-[#5C5347]">{child.school || '—'}</td>
                                            <td className="px-3 py-2 text-[#5C5347]">{child.grade || '—'}</td>
                                            <td className="px-3 py-2 text-[#5C5347]">{child.allergies || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Session dates */}
                              {sessions.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-[#8C7B6B] uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs">S</span>
                                    Booked Sessions ({sessions.length})
                                  </h4>
                                  <div className="overflow-x-auto rounded-lg border border-[#E8DDD0]">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-[#F5EFE8] text-[#5C5347]">
                                          <th className="px-3 py-2 text-left font-semibold">Event</th>
                                          <th className="px-3 py-2 text-left font-semibold">Date</th>
                                          <th className="px-3 py-2 text-left font-semibold">Time</th>
                                          <th className="px-3 py-2 text-left font-semibold">Venue</th>
                                          <th className="px-3 py-2 text-left font-semibold">Fee</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#F0E8DE]">
                                        {sessions.map((s, idx) => (
                                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF5EE]'}>
                                            <td className="px-3 py-2 font-medium text-[#2C2420]">{s.event_name || '—'}</td>
                                            <td className="px-3 py-2 text-[#5C5347]">{formatDate(s.event_date)}</td>
                                            <td className="px-3 py-2 text-[#5C5347]">
                                              {s.start_time && s.end_time ? `${s.start_time} – ${s.end_time}` : s.start_time || '—'}
                                            </td>
                                            <td className="px-3 py-2 text-[#5C5347]">{s.location || '—'}</td>
                                            <td className="px-3 py-2 text-[#5C5347]">{formatCurrency(s.class_fee)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Notes */}
                              {reg.notes && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                                  <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                                  <p className="text-xs text-amber-800">{reg.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {!loading && !error && filtered.length > 0 && (
          <div className="px-5 py-3 bg-[#FAF5EE] border-t border-[#E8DDD0] text-xs text-[#8C7B6B]">
            Showing {filtered.length} of {registrations.length} registration{registrations.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
