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
  medicalDoctorFirstName: string;
  medicalDoctorSurname: string;
  medicalAidName: string;
  medicalAidNumber: string;
}

interface ChildRow {
  fullName: string;
  dob: string;
  age: string;
  gender: string;
  grade: string;
  dietaryRestrictions: string;
  picturesTaken: string;
  indemnityConsent: boolean;
}

interface FormPage4 {
  children: ChildRow[];
  attendSchoolHoliday: string;
  hasIndemnityForm: string;
  indemnityFile: File | null;
  indemnityFilePreview: string;
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
  online_form_status: string | null;
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
  class_fee: number | null;
}

interface BookingCount {
  event_date_id: string;
  count: number;
}

// (1) Updated: added 'Dr', removed 'Other'
const TITLE_OPTIONS = ['Dr', 'Ms', 'Mr', 'Mrs'];
const RELATIONSHIP_OPTIONS = ['Father', 'Mother', 'Grandparent', 'Guardian', 'Au pair'];
const RELATIONSHIP_TO_CHILD_OPTIONS = ['Father', 'Mother', 'Grandparent', 'Guardian', 'Au pair', 'Sibling', 'Friend'];
const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Lactose Intolerant', 'Peanut Allergy'];

const EMPTY_CHILD: ChildRow = { fullName: '', dob: '', age: '', gender: '', grade: '', dietaryRestrictions: '', picturesTaken: '', indemnityConsent: false };
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

