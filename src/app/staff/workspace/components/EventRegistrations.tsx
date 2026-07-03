'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { roleCanAccessTab } from '@/app/staff/workspace/rbac';
import BookingPaymentMethodBadge from '@/app/staff/workspace/components/BookingPaymentMethodBadge';
import {
  ConfirmationEmailRecipientStatus,
  RecipientCheckboxList,
  buildSendRecipientOptions,
  defaultSelectedRecipientKeys,
} from '@/app/staff/workspace/components/ConfirmationEmailRecipientStatus';
import type { ConfirmationEmailRecipientsMap, ConfirmationRecipientKey } from '@/lib/confirmation-email-recipients';
import { resolveConfirmationRecipients, isCustomerConfirmationDelivered } from '@/lib/confirmation-email-recipients';

const STAFF_RECEIPT_ROLES = ['admin', 'super_admin', 'staff'] as const;

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
  selected_events?: string[];
  adult_class_dates?: string[];
  payment_method?: string;
  registration_code?: string | null;
  payfast_payment_id?: string | null;
  payfast_confirmation_email_sent_at?: string | null;
  payfast_confirmation_email_error?: string | null;
  payfast_confirmation_email_resend_id?: string | null;
  confirmation_email_recipients?: ConfirmationEmailRecipientsMap | null;
  proof_of_payment_url?: string | null;
  proof_of_payment_path?: string | null;
  // enriched
  session_dates?: SessionDate[];
}

interface CorrespondenceSettings {
  info_email: string | null;
  admin_email: string | null;
}

interface PayFastReceipt {
  payerName: string;
  email: string;
  cellphone: string;
  paymentStatus: string;
  paymentDate: string;
  registrationCode: string | null;
  mPaymentId: string | null;
  pfPaymentId: string | null;
  itemName: string;
  itemDescription: string | null;
  amountGross: string | null;
  amountFee: string | null;
  amountNet: string | null;
  hasItnData: boolean;
}

interface SessionDate {
  id: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_name: string | null;
  class_fee: number | null;
  session_name: string | null;
  statusLabel: string | null;
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
  registrationId: string;
  registrantName: string;
  participantIndex: number; // original index in r.children array
}

// Participants by Session view: macro view grouped by session → registrant → participants
interface ParticipantsBySessionGroup {
  sessionKey: string; // unique key for the session
  eventName: string;
  sessionName: string | null;
  statusLabel: string | null;
  eventDate: string | null;
  timeslot: string;
  location: string;
  registrants: {
    registrationId: string;
    registrantName: string;
    registrantEmail: string;
    registrantPhone: string;
    paymentStatus: string;
    participants: {
      originalIndex: number;
      fullName: string;
      age: string;
      ticketNumber: string;
      dob: string | null;
      gender: string;
      grade: string;
      allergies: string;
      picturesTaken: string;
      indemnityConsent: string;
    }[];
  }[];
}

type ParticipantSortKey = 'dob' | 'age' | 'gender' | 'allergies' | 'datetime';
type SortDir = 'asc' | 'desc';

type FilterTab = 'event' | 'registrant' | 'venue' | 'sessions_booked' | 'participant_bookings' | 'participants_by_location' | 'participants_by_session';

const PAGE_SIZE = 10;

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  failed_payment_transaction: 'bg-red-100 text-red-700 border-red-200',
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
  return `R ${Math.round(Number(val)).toLocaleString('en-US')}`;
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

function isPayfastPaidRegistration(reg: RegistrationRow): boolean {
  if (!['paid', 'awaiting_confirmation'].includes(reg.payment_status)) return false;
  if (reg.payment_method === 'eft' || reg.payment_method === 'credit') return false;
  if (reg.payment_method === 'payfast') return true;
  if (reg.payfast_payment_id) return true;
  if (reg.proof_of_payment_url || reg.proof_of_payment_path) return false;
  return true;
}

function isAdminOrAbove(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'super_admin';
}

function canSendStaffConfirmation(userRole: string, reg: RegistrationRow): boolean {
  if (!isAdminOrAbove(userRole)) return false;
  return ['paid', 'awaiting_confirmation'].includes(reg.payment_status);
}

function canAccessPayfastReceipt(userRole: string): boolean {
  return (
    STAFF_RECEIPT_ROLES.includes(userRole as (typeof STAFF_RECEIPT_ROLES)[number]) &&
    roleCanAccessTab(userRole, 'event_registrations')
  );
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
  userRole?: string;
}

