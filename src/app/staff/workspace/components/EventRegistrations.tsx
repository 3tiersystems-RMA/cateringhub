'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ChildParticipant {
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
  first_time_portal?: string | null;
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

// Registrant Bookings view: grouped by event → date → timeslot → registrants
interface SessionsBookedGroup {
  eventName: string;
  dates: {
    date: string;
    timeslots: {
      timeslot: string;
      dateId: string;
      registrants: { name: string; email: string; paymentStatus: string }[];
    }[];
  }[];
}

// Participant Bookings view: flat list of participants per session
interface ParticipantBookingRow {
  eventName: string;
  eventDate: string | null;
  timeslot: string;
  fullName: string;
  dob: string | null;
  age: string;
  gender: string;
  allergies: string;
  location: string;
}

type ParticipantSortKey = 'dob' | 'age' | 'gender' | 'allergies' | 'datetime';
type SortDir = 'asc' | 'desc';

type FilterTab = 'event' | 'registrant' | 'venue' | 'sessions_booked' | 'participant_bookings' | 'participants_by_location';

const PAGE_SIZE = 10;

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

function filterFilledChildren(children: ChildParticipant[] | null): ChildParticipant[] {
  if (!Array.isArray(children)) return [];
  return children.filter(c => {
    const name = (c.fullName || c.full_name || c.name || '').trim();
    return name.length > 0;
  });
}

// Elegant paginator component
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