// Calculate age in years from DOB string
function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
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
  // (NEW) Popup when selected event has no dates configured
  const [showNoDatesPopup, setShowNoDatesPopup] = useState(false);

  const [classEvents, setClassEvents] = useState<ClassEvent[]>([]);
  const [eventDates, setEventDates] = useState<EventDateRow[]>([]);
  const [sessionStatuses, setSessionStatuses] = useState<SessionStatus[]>([]);
  const [bookingCounts, setBookingCounts] = useState<BookingCount[]>([]);

  // Collapsible states
  const [importantInfoOpen, setImportantInfoOpen] = useState(false);
  const [emergencyContactOpen, setEmergencyContactOpen] = useState(true);
  const [medicalDetailsOpen, setMedicalDetailsOpen] = useState(false);
  const [cookingClassesOpen, setCookingClassesOpen] = useState(true);
  const [collapsedChildren, setCollapsedChildren] = useState<Record<number, boolean>>({ 0: false });

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
    medicalDoctorFirstName: '',
    medicalDoctorSurname: '',
    medicalAidName: '',
    medicalAidNumber: '',
  });

  const [page4, setPage4] = useState<FormPage4>({
    children: [{ ...EMPTY_CHILD }],
    attendSchoolHoliday: '',
    hasIndemnityForm: '',
    indemnityFile: null,
    indemnityFilePreview: '',
  });

  const [page5, setPage5] = useState<FormPage5>({
    paymentMethod: 'eft',
    proofFile: null,
    proofPreview: '',
  });

  const [page1Errors, setPage1Errors] = useState<Partial<Record<keyof FormPage1, string>>>({});
  const [page2Errors, setPage2Errors] = useState<Partial<Record<string, string>>>({});
  const [page3Errors, setPage3Errors] = useState<Partial<Record<string, string>>>({});
  const [page4Errors, setPage4Errors] = useState<Partial<Record<string, string>>>({});
  const [page5Errors, setPage5Errors] = useState<Partial<Record<string, string>>>({});

  // (NEW) Seats limit popup
  const [showSeatsFullPopup, setShowSeatsFullPopup] = useState(false);
  // (NEW) Limited seats warning — shown once per booking session when seats < 10
  const [showLimitedSeatsWarning, setShowLimitedSeatsWarning] = useState(false);
  const [limitedSeatsWarningShown, setLimitedSeatsWarningShown] = useState(false);

  useEffect(() => {
    loadSettings();
    loadClassEvents();
    loadEventDates();
    loadSessionStatuses();
  }, []);

  // Auto-show popup when selected event has no dates
  useEffect(() => {
    if (page1.selectedEvents.length === 0) return;
    const selectedEventIds = classEvents
      .filter(ev => page1.selectedEvents.includes(ev.name))
      .map(ev => ev.id);
    const datesForSelected = eventDates.filter(row => row.event_id && selectedEventIds.includes(row.event_id));
    if (datesForSelected.length === 0) {
      setShowNoDatesPopup(true);
    }
  }, [page1.selectedEvents, eventDates, classEvents]);

  // (NEW) When firstTimePortal changes, auto-expand/collapse Important Info and Medical Details
  useEffect(() => {
    if (page2.firstTimePortal === 'No') {
      // First Time = No: Passport/ID optional, skip to Page 4 — collapse all info cards
      setImportantInfoOpen(false);
      setMedicalDetailsOpen(false);
    } else if (page2.firstTimePortal === 'Yes') {
      // First Time = Yes: open all card views on Page 2 and Page 3
      setImportantInfoOpen(true);
      setMedicalDetailsOpen(true);
    }
  }, [page2.firstTimePortal]);

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const { data } = await supabase
        .from('cooking_class_settings')
        .select('*')
        .limit(1)
        .single();
      if (data) {
        setSettings(data);
      }
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

  // Get dates filtered by selected events
  function getFilteredDates(): EventDateRow[] {
    if (page1.selectedEvents.length === 0) return [];
    const selectedEventIds = classEvents
      .filter(ev => page1.selectedEvents.includes(ev.name))
      .map(ev => ev.id);
    return eventDates.filter(row => {
      if (!row.event_id) return false;
      return selectedEventIds.includes(row.event_id);
    });
  }

  // (6) Get the class_fee from the first matching event date for selected events
  function getEventClassFee(): number {
    // First, try to match against the specifically selected date labels
    if (page1.selectedDates.length > 0) {
      const matchedRows = eventDates.filter(row => page1.selectedDates.includes(formatEventDate(row)));
      for (const row of matchedRows) {
        if (row.class_fee != null && row.class_fee > 0) return row.class_fee;
      }
    }
    // Fallback: any date for the selected event
    const filtered = getFilteredDates();
    for (const row of filtered) {
      if (row.class_fee != null && row.class_fee > 0) return row.class_fee;
    }
    // Final fallback to settings class_fee
    return settings?.class_fee || 0;
  }

  // Get per-session breakdown: one entry per selected date
  function getSessionBreakdown(): { dateLabel: string; fee: number; participants: number; amount: number }[] {
    const count = getParticipantCount();
    if (page1.selectedDates.length === 0) return [];
    return page1.selectedDates.map(dateLabel => {
      const row = eventDates.find(r => formatEventDate(r) === dateLabel);
      let fee = 0;
      if (row && row.class_fee != null && row.class_fee > 0) {
        fee = row.class_fee;
      } else {
        fee = settings?.class_fee || 0;
      }
      return { dateLabel, fee, participants: count, amount: fee * count };
    });
  }

  // (6) Count filled participants
  function getParticipantCount(): number {
    return page4.children.filter(c => c.fullName.trim()).length;
  }

  // (6) Amount due = sum of all session amounts
  function getAmountDue(): number {
    const breakdown = getSessionBreakdown();
    if (breakdown.length > 0) {
      const total = breakdown.reduce((sum, s) => sum + s.amount, 0);
      if (total > 0) return total;
    }
    let fee = getEventClassFee();
    const count = getParticipantCount();
    if (fee > 0 && count > 0) return fee * count;
    return settings?.class_fee || 0;
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
    // RSA ID / Passport is optional if First Time = No
    if (page2.firstTimePortal !== 'No' && !page2.rsaIdPassport.trim()) errors.rsaIdPassport = 'RSA ID / Passport No is required';
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

    // (4) If child name entered, DOB/Gender/Dietary are mandatory
    page4.children.forEach((child, idx) => {
      if (child.fullName.trim()) {
        if (!child.dob) errors[`child_${idx}_dob`] = 'DOB is required';
        if (!child.gender) errors[`child_${idx}_gender`] = 'Gender is required';
        if (!child.dietaryRestrictions) errors[`child_${idx}_dietary`] = 'Dietary info is required';
        // (5) Age validation
        if (child.dob) {
          let age = calculateAge(child.dob);
          if (age !== null && age < 5) errors[`child_${idx}_age`] = 'Minimum participant age is 5';
          if (age !== null && age > 16) errors[`child_${idx}_age`] = 'Maximum participant age is 16';
        }
        if (!child.picturesTaken) errors[`child_${idx}_pictures`] = 'Please indicate your photo consent';
        if (!child.indemnityConsent) errors[`child_${idx}_indemnity`] = 'Please consent to the Indemnity Form clauses';
      }
    });

    // School Holiday is now optional — no validation required
    if (!page4.hasIndemnityForm) errors.hasIndemnityForm = 'Please indicate if you have a Signed Indemnity Form';
    if (page4.hasIndemnityForm === 'Yes' && !page4.indemnityFile) errors.indemnityFile = 'Please upload your signed Indemnity Form';
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
      // If First Time = No, skip directly to page 4
      if (page2.firstTimePortal === 'No') {
        setCurrentPage(4);
      } else {
        setCurrentPage(3);
      }
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

  // (1) Only one event can be selected at a time — radio behaviour
  function selectEvent(eventName: string) {
    setPage1(prev => {
      const alreadySelected = prev.selectedEvents.length === 1 && prev.selectedEvents[0] === eventName;
      const updated = alreadySelected ? [] : [eventName];
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

  // (5) Update child and auto-calculate age from DOB
  function updateChild(index: number, field: keyof ChildRow, value: string | boolean) {
    setPage4(prev => {
      const updated = [...prev.children];
      const updatedChild = { ...updated[index], [field]: value };
      // Auto-calculate age when DOB changes
      if (field === 'dob' && typeof value === 'string') {
        let age = calculateAge(value);
        updatedChild.age = age !== null ? String(age) : '';
      }
      updated[index] = updatedChild;
      return { ...prev, children: updated };
    });
  }

  function isLastChildComplete(): boolean {
    const last = page4.children[page4.children.length - 1];
    if (!last) return true;
    return (
      last.fullName.trim() !== '' &&
      last.dob !== '' &&
      last.gender !== '' &&
      last.dietaryRestrictions !== '' &&
      last.picturesTaken !== '' &&
      last.indemnityConsent === true
    );
  }

  function addChild() {
    setPage4(prev => {
      if (prev.children.length >= 10) return prev;
      const newIdx = prev.children.length;
      setCollapsedChildren(c => ({ ...c, [newIdx]: false }));
      return { ...prev, children: [...prev.children, { ...EMPTY_CHILD }] };
    });
  }

  function removeChild(index: number) {
    setPage4(prev => {
      if (index === 0) return prev; // Child 1 cannot be removed
      const updated = prev.children.filter((_, i) => i !== index);
      // Rebuild collapsedChildren map
      setCollapsedChildren(prev => {
        const rebuilt: Record<number, boolean> = {};
        updated.forEach((_, i) => {
          rebuilt[i] = i < index ? (prev[i] ?? true) : (prev[i + 1] ?? true);
        });
        return rebuilt;
      });
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

  function handleIndemnityUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPage4(prev => ({ ...prev, indemnityFile: file }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPage4(prev => ({ ...prev, indemnityFilePreview: ev.target?.result as string }));
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
      // ── Upload indemnity file to Google Drive ──────────────────────────────
      let indemnityFileUrl: string | null = null;
      if (page4.indemnityFile) {
        const indemnityForm = new FormData();
        indemnityForm.append('file', page4.indemnityFile);
        indemnityForm.append(
          'fileName',
          `Indemnity_${page1.firstName}_${page1.surname}_${Date.now()}.${page4.indemnityFile.name.split('.').pop()}`
        );
        const driveRes = await fetch('/api/cooking-classes/upload-to-drive', {
          method: 'POST',
          body: indemnityForm,
        });
        if (driveRes.ok) {
          const driveData = await driveRes.json();
          indemnityFileUrl = driveData.viewUrl || null;
        }
      }

      // ── Upload proof of payment to Google Drive (EFT only) ────────────────
      let proofDriveUrl: string | null = null;
      let proofSupabaseUrl: string | null = null;
      if (page5.paymentMethod === 'eft' && page5.proofFile) {
        // Primary: upload to Supabase storage (reliable, no OAuth dependency)
        try {
          const fileExt = page5.proofFile.name.split('.').pop();
          const storagePath = `proofs/${page1.firstName}_${page1.surname}_${Date.now()}.${fileExt}`;
          const { data: storageData, error: storageError } = await supabase.storage
            .from('cooking-class-proofs')
            .upload(storagePath, page5.proofFile, { upsert: false });
          if (!storageError && storageData) {
            const { data: publicUrlData } = supabase.storage
              .from('cooking-class-proofs')
              .getPublicUrl(storageData.path);
            proofSupabaseUrl = publicUrlData?.publicUrl || null;
          }
        } catch {
          // Non-blocking — continue even if Supabase storage fails
        }

        // Secondary: attempt Google Drive upload (non-blocking)
        try {
          const proofForm = new FormData();
          proofForm.append('file', page5.proofFile);
          proofForm.append(
            'fileName',
            `ProofOfPayment_${page1.firstName}_${page1.surname}_${Date.now()}.${page5.proofFile.name.split('.').pop()}`
          );
          const driveRes = await fetch('/api/cooking-classes/upload-to-drive', {
            method: 'POST',
            body: proofForm,
          });
          if (driveRes.ok) {
            const driveData = await driveRes.json();
            proofDriveUrl = driveData.viewUrl || null;
          }
        } catch {
          // Non-blocking — Drive upload failure does not block registration
        }
      }

      // (6) Use calculated amount due
      const amountDue = getAmountDue();

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
          // Page 2 — Relationship & Important Information
          relationship: page2.relationship,
          first_time_portal: page2.firstTimePortal,
          allergies_illness: page2.allergiesIllness,
          rsa_id_passport: page2.rsaIdPassport,
          // Page 3 — Emergency Contacts
          emergency_contact1: {
            title: page3.contact1.title,
            firstName: page3.contact1.firstName,
            surname: page3.contact1.surname,
            cellNo: page3.contact1.cellNo,
            relationshipToChild: page3.contact1.relationshipToChild,
          },
          emergency_contact2: {
            title: page3.contact2.title,
            firstName: page3.contact2.firstName,
            surname: page3.contact2.surname,
            cellNo: page3.contact2.cellNo,
            relationshipToChild: page3.contact2.relationshipToChild,
          },
          // Page 3 — Medical Details
          medical_doctor_first_name: page3.medicalDoctorFirstName,
          medical_doctor_surname: page3.medicalDoctorSurname,
          medical_aid_name: page3.medicalAidName,
          medical_aid_number: page3.medicalAidNumber,
          // Page 4 — Children & School Holiday
          children: page4.children
            .filter(c => c.fullName.trim().length > 0)
            .map(c => ({
              fullName: c.fullName,
              dob: c.dob,
              age: c.dob ? String(calculateAge(c.dob) ?? '') : c.age,
              gender: c.gender,
              grade: c.grade,
              dietaryRestrictions: c.dietaryRestrictions,
              picturesTaken: c.picturesTaken,
              indemnityConsent: c.indemnityConsent,
            })),
          attend_school_holiday: page4.attendSchoolHoliday,
          pictures_taken: page4.children.filter(c => c.fullName.trim()).map(c => c.picturesTaken).join(', '),
          indemnity_consent: page4.children.filter(c => c.fullName.trim()).every(c => c.indemnityConsent),
          indemnity_file_url: indemnityFileUrl,
          // Page 5 — Payment
          payment_method: page5.paymentMethod,
          payment_status: page5.paymentMethod === 'eft' ? 'awaiting_confirmation' : 'pending',
          proof_of_payment_url: proofSupabaseUrl,
          proof_of_payment_path: null,
          proof_of_payment_drive_url: proofDriveUrl,
          amount: amountDue,
        })
        .select('id')
        .single();

      if (regErr || !reg) throw new Error(regErr?.message || 'Failed to save registration');
      setRegistrationId(reg.id);

      await recordBookingCounts(reg.id, page1.selectedDates);

      if (page5.paymentMethod === 'eft') {
        // ── TEMPORARILY DISABLED — Google Sheets sync deactivated until further notice ──
        // await syncToSheet(reg.id);
        // ── END DISABLE BLOCK ─────────────────────────────────────────────
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
    // ── TEMPORARILY DISABLED — Google Sheets sync deactivated until further notice ──
    // All attributes and logic preserved below for re-activation.
    // try {
    //   await fetch('/api/cooking-classes/sync-sheet', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ registrationId: regId }),
    //   });
    // } catch {
    //   // Non-blocking
    // }
    // ── END DISABLE BLOCK ─────────────────────────────────────────────────
  }

  async function initiatePayFast(regId: string) {
    const amount = getAmountDue();
    if (amount <= 0) {
      await supabase
        .from('cooking_class_registrations')
        .update({ payment_status: 'paid' })
        .eq('id', regId);
      // ── TEMPORARILY DISABLED — Google Sheets sync deactivated until further notice ──
      // await syncToSheet(regId);
      // ── END DISABLE BLOCK ─────────────────────────────────────────────────
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

  // (NEW) Compute seats limit for child cards
  const availableSeats = getAvailableSeatsForSelection();

  // (NEW) Get total available seats for selected dates (minimum across selected dates)
  function getAvailableSeatsForSelection(): number | null {
    const selectedDateLabels = page1.selectedDates;
    if (selectedDateLabels.length === 0) return null;
    const matchedRows = eventDates.filter(row => selectedDateLabels.includes(formatEventDate(row)));
    if (matchedRows.length === 0) return null;
    let minAvailable: number | null = null;
    for (const row of matchedRows) {
      const seating = row.seating || 0;
      if (seating > 0) {
        const booked = getBookingCount(row.id);
        const available = Math.max(0, seating - booked);
        if (minAvailable === null || available < minAvailable) {
          minAvailable = available;
        }
      }
    }
    return minAvailable;
  }

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
  const filteredDates = getFilteredDates();
  // (NEW) Determine if selected event has no dates configured
  const hasEventSelected = page1.selectedEvents.length > 0;
  const hasNoDates = hasEventSelected && filteredDates.length === 0;

  return (
    <div className="min-h-screen bg-[#FAF5EE]">
      {/* (NEW) Contact Our Office Popup — shown when selected event has no dates */}
      {showNoDatesPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
            <div className="w-14 h-14 bg-[#FDF0E8] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#1A1612] mb-3">Contact Our Office</h3>
            <p className="text-sm text-[#5C5347] leading-relaxed mb-6">
              Enquire about the Event — <span className="font-semibold text-[#1A1612]">087 265 2262</span> or drop us an email:{' '}
              <a href="mailto:info@cardamomkitchen.co.za" className="font-semibold text-[#C4622D] hover:underline">
                info@cardamomkitchen.co.za
              </a>
            </p>
            <button
              onClick={() => setShowNoDatesPopup(false)}
              className="w-full bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

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

      {/* Inactive notice — replaces the entire form */}
      {!loadingSettings && settings?.online_form_status === 'inactive' && (
        <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-[#FDF0E8] rounded-full flex items-center justify-center mb-6 overflow-hidden">
            <img
              src="/favicon.ico"
              alt="Cardamom Kitchen favicon"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<svg class="w-8 h-8 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
                }
              }}
            />
          </div>
          <h2 className="text-xl font-bold text-[#1A1612] mb-3">No Online Registration Available</h2>
          <p className="text-[#5C5347] text-base leading-relaxed max-w-sm">
            No online registration available — please contact our office for further information.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-block bg-[#C4622D] text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
          >
            Back to Home
          </Link>
        </div>
      )}

      {/* Form — only shown when online_form_status is active */}
      {(loadingSettings || settings?.online_form_status !== 'inactive') && (
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
            <h2 className="text-xl font-bold text-[#C4622D] mb-6 text-center">Registration Details</h2>

            {flyerUrl && (
              <div className="mb-6 rounded-xl overflow-hidden">
                <img
                  src={flyerUrl}
                  alt="Cooking and Baking Class flyer showing class details and schedule"
                  className="w-full object-contain max-h-56"
                />
              </div>
            )}

            {/* Guardian / Responsible Person Card */}
            <div className="mb-6 border border-[#DDD5C8] rounded-2xl p-5 bg-white shadow-sm">
              <h2 className="text-lg font-semibold text-black mb-5">Guardian / Responsible Person</h2>

              {/* Full Name */}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-[#1A1612] mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
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

              {/* Email */}
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
                <input
                  type="password"
                  autoComplete="off"
                  value={page1.emailConfirm}
                  onChange={e => setPage1(p => ({ ...p, emailConfirm: e.target.value }))}
                  onPaste={e => e.preventDefault()}
                  placeholder="Re-enter your email address to confirm"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] ${page1Errors.emailConfirm ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                />
                {page1Errors.emailConfirm && <p className="text-xs text-red-500 mt-1">{page1Errors.emailConfirm}</p>}
                <p className="text-xs text-[#8C8278] mt-1.5">We use your email address for Communication purposes</p>
              </div>

              {/* Cellphone */}
              <div className="mb-0">
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
            </div>

            {/* (1) Select an Event — radio buttons, only one at a time */}
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
                        type="radio"
                        name="selectedEvent"
                        checked={page1.selectedEvents.includes(ev.name)}
                        onChange={() => selectEvent(ev.name)}
                        className="w-4 h-4 border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]"
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

            {/* Select Attendance — only show dates for selected events */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#1A1612] mb-2">
                Select Attendance <span className="text-red-500">*</span>
              </label>
              {page1.selectedEvents.length === 0 ? (
                <p className="text-xs text-[#8C8278] italic">Please select an event above to see available dates.</p>
              ) : filteredDates.length === 0 ? (
                <p className="text-xs text-[#8C8278] italic">No dates are currently scheduled for this event.</p>
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

            {/* (NEW) Continue button — disabled when event selected but no dates configured */}
            <button
              onClick={() => {
                if (hasNoDates) {
                  setShowNoDatesPopup(true);
                  return;
                }
                handlePage1Next();
              }}
              disabled={hasNoDates}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors mt-2 ${
                hasNoDates
                  ? 'bg-[#DDD5C8] text-[#8C8278] cursor-not-allowed'
                  : 'bg-[#C4622D] text-white hover:bg-[#A04E22]'
              }`}
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
                      RSA ID / Passport No {page2.firstTimePortal !== 'No' && <span className="text-red-500">*</span>}
                      {page2.firstTimePortal === 'No' && <span className="text-[#8C8278] text-xs font-normal ml-1">(optional)</span>}
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

                {/* 2nd Contact — optional */}
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

                {/* Medical Details — collapsible */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setMedicalDetailsOpen(o => !o)}
                    className="w-full flex items-center justify-between bg-[#4A4540] text-white px-5 py-4 rounded-xl font-medium text-sm"
                  >
                    <span>Medical Details</span>
                    <svg
                      className={`w-6 h-6 transition-transform ${medicalDetailsOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {medicalDetailsOpen && (
                    <div className="pt-6 space-y-6">
                      {/* Medical Doctor */}
                      <div>
                        <h4 className="text-base font-bold text-[#1A1612] mb-3">Medical Doctor</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <input
                              type="text"
                              value={page3.medicalDoctorFirstName}
                              onChange={e => setPage3(p => ({ ...p, medicalDoctorFirstName: e.target.value }))}
                              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D]"
                            />
                            <p className="text-xs text-[#5C5347] mt-1">First Name</p>
                          </div>
                          <div>
                            <input
                              type="text"
                              value={page3.medicalDoctorSurname}
                              onChange={e => setPage3(p => ({ ...p, medicalDoctorSurname: e.target.value }))}
                              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D]"
                            />
                            <p className="text-xs text-[#5C5347] mt-1">Surname</p>
                          </div>
                        </div>
                      </div>

                      {/* Medical Aid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-base font-bold text-[#1A1612] mb-3">Medical Aid Name</h4>
                          <input
                            type="text"
                            value={page3.medicalAidName}
                            onChange={e => setPage3(p => ({ ...p, medicalAidName: e.target.value }))}
                            className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D]"
                          />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-[#1A1612] mb-3">Medical Aid Number</h4>
                          <input
                            type="text"
                            value={page3.medicalAidNumber}
                            onChange={e => setPage3(p => ({ ...p, medicalAidNumber: e.target.value }))}
                            className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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

                {/* Child cards — dynamic, each collapsible */}
                <div className="space-y-3 mb-4">
                  {page4.children.map((child, idx) => {
                    const isOpen = !collapsedChildren[idx];
                    const hasName = child.fullName.trim().length > 0;
                    const ageError = page4Errors[`child_${idx}_age`];
                    const isDisabledBySeats = availableSeats !== null && idx >= availableSeats;
                    return (
                      <div key={idx} className={`border rounded-xl overflow-hidden ${isDisabledBySeats ? 'border-[#DDD5C8] opacity-50' : 'border-[#DDD5C8]'}`}>
                        {/* Card header */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isDisabledBySeats) {
                              if (availableSeats !== null && availableSeats < 10 && !limitedSeatsWarningShown) {
                                setShowLimitedSeatsWarning(true);
                                setLimitedSeatsWarningShown(true);
                              } else {
                                setShowSeatsFullPopup(true);
                              }
                              return;
                            }
                            setCollapsedChildren(prev => ({ ...prev, [idx]: !prev[idx] }));
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isDisabledBySeats ? 'bg-[#EDE7DA] cursor-not-allowed' : 'bg-[#F5F0E8] hover:bg-[#EDE7DA]'}`}
                        >
                          <span className="text-sm font-semibold text-[#1A1612]">
                            Child ({idx + 1}){child.fullName.trim() ? ` — ${child.fullName.trim()}` : ''}
                            {isDisabledBySeats && <span className="ml-2 text-xs font-normal text-[#8C8278]">(seat unavailable)</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            {idx > 0 && !isDisabledBySeats && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={e => { e.stopPropagation(); removeChild(idx); }}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); removeChild(idx); } }}
                                className="text-[#8C8278] hover:text-red-500 transition-colors p-1 rounded"
                                aria-label={`Remove Child ${idx + 1}`}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </span>
                            )}
                            <svg
                              className={`w-4 h-4 text-[#8C8278] transition-transform ${isOpen && !isDisabledBySeats ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* Card body */}
                        {isOpen && !isDisabledBySeats && (
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
                                <label className="block text-xs font-medium text-[#5C5347] mb-1">
                                  DOB {hasName && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                  type="date"
                                  value={child.dob}
                                  onChange={e => updateChild(idx, 'dob', e.target.value)}
                                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] ${page4Errors[`child_${idx}_dob`] ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                                />
                                {page4Errors[`child_${idx}_dob`] && (
                                  <p className="text-xs text-red-500 mt-0.5">{page4Errors[`child_${idx}_dob`]}</p>
                                )}
                              </div>
                            </div>
                            {/* Row 2: Age + Gender + Grade */}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-[#5C5347] mb-1">Age</label>
                                <input
                                  type="text"
                                  value={child.age}
                                  readOnly
                                  placeholder="Auto"
                                  className="w-full border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm bg-[#F5F0E8] text-[#5C5347] cursor-not-allowed"
                                />
                                {ageError && (
                                  <p className="text-xs text-red-500 mt-0.5">{ageError}</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-[#5C5347] mb-1">
                                  Gender {hasName && <span className="text-red-500">*</span>}
                                </label>
                                <select
                                  value={child.gender}
                                  onChange={e => updateChild(idx, 'gender', e.target.value)}
                                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white ${page4Errors[`child_${idx}_gender`] ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                                >
                                  <option value="">Select...</option>
                                  <option value="Female">Female</option>
                                  <option value="Male">Male</option>
                                </select>
                                {page4Errors[`child_${idx}_gender`] && (
                                  <p className="text-xs text-red-500 mt-0.5">{page4Errors[`child_${idx}_gender`]}</p>
                                )}
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
                              <label className="block text-xs font-medium text-[#5C5347] mb-1">
                                Dietary Restrictions {hasName && <span className="text-red-500">*</span>}
                              </label>
                              <select
                                value={child.dietaryRestrictions}
                                onChange={e => updateChild(idx, 'dietaryRestrictions', e.target.value)}
                                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white ${page4Errors[`child_${idx}_dietary`] ? 'border-red-400' : 'border-[#DDD5C8]'}`}
                              >
                                <option value="">Select...</option>
                                {DIETARY_OPTIONS.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                              {page4Errors[`child_${idx}_dietary`] && (
                                <p className="text-xs text-red-500 mt-0.5">{page4Errors[`child_${idx}_dietary`]}</p>
                              )}
                            </div>

                            {/* Consent & Indemnity — per child */}
                            <div className="mt-2 pt-3 border-t border-[#EDE7DA]">
                              <p className="text-xs font-semibold text-[#4A4540] uppercase tracking-wide mb-2">Consent &amp; Indemnity</p>
                              <hr className="border-[#EDE7DA] mb-3" />
                              {/* Photo consent */}
                              <div className="mb-3">
                                <p className="text-xs text-[#1A1612] mb-2">
                                  Photos taken of my/our child(ren) at the cooking classes{' '}
                                  {hasName && <span className="text-red-500">*</span>}
                                </p>
                                <div className="flex items-center gap-6">
                                  {[
                                    { value: 'yes', label: 'Yes, I give consent' },
                                    { value: 'no', label: 'No, I do not consent' },
                                  ].map(opt => (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`picturesTaken_${idx}`}
                                        value={opt.value}
                                        checked={child.picturesTaken === opt.value}
                                        onChange={() => updateChild(idx, 'picturesTaken', opt.value)}
                                        className="w-4 h-4 border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]"
                                      />
                                      <span className="text-xs text-[#1A1612]">{opt.label}</span>
                                    </label>
                                  ))}
                                </div>
                                {page4Errors[`child_${idx}_pictures`] && (
                                  <p className="text-xs text-red-500 mt-1">{page4Errors[`child_${idx}_pictures`]}</p>
                                )}
                              </div>
                              {/* Indemnity checkbox */}
                              <div>
                                <label className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={child.indemnityConsent}
                                    onChange={e => updateChild(idx, 'indemnityConsent', e.target.checked)}
                                    className="w-4 h-4 mt-0.5 border-2 border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D] rounded flex-shrink-0"
                                  />
                                  <span className="text-xs text-[#1A1612]">
                                    I consent to the clauses in the Business Indemnity Form{' '}
                                    {hasName && <span className="text-red-500">*</span>}
                                  </span>
                                </label>
                                {page4Errors[`child_${idx}_indemnity`] && (
                                  <p className="text-xs text-red-500 mt-1">{page4Errors[`child_${idx}_indemnity`]}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* + Add another child button */}
                {page4.children.length < 10 && (
                  <div className="mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isLastChildComplete()) return;
                        addChild();
                      }}
                      disabled={!isLastChildComplete()}
                      className={`w-full border-2 border-dashed rounded-xl py-3 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        isLastChildComplete()
                          ? 'border-[#C4622D] text-[#C4622D] hover:bg-[#FDF6EE] cursor-pointer'
                          : 'border-[#DDD5C8] text-[#8C8278] cursor-not-allowed bg-[#FAF5EE]'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      + Add another child
                    </button>
                    {!isLastChildComplete() && (
                      <p className="text-xs text-amber-600 mt-2 text-center">
                        Please complete all mandatory fields for the current child (Full Name, DOB, Gender, Dietary Restrictions, Photo Consent, and Indemnity Consent) before adding another child.
                      </p>
                    )}
                  </div>
                )}

                {/* SIGNED Indemnity Form upload */}
                <div className="mt-6 bg-white border border-[#EDE7DA] rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-[#4A4540] text-white px-5 py-4">
                    <h3 className="text-sm font-semibold">Do you have a Signed Indemnity Form?</h3>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-6 mb-4">
                      {['Yes', 'No'].map(opt => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="hasIndemnityForm"
                            value={opt}
                            checked={page4.hasIndemnityForm === opt}
                            onChange={() => setPage4(p => ({ ...p, hasIndemnityForm: opt, indemnityFile: opt === 'No' ? null : p.indemnityFile, indemnityFilePreview: opt === 'No' ? '' : p.indemnityFilePreview }))}
                            className="w-5 h-5 border-2 border-[#DDD5C8] text-[#C4622D] focus:ring-[#C4622D]"
                          />
                          <span className="text-sm text-[#1A1612]">{opt}</span>
                        </label>
                      ))}
                    </div>
                    {page4Errors.hasIndemnityForm && <p className="text-xs text-red-500 mb-3">{page4Errors.hasIndemnityForm}</p>}

                    {page4.hasIndemnityForm === 'Yes' && (
                      <>
                        <div
                          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${page4Errors.indemnityFile ? 'border-red-400 bg-red-50' : 'border-[#DDD5C8] bg-[#F8F5FF] hover:border-[#C4622D]/50'}`}
                          onClick={() => document.getElementById('indemnity-file-input')?.click()}
                        >
                          {page4.indemnityFilePreview ? (
                            <div>
                              {page4.indemnityFile?.type?.startsWith('image/') ? (
                                <img src={page4.indemnityFilePreview} alt="Signed indemnity form preview" className="max-h-32 mx-auto rounded-lg mb-3 object-contain" />
                              ) : (
                                <div className="text-4xl mb-3">📄</div>
                              )}
                              <p className="text-sm text-[#5C5347] font-medium">{page4.indemnityFile?.name}</p>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setPage4(p => ({ ...p, indemnityFile: null, indemnityFilePreview: '' })); }}
                                className="text-xs text-red-500 hover:underline mt-1"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div>
                              <svg className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                              </svg>
                              <p className="text-base font-bold text-[#1A1612] mb-1">Browse Files</p>
                              <p className="text-sm text-[#8C8278]">Drag and drop files here</p>
                            </div>
                          )}
                          <input
                            id="indemnity-file-input"
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleIndemnityUpload}
                            className="hidden"
                          />
                        </div>
                        <p className="text-xs text-[#5C5347] mt-2">Upload your SIGNED Cardamom Kitchen cooking classes Indemnity Form</p>
                        {page4Errors.indemnityFile && <p className="text-xs text-red-500 mt-1">{page4Errors.indemnityFile}</p>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  const backPage = page2.firstTimePortal === 'No' ? 2 : 3;
                  setCurrentPage(backPage);
                  window.scrollTo(0, 0);
                }}
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
            {/* Per-session billing breakdown */}
            {(() => {
              const breakdown = getSessionBreakdown();
              const total = getAmountDue();
              const count = getParticipantCount();
              let fee = getEventClassFee();
              return total > 0 ? (
                <div className="bg-[#FDF6EE] border border-[#EDE7DA] rounded-xl p-4 mb-6">
                  {breakdown.length > 1 ? (
                    // Multiple sessions — show per-session rows + Total
                    <div>
                      <div className="space-y-2 mb-3">
                        {breakdown.map((session, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-2 text-sm">
                            <div className="flex-1 min-w-0">
                              <span className="text-[#5C5347] font-medium block truncate">{session.dateLabel}</span>
                              <span className="text-xs text-[#8C8278]">
                                {session.participants} participant{session.participants !== 1 ? 's' : ''} × R{session.fee.toFixed(2)}
                              </span>
                            </div>
                            <span className="font-semibold text-[#1A1612] whitespace-nowrap">R{session.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-[#DDD5C8] pt-3 flex items-center justify-between">
                        <span className="text-sm font-bold text-[#1A1612]">Total Amount Due</span>
                        <span className="text-base font-bold text-[#C4622D]">R{total.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-[#8C8278] mt-2">
                        You are liable for the total of all booked sessions for every participant.
                      </p>
                    </div>
                  ) : breakdown.length === 1 ? (
                    // Single session
                    <p className="text-sm text-[#5C5347]">
                      {breakdown[0].participants} participant{breakdown[0].participants !== 1 ? 's' : ''} × <span className="font-semibold">R{breakdown[0].fee.toFixed(2)}</span> per participant ={' '}
                      <span className="font-bold text-[#C4622D] text-base">R{total.toFixed(2)}</span> due
                    </p>
                  ) : fee > 0 && count > 0 ? (
                    <p className="text-sm text-[#5C5347]">
                      {count} participant{count !== 1 ? 's' : ''} × <span className="font-semibold">R{fee.toFixed(2)}</span> per participant ={' '}
                      <span className="font-bold text-[#C4622D] text-base">R{total.toFixed(2)}</span> due
                    </p>
                  ) : (
                    <p className="text-sm text-[#5C5347]">
                      Registration fee: <span className="font-bold text-[#C4622D]">R{total.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              ) : null;
            })()}

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
      )}

      {/* (NEW) Limited Seats Warning — shown once per session when seats < 10 */}
      {showLimitedSeatsWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
            <div className="w-14 h-14 bg-[#FDF0E8] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#1A1612] mb-3">Limited seats available</h3>
            <p className="text-sm text-[#5C5347] leading-relaxed mb-6">
              There are limited seats available for this session. Please register only the participants that can be accommodated.
            </p>
            <button
              onClick={() => setShowLimitedSeatsWarning(false)}
              className="w-full bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* (NEW) Seats Full Popup */}
      {showSeatsFullPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#1A1612] mb-3">Seating Limit Reached</h3>
            <p className="text-sm text-[#5C5347] leading-relaxed mb-6">
              Cannot register more participants as the vacant seating is filled.
            </p>
            <button
              onClick={() => setShowSeatsFullPopup(false)}
              className="w-full bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
