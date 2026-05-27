'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';


interface FormPage1 {
  title: string;
  firstName: string;
  surname: string;
  email: string;
  emailConfirm: string;
  cellphone: string;
  selectedEvents: string[];
  selectedDates: string[];
}

interface FormPage2 {
  relationship: string;
  firstTimePortal: string;
  allergiesIllness: string;
  rsaIdPassport: string;
}

interface ContactPerson {
  title: string;
  firstName: string;
  surname: string;
  cellNo: string;
  relationshipToChild: string;
}

interface FormPage3 {
  contact1: ContactPerson;
  contact2: ContactPerson;
}

interface ChildRow {
  fullName: string;
  dob: string;
  age: string;
  gender: string;
  grade: string;
  dietaryRestrictions: string;
}

interface FormPage4 {
  children: ChildRow[];
  attendSchoolHoliday: string;
}

interface FormPage5 {
  paymentMethod: 'eft' | 'payfast';
  proofFile: File | null;
  proofPreview: string;
}

interface ClassSettings {
  flyer_image_url: string | null;
  flyer_image_path: string | null;
  sheet_id: string | null;
  sheet_name: string | null;
  class_fee: number;
}

interface ClassEvent {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface SessionStatus {
  id: string;
  label: string;
}

interface EventDateRow {
  id: string;
  event_id: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  sort_order: number;
  seating: number | null;
  status_id: string | null;
}

interface BookingCount {
  event_date_id: string;
  count: number;
}

// (1) Updated: added 'Dr', removed 'Other'
const TITLE_OPTIONS = ['Dr', 'Ms', 'Mr', 'Mrs'];
const RELATIONSHIP_OPTIONS = ['Father', 'Mother', 'Grandparent', 'Guardian', 'Au pair', 'Other'];
const RELATIONSHIP_TO_CHILD_OPTIONS = ['Father', 'Mother', 'Grandparent', 'Guardian', 'Au pair', 'Other', 'Sibling', 'Friend'];
const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Lactose Intolerant', 'Peanut Allergy', 'Other'];

const EMPTY_CHILD: ChildRow = { fullName: '', dob: '', age: '', gender: '', grade: '', dietaryRestrictions: '' };
const EMPTY_CONTACT: ContactPerson = { title: '', firstName: '', surname: '', cellNo: '', relationshipToChild: '' };

function formatEventDate(row: EventDateRow): string {
  if (!row.event_date) return '';
  const date = new Date(row.event_date + 'T00:00:00');
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'long' });
  const year = date.getFullYear();

  let timeStr = '';
  if (row.start_time || row.end_time) {
    const fmt = (t: string | null) => {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      const suffix = h >= 12 ? 'pm' : 'am';
      const hour = h % 12 || 12;
      return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`;
    };
    if (row.start_time && row.end_time) {
      timeStr = ` (${fmt(row.start_time)} - ${fmt(row.end_time)})`;
    } else if (row.start_time) {
      timeStr = ` (${fmt(row.start_time)})`;
    }
  }
  return `${day} ${month} ${year}${timeStr}`;
}

export default function CookingClassesPage() {
  const supabase = createClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [settings, setSettings] = useState<ClassSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [paymentLaunched, setPaymentLaunched] = useState(false);

  const [classEvents, setClassEvents] = useState<ClassEvent[]>([]);
  const [eventDates, setEventDates] = useState<EventDateRow[]>([]);
  const [sessionStatuses, setSessionStatuses] = useState<SessionStatus[]>([]);
  const [bookingCounts, setBookingCounts] = useState<BookingCount[]>([]);

  // Collapsible states
  const [importantInfoOpen, setImportantInfoOpen] = useState(true);
  const [emergencyContactOpen, setEmergencyContactOpen] = useState(true);
  const [cookingClassesOpen, setCookingClassesOpen] = useState(true);
  const [collapsedChildren, setCollapsedChildren] = useState<Record<number, boolean>>(
    Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, true]))
  );

  const [page1, setPage1] = useState<FormPage1>({
    title: '',
    firstName: '',
    surname: '',
    email: '',
    emailConfirm: '',
    cellphone: '',
    selectedEvents: [],
    selectedDates: [],
  });

  const [page2, setPage2] = useState<FormPage2>({
    relationship: '',
    firstTimePortal: '',
    allergiesIllness: '',
    rsaIdPassport: '',
  });

  const [page3, setPage3] = useState<FormPage3>({
    contact1: { ...EMPTY_CONTACT },
    contact2: { ...EMPTY_CONTACT },
  });

  const [page4, setPage4] = useState<FormPage4>({
    children: Array.from({ length: 10 }, () => ({ ...EMPTY_CHILD })),
    attendSchoolHoliday: '',
  });

  const [page5, setPage5] = useState<FormPage5>({
    paymentMethod: 'payfast',
    proofFile: null,
    proofPreview: '',
  });

  const [page1Errors, setPage1Errors] = useState<Partial<Record<keyof FormPage1, string>>>({});
  const [page2Errors, setPage2Errors] = useState<Partial<Record<string, string>>>({});
  const [page3Errors, setPage3Errors] = useState<Partial<Record<string, string>>>({});
  const [page4Errors, setPage4Errors] = useState<Partial<Record<string, string>>>({});
  const [page5Errors, setPage5Errors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    loadSettings();
    loadClassEvents();
    loadEventDates();
    loadSessionStatuses();
  }, []);

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const { data } = await supabase
        .from('cooking_class_settings')
        .select('*')
        .limit(1)
        .single();
      if (data) setSettings(data);
    } catch {
      // settings not found, use defaults
    } finally {
      setLoadingSettings(false);
    }
  }

  async function loadClassEvents() {
    try {
      const { data } = await supabase
        .from('cooking_class_events')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (data) setClassEvents(data);
    } catch {
      // ignore
    }
  }

  async function loadSessionStatuses() {
    try {
      const { data } = await supabase
        .from('cooking_class_session_statuses')
        .select('id, label')
        .order('sort_order', { ascending: true });
      if (data) setSessionStatuses(data);
    } catch {
      // ignore
    }
  }

  async function loadEventDates() {
    try {
      const { data } = await supabase
        .from('cooking_class_event_dates')
        .select('*')
        .order('sort_order', { ascending: true });
      if (data) {
        const filtered = data.filter((r: EventDateRow) => r.event_date);
        setEventDates(filtered);
        if (filtered.length > 0) {
          await loadBookingCounts(filtered.map((r: EventDateRow) => r.id));
        }
      }
    } catch {
      // ignore
    }
  }

  async function loadBookingCounts(dateIds: string[]) {
    try {
      const { data } = await supabase
        .from('cooking_class_booking_counts')
        .select('event_date_id')
        .in('event_date_id', dateIds);
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((row: { event_date_id: string }) => {
          counts[row.event_date_id] = (counts[row.event_date_id] || 0) + 1;
        });
        setBookingCounts(
          Object.entries(counts).map(([event_date_id, count]) => ({ event_date_id, count }))
        );
      }
    } catch {
      // ignore
    }
  }

  function getStatusLabel(statusId: string | null): string | null {
    if (!statusId) return null;
    const st = sessionStatuses.find(s => s.id === statusId);
    return st ? st.label : null;
  }

  function getBookingCount(dateId: string): number {
    return bookingCounts.find(b => b.event_date_id === dateId)?.count || 0;
  }

  function getAvailabilityText(row: EventDateRow): { text: string; color: string } {
    const statusLabel = getStatusLabel(row.status_id);
    if (statusLabel && statusLabel.toLowerCase() !== 'active') {
      const colorMap: Record<string, string> = {
        'fully booked': 'text-red-600',
        'cancelled': 'text-red-500',
        'venue change': 'text-amber-600',
      };
      const color = colorMap[statusLabel.toLowerCase()] || 'text-[#8C8278]';
      return { text: statusLabel, color };
    }
    const seating = row.seating || 0;
    if (seating > 0) {
      const booked = getBookingCount(row.id);
      const available = Math.max(0, seating - booked);
      if (available === 0) {
        return { text: 'Fully Booked', color: 'text-red-600' };
      }
      return { text: `${available} seat${available === 1 ? '' : 's'} available`, color: 'text-green-700' };
    }
    if (statusLabel) {
      return { text: statusLabel, color: 'text-[#5C5347]' };
    }
    return { text: '', color: '' };
  }

  function isDateSelectable(row: EventDateRow): boolean {
    const statusLabel = getStatusLabel(row.status_id);
    if (statusLabel) {
      const lower = statusLabel.toLowerCase();
      if (lower === 'cancelled' || lower === 'fully booked') return false;
    }
    const seating = row.seating || 0;
    if (seating > 0) {
      const booked = getBookingCount(row.id);
      if (booked >= seating) return false;
    }
    return true;
  }

  function getFlyerUrl(): string | null {
    if (settings?.flyer_image_url) return settings.flyer_image_url;
    if (settings?.flyer_image_path) {
      const { data } = supabase.storage.from('cooking-class-flyers').getPublicUrl(settings.flyer_image_path);
      return data?.publicUrl || null;
    }
    return null;
  }

  // (7) Get dates filtered by selected events
  function getFilteredDates(): EventDateRow[] {
    if (page1.selectedEvents.length === 0) return [];
    // Find event IDs for selected event names
    const selectedEventIds = classEvents
      .filter(ev => page1.selectedEvents.includes(ev.name))
      .map(ev => ev.id);
    // Show dates that either match a selected event_id, or have no event_id (general dates)
    return eventDates.filter(row => {
      if (!row.event_id) return true; // general dates always show
      return selectedEventIds.includes(row.event_id);
    });
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function validatePage1(): boolean {
    const errors: Partial<Record<keyof FormPage1, string>> = {};
    if (!page1.title) errors.title = 'Please select a title';
    if (!page1.firstName.trim()) errors.firstName = 'First name is required';
    if (!page1.surname.trim()) errors.surname = 'Surname is required';
    if (!page1.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(page1.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!page1.emailConfirm.trim()) {
      errors.emailConfirm = 'Please confirm your email';
    } else if (page1.email !== page1.emailConfirm) {
      errors.emailConfirm = 'Email addresses do not match';
    }
    if (!page1.cellphone.trim()) {
      errors.cellphone = 'Cellphone number is required';
    } else if (!/^[0-9+\s\-()]{7,15}$/.test(page1.cellphone.trim())) {
      errors.cellphone = 'Please enter a valid cellphone/mobile number';
    }
    if (page1.selectedEvents.length === 0) {
      errors.selectedEvents = 'Please select at least one event';
    }
    const filteredDates = getFilteredDates();
    if (filteredDates.length > 0 && page1.selectedDates.length === 0) {
      errors.selectedDates = 'Please select at least one date';
    }
    setPage1Errors(errors);
    return Object.keys(errors).length === 0;
  }

  function validatePage2(): boolean {
    const errors: Record<string, string> = {};
    if (!page2.relationship) errors.relationship = 'Please select your relationship';
    if (!page2.firstTimePortal) errors.firstTimePortal = 'Please answer this question';
    if (!page2.rsaIdPassport.trim()) errors.rsaIdPassport = 'RSA ID / Passport No is required';
    setPage2Errors(errors);
    return Object.keys(errors).length === 0;
  }

  function validatePage3(): boolean {
    const errors: Record<string, string> = {};
    const c1 = page3.contact1;
    if (!c1.firstName.trim()) errors.contact1FirstName = 'First name is required';
    if (!c1.surname.trim()) errors.contact1Surname = 'Surname is required';
    if (!c1.cellNo.trim()) {
      errors.contact1CellNo = 'Cell number is required';
    } else if (!/^[0-9+\s\-()]{7,15}$/.test(c1.cellNo.trim())) {
      errors.contact1CellNo = 'Please enter a valid cellphone number';
    }
    if (!c1.relationshipToChild) errors.contact1Relationship = 'Please select relationship to child';

    // (3) 2nd contact is optional — only validate if any field is filled
    const c2 = page3.contact2;
    const c2HasData = c2.firstName.trim() || c2.surname.trim() || c2.cellNo.trim() || c2.relationshipToChild;
    if (c2HasData) {
      if (!c2.firstName.trim()) errors.contact2FirstName = 'First name is required';
      if (!c2.surname.trim()) errors.contact2Surname = 'Surname is required';
      if (!c2.cellNo.trim()) {
        errors.contact2CellNo = 'Cell number is required';
      } else if (!/^[0-9+\s\-()]{7,15}$/.test(c2.cellNo.trim())) {
        errors.contact2CellNo = 'Please enter a valid cellphone number';
      }
      if (!c2.relationshipToChild) errors.contact2Relationship = 'Please select relationship to child';
    }

    setPage3Errors(errors);
    return Object.keys(errors).length === 0;
  }

  function validatePage4(): boolean {
    const errors: Record<string, string> = {};
    const filledChildren = page4.children.filter(c => c.fullName.trim());
    if (filledChildren.length === 0) errors.children = "Please enter at least one child's details";
    if (!page4.attendSchoolHoliday) errors.attendSchoolHoliday = 'Please answer this question';
    setPage4Errors(errors);
    return Object.keys(errors).length === 0;
  }

  function validatePage5(): boolean {
    const errors: Record<string, string> = {};
    if (page5.paymentMethod === 'eft' && !page5.proofFile) {
      errors.proof = 'Please upload proof of payment for EFT';
    }
    setPage5Errors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function handlePage1Next() {
    if (validatePage1()) {
      setCurrentPage(2);
      window.scrollTo(0, 0);
    }
  }

  function handlePage2Next() {
    if (validatePage2()) {
      setCurrentPage(3);
      window.scrollTo(0, 0);
    }
  }

  function handlePage3Next() {
    if (validatePage3()) {
      setCurrentPage(4);
      window.scrollTo(0, 0);
    }
  }

  function handlePage4Next() {
    if (validatePage4()) {
      setCurrentPage(5);
      window.scrollTo(0, 0);
    }
  }

  function toggleEvent(eventName: string) {
    setPage1(prev => {
      const exists = prev.selectedEvents.includes(eventName);
      const updated = exists
        ? prev.selectedEvents.filter(e => e !== eventName)
        : [...prev.selectedEvents, eventName];
      // Clear selected dates when events change so stale dates are removed
      return { ...prev, selectedEvents: updated, selectedDates: [] };
    });
  }

  function toggleDate(dateLabel: string) {
    setPage1(prev => {
      const exists = prev.selectedDates.includes(dateLabel);
      const updated = exists
        ? prev.selectedDates.filter(d => d !== dateLabel)
        : [...prev.selectedDates, dateLabel];
      return { ...prev, selectedDates: updated };
    });
  }

  function updateChild(index: number, field: keyof ChildRow, value: string) {
    setPage4(prev => {
      const updated = [...prev.children];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, children: updated };
    });
  }

  function updateContact(which: 'contact1' | 'contact2', field: keyof ContactPerson, value: string) {
    setPage3(prev => ({
      ...prev,
      [which]: { ...prev[which], [field]: value },
    }));
  }

  function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPage5(prev => ({ ...prev, proofFile: file }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPage5(prev => ({ ...prev, proofPreview: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  }

  async function recordBookingCounts(regId: string, selectedDateLabels: string[]) {
    try {
      const matchedDateIds = eventDates
        .filter(row => selectedDateLabels.includes(formatEventDate(row)))
        .map(row => row.id);
      if (matchedDateIds.length === 0) return;
      const inserts = matchedDateIds.map(event_date_id => ({
        event_date_id,
        registration_id: regId,
      }));
      await supabase.from('cooking_class_booking_counts').insert(inserts);
    } catch {
      // Non-blocking
    }
  }

  async function handleSubmit() {
    if (!validatePage5()) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      let proofUrl: string | null = null;
      let proofPath: string | null = null;

      if (page5.paymentMethod === 'eft' && page5.proofFile) {
        const ext = page5.proofFile.name.split('.').pop();
        const path = `proof-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('cooking-class-proofs')
          .upload(path, page5.proofFile);
        if (uploadErr) throw new Error('Failed to upload proof of payment');
        proofPath = path;
        proofUrl = null;
      }

      const { data: reg, error: regErr } = await supabase
        .from('cooking_class_registrations')
        .insert({
          title: page1.title,
          first_name: page1.firstName,
          surname: page1.surname,
          email: page1.email,
          cellphone: page1.cellphone,
          selected_events: page1.selectedEvents,
          adult_class_dates: page1.selectedDates,
          payment_method: page5.paymentMethod,
          payment_status: page5.paymentMethod === 'eft' ? 'awaiting_confirmation' : 'pending',
          proof_of_payment_url: proofUrl,
          proof_of_payment_path: proofPath,
          amount: settings?.class_fee || 0,
        })
        .select('id')
        .single();

      if (regErr || !reg) throw new Error(regErr?.message || 'Failed to save registration');
      setRegistrationId(reg.id);

      await recordBookingCounts(reg.id, page1.selectedDates);

      if (page5.paymentMethod === 'eft') {
        await syncToSheet(reg.id);
        setCurrentPage(6);
      } else {
        await initiatePayFast(reg.id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function syncToSheet(regId: string) {
    try {
      await fetch('/api/cooking-classes/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: regId }),
      });
    } catch {
      // Non-blocking
    }
  }

  async function initiatePayFast(regId: string) {
    const amount = settings?.class_fee || 0;
    if (amount <= 0) {
      await supabase
        .from('cooking_class_registrations')
        .update({ payment_status: 'paid' })
        .eq('id', regId);
      await syncToSheet(regId);
      setCurrentPage(6);
      return;
    }

    const res = await fetch('/api/payfast/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: {
          paymentId: `CC-${regId.slice(0, 8).toUpperCase()}`,
          itemName: 'Cooking & Baking Class Registration',
          itemDescription: `${page1.firstName} ${page1.surname} - ${page1.selectedEvents.join(', ')}`,
          amount,
        },
        buyer: {
          firstName: page1.firstName,
          lastName: page1.surname,
          email: page1.email,
          cellNumber: page1.cellphone,
        },
        returnUrl: `${window.location.origin}/cooking-classes/payment-return?id=${regId}&status=success`,
        cancelUrl: `${window.location.origin}/cooking-classes/payment-return?id=${regId}&status=cancel`,
        notifyUrl: `${window.location.origin}/api/cooking-classes/payfast-itn?id=${regId}`,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to initiate payment');

    await supabase
      .from('cooking_class_registrations')
      .update({ payfast_payment_id: data.params.m_payment_id })
      .eq('id', regId);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.gatewayUrl;
    Object.entries(data.params).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    setPaymentLaunched(true);
    form.submit();
  }

  const flyerUrl = getFlyerUrl();

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-[#FAF5EE] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#8C8278] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const totalSteps = 5;
  // (7) Dates filtered by selected events
  const filteredDates = getFilteredDates();

  return (
    <div className="min-h-screen bg-[#FAF5EE]">
      {/* Header */}
      <header className="bg-white border-b border-[#DDD5C8] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/homepage" className="text-[#C4622D] text-sm font-medium hover:underline">
            ← Back to Home
          </Link>
          <h1 className="text-lg font-bold text-[#1A1612]">Cooking &amp; Baking Classes</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        {currentPage < 6 && (
          <div className="flex items-center gap-2 mb-8">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(step => (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  currentPage >= step ? 'bg-[#C4622D] text-white' : 'bg-[#DDD5C8] text-[#8C8278]'
                }`}>
                  {step}
                </div>
                {step < totalSteps && (
                  <div className={`flex-1 h-1 rounded ${currentPage > step ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── PAGE 1 — Personal Details ─────────────────────────────────────── */}
        {currentPage === 1 && (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 shadow-sm">
            {flyerUrl && (
              <div className="mb-6 rounded-xl overflow-hidden">
                <img
                  src={flyerUrl}
                  alt="Cooking and Baking Class flyer showing class details and schedule"
                  className="w-full object-contain max-h-80"
                />
              </div>
            )}

            <h2 className="text-xl font-bold text-[#1A1612] mb-6">Registration Details</h2>

            {/* Full Name */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1A1612] mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  {/* (2) Title dropdown: Dr, Ms, Mr, Mrs — no Other */}
                  <select
                    value={page1.title}
                    onChange={e => setPage1(p => ({ ...p, title: e.target.value }))}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white ${page1Errors.title ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                  >
                    <option value="">Title...</option>
                    {TITLE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <p className="text-xs text-[#8C8278] mt-1">Title</p>
                  {page1Errors.title && <p className="text-xs text-red-500 mt-1">{page1Errors.title}</p>}
                </div>
                <div>
                  <input
                    type="text"
                    value={page1.firstName}
                    onChange={e => setPage1(p => ({ ...p, firstName: e.target.value }))}
                    placeholder=""
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page1Errors.firstName ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                  />
                  <p className="text-xs text-[#8C8278] mt-1">First Name</p>
                  {page1Errors.firstName && <p className="text-xs text-red-500 mt-1">{page1Errors.firstName}</p>}
                </div>
                <div>
                  <input
                    type="text"
                    value={page1.surname}
                    onChange={e => setPage1(p => ({ ...p, surname: e.target.value }))}
                    placeholder=""
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page1Errors.surname ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                  />
                  <p className="text-xs text-[#8C8278] mt-1">Surname</p>
                  {page1Errors.surname && <p className="text-xs text-red-500 mt-1">{page1Errors.surname}</p>}
                </div>
              </div>
            </div>

            {/* Email — (1) confirmation field masked as password */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1A1612] mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={page1.email}
                onChange={e => setPage1(p => ({ ...p, email: e.target.value }))}
                placeholder="Your contactable email address"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] mb-3 ${page1Errors.email ? 'border-red-400' : 'border-[#DDD5C8]'}`}
              />
              {page1Errors.email && <p className="text-xs text-red-500 mb-2">{page1Errors.email}</p>}
              {/* (1) Confirmation field uses type="password" to mask input as asterisks */}
              <input
                type="password"
                autoComplete="off"
                value={page1.emailConfirm}
                onChange={e => setPage1(p => ({ ...p, emailConfirm: e.target.value }))}
                placeholder="Re-enter your email address to confirm"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page1Errors.emailConfirm ? 'border-red-400' : 'border-[#DDD5C8]'}`}
              />
              {page1Errors.emailConfirm && <p className="text-xs text-red-500 mt-1">{page1Errors.emailConfirm}</p>}
              <p className="text-xs text-[#8C8278] mt-1.5">We use your email address for Communication purposes</p>
            </div>

            {/* Cellphone */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1A1612] mb-2">
                Cellphone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={page1.cellphone}
                onChange={e => setPage1(p => ({ ...p, cellphone: e.target.value }))}
                placeholder="(000) 000-0000"
                className={`w-full max-w-xs border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page1Errors.cellphone ? 'border-red-400' : 'border-[#DDD5C8]'}`}
              />
              {page1Errors.cellphone
                ? <p className="text-xs text-red-500 mt-1">{page1Errors.cellphone}</p>
                : <p className="text-xs text-[#8C8278] mt-1">Please enter a valid Cellphone/Mobile number</p>
              }
            </div>

            {/* Select an Event */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1A1612] mb-2">
                Select an Event <span className="text-red-500">*</span>
              </label>
              {classEvents.length === 0 ? (
                <p className="text-xs text-[#8C8278] italic">No events available at this time.</p>
              ) : (
                <div className="space-y-2.5">
                  {classEvents.map(ev => (
                    <label key={ev.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={page1.selectedEvents.includes(ev.name)}
                        onChange={() => toggleEvent(ev.name)}
                        className="w-4 h-4 rounded border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]"
                      />
                      <span className="text-sm text-[#1A1612]">{ev.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {page1Errors.selectedEvents && (
                <p className="text-xs text-red-500 mt-1">{page1Errors.selectedEvents}</p>
              )}
            </div>

            {/* (7) Select Attendance — only show dates for selected events */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1A1612] mb-2">
                Select Attendance <span className="text-red-500">*</span>
              </label>
              {page1.selectedEvents.length === 0 ? (
                <p className="text-xs text-[#8C8278] italic">Please select an event above to see available dates.</p>
              ) : filteredDates.length === 0 ? (
                <p className="text-xs text-[#8C8278] italic">No dates available for the selected event(s).</p>
              ) : (
                <div className="space-y-3">
                  {filteredDates.map(row => {
                    const label = formatEventDate(row);
                    const selectable = isDateSelectable(row);
                    const availability = getAvailabilityText(row);
                    return (
                      <div key={row.id}>
                        <label className={`flex items-center gap-3 ${selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                          <input
                            type="checkbox"
                            checked={page1.selectedDates.includes(label)}
                            onChange={() => selectable && toggleDate(label)}
                            disabled={!selectable}
                            className="w-4 h-4 rounded border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D] disabled:opacity-50"
                          />
                          <span className={`text-sm ${selectable ? 'text-[#1A1612]' : 'text-[#8C8278]'}`}>{label}</span>
                        </label>
                        {availability.text && (
                          <p className={`text-xs mt-0.5 ml-7 font-medium ${availability.color}`}>
                            {availability.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {page1Errors.selectedDates && (
                <p className="text-xs text-red-500 mt-1">{page1Errors.selectedDates}</p>
              )}
            </div>

            <button
              onClick={handlePage1Next}
              className="w-full bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors mt-2"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── PAGE 2 — Relationship & Important Information ─────────────────── */}
        {currentPage === 2 && (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#1A1612] mb-8">Relationship &amp; Important Information</h2>

            {/* Relationship */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-[#1A1612] mb-3">
                Relationship <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {RELATIONSHIP_OPTIONS.map(rel => (
                  <label key={rel} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="relationship"
                      value={rel}
                      checked={page2.relationship === rel}
                      onChange={() => setPage2(p => ({ ...p, relationship: rel }))}
                      className="w-5 h-5 border-2 border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]"
                    />
                    <span className="text-sm text-[#1A1612]">{rel}</span>
                  </label>
                ))}
              </div>
              {page2Errors.relationship && <p className="text-xs text-red-500 mt-2">{page2Errors.relationship}</p>}
            </div>

            {/* First Time using portal */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-[#1A1612] mb-3">
                First Time using this online Registration Portal ? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-x-8">
                {['Yes', 'No'].map(opt => (
                  <label key={opt} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="firstTimePortal"
                      value={opt}
                      checked={page2.firstTimePortal === opt}
                      onChange={() => setPage2(p => ({ ...p, firstTimePortal: opt }))}
                      className="w-5 h-5 border-2 border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]"
                    />
                    <span className="text-sm text-[#1A1612]">{opt}</span>
                  </label>
                ))}
              </div>
              {page2Errors.firstTimePortal && <p className="text-xs text-red-500 mt-2">{page2Errors.firstTimePortal}</p>}
            </div>

            {/* Important Information collapsible */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setImportantInfoOpen(o => !o)}
                className="w-full flex items-center justify-between bg-[#4A4540] text-white px-5 py-4 rounded-xl font-medium text-sm"
              >
                <span>Important Information</span>
                <svg
                  className={`w-6 h-6 transition-transform ${importantInfoOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {importantInfoOpen && (
                <div className="pt-6">
                  {/* Allergies / illness */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#1A1612] mb-2">
                      Details of any allergies or known illness
                    </label>
                    <input
                      type="text"
                      value={page2.allergiesIllness}
                      onChange={e => setPage2(p => ({ ...p, allergiesIllness: e.target.value }))}
                      className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D]"
                    />
                    <p className="text-xs text-[#8C8278] mt-1.5">List any information about the attendee that might impact their well-being</p>
                  </div>

                  {/* RSA ID / Passport No */}
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-[#1A1612] mb-2">
                      RSA ID / Passport No <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={page2.rsaIdPassport}
                      onChange={e => setPage2(p => ({ ...p, rsaIdPassport: e.target.value }))}
                      placeholder="Your RSA Id no or other form of Identification"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page2Errors.rsaIdPassport ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                    />
                    <p className="text-xs text-[#8C8278] mt-1.5">South African resident must enter their 13-DIGIT ID NUMBER</p>
                    {page2Errors.rsaIdPassport && <p className="text-xs text-red-500 mt-1">{page2Errors.rsaIdPassport}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setCurrentPage(1); window.scrollTo(0, 0); }}
                className="flex-1 border border-[#DDD5C8] text-[#5C5347] py-3 rounded-xl font-semibold text-sm hover:bg-[#FAF5EE] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handlePage2Next}
                className="flex-1 bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── PAGE 3 — Emergency Contact Details ───────────────────────────── */}
        {currentPage === 3 && (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setEmergencyContactOpen(o => !o)}
              className="w-full flex items-center justify-between bg-[#4A4540] text-white px-5 py-4 rounded-xl font-medium text-sm mb-6"
            >
              <span>Emergency Contact Details</span>
              <svg
                className={`w-6 h-6 transition-transform ${emergencyContactOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {emergencyContactOpen && (
              <div>
                {/* 1st Contact */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-[#1A1612] pb-2 border-b border-[#EDE7DA] mb-4">
                    Provide the Details of the 1st Contact person
                  </h3>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#1A1612] mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        {/* (2) Title as dropdown for contact1 */}
                        <select
                          value={page3.contact1.title}
                          onChange={e => updateContact('contact1', 'title', e.target.value)}
                          className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                        >
                          <option value="">Title...</option>
                          {TITLE_OPTIONS.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <p className="text-xs text-[#8C8278] mt-1">Title</p>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={page3.contact1.firstName}
                          onChange={e => updateContact('contact1', 'firstName', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page3Errors.contact1FirstName ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                        />
                        <p className="text-xs text-[#8C8278] mt-1">First Name</p>
                        {page3Errors.contact1FirstName && <p className="text-xs text-red-500 mt-1">{page3Errors.contact1FirstName}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={page3.contact1.surname}
                          onChange={e => updateContact('contact1', 'surname', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page3Errors.contact1Surname ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                        />
                        <p className="text-xs text-[#8C8278] mt-1">Surname</p>
                        {page3Errors.contact1Surname && <p className="text-xs text-red-500 mt-1">{page3Errors.contact1Surname}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1A1612] mb-2">
                        Cell no <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={page3.contact1.cellNo}
                        onChange={e => updateContact('contact1', 'cellNo', e.target.value)}
                        placeholder="(000) 000-0000"
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page3Errors.contact1CellNo ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                      />
                      {page3Errors.contact1CellNo
                        ? <p className="text-xs text-red-500 mt-1">{page3Errors.contact1CellNo}</p>
                        : <p className="text-xs text-[#8C8278] mt-1">Please enter a valid cellphone number</p>
                      }
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1612] mb-2">
                        Relationship to child <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={page3.contact1.relationshipToChild}
                        onChange={e => updateContact('contact1', 'relationshipToChild', e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white ${page3Errors.contact1Relationship ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                      >
                        <option value="">Please Select</option>
                        {RELATIONSHIP_TO_CHILD_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {page3Errors.contact1Relationship && <p className="text-xs text-red-500 mt-1">{page3Errors.contact1Relationship}</p>}
                    </div>
                  </div>
                </div>

                {/* (3) 2nd Contact — optional */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-[#1A1612] pb-2 border-b border-[#EDE7DA] mb-1">
                    Provide the Details of a 2nd Contact person
                  </h3>
                  <p className="text-xs text-[#8C8278] mb-4">Optional — leave blank if not applicable</p>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#1A1612] mb-2">
                      Full Name
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        {/* (2) Title as dropdown for contact2 */}
                        <select
                          value={page3.contact2.title}
                          onChange={e => updateContact('contact2', 'title', e.target.value)}
                          className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                        >
                          <option value="">Title...</option>
                          {TITLE_OPTIONS.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <p className="text-xs text-[#8C8278] mt-1">Title</p>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={page3.contact2.firstName}
                          onChange={e => updateContact('contact2', 'firstName', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page3Errors.contact2FirstName ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                        />
                        <p className="text-xs text-[#8C8278] mt-1">First Name</p>
                        {page3Errors.contact2FirstName && <p className="text-xs text-red-500 mt-1">{page3Errors.contact2FirstName}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={page3.contact2.surname}
                          onChange={e => updateContact('contact2', 'surname', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page3Errors.contact2Surname ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                        />
                        <p className="text-xs text-[#8C8278] mt-1">Surname</p>
                        {page3Errors.contact2Surname && <p className="text-xs text-red-500 mt-1">{page3Errors.contact2Surname}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#1A1612] mb-2">
                        Cell no
                      </label>
                      <input
                        type="tel"
                        value={page3.contact2.cellNo}
                        onChange={e => updateContact('contact2', 'cellNo', e.target.value)}
                        placeholder="(000) 000-0000"
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page3Errors.contact2CellNo ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                      />
                      {page3Errors.contact2CellNo
                        ? <p className="text-xs text-red-500 mt-1">{page3Errors.contact2CellNo}</p>
                        : <p className="text-xs text-[#8C8278] mt-1">Please enter a valid cellphone number</p>
                      }
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1A1612] mb-2">
                        Relationship to child
                      </label>
                      <select
                        value={page3.contact2.relationshipToChild}
                        onChange={e => updateContact('contact2', 'relationshipToChild', e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white ${page3Errors.contact2Relationship ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                      >
                        <option value="">Please Select</option>
                        {RELATIONSHIP_TO_CHILD_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {page3Errors.contact2Relationship && <p className="text-xs text-red-500 mt-1">{page3Errors.contact2Relationship}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setCurrentPage(2); window.scrollTo(0, 0); }}
                className="flex-1 border border-[#DDD5C8] text-[#5C5347] py-3 rounded-xl font-semibold text-sm hover:bg-[#FAF5EE] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handlePage3Next}
                className="flex-1 bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── PAGE 4 — Register to attend Cooking Classes ───────────────────── */}
        {currentPage === 4 && (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setCookingClassesOpen(o => !o)}
              className="w-full flex items-center justify-between bg-[#4A4540] text-white px-5 py-4 rounded-xl font-medium text-sm mb-6"
            >
              <span>Participant to attend the Event on offer</span>
              <svg
                className={`w-6 h-6 transition-transform ${cookingClassesOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {cookingClassesOpen && (
              <div>
                <p className="text-sm font-medium text-[#1A1612] mb-4">
                  Register <span className="text-red-500">*</span>
                </p>
                {page4Errors.children && <p className="text-xs text-red-500 mb-3">{page4Errors.children}</p>}

                {/* Child cards — each collapsible */}
                <div className="space-y-3 mb-6">
                  {page4.children.map((child, idx) => {
                    const isOpen = !collapsedChildren[idx];
                    return (
                      <div key={idx} className="border border-[#DDD5C8] rounded-xl overflow-hidden">
                        {/* Card header */}
                        <button
                          type="button"
                          onClick={() => setCollapsedChildren(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          className="w-full flex items-center justify-between px-4 py-3 bg-[#F5F0E8] hover:bg-[#EDE7DA] transition-colors"
                        >
                          <span className="text-sm font-semibold text-[#1A1612]">Child ({idx + 1})</span>
                          <svg
                            className={`w-4 h-4 text-[#8C8278] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Card body */}
                        {isOpen && (
                          <div className="px-4 py-4 space-y-3">
                            {/* Row 1: Full Name + DOB */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-[#5C5347] mb-1">Full Name</label>
                                <input
                                  type="text"
                                  value={child.fullName}
                                  onChange={e => updateChild(idx, 'fullName', e.target.value)}
                                  className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-[#5C5347] mb-1">DOB</label>
                                <input
                                  type="date"
                                  value={child.dob}
                                  onChange={e => updateChild(idx, 'dob', e.target.value)}
                                  className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                                />
                              </div>
                            </div>
                            {/* Row 2: Age + Gender + Grade */}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-[#5C5347] mb-1">Age</label>
                                <input
                                  type="text"
                                  value={child.age}
                                  onChange={e => updateChild(idx, 'age', e.target.value)}
                                  className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-[#5C5347] mb-1">Gender</label>
                                <select
                                  value={child.gender}
                                  onChange={e => updateChild(idx, 'gender', e.target.value)}
                                  className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                                >
                                  <option value="">Select...</option>
                                  <option value="Female">Female</option>
                                  <option value="Male">Male</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-[#5C5347] mb-1">Grade</label>
                                <input
                                  type="text"
                                  value={child.grade}
                                  onChange={e => updateChild(idx, 'grade', e.target.value)}
                                  className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                                />
                              </div>
                            </div>
                            {/* Row 3: Dietary Restrictions */}
                            <div>
                              <label className="block text-xs font-medium text-[#5C5347] mb-1">Dietary Restrictions</label>
                              <select
                                value={child.dietaryRestrictions}
                                onChange={e => updateChild(idx, 'dietaryRestrictions', e.target.value)}
                                className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                              >
                                <option value="">Select...</option>
                                {DIETARY_OPTIONS.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Attend School Holiday programme */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[#8C8278] mb-3">
                    Attend our School Holiday programme <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-x-8">
                    {['Yes', 'No'].map(opt => (
                      <label key={opt} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="attendSchoolHoliday"
                          value={opt}
                          checked={page4.attendSchoolHoliday === opt}
                          onChange={() => setPage4(p => ({ ...p, attendSchoolHoliday: opt }))}
                          className="w-5 h-5 border-2 border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]"
                        />
                        <span className="text-sm text-[#1A1612]">{opt}</span>
                      </label>
                    ))}
                  </div>
                  {page4Errors.attendSchoolHoliday && <p className="text-xs text-red-500 mt-2">{page4Errors.attendSchoolHoliday}</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setCurrentPage(3); window.scrollTo(0, 0); }}
                className="flex-1 border border-[#DDD5C8] text-[#5C5347] py-3 rounded-xl font-semibold text-sm hover:bg-[#FAF5EE] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handlePage4Next}
                className="flex-1 bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
              >
                Continue to Payment →
              </button>
            </div>
          </div>
        )}

        {/* ── PAGE 5 — Payment ─────────────────────────────────────────────── */}
        {currentPage === 5 && (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#1A1612] mb-2">Payment</h2>
            {settings?.class_fee && settings.class_fee > 0 && (
              <p className="text-sm text-[#5C5347] mb-6">
                Registration fee: <span className="font-bold text-[#C4622D]">R{settings.class_fee.toFixed(2)}</span>
              </p>
            )}

            {/* Summary */}
            <div className="bg-[#FAF5EE] rounded-xl p-4 mb-6 text-sm">
              <p className="font-semibold text-[#1A1612] mb-1">{page1.title} {page1.firstName} {page1.surname}</p>
              <p className="text-[#5C5347]">{page1.email}</p>
              <p className="text-[#5C5347]">{page1.cellphone}</p>
              {page1.selectedEvents.length > 0 && (
                <p className="text-[#5C5347] mt-1">Events: {page1.selectedEvents.join(', ')}</p>
              )}
              {page1.selectedDates.length > 0 && (
                <p className="text-[#5C5347]">Dates: {page1.selectedDates.join(', ')}</p>
              )}
            </div>

            <h3 className="text-sm font-semibold text-[#1A1612] mb-3">Select Payment Method</h3>

            <div className="space-y-3 mb-6">
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${page5.paymentMethod === 'payfast' ? 'border-[#C4622D] bg-[#FDF6EE]' : 'border-[#DDD5C8] hover:border-[#C4622D]/50'}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="payfast"
                  checked={page5.paymentMethod === 'payfast'}
                  onChange={() => setPage5(p => ({ ...p, paymentMethod: 'payfast', proofFile: null, proofPreview: '' }))}
                  className="mt-0.5 text-[#C4622D]"
                />
                <div>
                  <p className="text-sm font-semibold text-[#1A1612]">Pay Online via PayFast</p>
                  <p className="text-xs text-[#8C8278] mt-0.5">Secure online payment — card, EFT, or SnapScan</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${page5.paymentMethod === 'eft' ? 'border-[#C4622D] bg-[#FDF6EE]' : 'border-[#DDD5C8] hover:border-[#C4622D]/50'}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="eft"
                  checked={page5.paymentMethod === 'eft'}
                  onChange={() => setPage5(p => ({ ...p, paymentMethod: 'eft' }))}
                  className="mt-0.5 text-[#C4622D]"
                />
                <div>
                  <p className="text-sm font-semibold text-[#1A1612]">EFT Pre-payment</p>
                  <p className="text-xs text-[#8C8278] mt-0.5">Upload your proof of payment — confirmed by our accounts team</p>
                </div>
              </label>
            </div>

            {/* EFT proof upload */}
            {page5.paymentMethod === 'eft' && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-[#1A1612] mb-2">
                  Upload Proof of Payment <span className="text-red-500">*</span>
                </label>
                <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${page5Errors.proof ? 'border-red-400' : 'border-[#DDD5C8] hover:border-[#C4622D]/50'}`}>
                  {page5.proofPreview ? (
                    <div>
                      {page5.proofFile?.type?.startsWith('image/') ? (
                        <img src={page5.proofPreview} alt="Proof of payment preview" className="max-h-40 mx-auto rounded-lg mb-3 object-contain" />
                      ) : (
                        <div className="text-4xl mb-3">📄</div>
                      )}
                      <p className="text-sm text-[#5C5347] font-medium">{page5.proofFile?.name}</p>
                      <button
                        onClick={() => setPage5(p => ({ ...p, proofFile: null, proofPreview: '' }))}
                        className="text-xs text-red-500 hover:underline mt-1"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl mb-2">📎</div>
                      <p className="text-sm text-[#5C5347] mb-1">Click to upload proof of payment</p>
                      <p className="text-xs text-[#8C8278]">JPG, PNG, PDF accepted</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleProofUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  />
                </div>
                {page5Errors.proof && <p className="text-xs text-red-500 mt-1">{page5Errors.proof}</p>}
              </div>
            )}

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setCurrentPage(4); window.scrollTo(0, 0); }}
                className="flex-1 border border-[#DDD5C8] text-[#5C5347] py-3 rounded-xl font-semibold text-sm hover:bg-[#FAF5EE] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || paymentLaunched}
                className="flex-1 bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Processing...' : page5.paymentMethod === 'payfast' ? 'Pay Now →' : 'Submit Registration →'}
              </button>
            </div>
          </div>
        )}

        {/* ── PAGE 6 — Success ─────────────────────────────────────────────── */}
        {currentPage === 6 && (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A1612] mb-2">Registration Submitted!</h2>
            {page5.paymentMethod === 'eft' ? (
              <p className="text-sm text-[#5C5347] mb-6">
                Thank you, {page1.title} {page1.firstName}! Your registration has been received. Our accounts team will confirm your EFT payment and you will be notified by email.
              </p>
            ) : (
              <p className="text-sm text-[#5C5347] mb-6">
                Thank you, {page1.title} {page1.firstName}! Your registration and payment have been received. You will receive a confirmation email shortly.
              </p>
            )}
            <Link
              href="/homepage"
              className="inline-block bg-[#C4622D] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
            >
              Back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