export default function EventRegistrations({ isSuperAdmin = false, userRole = '' }: EventRegistrationsProps) {
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
  const [activeClassOptions, setActiveClassOptions] = useState<string[]>([]);

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

  // Participants by Session filter state
  const [sessionParticipantFilter, setSessionParticipantFilter] = useState<string>('all');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<RegistrationRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Participant-only delete state
  const [deleteParticipantTarget, setDeleteParticipantTarget] = useState<{ registrationId: string; participantIndex: number; participantName: string } | null>(null);
  const [deletingParticipant, setDeletingParticipant] = useState(false);
  const [deleteParticipantError, setDeleteParticipantError] = useState('');

  // PayFast receipt modal
  const [receiptTarget, setReceiptTarget] = useState<RegistrationRow | null>(null);
  const [receiptData, setReceiptData] = useState<PayFastReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  // Confirmation email send (staff)
  const [correspondenceSettings, setCorrespondenceSettings] = useState<CorrespondenceSettings | null>(null);
  const [sendTarget, setSendTarget] = useState<RegistrationRow | null>(null);
  const [selectedSendTargets, setSelectedSendTargets] = useState<ConfirmationRecipientKey[]>([]);
  const [sendingConfirmationId, setSendingConfirmationId] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const suppressSendModalUntil = useRef(0);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      // 1. Fetch all cooking class registrations
      const { data: regs, error: regsErr } = await supabase
        .from('cooking_class_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (regsErr) throw regsErr;
      if (!regs || regs.length === 0) { setRegistrations([]); return; }

      // 2. Fetch booking counts (links registrations → session IDs)
      const regIds = regs.map((r: RegistrationRow) => r.id);
      const { data: bookings } = await supabase
        .from('cooking_class_booking_counts')
        .select('registration_id, event_date_id')
        .in('registration_id', regIds);

      // 3. Fetch cooking class sessions with class names
      const eventDateIds = [...new Set((bookings || []).map((b: { event_date_id: string }) => b.event_date_id))];
      let eventDatesMap: Record<string, SessionDate> = {};

      if (eventDateIds.length > 0) {
        const { data: dates } = await supabase
          .from('cooking_class_sessions')
          .select('id, event_date, start_time, end_time, location, class_fee, class_id, session_name, status_id')
          .in('id', eventDateIds);

        if (dates && dates.length > 0) {
          const eventIds = [...new Set(dates.map((d: { class_id: string }) => d.class_id).filter(Boolean))];
          let eventsMap: Record<string, string> = {};
          if (eventIds.length > 0) {
            const { data: events } = await supabase
              .from('cooking_class_name')
              .select('id, name')
              .in('id', eventIds);
            (events || []).forEach((e: { id: string; name: string }) => { eventsMap[e.id] = e.name; });
          }
          // Fetch session status labels
          const statusIds = [...new Set(dates.map((d: { status_id: string | null }) => d.status_id).filter(Boolean))];
          let statusLabelMap: Record<string, string> = {};
          if (statusIds.length > 0) {
            const { data: statuses } = await supabase
              .from('cooking_class_session_statuses')
              .select('id, label')
              .in('id', statusIds);
            (statuses || []).forEach((s: { id: string; label: string | null }) => {
              if (s.label) statusLabelMap[s.id] = s.label;
            });
          }
          dates.forEach((d: { id: string; event_date: string | null; start_time: string | null; end_time: string | null; location: string | null; class_fee: number | null; class_id: string; session_name: string | null; status_id: string | null }) => {
            const dbLabel = d.status_id ? (statusLabelMap[d.status_id] || null) : null;
            // Use effectiveSessionStatusLabel logic: if session has ended, show 'Bookings Closed'
            const now = new Date();
            let statusLabel: string | null = null;
            if (d.event_date) {
              const endTime = d.end_time || '23:59';
              const sessionEnd = new Date(`${d.event_date}T${endTime}`);
              statusLabel = sessionEnd < now ? 'Bookings Closed' : (dbLabel || 'Active');
            } else {
              statusLabel = dbLabel || null;
            }
            eventDatesMap[d.id] = {
              id: d.id,
              event_date: d.event_date,
              start_time: d.start_time,
              end_time: d.end_time,
              location: d.location,
              class_fee: d.class_fee,
              event_name: eventsMap[d.class_id] || null,
              session_name: d.session_name || null,
              statusLabel,
            };
          });
        }
      }

      // 4. Build registration → session_dates map from booking_counts
      const regSessionMap: Record<string, SessionDate[]> = {};
      (bookings || []).forEach((b: { registration_id: string; event_date_id: string }) => {
        if (!regSessionMap[b.registration_id]) regSessionMap[b.registration_id] = [];
        if (eventDatesMap[b.event_date_id]) {
          regSessionMap[b.registration_id].push(eventDatesMap[b.event_date_id]);
        }
      });

      // Build a map: class name → first known location (for enriching legacy synthetic sessions)
      const classNameToLocation: Record<string, string | null> = {};
      Object.values(eventDatesMap).forEach(sd => {
        const name = sd.event_name || '';
        if (name && classNameToLocation[name] === undefined) {
          classNameToLocation[name] = sd.location || null;
        } else if (name && !classNameToLocation[name] && sd.location) {
          classNameToLocation[name] = sd.location;
        }
      });

      const enriched: RegistrationRow[] = regs.map((r: RegistrationRow) => {
        const sessions = regSessionMap[r.id] || [];
        if (sessions.length > 0) {
          return { ...r, session_dates: sessions };
        }

        const names = Array.isArray(r.selected_events) ? r.selected_events.filter(Boolean) : [];
        const dates = Array.isArray(r.adult_class_dates) ? r.adult_class_dates.filter(Boolean) : [];
        const synthetic: SessionDate[] = [];
        if (names.length > 0 && dates.length > 0) {
          names.forEach(name => dates.forEach(d =>
            synthetic.push({
              id: '',
              event_date: d,
              start_time: null,
              end_time: null,
              location: classNameToLocation[name] || null,
              class_fee: null,
              event_name: name,
              session_name: null,
              statusLabel: null,
            })
          ));
        } else if (names.length > 0) {
          names.forEach(name => synthetic.push({
            id: '',
            event_date: null,
            start_time: null,
            end_time: null,
            location: classNameToLocation[name] || null,
            class_fee: null,
            event_name: name,
            session_name: null,
            statusLabel: null,
          }));
        }
        return { ...r, session_dates: synthetic };
      });

      setRegistrations(enriched);

      // 5. Build filter options
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

      // 6. Fetch active classes from Class Settings for the "Filter by Class" dropdowns
      const [activeClassesResult, corrSettingsResult] = await Promise.all([
        supabase
          .from('cooking_class_name')
          .select('name')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('correspondence_settings')
          .select('info_email, admin_email')
          .limit(1)
          .maybeSingle(),
      ]);
      const activeClasses = activeClassesResult.data;
      const corrSettings = corrSettingsResult.data;
      if (corrSettings) {
        setCorrespondenceSettings({
          info_email: corrSettings.info_email,
          admin_email: corrSettings.admin_email,
        });
      }
      if (activeClasses && activeClasses.length > 0) {
        setActiveClassOptions([...new Set(activeClasses.map((c: { name: string }) => c.name))]);
      } else {
        setActiveClassOptions([...allEvents].sort());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load registrations');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
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

  const closeReceiptModal = () => {
    setReceiptTarget(null);
    setReceiptData(null);
    setReceiptError('');
    setReceiptLoading(false);
  };

  const canViewPayfastReceipt = (reg: RegistrationRow) =>
    canAccessPayfastReceipt(userRole) && isPayfastPaidRegistration(reg);

  const openReceiptModal = async (reg: RegistrationRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canAccessPayfastReceipt(userRole)) return;
    setReceiptTarget(reg);
    setReceiptData(null);
    setReceiptError('');
    setReceiptLoading(true);
    try {
      const res = await fetch(`/api/cooking-classes/payfast-receipt?registrationId=${encodeURIComponent(reg.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load PayFast receipt');
      setReceiptData(data.receipt as PayFastReceipt);
    } catch (err: unknown) {
      setReceiptError(err instanceof Error ? err.message : 'Failed to load PayFast receipt');
    } finally {
      setReceiptLoading(false);
    }
  };

  const openSendModal = (reg: RegistrationRow, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (Date.now() < suppressSendModalUntil.current) return;
    if (!canSendStaffConfirmation(userRole, reg)) return;

    const options = buildSendRecipientOptions(
      resolveConfirmationRecipients(
        reg.confirmation_email_recipients,
        reg.email,
        correspondenceSettings?.info_email,
        correspondenceSettings?.admin_email,
        reg.payfast_confirmation_email_sent_at,
        reg.payfast_confirmation_email_resend_id
      )
    );

    setSendTarget(reg);
    setSelectedSendTargets(defaultSelectedRecipientKeys(options));
    setSendError('');
  };

  const closeSendModal = () => {
    setSendTarget(null);
    setSelectedSendTargets([]);
    setSendError('');
    setSendingConfirmationId(null);
  };

  const patchRegistrationAfterSend = (
    registrationId: string,
    data: {
      recipients?: ConfirmationEmailRecipientsMap;
      resendId?: string;
      results?: Partial<Record<ConfirmationRecipientKey, { sent?: boolean }>>;
      partial?: boolean;
    }
  ) => {
    const sentAt = new Date().toISOString();
    setRegistrations((prev) =>
      prev.map((r) => {
        if (r.id !== registrationId) return r;

        let recipients = data.recipients ?? r.confirmation_email_recipients ?? null;
        if (!recipients && data.results) {
          const base = { ...(r.confirmation_email_recipients || {}) } as ConfirmationEmailRecipientsMap;
          for (const [key, result] of Object.entries(data.results)) {
            if (!result?.sent) continue;
            const k = key as ConfirmationRecipientKey;
            const email =
              k === 'customer'
                ? r.email
                : k === 'info_admin'
                  ? correspondenceSettings?.info_email
                  : correspondenceSettings?.admin_email;
            if (!email) continue;
            base[k] = {
              email,
              sent_at: sentAt,
              error: null,
              resend_id: data.resendId || null,
            };
          }
          if (Object.keys(base).length > 0) recipients = base;
        }

        const customerSent =
          isCustomerConfirmationDelivered(recipients) || Boolean(data.results?.customer?.sent);

        return {
          ...r,
          confirmation_email_recipients: recipients,
          payfast_confirmation_email_sent_at: customerSent
            ? recipients?.customer?.sent_at || sentAt
            : r.payfast_confirmation_email_sent_at,
          payfast_confirmation_email_error: customerSent ? null : r.payfast_confirmation_email_error,
          payfast_confirmation_email_resend_id: data.resendId ?? r.payfast_confirmation_email_resend_id,
        };
      })
    );
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    window.setTimeout(() => setToastMessage(null), 6000);
  };

  const handleSendConfirmation = async () => {
    if (!sendTarget || selectedSendTargets.length === 0) return;

    const sendOptions = buildSendRecipientOptions(
      resolveConfirmationRecipients(
        sendTarget.confirmation_email_recipients,
        sendTarget.email,
        correspondenceSettings?.info_email,
        correspondenceSettings?.admin_email,
        sendTarget.payfast_confirmation_email_sent_at,
        sendTarget.payfast_confirmation_email_resend_id
      )
    );
    const forceResend = selectedSendTargets.some(
      (key) => sendOptions.find((o) => o.key === key)?.status === 'sent'
    );

    setSendingConfirmationId(sendTarget.id);
    setSendError('');
    try {
      const res = await fetch('/api/cooking-classes/send-staff-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: sendTarget.id,
          targets: selectedSendTargets,
          forceResend,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to send confirmation email');
      }

      if (data.skipped) {
        const skipMsg =
          data.message ||
          data.error ||
          'Selected recipients are already notified — check the box to resend.';
        setSendError(skipMsg);
        showToast('error', skipMsg);
        return;
      }

      const sentLabels = selectedSendTargets
        .map((key) => sendOptions.find((o) => o.key === key)?.label)
        .filter(Boolean);

      const registrationId = sendTarget.id;
      suppressSendModalUntil.current = Date.now() + 800;
      closeSendModal();
      patchRegistrationAfterSend(registrationId, data);

      const persistNote =
        data.persisted === false
          ? ` Warning: ${data.persistError || 'delivery status could not be saved'}.`
          : '';

      showToast(
        'success',
        (data.partial
          ? 'Email sent with some failures. Check Confirm Email status for details.'
          : `Confirmation email sent to ${sentLabels.join(', ') || 'selected recipients'}.`) +
          persistNote
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send confirmation email';
      setSendError(message);
      showToast('error', message);
    } finally {
      setSendingConfirmationId(null);
    }
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
        .from('cooking_class_booking_counts')
        .delete()
        .eq('registration_id', deleteTarget.id);
      if (bookingErr) throw bookingErr;

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

  const handleDeleteParticipant = async () => {
    if (!deleteParticipantTarget) return;
    setDeletingParticipant(true);
    setDeleteParticipantError('');
    try {
      const reg = registrations.find(r => r.id === deleteParticipantTarget.registrationId);
      if (!reg) throw new Error('Registration not found');
      const updatedChildren = Array.isArray(reg.children) ? [...reg.children] : [];
      // Remove the participant at the original index by nullifying/blanking it
      // We splice it out entirely so the array shrinks
      updatedChildren.splice(deleteParticipantTarget.participantIndex, 1);
      const { error } = await supabase
        .from('cooking_class_registrations')
        .update({ children: updatedChildren })
        .eq('id', deleteParticipantTarget.registrationId);
      if (error) throw error;
      setRegistrations(prev => prev.map(r => {
        if (r.id !== deleteParticipantTarget.registrationId) return r;
        return { ...r, children: updatedChildren };
      }));
      setDeleteParticipantTarget(null);
      setDeleteParticipantError('');
    } catch (err: unknown) {
      setDeleteParticipantError(err instanceof Error ? err.message : 'Failed to delete participant');
    } finally {
      setDeletingParticipant(false);
    }
  };

  // Apply filters
  const filtered = registrations.filter(r => {
    if (filterTab === 'event' && selectedEvent !== 'all') {
      const hasEvent = (r.session_dates || []).some(sd => sd.event_name === selectedEvent);
      // Fallback: check selected_events array directly on the registration
      const hasEventFallback = !hasEvent && Array.isArray(r.selected_events) && r.selected_events.some(ev => ev === selectedEvent);
      if (!hasEvent && !hasEventFallback) return false;
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
      const sessionDates = r.session_dates || [];
      if (sessionDates.length === 0) {
        // Include registrants with no session assigned
        const evName = 'No Session Assigned';
        const dateKey = '—';
        const timeslot = '—';
        if (!eventMap[evName]) eventMap[evName] = {};
        if (!eventMap[evName][dateKey]) eventMap[evName][dateKey] = {};
        if (!eventMap[evName][dateKey][timeslot]) {
          eventMap[evName][dateKey][timeslot] = { dateId: '', registrants: [] };
        }
        eventMap[evName][dateKey][timeslot].registrants.push({
          name,
          email: r.email,
          paymentStatus: r.payment_status,
        });
      } else {
        sessionDates.forEach(sd => {
          const evName = sd.event_name || 'Unknown Class';
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
      }
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
      const allChildren = Array.isArray(r.children) ? r.children : [];
      const registrantName = `${r.title ? r.title + ' ' : ''}${r.first_name} ${r.surname}`.trim();
      const sessionDates = r.session_dates || [];
      // Build list of filled children with their original indices
      const filledChildren: { child: ChildParticipant; originalIndex: number }[] = allChildren
        .map((child, idx) => ({ child, originalIndex: idx }))
        .filter(({ child }) => (child.fullName || child.full_name || child.name || '').trim().length > 0);
      if (filledChildren.length === 0) return;
      if (sessionDates.length === 0) {
        // Include participants with no session assigned
        filledChildren.forEach(({ child, originalIndex }) => {
          const ageStr = child.age != null ? String(child.age) : calcAge(child.dob);
          rows.push({
            eventName: 'No Session Assigned',
            eventDate: null,
            timeslot: '—',
            fullName: (child.fullName || child.full_name || child.name || '').trim(),
            dob: child.dob || null,
            age: ageStr,
            gender: (child.gender || '').trim(),
            allergies: (child.dietaryRestrictions || child.allergies || '').trim(),
            location: '',
            registrationId: r.id,
            registrantName,
            participantIndex: originalIndex,
          });
        });
      } else {
        sessionDates.forEach(sd => {
          const evName = sd.event_name || 'Unknown Class';
          const timeslot = sd.start_time && sd.end_time
            ? `${sd.start_time} – ${sd.end_time}`
            : sd.start_time || 'Time TBC';
          filledChildren.forEach(({ child, originalIndex }) => {
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
              registrationId: r.id,
              registrantName,
              participantIndex: originalIndex,
            });
          });
        });
      }
    });
    return rows;
  })();

  // Build Participants by Session grouped data (macro view)
  const participantsBySessionGroups: ParticipantsBySessionGroup[] = (() => {
    // Map: sessionKey → group
    const sessionMap: Record<string, ParticipantsBySessionGroup> = {};

    registrations.forEach(r => {
      const allChildren = Array.isArray(r.children) ? r.children : [];
      const filledChildren: { child: ChildParticipant; originalIndex: number }[] = allChildren
        .map((child, idx) => ({ child, originalIndex: idx }))
        .filter(({ child }) => (child.fullName || child.full_name || child.name || '').trim().length > 0);

      if (filledChildren.length === 0) return;

      const registrantName = `${r.title ? r.title + ' ' : ''}${r.first_name} ${r.surname}`.trim();
      const sessionDates = r.session_dates || [];

      const buildParticipants = () => filledChildren.map(({ child, originalIndex }) => {
        const ageStr = child.age != null && child.age !== '' ? String(child.age) : calcAge(child.dob);
        const childAllergies = (child.allergies || child.dietaryRestrictions || '').trim();
        const childName = (child.fullName || child.full_name || child.name || '').trim();
        const picturesTaken = (child as Record<string, unknown>).picturesTaken;
        const indemnityConsent = (child as Record<string, unknown>).indemnityConsent;
        return {
          originalIndex,
          fullName: childName,
          age: ageStr,
          ticketNumber: (child.ticket_number || '').trim(),
          dob: child.dob || null,
          gender: (child.gender || '').trim(),
          grade: (child.grade || '').trim(),
          allergies: childAllergies,
          picturesTaken: picturesTaken != null && picturesTaken !== '' ? String(picturesTaken) : '',
          indemnityConsent: indemnityConsent === true || indemnityConsent === 'true' ? 'Yes' : indemnityConsent === false || indemnityConsent === 'false' ? 'No' : indemnityConsent != null && indemnityConsent !== '' ? String(indemnityConsent) : '',
        };
      });

      const addRegistrantToSession = (sessionKey: string, eventName: string, sessionName: string | null, statusLabel: string | null, eventDate: string | null, timeslot: string, location: string) => {
        if (!sessionMap[sessionKey]) {
          sessionMap[sessionKey] = {
            sessionKey,
            eventName,
            sessionName,
            statusLabel,
            eventDate,
            timeslot,
            location,
            registrants: [],
          };
        }
        // Check if this registrant already exists in this session
        const existing = sessionMap[sessionKey].registrants.find(reg => reg.registrationId === r.id);
        if (!existing) {
          sessionMap[sessionKey].registrants.push({
            registrationId: r.id,
            registrantName,
            registrantEmail: r.email,
            registrantPhone: r.cellphone,
            paymentStatus: r.payment_status,
            participants: buildParticipants(),
          });
        }
      };

      if (sessionDates.length === 0) {
        const sessionKey = 'no-session';
        addRegistrantToSession(sessionKey, 'No Session Assigned', null, null, null, '—', '');
      } else {
        sessionDates.forEach(sd => {
          const evName = sd.event_name || 'Unknown Class';
          const timeslot = sd.start_time && sd.end_time
            ? `${sd.start_time} – ${sd.end_time}`
            : sd.start_time || 'Time TBC';
          const sessionKey = `${evName}__${sd.event_date || ''}__${timeslot}`;
          addRegistrantToSession(sessionKey, evName, sd.session_name || null, sd.statusLabel || null, sd.event_date, timeslot, (sd.location || '').trim());
        });
      }
    });

    return Object.values(sessionMap).sort((a, b) => {
      // Sort by event name, then date
      const nameCmp = a.eventName.localeCompare(b.eventName);
      if (nameCmp !== 0) return nameCmp;
      return (a.eventDate || '').localeCompare(b.eventDate || '');
    });
  })();

  const filteredParticipantsBySession = sessionParticipantFilter === 'all'
    ? participantsBySessionGroups
    : participantsBySessionGroups.filter(g => g.eventName === sessionParticipantFilter);

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
    const eventLabel = participantEventFilter !== 'all' ? participantEventFilter : 'All Classes';
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
    <div class="meta"><div class="meta-item"><div class="label">Total Participants</div><div class="value">${rows.length}</div></div><div class="meta-item"><div class="label">Class Filter</div><div class="value" style="font-size:12px;color:#5c5347">${eventLabel}</div></div></div>
    <table><thead><tr><th>#</th><th>Class</th><th>Date &amp; Time</th><th>Full Name</th><th>Date of Birth</th><th>Age</th><th>Gender</th><th>Allergies</th></tr></thead><tbody>${tableRows}</tbody></table>
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

  const handleCreateParticipantsBySessionPDF = () => {
    const groups = filteredParticipantsBySession;
    const classLabel = sessionParticipantFilter !== 'all' ? sessionParticipantFilter : 'All Classes';
    const generatedAt = new Date().toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const totalParticipantCount = groups.reduce((s, g) => s + g.registrants.reduce((rs, r) => rs + r.participants.length, 0), 0);

    const sessionBlocks = groups.map(group => {
      const dateStr = group.eventDate ? new Date(group.eventDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const registrantRows = group.registrants.map(reg => {
        const participantRows = reg.participants.map((p, pIdx) => `
          <tr style="background:${pIdx % 2 === 0 ? '#ffffff' : '#faf5ee'}">
            <td style="padding:7px 12px 7px 28px;border-bottom:1px solid #f0e8de;color:#8c7b6b;font-size:11px">${pIdx + 1}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0e8de;font-size:12px;font-weight:500;color:#2c2420">${p.fullName || '—'}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347;text-transform:capitalize">${p.gender || '—'}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0e8de;font-size:12px;color:#5c5347">${p.allergies || 'None'}</td>
          </tr>
        `).join('');
        const paymentBadgeColor = reg.paymentStatus === 'paid' ? '#16a34a' : reg.paymentStatus === 'pending' ? '#d97706' : '#6b7280';
        return `
          <tr>
            <td colspan="4" style="padding:0">
              <div style="background:#2c2420;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;margin-top:4px">
                <div>
                  <span style="font-size:12px;font-weight:700">${reg.registrantName}</span>
                  ${reg.registrantEmail ? `<span style="font-size:11px;color:#c4a882;margin-left:12px">✉ ${reg.registrantEmail}</span>` : ''}
                  ${reg.registrantPhone ? `<span style="font-size:11px;color:#c4a882;margin-left:12px">📞 ${reg.registrantPhone}</span>` : ''}
                </div>
                <span style="font-size:10px;font-weight:600;color:${paymentBadgeColor};text-transform:uppercase;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:4px">${reg.paymentStatus || '—'}</span>
              </div>
            </td>
          </tr>
          ${participantRows}
        `;
      }).join('');

      return `
        <div style="margin-bottom:24px;border:1px solid #e8ddd0;border-radius:8px;overflow:hidden">
          <div style="background:#f5efe8;padding:10px 14px;border-bottom:2px solid #c4622d">
            <div style="font-size:13px;font-weight:700;color:#c4622d">${group.eventName}${group.sessionName ? ` <span style="font-size:12px;color:#5c5347;font-weight:600">— ${group.sessionName}</span>` : ''}</div>
            <div style="font-size:11px;color:#5c5347;margin-top:2px">📅 ${dateStr} &nbsp;·&nbsp; 🕐 ${group.timeslot || '—'} &nbsp;·&nbsp; 📍 ${group.location || '—'}</div>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#faf5ee">
                <th style="padding:8px 12px 8px 28px;text-align:left;font-size:10px;font-weight:700;color:#5c5347;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e8ddd0">#</th>
                <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#5c5347;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e8ddd0">Full Name</th>
                <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#5c5347;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e8ddd0">Gender</th>
                <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#5c5347;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e8ddd0">Allergies / Dietary</th>
              </tr>
            </thead>
            <tbody>${registrantRows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Participants by Session — ${classLabel}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2c2420;background:#fff;padding:24px}.header{border-bottom:2px solid #c4622d;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.header-left h1{font-size:20px;font-weight:700;color:#1a1612}.header-left p{font-size:12px;color:#8c7b6b;margin-top:4px}.meta{display:flex;gap:24px;margin-bottom:20px}.meta-item{background:#faf5ee;border:1px solid #e8ddd0;border-radius:8px;padding:8px 14px}.meta-item .label{font-size:10px;color:#8c7b6b;text-transform:uppercase;letter-spacing:.05em;font-weight:600}.meta-item .value{font-size:14px;font-weight:700;color:#c4622d;margin-top:2px}.footer{margin-top:20px;padding-top:12px;border-top:1px solid #e8ddd0;font-size:10px;color:#8c7b6b;text-align:center}@media print{body{padding:16px}@page{margin:1cm;size:A4 portrait}}</style>
    </head><body>
    <div class="header"><div class="header-left"><h1>Participants by Session</h1><p>Class: ${classLabel}</p></div><div style="text-align:right;font-size:11px;color:#8c7b6b">Generated: ${generatedAt}</div></div>
    <div class="meta"><div class="meta-item"><div class="label">Total Sessions</div><div class="value">${groups.length}</div></div><div class="meta-item"><div class="label">Total Participants</div><div class="value">${totalParticipantCount}</div></div><div class="meta-item"><div class="label">Class Filter</div><div class="value" style="font-size:12px;color:#5c5347">${classLabel}</div></div></div>
    ${sessionBlocks}
    <div class="footer">Cardamom Kitchen — Class Registrations · Participants by Session Report</div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const filterTabConfig: { key: FilterTab; label: string; icon: string }[] = [
    { key: 'event', label: 'By Class', icon: '\uD83C\uDF9F' },
    { key: 'registrant', label: 'By Registrant', icon: '👤' },
    { key: 'venue', label: 'By Venue Location', icon: '📍' },
    { key: 'sessions_booked', label: 'Registrant Bookings', icon: '📅' },
    { key: 'participant_bookings', label: 'Participant Bookings', icon: '👧' },
    { key: 'participants_by_location', label: 'Participants by Location', icon: '📌' },
    { key: 'participants_by_session', label: 'Participants by Session', icon: '🗂️' },
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
          <p className="text-sm text-[#8C7B6B] mt-0.5">All in-person class registrations with participant details</p>
        </div>
        <button
          onClick={() => void loadData()}
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
                <label className="text-sm font-medium text-[#5C5347] whitespace-nowrap">Filter by Class:</label>
                <select
                  value={participantEventFilter}
                  onChange={e => { setParticipantEventFilter(e.target.value); setParticipantSortKey(null); setParticipantSortDir('asc'); }}
                  className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-[#E8DDD0] rounded-lg bg-white text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
                >
                  <option value="all">All Classes</option>
                  {activeClassOptions.map(ev => <option key={ev} value={ev}>{ev}</option>)}
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
                  <p className="text-[#5C5347] font-medium">No participants found for this class</p>
                  <p className="text-sm text-[#8C7B6B] mt-1">Try selecting a different class or &quot;All Classes&quot;</p>
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
                          <th className="px-4 py-3 text-left font-semibold">Class</th>
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
                          {isSuperAdmin && (
                            <th className="px-4 py-3 text-center font-semibold w-12"></th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0E8DE]">
                        {sortedParticipantRows.map((row, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-[#FAF5EE]' : 'bg-[#FAF5EE] hover:bg-[#F5EFE8]'}>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 bg-black text-white text-xs font-semibold rounded-full">{idx + 1}</span>
                            </td>
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
                            {isSuperAdmin && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDeleteParticipantTarget({ registrationId: row.registrationId, participantIndex: row.participantIndex, participantName: row.fullName })}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
                                  title={`Delete participant ${row.fullName}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )

        ) : filterTab === 'participants_by_session' ? (
          error ? (
            <div className="p-6 text-center text-red-600 text-sm">{error}</div>
          ) : (
            <>
              {/* Filter bar */}
              <div className="px-5 py-3 bg-[#FAF5EE] border-b border-[#E8DDD0] flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-[#5C5347] whitespace-nowrap">Filter by Class:</label>
                <select
                  value={sessionParticipantFilter}
                  onChange={e => setSessionParticipantFilter(e.target.value)}
                  className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-[#E8DDD0] rounded-lg bg-white text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
                >
                  <option value="all">All Classes</option>
                  {activeClassOptions.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                </select>
                {sessionParticipantFilter !== 'all' && (
                  <button onClick={() => setSessionParticipantFilter('all')} className="text-xs text-[#C4622D] hover:underline">Clear</button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-[#8C7B6B]">
                    <span className="font-semibold text-[#2C2420]">{filteredParticipantsBySession.length}</span> session{filteredParticipantsBySession.length !== 1 ? 's' : ''}
                    {' · '}
                    <span className="font-semibold text-[#2C2420]">
                      {filteredParticipantsBySession.reduce((s, g) => s + g.registrants.reduce((rs, r) => rs + r.participants.length, 0), 0)}
                    </span> participants
                  </span>
                  {filteredParticipantsBySession.length > 0 && (
                    <button onClick={handleCreateParticipantsBySessionPDF} className="flex items-center gap-1.5 bg-[#C4622D] text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#A04E22] transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v2.546l.943-1.048a.75.75 0 1 1 1.114 1.004l-2.25 2.5a.75.75 0 0 1-1.114 0l-2.25-2.5a.75.75 0 1 1 1.114-1.004l.943 1.048V8.75Z" clipRule="evenodd" />
                      </svg>
                      Create PDF
                    </button>
                  )}
                </div>
              </div>

              {filteredParticipantsBySession.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-3xl mb-2">🗂️</p>
                  <p className="text-[#5C5347] font-medium">No participants found for this class</p>
                  <p className="text-sm text-[#8C7B6B] mt-1">Try selecting a different class or &quot;All Classes&quot;</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F0E8DE]">
                  {filteredParticipantsBySession.map(group => {
                    const totalParticipantsInSession = group.registrants.reduce((s, r) => s + r.participants.length, 0);
                    const isSessionExpanded = expandedSessions.has(group.sessionKey);
                    const toggleSessionCollapse = () => {
                      setExpandedSessions(prev => {
                        const next = new Set(prev);
                        if (next.has(group.sessionKey)) {
                          next.delete(group.sessionKey);
                        } else {
                          next.add(group.sessionKey);
                        }
                        return next;
                      });
                    };
                    return (
                      <div key={group.sessionKey} className="p-5">
                        {/* Session Header — clickable to collapse/expand */}
                        <div
                          className={`flex items-start gap-3 mb-4 cursor-pointer rounded-xl px-4 py-3 -mx-4 -mt-3 transition-colors ${isSessionExpanded ? 'bg-black' : 'hover:bg-[#FAF5EE]'}`}
                          onClick={toggleSessionCollapse}
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C4622D] to-[#E8845A] flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0 mt-0.5">
                            {group.eventName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-base font-bold ${isSessionExpanded ? 'text-white' : 'text-[#2C2420]'}`}>
                              {group.eventName}
                              {group.sessionName && (
                                <span className={`ml-2 text-sm font-semibold ${isSessionExpanded ? 'text-orange-300' : 'text-[#C4622D]'}`}>— {group.sessionName}</span>
                              )}
                              {group.statusLabel && (
                                <span className={`ml-2 text-xs font-medium ${isSessionExpanded ? 'text-gray-400' : 'text-[#8C7B6B]'}`}>({group.statusLabel})</span>
                              )}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {group.eventDate && (
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${isSessionExpanded ? 'bg-[#2C2420] border border-[#3C3430] text-gray-300' : 'bg-[#F5EFE8] border border-[#E8DDD0] text-[#5C5347]'}`}>
                                  📆 {formatDate(group.eventDate)}
                                </span>
                              )}
                              {group.timeslot && group.timeslot !== '—' && (
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${isSessionExpanded ? 'bg-[#2C2420] border border-[#3C3430] text-gray-300' : 'bg-[#F5EFE8] border border-[#E8DDD0] text-[#5C5347]'}`}>
                                  🕐 {group.timeslot}
                                </span>
                              )}
                              {group.location && (
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${isSessionExpanded ? 'bg-[#2C2420] border border-[#3C3430] text-gray-300' : 'bg-[#F5EFE8] border border-[#E8DDD0] text-[#5C5347]'}`}>
                                  📍 {group.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isSessionExpanded ? 'bg-[#2C2420] border border-[#3C3430] text-gray-300' : 'bg-white border border-[#E8DDD0] text-[#8C7B6B]'}`}>
                              {group.registrants.length} registrant{group.registrants.length !== 1 ? 's' : ''}
                            </span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isSessionExpanded ? 'bg-[#2C2420] border border-[#C4622D]/40 text-orange-300' : 'bg-[#FDF6EE] border border-[#E8C9B0] text-[#C4622D]'}`}>
                              {totalParticipantsInSession} participant{totalParticipantsInSession !== 1 ? 's' : ''}
                            </span>
                            {/* Chevron */}
                            <svg
                              className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isSessionExpanded ? 'rotate-180 text-gray-400' : 'text-[#8C7B6B]'}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Registrants — only shown when expanded */}
                        {isSessionExpanded && (
                          <div className="space-y-4 pl-12">
                            {group.registrants.map((registrant, rIdx) => (
                              <div key={registrant.registrationId} className="border border-[#E8DDD0] rounded-xl overflow-hidden">
                                {/* Registrant Header */}
                                <div className="bg-[#F0EBE4] border-b border-[#E8DDD0] px-4 py-3 flex items-center gap-3 flex-wrap">
                                  <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    R
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-[#2C2420]">{registrant.registrantName}</p>
                                    <div className="flex flex-wrap items-center gap-3 mt-0.5">
                                      <span className="text-xs text-[#5C5347] flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        {registrant.registrantEmail}
                                      </span>
                                      <span className="text-xs text-[#5C5347] flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        {registrant.registrantPhone}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_COLORS[registrant.paymentStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                      {registrant.paymentStatus.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-xs bg-[#E8DDD0] border border-[#D4C4B0] text-[#5C5347] px-2.5 py-1 rounded-full font-medium">
                                      {registrant.participants.length} participant{registrant.participants.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>

                                {/* Participants */}
                                <div className="divide-y divide-[#F0E8DE]">
                                  {registrant.participants.map((participant, pIdx) => (
                                    <div key={pIdx} className="p-4 bg-white">
                                      {/* Participant sub-header */}
                                      <div className="flex items-center gap-2 mb-3">
                                        <span className="w-6 h-6 rounded-full bg-[#C4622D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                          {pIdx + 1}
                                        </span>
                                        <span className="text-sm font-semibold text-[#1A1612]">{participant.fullName || '—'}</span>
                                        {participant.age && participant.age !== '—' && (
                                          <span className="text-xs bg-white border border-[#DDD5C8] text-[#5C5347] px-2 py-0.5 rounded-full">Age {participant.age}</span>
                                        )}
                                        {participant.ticketNumber && (
                                          <span className="text-xs font-mono font-semibold bg-[#FDF6EE] border border-[#C4622D]/30 text-[#C4622D] px-2 py-0.5 rounded-full">{participant.ticketNumber}</span>
                                        )}
                                        <span className="ml-auto text-xs text-[#8C7B6B]">Child Participant</span>
                                      </div>
                                      {/* Participant detail grid */}
                                      <div className="flex gap-8 pl-8">
                                        <div>
                                          <p className="text-xs text-[#8C8278] mb-0.5">Full Name</p>
                                          <p className="text-sm font-medium text-[#1A1612]">{participant.fullName || '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-[#8C8278] mb-0.5">Gender</p>
                                          <p className="text-sm font-medium text-[#1A1612] capitalize">{participant.gender || '—'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-[#8C8278] mb-0.5">Allergies / Dietary</p>
                                          <p className="text-sm font-medium text-[#1A1612]">{participant.allergies || 'None'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                          <th className="px-4 py-3 text-left font-semibold">Class</th>
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
                          {isSuperAdmin && (
                            <th className="px-4 py-3 text-center font-semibold w-12"></th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0E8DE]">
                        {sortedLocationParticipantRows.map((row, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-[#FAF5EE]' : 'bg-[#FAF5EE] hover:bg-[#F5EFE8]'}>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 bg-black text-white text-xs font-semibold rounded-full">{idx + 1}</span>
                            </td>
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
                            {isSuperAdmin && (
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDeleteParticipantTarget({ registrationId: row.registrationId, participantIndex: row.participantIndex, participantName: row.fullName })}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
                                  title={`Delete participant ${row.fullName}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </td>
                            )}
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
                  <label className="text-sm font-medium text-[#5C5347] whitespace-nowrap">Filter by Class:</label>
                  <select
                    value={selectedEvent}
                    onChange={e => setSelectedEvent(e.target.value)}
                    className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-[#E8DDD0] rounded-lg bg-white text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
                  >
                    <option value="all">All Classes</option>
                    {activeClassOptions.map(ev => <option key={ev} value={ev}>{ev}</option>)}
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
                      <th className="px-4 py-3 text-left font-semibold">Class</th>
                      <th className="px-4 py-3 text-left font-semibold">Venue</th>
                      <th className="px-4 py-3 text-left font-semibold">Date(s)</th>
                      <th className="px-4 py-3 text-left font-semibold">Payment</th>
                      {isAdminOrAbove(userRole) && (
                        <th className="px-4 py-3 text-left font-semibold">Confirm Email</th>
                      )}
                      <th className="px-4 py-3 text-left font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold">Registered</th>
                      <th className="px-4 py-3 text-center font-semibold">Participants</th>
                      {isAdminOrAbove(userRole) && (
                        <th className="px-4 py-3 text-center font-semibold w-16">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E8DE]">
                    {paginated.map(reg => {
                      const isExpanded = expandedId === reg.id;
                      const sessions = reg.session_dates || [];
                      const uniqueEvents = [...new Set(sessions.map(s => s.event_name).filter(Boolean))];
                      // Build a per-class venue map: event_name → first non-null location for that class
                      const venueByClass: Record<string, string | null> = {};
                      sessions.forEach(s => {
                        const key = s.event_name || '';
                        if (key && venueByClass[key] === undefined) {
                          venueByClass[key] = s.location || null;
                        } else if (key && !venueByClass[key] && s.location) {
                          venueByClass[key] = s.location;
                        }
                      });
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
                              {uniqueEvents.length > 0 ? (
                                <div className="space-y-0.5">
                                  {uniqueEvents.map((ev, i) => {
                                    const venue = ev ? venueByClass[ev] : null;
                                    return (
                                      <div key={i} className="text-xs text-[#5C5347] truncate max-w-[160px]" title={venue ?? undefined}>
                                        {venue || '—'}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : <span className="text-[#8C7B6B]">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {sessions.length > 0 ? (
                                <div className="space-y-0.5">
                                  {sessions.slice(0, 2).map((s, i) => (
                                    <div key={i} className="text-xs text-[#5C5347]">
                                      {formatDate(s.event_date)}
                                    </div>
                                  ))}
                                  {sessions.length > 2 && <div className="text-xs text-[#8C7B6B]">+{sessions.length - 2} more</div>}
                                </div>
                              ) : <span className="text-[#8C7B6B]">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-start gap-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex w-fit shrink-0 px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                    {reg.payment_status.replace(/_/g, ' ')}
                                  </span>
                                  <BookingPaymentMethodBadge
                                    paymentMethod={reg.payment_method}
                                    payfastPaymentId={reg.payfast_payment_id}
                                    size="sm"
                                  />
                                </div>
                                {canViewPayfastReceipt(reg) && (
                                  <button
                                    type="button"
                                    onClick={(e) => openReceiptModal(reg, e)}
                                    className="inline-flex items-center gap-1 w-fit px-2 py-0.5 text-[11px] font-semibold rounded-lg border border-[#C4622D]/30 bg-[#FDF6EE] text-[#C4622D] hover:bg-[#F5EFE8] transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    PayFast Receipt
                                  </button>
                                )}
                              </div>
                            </td>
                            {isAdminOrAbove(userRole) && (
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                  {canSendStaffConfirmation(userRole, reg) ? (
                                    <ConfirmationEmailRecipientStatus
                                      customerEmail={reg.email}
                                      infoEmail={correspondenceSettings?.info_email ?? null}
                                      mainAdminEmail={correspondenceSettings?.admin_email ?? null}
                                      storedRecipients={reg.confirmation_email_recipients}
                                      legacySentAt={reg.payfast_confirmation_email_sent_at}
                                      legacyResendId={reg.payfast_confirmation_email_resend_id}
                                    />
                                  ) : (
                                    <span className="text-[#8C7B6B]">—</span>
                                  )}
                                </td>
                            )}
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
                            {isAdminOrAbove(userRole) && (
                              <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                {canSendStaffConfirmation(userRole, reg) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => openSendModal(reg, e)}
                                    disabled={sendingConfirmationId === reg.id}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E8DDD0] bg-white text-[#C4622D] hover:bg-[#FDF6EE] hover:border-[#C4622D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Send confirmation email to registrant and admins"
                                  >
                                    {sendingConfirmationId === reg.id ? (
                                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                      </svg>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-[#C4B8A8]">—</span>
                                )}
                              </td>
                            )}
                          </tr>

                          {/* Expanded participant details */}
                          {isExpanded && (
                            <tr key={`${reg.id}-expanded`} className="bg-[#FDF6EE]">
                              <td colSpan={isAdminOrAbove(userRole) ? 11 : 9} className="p-0">
                                <div className="bg-black px-6 py-4 flex items-center gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white">{reg.title} {reg.first_name} {reg.surname}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{reg.email} · {reg.cellphone}</p>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full border capitalize ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                      {reg.payment_status.replace(/_/g, ' ')}
                                    </span>
                                    <BookingPaymentMethodBadge
                                      paymentMethod={reg.payment_method}
                                      payfastPaymentId={reg.payfast_payment_id}
                                      size="sm"
                                    />
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
                                        Participants ({childCount})
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
                                              <th className="px-3 py-2 text-left font-semibold">Class</th>
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

                                  {canViewPayfastReceipt(reg) && (
                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={(e) => openReceiptModal(reg, e)}
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-[#C4622D] bg-white text-[#C4622D] hover:bg-[#FDF6EE] transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        View PayFast Receipt
                                      </button>
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

      {/* ── PAYFAST RECEIPT MODAL ── */}
      {receiptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeReceiptModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#E8DDD0] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E8DDD0]">
              <div>
                <h3 className="text-base font-bold text-[#1A1612]">PayFast Receipt</h3>
                <p className="text-xs text-[#8C7B6B] mt-0.5">
                  {receiptTarget.title} {receiptTarget.first_name} {receiptTarget.surname}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReceiptModal}
                className="w-8 h-8 rounded-full border border-[#E8DDD0] text-[#8C7B6B] hover:bg-[#FAF5EE] transition-colors"
                aria-label="Close receipt"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5">
              {receiptLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : receiptError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {receiptError}
                </div>
              ) : receiptData ? (
                <div className="rounded-xl overflow-hidden border border-[#E8DDD0]">
                  <div className="bg-[#1A1612] px-5 py-4 text-center">
                    <p className="text-white font-bold text-lg">PayFast</p>
                    <p className="text-[#C4622D] text-xs tracking-widest uppercase mt-1">Payment Receipt</p>
                  </div>
                  <div className="bg-green-50 border-b border-green-200 px-5 py-2.5 text-center">
                    <p className="text-green-700 font-semibold text-sm capitalize">
                      {receiptData.paymentStatus.replace(/_/g, ' ').toLowerCase()}
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-[#8C7B6B]">Payer</p>
                        <p className="font-medium text-[#1A1612]">{receiptData.payerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#8C7B6B]">Payment Date</p>
                        <p className="font-medium text-[#1A1612]">{formatDate(receiptData.paymentDate)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-[#8C7B6B]">Email</p>
                        <p className="font-medium text-[#1A1612]">{receiptData.email}</p>
                      </div>
                      {receiptData.mPaymentId && (
                        <div>
                          <p className="text-xs text-[#8C7B6B]">Payment Reference</p>
                          <p className="font-mono text-xs font-semibold text-[#C4622D]">{receiptData.mPaymentId}</p>
                        </div>
                      )}
                      {receiptData.pfPaymentId && (
                        <div>
                          <p className="text-xs text-[#8C7B6B]">PayFast Transaction ID</p>
                          <p className="font-mono text-xs font-semibold text-[#1A1612]">{receiptData.pfPaymentId}</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#F0E8DE] pt-3">
                      <p className="text-xs text-[#8C7B6B]">Item</p>
                      <p className="font-medium text-[#1A1612]">{receiptData.itemName}</p>
                      {receiptData.itemDescription && (
                        <p className="text-xs text-[#5C5347] mt-1">{receiptData.itemDescription}</p>
                      )}
                    </div>

                    <div className="border-t border-[#F0E8DE] pt-3 space-y-1.5">
                      {receiptData.amountGross && (
                        <div className="flex justify-between">
                          <span className="text-[#5C5347]">Amount</span>
                          <span className="font-semibold text-[#1A1612]">{receiptData.amountGross}</span>
                        </div>
                      )}
                      {receiptData.amountFee && (
                        <div className="flex justify-between text-xs">
                          <span className="text-[#8C7B6B]">PayFast Fee</span>
                          <span className="text-[#5C5347]">{receiptData.amountFee}</span>
                        </div>
                      )}
                      {receiptData.amountNet && (
                        <div className="flex justify-between text-xs">
                          <span className="text-[#8C7B6B]">Net Amount</span>
                          <span className="text-[#5C5347]">{receiptData.amountNet}</span>
                        </div>
                      )}
                    </div>

                    {!receiptData.hasItnData && (
                      <p className="text-[11px] text-[#8C7B6B] border-t border-[#F0E8DE] pt-3">
                        Receipt built from registration data. Full PayFast fee breakdown is available for payments completed after this update.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-[60] max-w-md px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
            toastMessage.type === 'success' ?'bg-green-50 border-green-200 text-green-800' :'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* ── SEND CONFIRMATION EMAIL MODAL ── */}
      {sendTarget && (() => {
        const sendOptions = buildSendRecipientOptions(
          resolveConfirmationRecipients(
            sendTarget.confirmation_email_recipients,
            sendTarget.email,
            correspondenceSettings?.info_email,
            correspondenceSettings?.admin_email,
            sendTarget.payfast_confirmation_email_sent_at,
            sendTarget.payfast_confirmation_email_resend_id
          )
        );
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#E8DDD0] w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E8DDD0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FDF6EE] border border-[#E8C9B0] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1A1612]">Send Confirmation Email</h3>
                  <p className="text-xs text-[#8C7B6B] mt-0.5">Select who should receive this confirmation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSendModal}
                disabled={Boolean(sendingConfirmationId)}
                className="w-8 h-8 rounded-full border border-[#E8DDD0] text-[#8C7B6B] hover:bg-[#FAF5EE] transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-[#FAF5EE] border border-[#E8DDD0] rounded-xl p-3">
                <p className="text-sm font-bold text-[#1A1612]">
                  {sendTarget.title ? `${sendTarget.title} ` : ''}{sendTarget.first_name} {sendTarget.surname}
                </p>
                <p className="text-xs text-[#8C7B6B] mt-0.5">
                  {sendTarget.registration_code ? `Ref: ${sendTarget.registration_code} · ` : ''}
                  {formatCurrency(sendTarget.amount)} · {sendTarget.payment_status.replace(/_/g, ' ')}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wide mb-2">
                  Select recipients
                </p>
                {sendOptions.length > 0 ? (
                  <RecipientCheckboxList
                    options={sendOptions}
                    selected={selectedSendTargets}
                    onChange={setSelectedSendTargets}
                  />
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No recipient emails are configured for this registration.
                  </p>
                )}
              </div>

              {sendError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sendError}</p>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={closeSendModal}
                disabled={Boolean(sendingConfirmationId)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-medium text-[#5C5347] hover:bg-[#FAF5EE] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleSendConfirmation();
                }}
                disabled={Boolean(sendingConfirmationId) || selectedSendTargets.length === 0}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#1A1612] text-white text-sm font-semibold hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingConfirmationId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send to selected ({selectedSendTargets.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

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

      {/* ── DELETE PARTICIPANT MODAL ── */}
      {deleteParticipantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 w-full max-w-md">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-red-100">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1612]">Delete Participant</h3>
                <p className="text-xs text-red-600 font-medium">This action is permanent and cannot be undone</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[#5C5347] mb-3">You are about to permanently delete this participant record only:</p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-sm font-bold text-[#1A1612]">{deleteParticipantTarget.participantName}</p>
                <p className="text-xs text-[#8C8278] mt-0.5">Only this participant will be removed. The registrant and all other participants remain unchanged.</p>
              </div>
              {deleteParticipantError && <p className="text-xs text-red-600 mt-2">{deleteParticipantError}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button type="button" onClick={() => { setDeleteParticipantTarget(null); setDeleteParticipantError(''); }} disabled={deletingParticipant} className="flex-1 px-4 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-medium text-[#5C5347] hover:bg-[#FAF5EE] transition-colors disabled:opacity-50">Cancel</button>
              <button
                type="button"
                onClick={handleDeleteParticipant}
                disabled={deletingParticipant}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletingParticipant ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete Participant</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