function SortIcon({ col, sortKey, sortDir }: { col: ParticipantSortKey; sortKey: ParticipantSortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <span className="ml-1 text-[#C4B8A8]">⇅</span>;
  return <span className="ml-1 text-[#C4622D]">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

interface EventRegistrationsProps {
  isSuperAdmin?: boolean;
}

export default function EventRegistrations({ isSuperAdmin = false }: EventRegistrationsProps) {
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Participant Bookings sort state
  const [participantSortKey, setParticipantSortKey] = useState<ParticipantSortKey | null>(null);
  const [participantSortDir, setParticipantSortDir] = useState<SortDir>('asc');
  const [participantEventFilter, setParticipantEventFilter] = useState<string>('all');

  // Participants by Location sort/filter state
  const [locationParticipantSortKey, setLocationParticipantSortKey] = useState<ParticipantSortKey | null>(null);
  const [locationParticipantSortDir, setLocationParticipantSortDir] = useState<SortDir>('asc');
  const [locationParticipantFilter, setLocationParticipantFilter] = useState<string>('all');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<RegistrationRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch all event management registrations
      const { data: regs, error: regsErr } = await supabase
        .from('event_management_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (regsErr) throw regsErr;
      if (!regs || regs.length === 0) { setRegistrations([]); return; }

      // 2. Fetch booking counts (links registrations → event_dates)
      const regIds = regs.map((r: RegistrationRow) => r.id);
      const { data: bookings } = await supabase
        .from('event_management_booking_counts')
        .select('registration_id, event_date_id')
        .in('registration_id', regIds);

      // 3. Fetch event dates with event names
      const eventDateIds = [...new Set((bookings || []).map((b: { event_date_id: string }) => b.event_date_id))];
      let eventDatesMap: Record<string, SessionDate> = {};

      if (eventDateIds.length > 0) {
        const { data: dates } = await supabase
          .from('event_management_event_dates')
          .select('id, event_date, start_time, end_time, location, event_fee, event_id')
          .in('id', eventDateIds);

        if (dates && dates.length > 0) {
          const eventIds = [...new Set(dates.map((d: { event_id: string }) => d.event_id).filter(Boolean))];
          let eventsMap: Record<string, string> = {};
          if (eventIds.length > 0) {
            const { data: events } = await supabase
              .from('event_management_events')
              .select('id, name')
              .in('id', eventIds);
            (events || []).forEach((e: { id: string; name: string }) => { eventsMap[e.id] = e.name; });
          }
          dates.forEach((d: { id: string; event_date: string | null; start_time: string | null; end_time: string | null; location: string | null; event_fee: number | null; event_id: string }) => {
            eventDatesMap[d.id] = {
              id: d.id,
              event_date: d.event_date,
              start_time: d.start_time,
              end_time: d.end_time,
              location: d.location,
              class_fee: d.event_fee,
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
      const enriched: RegistrationRow[] = regs.map((r: RegistrationRow) => ({
        ...r,
        session_dates: regSessionMap[r.id] || [],
      }));

      setRegistrations(enriched);

      // 6. Build filter options
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

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [filterTab, selectedEvent, registrantSearch, selectedVenue]);

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const openDeleteModal = (reg: RegistrationRow, e: React.MouseEvent) => {
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
      const { error: bookingErr } = await supabase
        .from('event_management_booking_counts')
        .delete()
        .eq('registration_id', deleteTarget.id);
      if (bookingErr) throw bookingErr;

      const { error: regErr } = await supabase
        .from('event_management_registrations')
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

  const totalParticipants = filtered.reduce((sum, r) => sum + filterFilledChildren(r.children).length, 0);
  const totalPaid = filtered.filter(r => r.payment_status === 'paid').length;
  const totalAmount = filtered.reduce((sum, r) => sum + (r.payment_status === 'paid' ? (r.amount || 0) : 0), 0);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Build Registrant Bookings grouped data
  const sessionsBookedGroups: SessionsBookedGroup[] = (() => {
    const eventMap: Record<string, Record<string, Record<string, { dateId: string; registrants: { name: string; email: string; paymentStatus: string }[] }>>> = {};
    registrations.forEach(r => {
      const name = `${r.title ? r.title + ' ' : ''}${r.first_name} ${r.surname}`.trim();
      (r.session_dates || []).forEach(sd => {
        const evName = sd.event_name || 'Unknown Event';
        const dateKey = formatDate(sd.event_date);
        const timeslot = sd.start_time && sd.end_time
          ? `${sd.start_time} – ${sd.end_time}`
          : sd.start_time || 'Time TBC';
        if (!eventMap[evName]) eventMap[evName] = {};
        if (!eventMap[evName][dateKey]) eventMap[evName][dateKey] = {};
        if (!eventMap[evName][dateKey][timeslot]) {
          eventMap[evName][dateKey][timeslot] = { dateId: sd.id, registrants: [] };
        }
        eventMap[evName][dateKey][timeslot].registrants.push({
          name,
          email: r.email,
          paymentStatus: r.payment_status,
        });
      });
    });
    return Object.entries(eventMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([eventName, dates]) => ({
        eventName,
        dates: Object.entries(dates)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, timeslots]) => ({
            date,
            timeslots: Object.entries(timeslots)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([timeslot, data]) => ({
                timeslot,
                dateId: data.dateId,
                registrants: data.registrants,
              })),
          })),
      }));
  })();

  // Build Participant Bookings flat list
  const participantBookingRows: ParticipantBookingRow[] = (() => {
    const rows: ParticipantBookingRow[] = [];
    registrations.forEach(r => {
      const children = filterFilledChildren(r.children);
      if (children.length === 0) return;
      (r.session_dates || []).forEach(sd => {
        const evName = sd.event_name || 'Unknown Event';
        const timeslot = sd.start_time && sd.end_time
          ? `${sd.start_time} – ${sd.end_time}`
          : sd.start_time || 'Time TBC';
        children.forEach(child => {
          const ageStr = child.age != null ? String(child.age) : calcAge(child.dob);
          rows.push({
            eventName: evName,
            eventDate: sd.event_date,
            timeslot,
            fullName: (child.fullName || child.full_name || child.name || '').trim(),
            dob: child.dob || null,
            age: ageStr,
            gender: (child.gender || '').trim(),
            allergies: (child.dietaryRestrictions || child.allergies || '').trim(),
            location: (sd.location || '').trim(),
          });
        });
      });
    });
    return rows;
  })();

  const handleParticipantSort = (key: ParticipantSortKey) => {
    if (participantSortKey === key) {
      setParticipantSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setParticipantSortKey(key);
      setParticipantSortDir('asc');
    }
  };

  const filteredParticipantRows = participantEventFilter === 'all'
    ? participantBookingRows
    : participantBookingRows.filter(r => r.eventName === participantEventFilter);

  const sortedParticipantRows = [...filteredParticipantRows].sort((a, b) => {
    if (!participantSortKey) return 0;
    let aVal = '', bVal = '';
    if (participantSortKey === 'datetime') {
      const dateCmp = (a.eventDate || '').localeCompare(b.eventDate || '');
      if (dateCmp !== 0) return participantSortDir === 'asc' ? dateCmp : -dateCmp;
      aVal = a.timeslot; bVal = b.timeslot;
      const cmp = aVal.localeCompare(bVal);
      return participantSortDir === 'asc' ? cmp : -cmp;
    } else if (participantSortKey === 'dob') {
      aVal = a.dob || ''; bVal = b.dob || '';
    } else if (participantSortKey === 'age') {
      const aNum = parseInt(a.age, 10), bNum = parseInt(b.age, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return participantSortDir === 'asc' ? aNum - bNum : bNum - aNum;
      aVal = a.age; bVal = b.age;
    } else if (participantSortKey === 'gender') {
      aVal = a.gender.toLowerCase(); bVal = b.gender.toLowerCase();
    } else if (participantSortKey === 'allergies') {
      aVal = a.allergies.toLowerCase(); bVal = b.allergies.toLowerCase();
    }
    const cmp = aVal.localeCompare(bVal);
    return participantSortDir === 'asc' ? cmp : -cmp;
  });

  const handleLocationParticipantSort = (key: ParticipantSortKey) => {
    if (locationParticipantSortKey === key) {
      setLocationParticipantSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setLocationParticipantSortKey(key);
      setLocationParticipantSortDir('asc');
    }
  };

  const filteredLocationParticipantRows = locationParticipantFilter === 'all'
    ? participantBookingRows
    : participantBookingRows.filter(r => r.location === locationParticipantFilter);

  const sortedLocationParticipantRows = [...filteredLocationParticipantRows].sort((a, b) => {
    if (!locationParticipantSortKey) return 0;
    let aVal = '', bVal = '';
    if (locationParticipantSortKey === 'datetime') {
      const dateCmp = (a.eventDate || '').localeCompare(b.eventDate || '');
      if (dateCmp !== 0) return locationParticipantSortDir === 'asc' ? dateCmp : -dateCmp;
      aVal = a.timeslot; bVal = b.timeslot;
      const cmp = aVal.localeCompare(bVal);
      return locationParticipantSortDir === 'asc' ? cmp : -cmp;
    } else if (locationParticipantSortKey === 'dob') {
      aVal = a.dob || ''; bVal = b.dob || '';
    } else if (locationParticipantSortKey === 'age') {
      const aNum = parseInt(a.age, 10), bNum = parseInt(b.age, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return locationParticipantSortDir === 'asc' ? aNum - bNum : bNum - aNum;
      aVal = a.age; bVal = b.age;
    } else if (locationParticipantSortKey === 'gender') {
      aVal = a.gender.toLowerCase(); bVal = b.gender.toLowerCase();
    } else if (locationParticipantSortKey === 'allergies') {
      aVal = a.allergies.toLowerCase(); bVal = b.allergies.toLowerCase();
    }
    const cmp = aVal.localeCompare(bVal);
    return locationParticipantSortDir === 'asc' ? cmp : -cmp;
  });

  // PDF helpers
  const handleCreateParticipantPDF = () => {
    const rows = sortedParticipantRows;
    const eventLabel = participantEventFilter !== 'all' ? participantEventFilter : 'All Events';
    const generatedAt = new Date().toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const tableRows = rows.map((row, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#faf5ee'}">
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;color:#8c7b6b;font-size:12px">${idx + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#c4622d;font-weight:500">${row.eventName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#2c2420">
          <div style="font-weight:500">${row.eventDate ? new Date(row.eventDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
          <div style="color:#8c7b6b;font-size:11px">${row.timeslot}</div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;font-weight:500;color:#2c2420">${row.fullName || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347">${row.dob ? new Date(row.dob).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347;text-align:center">${row.age !== '—' ? row.age : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347;text-transform:capitalize">${row.gender || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347">${row.allergies || 'None'}</td>
      </tr>
    `).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Participant Bookings — ${eventLabel}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2c2420;background:#fff;padding:24px}.header{border-bottom:2px solid #c4622d;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.header-left h1{font-size:20px;font-weight:700;color:#1a1612}.header-left p{font-size:12px;color:#8c7b6b;margin-top:4px}.meta{display:flex;gap:24px;margin-bottom:16px}.meta-item{background:#faf5ee;border:1px solid #e8ddd0;border-radius:8px;padding:8px 14px}.meta-item .label{font-size:10px;color:#8c7b6b;text-transform:uppercase;letter-spacing:.05em;font-weight:600}.meta-item .value{font-size:14px;font-weight:700;color:#c4622d;margin-top:2px}table{width:100%;border-collapse:collapse}thead tr{background:#f5efe8}thead th{padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#5c5347;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e8ddd0}.footer{margin-top:20px;padding-top:12px;border-top:1px solid #e8ddd0;font-size:10px;color:#8c7b6b;text-align:center}@media print{body{padding:16px}@page{margin:1cm;size:A4 landscape}}</style>
    </head><body>
    <div class="header"><div class="header-left"><h1>Participant Bookings</h1><p>Event: ${eventLabel}</p></div><div style="text-align:right;font-size:11px;color:#8c7b6b">Generated: ${generatedAt}</div></div>
    <div class="meta"><div class="meta-item"><div class="label">Total Participants</div><div class="value">${rows.length}</div></div><div class="meta-item"><div class="label">Event Filter</div><div class="value" style="font-size:12px;color:#5c5347">${eventLabel}</div></div></div>
    <table><thead><tr><th>#</th><th>Event</th><th>Date &amp; Time</th><th>Full Name</th><th>Date of Birth</th><th>Age</th><th>Gender</th><th>Allergies</th></tr></thead><tbody>${tableRows}</tbody></table>
    <div class="footer">Cardamom Kitchen — Event Bookings · Participant Bookings Report</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=1100,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleCreateLocationParticipantPDF = () => {
    const rows = sortedLocationParticipantRows;
    const locationLabel = locationParticipantFilter !== 'all' ? locationParticipantFilter : 'All Locations';
    const generatedAt = new Date().toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const tableRows = rows.map((row, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#faf5ee'}">
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;color:#8c7b6b;font-size:12px">${idx + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px">
          <div style="color:#c4622d;font-weight:500">${row.eventName}</div>
          <div style="color:#8c7b6b;font-size:11px;margin-top:2px">📍 ${row.location || '—'}</div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#2c2420">
          <div style="font-weight:500">${row.eventDate ? new Date(row.eventDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
          <div style="color:#8c7b6b;font-size:11px">${row.timeslot}</div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;font-weight:500;color:#2c2420">${row.fullName || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347">${row.dob ? new Date(row.dob).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347;text-align:center">${row.age !== '—' ? row.age : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347;text-transform:capitalize">${row.gender || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347">${row.allergies || 'None'}</td>
      </tr>
    `).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Participants by Location — ${locationLabel}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2c2420;background:#fff;padding:24px}.header{border-bottom:2px solid #c4622d;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.header-left h1{font-size:20px;font-weight:700;color:#1a1612}.header-left p{font-size:12px;color:#8c7b6b;margin-top:4px}.meta{display:flex;gap:24px;margin-bottom:16px}.meta-item{background:#faf5ee;border:1px solid #e8ddd0;border-radius:8px;padding:8px 14px}.meta-item .label{font-size:10px;color:#8c7b6b;text-transform:uppercase;letter-spacing:.05em;font-weight:600}.meta-item .value{font-size:14px;font-weight:700;color:#c4622d;margin-top:2px}table{width:100%;border-collapse:collapse}thead tr{background:#f5efe8}thead th{padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#5c5347;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e8ddd0}.footer{margin-top:20px;padding-top:12px;border-top:1px solid #e8ddd0;font-size:10px;color:#8c7b6b;text-align:center}@media print{body{padding:16px}@page{margin:1cm;size:A4 landscape}}</style>
    </head><body>
    <div class="header"><div class="header-left"><h1>Participants by Location</h1><p>Location: ${locationLabel}</p></div><div style="text-align:right;font-size:11px;color:#8c7b6b">Generated: ${generatedAt}</div></div>
    <div class="meta"><div class="meta-item"><div class="label">Total Participants</div><div class="value">${rows.length}</div></div><div class="meta-item"><div class="label">Location Filter</div><div class="value" style="font-size:12px;color:#5c5347">${locationLabel}</div></div></div>
    <table><thead><tr><th>#</th><th>Event / Location</th><th>Date &amp; Time</th><th>Full Name</th><th>Date of Birth</th><th>Age</th><th>Gender</th><th>Allergies</th></tr></thead><tbody>${tableRows}</tbody></table>
    <div class="footer">Cardamom Kitchen — Event Bookings · Participants by Location Report</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=1100,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const filterTabConfig: { key: FilterTab; label: string; icon: string }[] = [
    { key: 'event', label: 'By Event', icon: '\uD83C\uDF9F' },
    { key: 'registrant', label: 'By Registrant', icon: '👤' },
    { key: 'venue', label: 'By Venue Location', icon: '📍' },
    { key: 'sessions_booked', label: 'Registrant Bookings', icon: '📅' },
    { key: 'participant_bookings', label: 'Participant Bookings', icon: '👧' },
    { key: 'participants_by_location', label: 'Participants by Location', icon: '📌' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#2C2420]">Class Registrations</h2>
          <p className="text-sm text-[#8C7B6B] mt-0.5">All event booking registrations with participant details</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-[#E8DDD0] rounded-lg text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
        >
          <span>↻</span> Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8DDD0] rounded-xl p-4">
          <p className="text-xs text-[#8C7B6B] uppercase tracking-wide font-medium">Total Registrations</p>
          <p className="text-2xl font-bold text-[#2C2420] mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white border border-[#E8DDD0] rounded-xl p-4">
          <p className="text-xs text-[#8C7B6B] uppercase tracking-wide font-medium">Participants</p>
          <p className="text-2xl font-bold text-[#C4622D] mt-1">{totalParticipants}</p>
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

      {/* Filter Tabs + Content */}
      <div className="bg-white border border-[#E8DDD0] rounded-xl overflow-hidden">
        {/* Tab buttons */}
        <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-[#E8DDD0] bg-[#FAF5EE]">
          {filterTabConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium transition-colors rounded-full border whitespace-nowrap ${
                filterTab === tab.key
                  ? 'bg-[#C4622D] text-white border-[#C4622D]'
                  : 'bg-white border-[#DDD5C8] text-[#5C5347] hover:bg-[#FDF6EE] hover:border-[#C4622D] hover:text-[#C4622D]'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── REGISTRANT BOOKINGS TAB ── */}
        {filterTab === 'sessions_booked' ? (
          error ? (
            <div className="p-6 text-center text-red-600 text-sm">{error}</div>
          ) : sessionsBookedGroups.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-[#5C5347] font-medium">No session bookings found</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0E8DE]">
              {sessionsBookedGroups.map(group => (
                <div key={group.eventName} className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C4622D] to-[#E8845A] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {group.eventName.charAt(0)}
                    </div>
                    <h3 className="text-base font-semibold text-[#2C2420]">{group.eventName}</h3>
                    <span className="ml-auto text-xs text-[#8C7B6B] bg-[#F5EFE8] border border-[#E8DDD0] px-2.5 py-1 rounded-full font-medium">
                      {group.dates.reduce((s, d) => s + d.timeslots.reduce((ts, t) => ts + t.registrants.length, 0), 0)} bookings
                    </span>
                  </div>
                  <div className="space-y-4 pl-11">
                    {group.dates.map(dateGroup => (
                      <div key={dateGroup.date}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-[#5C5347] bg-[#F5EFE8] border border-[#E8DDD0] px-3 py-1 rounded-full">
                            📆 {dateGroup.date}
                          </span>
                        </div>
                        <div className="space-y-3 pl-4">
                          {dateGroup.timeslots.map(slot => (
                            <div key={slot.timeslot} className="rounded-xl border border-[#E8DDD0] overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#FAF5EE] to-[#F5EFE8] border-b border-[#E8DDD0]">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#C4622D]">🕐</span>
                                  <span className="text-sm font-semibold text-[#2C2420]">{slot.timeslot}</span>
                                </div>
                                <span className="text-xs font-medium text-[#8C7B6B] bg-white border border-[#E8DDD0] px-2.5 py-0.5 rounded-full">
                                  {slot.registrants.length} registrant{slot.registrants.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-[#F5EFE8] text-[#5C5347]">
                                    <th className="px-4 py-2 text-left font-semibold">#</th>
                                    <th className="px-4 py-2 text-left font-semibold">Registrant Name</th>
                                    <th className="px-4 py-2 text-left font-semibold">Email</th>
                                    <th className="px-4 py-2 text-left font-semibold">Payment Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F0E8DE]">
                                  {slot.registrants.map((reg, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF5EE]'}>
                                      <td className="px-4 py-2 text-[#8C7B6B] font-medium">{idx + 1}</td>
                                      <td className="px-4 py-2 font-medium text-[#2C2420]">{reg.name}</td>
                                      <td className="px-4 py-2 text-[#5C5347]">{reg.email}</td>
                                      <td className="px-4 py-2">
                                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${PAYMENT_STATUS_COLORS[reg.paymentStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                          {reg.paymentStatus.replace(/_/g, ' ')}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )

        ) : filterTab === 'participant_bookings' ? (
          error ? (
            <div className="p-6 text-center text-red-600 text-sm">{error}</div>
          ) : (
            <>
              <div className="px-5 py-3 bg-[#FAF5EE] border-b border-[#E8DDD0] flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-[#5C5347] whitespace-nowrap">Filter by Event:</label>
                <select
                  value={participantEventFilter}
                  onChange={e => { setParticipantEventFilter(e.target.value); setParticipantSortKey(null); setParticipantSortDir('asc'); }}
                  className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-[#E8DDD0] rounded-lg bg-white text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
                >
                  <option value="all">All Events</option>
                  {eventOptions.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                </select>
                {participantEventFilter !== 'all' && (
                  <button onClick={() => { setParticipantEventFilter('all'); setParticipantSortKey(null); }} className="text-xs text-[#C4622D] hover:underline">Clear</button>
                )}
                {sortedParticipantRows.length > 0 && (
                  <button onClick={handleCreateParticipantPDF} className="ml-auto flex items-center gap-1.5 bg-[#C4622D] text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#A04E22] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v2.546l.943-1.048a.75.75 0 1 1 1.114 1.004l-2.25 2.5a.75.75 0 0 1-1.114 0l-2.25-2.5a.75.75 0 1 1 1.114-1.004l.943 1.048V8.75Z" clipRule="evenodd" />
                    </svg>
                    Create PDF
                  </button>
                )}
              </div>
              {sortedParticipantRows.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-3xl mb-2">👧</p>
                  <p className="text-[#5C5347] font-medium">No participants found for this event</p>
                  <p className="text-sm text-[#8C7B6B] mt-1">Try selecting a different event or &quot;All Events&quot;</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-2.5 bg-[#FAF5EE] border-b border-[#E8DDD0] flex items-center justify-between">
                    <p className="text-xs text-[#8C7B6B]">
                      <span className="font-semibold text-[#2C2420]">{sortedParticipantRows.length}</span> participant{sortedParticipantRows.length !== 1 ? 's' : ''}{participantEventFilter !== 'all' ? ` for "${participantEventFilter}"` : ' across all sessions'}
                    </p>
                    {participantSortKey && (
                      <button onClick={() => { setParticipantSortKey(null); setParticipantSortDir('asc'); }} className="text-xs text-[#C4622D] hover:underline">Clear sort</button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F5EFE8] text-[#5C5347] text-xs uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-semibold">#</th>
                          <th className="px-4 py-3 text-left font-semibold">Event</th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleParticipantSort('datetime')}>
                            Date &amp; Time <SortIcon col="datetime" sortKey={participantSortKey} sortDir={participantSortDir} />
                          </th>
                          <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleParticipantSort('dob')}>
                            DOB <SortIcon col="dob" sortKey={participantSortKey} sortDir={participantSortDir} />
                          </th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleParticipantSort('age')}>
                            Age <SortIcon col="age" sortKey={participantSortKey} sortDir={participantSortDir} />
                          </th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleParticipantSort('gender')}>
                            Gender <SortIcon col="gender" sortKey={participantSortKey} sortDir={participantSortDir} />
                          </th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleParticipantSort('allergies')}>
                            Allergies <SortIcon col="allergies" sortKey={participantSortKey} sortDir={participantSortDir} />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0E8DE]">
                        {sortedParticipantRows.map((row, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-[#FAF5EE]' : 'bg-[#FAF5EE] hover:bg-[#F5EFE8]'}>
                            <td className="px-4 py-3 text-xs text-[#8C7B6B] font-medium">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-[#FDF6EE] to-[#F5EFE8] text-[#C4622D] text-xs font-medium rounded-lg border border-[#E8C9B0] shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C4622D] flex-shrink-0" />
                                {row.eventName}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs text-[#2C2420] font-medium">{formatDate(row.eventDate)}</div>
                              <div className="text-xs text-[#8C7B6B] mt-0.5">{row.timeslot}</div>
                            </td>
                            <td className="px-4 py-3 font-medium text-[#2C2420]">{row.fullName || '—'}</td>
                            <td className="px-4 py-3 text-[#5C5347] text-xs">{formatDate(row.dob)}</td>
                            <td className="px-4 py-3 text-[#5C5347] text-xs">
                              {row.age !== '—' ? (
                                <span className="inline-flex items-center justify-center w-8 h-6 bg-[#F5EFE8] text-[#C4622D] text-xs font-semibold rounded-full border border-[#E8C9B0]">{row.age}</span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {row.gender ? (
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${row.gender.toLowerCase() === 'female' ? 'bg-pink-50 text-pink-700 border-pink-200' : row.gender.toLowerCase() === 'male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{row.gender}</span>
                              ) : <span className="text-[#8C7B6B]">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#5C5347]">
                              {row.allergies ? (
                                <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">{row.allergies}</span>
                              ) : <span className="text-[#8C7B6B]">None</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )

        ) : filterTab === 'participants_by_location' ? (
          error ? (
            <div className="p-6 text-center text-red-600 text-sm">{error}</div>
          ) : (
            <>
              <div className="px-5 py-3 bg-[#FAF5EE] border-b border-[#E8DDD0] flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-[#5C5347] whitespace-nowrap">Filter by Location:</label>
                <select
                  value={locationParticipantFilter}
                  onChange={e => { setLocationParticipantFilter(e.target.value); setLocationParticipantSortKey(null); setLocationParticipantSortDir('asc'); }}
                  className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-[#E8DDD0] rounded-lg bg-white text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
                >
                  <option value="all">All Locations</option>
                  {venueOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                {locationParticipantFilter !== 'all' && (
                  <button onClick={() => { setLocationParticipantFilter('all'); setLocationParticipantSortKey(null); }} className="text-xs text-[#C4622D] hover:underline">Clear</button>
                )}
                {sortedLocationParticipantRows.length > 0 && (
                  <button onClick={handleCreateLocationParticipantPDF} className="ml-auto flex items-center gap-1.5 bg-[#C4622D] text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#A04E22] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v2.546l.943-1.048a.75.75 0 1 1 1.114 1.004l-2.25 2.5a.75.75 0 0 1-1.114 0l-2.25-2.5a.75.75 0 1 1 1.114-1.004l.943 1.048V8.75Z" clipRule="evenodd" />
                    </svg>
                    Create PDF
                  </button>
                )}
              </div>
              {sortedLocationParticipantRows.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-3xl mb-2">📌</p>
                  <p className="text-[#5C5347] font-medium">No participants found for this location</p>
                  <p className="text-sm text-[#8C7B6B] mt-1">Try selecting a different location or &quot;All Locations&quot;</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-2.5 bg-[#FAF5EE] border-b border-[#E8DDD0] flex items-center justify-between">
                    <p className="text-xs text-[#8C7B6B]">
                      <span className="font-semibold text-[#2C2420]">{sortedLocationParticipantRows.length}</span> participant{sortedLocationParticipantRows.length !== 1 ? 's' : ''}{locationParticipantFilter !== 'all' ? ` at "${locationParticipantFilter}"` : ' across all locations'}
                    </p>
                    {locationParticipantSortKey && (
                      <button onClick={() => { setLocationParticipantSortKey(null); setLocationParticipantSortDir('asc'); }} className="text-xs text-[#C4622D] hover:underline">Clear sort</button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F5EFE8] text-[#5C5347] text-xs uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-semibold">#</th>
                          <th className="px-4 py-3 text-left font-semibold">Event</th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleLocationParticipantSort('datetime')}>
                            Date &amp; Time <SortIcon col="datetime" sortKey={locationParticipantSortKey} sortDir={locationParticipantSortDir} />
                          </th>
                          <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleLocationParticipantSort('dob')}>
                            DOB <SortIcon col="dob" sortKey={locationParticipantSortKey} sortDir={locationParticipantSortDir} />
                          </th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleLocationParticipantSort('age')}>
                            Age <SortIcon col="age" sortKey={locationParticipantSortKey} sortDir={locationParticipantSortDir} />
                          </th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleLocationParticipantSort('gender')}>
                            Gender <SortIcon col="gender" sortKey={locationParticipantSortKey} sortDir={locationParticipantSortDir} />
                          </th>
                          <th className="px-4 py-3 text-left font-semibold cursor-pointer select-none hover:text-[#C4622D]" onClick={() => handleLocationParticipantSort('allergies')}>
                            Allergies <SortIcon col="allergies" sortKey={locationParticipantSortKey} sortDir={locationParticipantSortDir} />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0E8DE]">
                        {sortedLocationParticipantRows.map((row, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-[#FAF5EE]' : 'bg-[#FAF5EE] hover:bg-[#F5EFE8]'}>
                            <td className="px-4 py-3 text-xs text-[#8C7B6B] font-medium">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-[#FDF6EE] to-[#F5EFE8] text-[#C4622D] text-xs font-medium rounded-lg border border-[#E8C9B0] shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C4622D] flex-shrink-0" />
                                {row.eventName}
                              </span>
                              {row.location && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-[#8C7B6B]">
                                  <span>📍</span><span>{row.location}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs text-[#2C2420] font-medium">{formatDate(row.eventDate)}</div>
                              <div className="text-xs text-[#8C7B6B] mt-0.5">{row.timeslot}</div>
                            </td>
                            <td className="px-4 py-3 font-medium text-[#2C2420]">{row.fullName || '—'}</td>
                            <td className="px-4 py-3 text-[#5C5347] text-xs">{formatDate(row.dob)}</td>
                            <td className="px-4 py-3 text-[#5C5347] text-xs">
                              {row.age !== '—' ? (
                                <span className="inline-flex items-center justify-center w-8 h-6 bg-[#F5EFE8] text-[#C4622D] text-xs font-semibold rounded-full border border-[#E8C9B0]">{row.age}</span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {row.gender ? (
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${row.gender.toLowerCase() === 'female' ? 'bg-pink-50 text-pink-700 border-pink-200' : row.gender.toLowerCase() === 'male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{row.gender}</span>
                              ) : <span className="text-[#8C7B6B]">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#5C5347]">
                              {row.allergies ? (
                                <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">{row.allergies}</span>
                              ) : <span className="text-[#8C7B6B]">None</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )

        ) : (
          <>
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
                    {eventOptions.map(ev => <option key={ev} value={ev}>{ev}</option>)}
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
                    {venueOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {selectedVenue !== 'all' && (
                    <button onClick={() => setSelectedVenue('all')} className="text-xs text-[#C4622D] hover:underline">Clear</button>
                  )}
                </div>
              )}
            </div>

            {/* Table */}
            {error ? (
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
                      <th className="px-4 py-3 text-left font-semibold">Event</th>
                      <th className="px-4 py-3 text-left font-semibold">Venue</th>
                      <th className="px-4 py-3 text-left font-semibold">Date(s)</th>
                      <th className="px-4 py-3 text-left font-semibold">Payment</th>
                      <th className="px-4 py-3 text-left font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold">Registered</th>
                      <th className="px-4 py-3 text-center font-semibold">Participants</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E8DE]">
                    {paginated.map(reg => {
                      const isExpanded = expandedId === reg.id;
                      const sessions = reg.session_dates || [];
                      const uniqueEvents = [...new Set(sessions.map(s => s.event_name).filter(Boolean))];
                      const uniqueVenues = [...new Set(sessions.map(s => s.location).filter(Boolean))];
                      const filledChildren = filterFilledChildren(reg.children);
                      const childCount = filledChildren.length;

                      return (
                        <>
                          <tr
                            key={reg.id}
                            className={`hover:bg-[#FAF5EE] transition-colors cursor-pointer ${isExpanded ? 'bg-[#FDF6EE]' : 'bg-white'}`}
                            onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#2C2420]">{reg.title} {reg.first_name} {reg.surname}</div>
                              <div className="text-xs text-[#8C7B6B] mt-0.5">{reg.relationship || '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-[#2C2420]">{reg.email}</div>
                              <div className="text-xs text-[#8C7B6B] mt-0.5">{reg.cellphone}</div>
                            </td>
                            <td className="px-4 py-3">
                              {uniqueEvents.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {uniqueEvents.map((ev, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-[#FDF6EE] to-[#F5EFE8] text-[#C4622D] text-xs font-medium rounded-lg border border-[#E8C9B0] shadow-sm">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#C4622D] flex-shrink-0" />{ev}
                                    </span>
                                  ))}
                                </div>
                              ) : <span className="text-[#8C7B6B]">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {uniqueVenues.length > 0 ? (
                                <div className="space-y-0.5">
                                  {uniqueVenues.map((v, i) => (
                                    <div key={i} className="text-xs text-[#5C5347] truncate max-w-[160px]" title={v ?? undefined}>{v}</div>
                                  ))}
                                </div>
                              ) : <span className="text-[#8C7B6B]">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {sessions.length > 0 ? (
                                <div className="space-y-0.5">
                                  {sessions.slice(0, 2).map((s, i) => (
                                    <div key={i} className="text-xs text-[#5C5347]">{formatDate(s.event_date)}</div>
                                  ))}
                                  {sessions.length > 2 && <div className="text-xs text-[#8C7B6B]">+{sessions.length - 2} more</div>}
                                </div>
                              ) : <span className="text-[#8C7B6B]">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {reg.payment_status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-[#2C2420]">{formatCurrency(reg.amount)}</td>
                            <td className="px-4 py-3 text-xs text-[#5C5347]">{formatDate(reg.created_at)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => openDeleteModal(reg, e)}
                                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 hover:border-red-300 transition-colors"
                                    title="Delete this registration"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </button>
                                )}
                                <button
                                  onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : reg.id); }}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${isExpanded ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'bg-white text-[#C4622D] border-[#C4622D] hover:bg-[#FDF6EE]'}`}
                                >
                                  <span>{childCount}</span>
                                  <span>{isExpanded ? '▲' : '▼'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded participant details */}
                          {isExpanded && (
                            <tr key={`${reg.id}-expanded`} className="bg-[#FDF6EE]">
                              <td colSpan={9} className="p-0">
                                <div className="bg-black px-6 py-4 flex items-center gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white">{reg.title} {reg.first_name} {reg.surname}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{reg.email} · {reg.cellphone}</p>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full border capitalize ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                      {reg.payment_status.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-sm font-bold text-white">{formatCurrency(reg.amount)}</span>
                                    <span className="text-xs text-gray-400">{formatDate(reg.created_at)}</span>
                                  </div>
                                </div>
                                <div className="px-6 py-5 space-y-5">
                                  {/* Registrant info */}
                                  <div>
                                    <h4 className="text-xs font-semibold text-[#8C7B6B] uppercase tracking-wide mb-2 flex items-center gap-2">
                                      <span className="w-5 h-5 bg-[#C4622D] text-white rounded-full flex items-center justify-center text-xs">R</span>
                                      Registrant (Guardian / Responsible Person)
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
                                              <td className="px-3 py-2 text-[#5C5347]">{[reg.medical_doctor_first_name, reg.medical_doctor_surname].filter(Boolean).join(' ') || '—'}</td>
                                              <td className="px-3 py-2 text-[#5C5347]">{reg.medical_aid_name || '—'}</td>
                                              <td className="px-3 py-2 text-[#5C5347]">{reg.medical_aid_number || '—'}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Child participants */}
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
                                              <th className="px-3 py-2 text-left font-semibold">Grade</th>
                                              <th className="px-3 py-2 text-left font-semibold">Allergies</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[#F0E8DE]">
                                            {filledChildren.map((child, idx) => (
                                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF5EE]'}>
                                                <td className="px-3 py-2 text-[#8C7B6B] font-medium">{idx + 1}</td>
                                                <td className="px-3 py-2 font-medium text-[#2C2420]">{child.fullName || child.full_name || child.name || '—'}</td>
                                                <td className="px-3 py-2 text-[#5C5347]">{formatDate(child.dob)}</td>
                                                <td className="px-3 py-2 text-[#5C5347]">{child.age != null ? String(child.age) : calcAge(child.dob)}</td>
                                                <td className="px-3 py-2 text-[#5C5347] capitalize">{child.gender || '—'}</td>
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
                                                <td className="px-3 py-2 text-[#5C5347]">{s.start_time && s.end_time ? `${s.start_time} – ${s.end_time}` : s.start_time || '—'}</td>
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

            {/* Paginator */}
            {!error && filtered.length > 0 && (
              <>
                <div className="px-5 py-2 bg-[#FAF5EE] border-t border-[#E8DDD0] text-xs text-[#8C7B6B]">
                  Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} registration{filtered.length !== 1 ? 's' : ''}
                </div>
                <Paginator currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </>
            )}
          </>
        )}
      </div>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 w-full max-w-md">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-red-100">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1612]">Delete Event Registration</h3>
                <p className="text-xs text-red-600 font-medium">This action is permanent and cannot be undone</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#5C5347] mb-1">You are about to permanently delete the complete record for:</p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-sm font-bold text-[#1A1612]">{deleteTarget.title ? `${deleteTarget.title} ` : ''}{deleteTarget.first_name} {deleteTarget.surname}</p>
                <p className="text-xs text-[#8C8278]">{deleteTarget.email} · {deleteTarget.cellphone}</p>
                <p className="text-xs text-[#8C8278] mt-0.5">Registered: {formatDate(deleteTarget.created_at)} · Amount: {formatCurrency(deleteTarget.amount)}</p>
              </div>
              <p className="text-xs text-[#8C8278] mb-3">This will permanently remove the registration, all participant data, session bookings, and payment records associated with this registrant.</p>
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
              {deleteError && <p className="text-xs text-red-600 mt-2">{deleteError}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button type="button" onClick={closeDeleteModal} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-medium text-[#5C5347] hover:bg-[#FAF5EE] transition-colors disabled:opacity-50">Cancel</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete Permanently</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
