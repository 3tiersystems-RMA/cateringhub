'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type BookableEvent,
  type BookableSession,
  toSASTDateTimeInput,
  fromSASTDateTimeInputToUTCISO,
  sessionToMarketingDateTimes,
  marketingDateTimesToSession,
  resolveCheckoutFee,
  getEnrollmentUrl,
  getEnrollmentUrlForBookableEvent,
  resolveEnrollmentUrl,
  pickDefaultSession,
  formatSessionLabel,
  SAST_OFFSET_MINUTES,
} from '@/lib/event-management-sync';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_date_to: string | null;
  location: string | null;
  image_path: string | null;
  image_url: string | null;
  is_published: boolean;
  is_registered: boolean;
  cost: number | null;
  enrollment_url: string | null;
  event_menu: string | null;
  event_management_event_id: string | null;
  event_management_session_id: string | null;
  created_at: string;
  imageUrl?: string;
}

interface EventForm {
  title: string;
  description: string;
  event_date: string;
  event_date_to: string;
  location: string;
  is_published: boolean;
  image_url: string;
  is_registered: boolean;
  cost: string;
  enrollment_url: string;
  event_menu: string;
  event_management_event_id: string;
  event_management_session_id: string;
}

const emptyEventForm: EventForm = {
  title: '',
  description: '',
  event_date: '',
  event_date_to: '',
  location: '',
  is_published: false,
  image_url: '',
  is_registered: false,
  cost: '',
  enrollment_url: '',
  event_menu: '',
  event_management_event_id: '',
  event_management_session_id: '',
};

export default function EventManagement({ canCreate = true, canDelete = true }: { canCreate?: boolean; canDelete?: boolean }) {
  const supabase = createClient();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventForm>(emptyEventForm);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [listError, setListError] = useState('');
  // 'device' | 'url'
  const [imageInputMode, setImageInputMode] = useState<'device' | 'url'>('device');
  const [isOpen, setIsOpen] = useState(true);
  const [bookableEvents, setBookableEvents] = useState<BookableEvent[]>([]);
  const [defaultEventFee, setDefaultEventFee] = useState(0);
  const [loadingBookable, setLoadingBookable] = useState(false);
  const [showSyncedOverrides, setShowSyncedOverrides] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (!showForm) return;

    let cancelled = false;
    async function loadBookableEvents() {
      setLoadingBookable(true);
      try {
        const mgmtEvents = await supabase
          .from('event_management_events')
          .select('id, name')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        const settings = await supabase.from('event_management_settings').select('event_fee').limit(1).single();

        if (cancelled) return;
        setDefaultEventFee(settings?.event_fee != null ? Number(settings.event_fee) : 0);

        if (!mgmtEvents?.data?.length) {
          setBookableEvents([]);
          return;
        }

        const eventIds = mgmtEvents.data.map(e => e.id);
        const { data: sessions } = await supabase
          .from('event_management_event_dates')
          .select('id, event_id, event_date, start_time, end_time, location, event_fee')
          .in('event_id', eventIds)
          .order('event_date', { ascending: true });

        if (cancelled) return;

        const sessionsByEvent: Record<string, BookableSession[]> = {};
        (sessions || []).forEach((s: BookableSession) => {
          if (!sessionsByEvent[s.event_id]) sessionsByEvent[s.event_id] = [];
          sessionsByEvent[s.event_id].push({
            ...s,
            event_fee: s.event_fee != null ? Number(s.event_fee) : null,
          });
        });

        setBookableEvents(
          mgmtEvents.data
            .map(ev => ({
              id: ev.id,
              name: ev.name,
              sessions: sessionsByEvent[ev.id] || [],
            }))
            .filter(ev => ev.sessions.length > 0)
        );
      } catch {
        if (!cancelled) setBookableEvents([]);
      } finally {
        if (!cancelled) setLoadingBookable(false);
      }
    }

    loadBookableEvents();
    return () => { cancelled = true; };
  }, [showForm, supabase]);

  /** Remove fields populated from Event Bookings → Settings (dropdown sync). */
  function clearBookableSyncedFields(prev: EventForm): EventForm {
    return {
      ...prev,
      title: '',
      event_date: '',
      event_date_to: '',
      location: '',
      cost: '',
      enrollment_url: '',
      event_management_event_id: '',
      event_management_session_id: '',
    };
  }

  function setEventType(registered: boolean) {
    setShowSyncedOverrides(false);
    setForm((f) => {
      if (registered) {
        return { ...f, is_registered: true, enrollment_url: f.enrollment_url || getEnrollmentUrl() };
      }
      return clearBookableSyncedFields({ ...f, is_registered: false });
    });
  }

  const isLinkedToSettings = !!(form.event_management_event_id && form.event_management_session_id);
  const hasValidCost = !!(form.cost.trim() && !isNaN(parseFloat(form.cost)) && parseFloat(form.cost) > 0);
  const bookableFormComplete = form.is_registered && isLinkedToSettings && hasValidCost && !!form.title.trim() && !!form.event_date;

  function applySessionToForm(
    bookable: BookableEvent,
    session: BookableSession,
    prev: EventForm
  ): EventForm {
    const { event_date, event_date_to } = sessionToMarketingDateTimes(session);
    const fee = resolveCheckoutFee(defaultEventFee, session.event_fee);
    return {
      ...prev,
      title: bookable.name,
      event_date,
      event_date_to,
      location: session.location || '',
      cost: fee > 0 ? String(fee) : '',
      enrollment_url: getEnrollmentUrlForBookableEvent(bookable.id, session.id),
      event_management_event_id: bookable.id,
      event_management_session_id: session.id,
      is_registered: true,
    };
  }

  function handleSelectBookableEvent(eventId: string) {
    setShowSyncedOverrides(false);
    if (!eventId) {
      setForm(prev => clearBookableSyncedFields(prev));
      return;
    }
    const bookable = bookableEvents.find(e => e.id === eventId);
    if (!bookable) return;
    const session = pickDefaultSession(bookable.sessions);
    if (!session) return;
    setForm(prev => applySessionToForm(bookable, session, prev));
  }

  function handleSelectBookableSession(sessionId: string) {
    setShowSyncedOverrides(false);
    const bookable = bookableEvents.find(e => e.id === form.event_management_event_id);
    if (!bookable) return;
    const session = bookable.sessions.find(s => s.id === sessionId);
    if (!session) return;
    setForm(prev => applySessionToForm(bookable, session, prev));
  }

  async function syncLinkedSessionToSettings(
    eventId: string,
    sessionId: string,
    data: {
      title: string;
      event_date: string;
      event_date_to: string;
      location: string;
      cost: number | null;
    }
  ) {
    const sessionFields = marketingDateTimesToSession(data.event_date, data.event_date_to);
    if (!sessionFields) return;

    await supabase
      .from('event_management_events')
      .update({ name: data.title.trim() })
      .eq('id', eventId);

    await supabase
      .from('event_management_event_dates')
      .update({
        event_date: sessionFields.event_date,
        start_time: sessionFields.start_time,
        end_time: sessionFields.end_time,
        location: data.location.trim() || null,
        event_fee: data.cost,
      })
      .eq('id', sessionId);
  }

  const selectedBookable = bookableEvents.find(e => e.id === form.event_management_event_id);
  const selectedSessions = selectedBookable?.sessions || [];

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });

    if (!error && data) {
      const withUrls = await Promise.all(
        data.map(async (ev: Event) => {
          if (ev.image_path) {
            const { data: urlData } = await supabase.storage
              .from('event-photos')
              .createSignedUrl(ev.image_path, 3600);
            return { ...ev, imageUrl: urlData?.signedUrl };
          }
          // If image_url is set, use it directly as the preview
          if (ev.image_url) {
            return { ...ev, imageUrl: ev.image_url };
          }
          return ev;
        })
      );
      setEvents(withUrls);
    }
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPendingImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!pendingImageFile) return null;
    setUploadingImage(true);
    const ext = pendingImageFile.name.split('.').pop();
    const path = `event-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('event-photos')
      .upload(path, pendingImageFile, { upsert: true });
    setUploadingImage(false);
    if (error) {
      setFormError('Image upload failed: ' + error.message);
      return null;
    }
    return path;
  };

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setForm(emptyEventForm);
    setPendingImageFile(null);
    setPendingImagePreview(null);
    setImageInputMode('device');
    setShowSyncedOverrides(false);
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const handleOpenEdit = (ev: Event) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description || '',
      event_date: ev.event_date ? toSASTDateTimeInput(ev.event_date) : '',
      event_date_to: ev.event_date_to ? toSASTDateTimeInput(ev.event_date_to) : '',
      location: ev.location || '',
      is_published: ev.is_published,
      image_url: ev.image_url || '',
      is_registered: ev.is_registered || false,
      cost: ev.cost != null ? String(ev.cost) : '',
      enrollment_url: ev.is_registered
        ? resolveEnrollmentUrl(ev.enrollment_url, ev.event_management_event_id, ev.event_management_session_id)
        : (ev.enrollment_url || ''),
      event_menu: ev.event_menu || '',
      event_management_event_id: ev.event_management_event_id || '',
      event_management_session_id: ev.event_management_session_id || '',
    });
    setPendingImageFile(null);
    // If there's a stored image_path preview use it, else use image_url
    setPendingImagePreview(ev.imageUrl || null);
    // Determine which mode to show based on existing data
    setImageInputMode(ev.image_url && !ev.image_path ? 'url' : 'device');
    setShowSyncedOverrides(false);
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  function formatDateTimeLocalLabel(value: string): string {
    if (!value) return '—';
    const iso = fromSASTDateTimeInputToUTCISO(value);
    if (!iso) return value;
    try {
      return new Date(iso).toLocaleString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  }

  const editableFieldClass = 'w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D]';

  function renderEventImageSection() {
    return (
      <div>
        <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
          Event Image
        </label>
        <div className="flex rounded-xl border border-[#DDD5C8] overflow-hidden mb-3">
          <button
            type="button"
            onClick={() => {
              setImageInputMode('device');
              setForm((f) => ({ ...f, image_url: '' }));
              setTimeout(() => imageInputRef.current?.click(), 50);
            }}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              imageInputMode === 'device' ? 'bg-[#C4622D] text-white' : 'bg-white text-[#5C5347] hover:bg-[#e9e0cf]'
            }`}
          >
            Upload from Device
          </button>
          <button
            type="button"
            onClick={() => {
              setImageInputMode('url');
              setPendingImageFile(null);
              setPendingImagePreview(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
              imageInputMode === 'url' ? 'bg-[#C4622D] text-white' : 'bg-white text-[#5C5347] hover:bg-[#e9e0cf]'
            }`}
          >
            Enter Image URL
          </button>
        </div>
        {imageInputMode === 'device' ? (
          <>
            {pendingImagePreview && (
              <div className="mb-2 relative w-full h-36 rounded-xl overflow-hidden border border-[#DDD5C8]">
                <img src={pendingImagePreview} alt="Event preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPendingImageFile(null);
                    setPendingImagePreview(null);
                  }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="w-full border-2 border-dashed border-[#DDD5C8] rounded-xl py-3 text-sm text-[#8C8278] hover:border-[#C4622D] hover:text-[#C4622D] transition-colors"
            >
              {pendingImagePreview ? 'Change Image' : 'Upload Image'}
            </button>
          </>
        ) : (
          <>
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="https://example.com/image.jpg"
              className={editableFieldClass}
            />
            {form.image_url && (
              <div className="mt-2 relative w-full h-36 rounded-xl overflow-hidden border border-[#DDD5C8]">
                <img
                  src={form.image_url}
                  alt="URL image preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const handleSave = async () => {
    setFormError('');
    setFormSuccess('');

    if (form.is_registered) {
      if (!form.event_management_event_id || !form.event_management_session_id) {
        setFormError('Please select a bookable event from Event Bookings → Settings.');
        return;
      }
      if (form.cost && isNaN(parseFloat(form.cost))) {
        setFormError('Cost must be a valid number.');
        return;
      }
      if (!form.cost.trim() || parseFloat(form.cost) <= 0) {
        setFormError('Cost must be greater than zero.');
        return;
      }
    }

    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.event_date) { setFormError('Event start date is required.'); return; }

    if (form.event_date_to) {
      const fromIso = fromSASTDateTimeInputToUTCISO(form.event_date);
      const toIso = fromSASTDateTimeInputToUTCISO(form.event_date_to);
      if (!fromIso || !toIso) {
        setFormError('Invalid date/time format. Please select both From and To again.');
        return;
      }
      if (new Date(toIso) < new Date(fromIso)) {
        setFormError('The "To" date cannot be before the "From" date.');
        return;
      }
    }

    setSaving(true);
    let imagePath = editingEvent?.image_path || null;
    let imageUrlValue: string | null = null;

    if (imageInputMode === 'url') {
      // URL mode: clear any uploaded file path, use the URL
      imagePath = null;
      imageUrlValue = form.image_url.trim() || null;
    } else {
      // Device mode: upload if new file selected
      imageUrlValue = null;
      if (pendingImageFile) {
        const uploaded = await uploadImage();
        if (!uploaded) { setSaving(false); return; }
        imagePath = uploaded;
      }
    }

    const eventDateFrom = fromSASTDateTimeInputToUTCISO(form.event_date);
    if (!eventDateFrom) {
      setFormError('Invalid start date/time format.');
      setSaving(false);
      return;
    }

    // If to-date is blank, copy from-date
    const eventDateTo = form.event_date_to
      ? fromSASTDateTimeInputToUTCISO(form.event_date_to)
      : eventDateFrom;

    if (!eventDateTo) {
      setFormError('Invalid end date/time format.');
      setSaving(false);
      return;
    }

    const parsedCost = form.is_registered && form.cost.trim() ? parseFloat(form.cost) : null;

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: eventDateFrom,
      event_date_to: eventDateTo,
      location: form.location.trim() || null,
      image_path: imagePath,
      image_url: imageUrlValue,
      is_published: form.is_published,
      is_registered: form.is_registered,
      cost: parsedCost,
      enrollment_url: form.is_registered && form.event_management_event_id
        ? getEnrollmentUrlForBookableEvent(form.event_management_event_id, form.event_management_session_id)
        : null,
      event_menu: form.is_registered && form.event_menu.trim() ? form.event_menu.trim() : null,
      event_management_event_id: form.is_registered ? form.event_management_event_id : null,
      event_management_session_id: form.is_registered ? form.event_management_session_id : null,
    };

    if (form.is_registered && form.event_management_event_id && form.event_management_session_id) {
      try {
        await syncLinkedSessionToSettings(
          form.event_management_event_id,
          form.event_management_session_id,
          {
            title: form.title.trim(),
            event_date: form.event_date,
            event_date_to: form.event_date_to || form.event_date,
            location: form.location,
            cost: parsedCost,
          }
        );
      } catch (syncErr: unknown) {
        setFormError(syncErr instanceof Error ? syncErr.message : 'Failed to sync with Event Bookings Settings.');
        setSaving(false);
        return;
      }
    }

    if (editingEvent) {
      const { data, error } = await supabase.from('events').update(payload).eq('id', editingEvent.id).select('id');
      if (error) { setFormError(error.message); setSaving(false); return; }
      if (!data || data.length === 0) { setFormError('Update was blocked — you may not have permission to edit events.'); setSaving(false); return; }
      setFormSuccess('Event updated successfully.');
    } else {
      const { data, error } = await supabase.from('events').insert([payload]).select('id');
      if (error) { setFormError(error.message); setSaving(false); return; }
      if (!data || data.length === 0) { setFormError('Could not create the event. Please try again.'); setSaving(false); return; }
      setFormSuccess('Event created successfully.');
    }

    setSaving(false);
    await loadEvents();
    setTimeout(() => {
      setShowForm(false);
      setFormSuccess('');
    }, 1200);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setListError('');
    const { data, error } = await supabase.from('events').delete().eq('id', id).select('id');
    if (error || !data || data.length === 0) {
      setListError(error?.message || 'Delete was blocked — you may not have permission to delete events.');
      await loadEvents();
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const handleTogglePublish = async (ev: Event) => {
    const { data, error } = await supabase
      .from('events')
      .update({ is_published: !ev.is_published })
      .eq('id', ev.id)
      .select('id');
    setListError('');
    if (error || !data || data.length === 0) {
      setListError(error?.message || 'Could not change the publish status — you may not have permission.');
      await loadEvents();
    } else {
      setEvents((prev) =>
        prev.map((e) => (e.id === ev.id ? { ...e, is_published: !ev.is_published } : e))
      );
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatEventDateTime = (from: string, to: string | null) => {
    try {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) return from;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const fromSast = new Date(fromDate.getTime() + SAST_OFFSET_MINUTES * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateLabel = `${pad(fromSast.getUTCDate())} ${monthNames[fromSast.getUTCMonth()]} ${fromSast.getUTCFullYear()}`;
      const fromTime = `${pad(fromSast.getUTCHours())}:${pad(fromSast.getUTCMinutes())}`;
      if (!to) return `${dateLabel}, ${fromTime}`;
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) return `${dateLabel}, ${fromTime}`;
      const toSast = new Date(toDate.getTime() + SAST_OFFSET_MINUTES * 60 * 1000);
      const toTime = `${pad(toSast.getUTCHours())}:${pad(toSast.getUTCMinutes())}`;
      const sameSastDate =
        fromSast.getUTCFullYear() === toSast.getUTCFullYear() &&
        fromSast.getUTCMonth() === toSast.getUTCMonth() &&
        fromSast.getUTCDate() === toSast.getUTCDate();
      if (sameSastDate) return `${dateLabel}, ${fromTime} – ${toTime}`;
      const toDateLabel = `${pad(toSast.getUTCDate())} ${monthNames[toSast.getUTCMonth()]} ${toSast.getUTCFullYear()}`;
      return `${dateLabel}, ${fromTime} – ${toDateLabel}, ${toTime}`;
    } catch {
      return from;
    }
  };

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  const filtered = events.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
        {/* Collapsible header */}
        <button
          type="button"
          onClick={() => setIsOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#FAF5EE] transition-colors"
        >
          <div>
            <span className="text-base font-bold text-[#1A1612]">Current/Past Events</span>
            <p className="text-xs text-[#8C8278] mt-0.5">
              {events.length} event{events.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <svg className={`w-5 h-5 text-[#8C8278] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>

        {isOpen && (
          <div className="border-t border-[#EDE7DA] px-6 pb-6 pt-4">
            {/* Actions row */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search events by title or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-[#DDD5C8] rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#C4622D] bg-white w-full"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B5ADA5] hover:text-[#5C5347] transition-colors"
                    aria-label="Clear search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                )}
              </div>
              {canCreate && (
                <button
                  onClick={handleOpenCreate}
                  className="flex items-center gap-2 bg-[#C4622D] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Event
                </button>
              )}
            </div>

            {listError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
                <span>{listError}</span>
                <button onClick={() => setListError('')} className="text-red-400 hover:text-red-600 flex-shrink-0" aria-label="Dismiss">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Form Modal */}
            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-[#DDD5C8] w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h3 className="text-lg font-bold text-[#1A1612]">
                      {editingEvent ? 'Edit Event' : 'Add New Event'}
                    </h3>
                    <button
                      onClick={() => setShowForm(false)}
                      className="p-1.5 rounded-lg text-[#8C8278] hover:bg-[#e9e0cf] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {formError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                        {formError}
                      </div>
                    )}
                    {formSuccess && (
                      <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                        {formSuccess}
                      </div>
                    )}

                    {/* Event type — choose bookable vs info-only */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#5C5347] uppercase tracking-wider">What type of event?</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setEventType(true)}
                          className={`text-left rounded-xl border-2 p-4 transition-colors ${
                            form.is_registered
                              ? 'border-[#C4622D] bg-[#FFF8F4] ring-1 ring-[#C4622D]/20'
                              : 'border-[#EDE7DA] bg-white hover:border-[#DDD5C8]'
                          }`}
                        >
                          <p className="text-sm font-bold text-[#1A1612]">Bookable event</p>
                          <p className="text-xs text-[#5C5347] mt-1">
                            Shows <strong>price</strong> and <strong>Enroll Now</strong> on the public Events page. Link to Event Bookings → Settings.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventType(false)}
                          className={`text-left rounded-xl border-2 p-4 transition-colors ${
                            !form.is_registered
                              ? 'border-[#5C5347] bg-[#F5F0E8] ring-1 ring-[#5C5347]/10'
                              : 'border-[#EDE7DA] bg-white hover:border-[#DDD5C8]'
                          }`}
                        >
                          <p className="text-sm font-bold text-[#1A1612]">Info only</p>
                          <p className="text-xs text-[#5C5347] mt-1">
                            Display-only card — <strong>no price</strong>, <strong>no Enroll button</strong>. For announcements or past highlights.
                          </p>
                        </button>
                      </div>
                    </div>

                    {!form.is_registered && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900 space-y-1">
                        <p className="font-semibold">Info-only mode</p>
                        <p>Fill in title, date, and image below. Visitors will see the event card but cannot book online. To add price and Enroll Now, switch to <strong>Bookable event</strong> above.</p>
                      </div>
                    )}

                    {form.is_registered && !isLinkedToSettings && (
                      <div className="bg-[#FFF8F4] border border-[#F0D5C4] rounded-xl px-4 py-3 text-xs text-[#5C5347] space-y-2">
                        <p className="font-semibold text-[#C4622D]">Setup checklist</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Create the event + session + fee in <strong>Event Bookings → Settings</strong></li>
                          <li>Select it in the dropdown below — title, date, location, and price load automatically</li>
                          <li>Add description / image, then turn <strong>Published</strong> on</li>
                        </ol>
                      </div>
                    )}

                    {form.is_registered ? (
                      <>
                        {/* Step 2 — Link to Settings */}
                        <div className="space-y-4 bg-[#FFF8F4] border border-[#F0D5C4] rounded-xl p-4">
                          <p className="text-xs font-bold text-[#C4622D] uppercase tracking-wider">Step 1 — Link bookable event</p>

                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                              Bookable Event (from Settings) <span className="text-red-500">*</span>
                            </label>
                            {loadingBookable ? (
                              <p className="text-xs text-[#8C8278]">Loading bookable events…</p>
                            ) : bookableEvents.length === 0 ? (
                              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                No bookable events found. Add an event with sessions in <strong>Event Bookings → Settings</strong> first.
                              </p>
                            ) : (
                              <select
                                value={form.event_management_event_id}
                                onChange={(e) => handleSelectBookableEvent(e.target.value)}
                                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                              >
                                <option value="">— Select bookable event —</option>
                                {bookableEvents.map(ev => (
                                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          {selectedSessions.length > 1 && (
                            <div>
                              <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                                Session <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={form.event_management_session_id}
                                onChange={(e) => handleSelectBookableSession(e.target.value)}
                                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                              >
                                {selectedSessions.map(s => (
                                  <option key={s.id} value={s.id}>{formatSessionLabel(s)}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {!form.event_management_event_id && (
                            <p className="text-xs text-[#8C8278] italic">
                              Select a bookable event above to load event details from Settings.
                            </p>
                          )}
                        </div>

                        {form.event_management_event_id && (
                          <>
                            {/* Synced summary from Settings */}
                            <div className="bg-white border border-[#EDE7DA] rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-[#5C5347] uppercase tracking-wider">
                                  From Event Bookings → Settings
                                </p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold">
                                  Linked ✓
                                </span>
                              </div>

                              {!showSyncedOverrides ? (
                                <dl className="space-y-2 text-sm">
                                  <div>
                                    <dt className="text-xs text-[#8C8278]">Title</dt>
                                    <dd className="font-medium text-[#1A1612]">{form.title || '—'}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs text-[#8C8278]">Date &amp; time</dt>
                                    <dd className="text-[#1A1612]">
                                      {formatDateTimeLocalLabel(form.event_date)}
                                      {form.event_date_to && form.event_date_to !== form.event_date && (
                                        <> – {formatDateTimeLocalLabel(form.event_date_to)}</>
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs text-[#8C8278]">Location</dt>
                                    <dd className="text-[#1A1612]">{form.location || '—'}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs text-[#8C8278]">Cost</dt>
                                    <dd className="font-semibold text-[#C4622D]">
                                      {form.cost ? `R ${Number(form.cost).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'} per person
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs text-[#8C8278]">Enrollment URL</dt>
                                    <dd className="text-xs text-[#5C5347] break-all">{form.enrollment_url || getEnrollmentUrl()}</dd>
                                  </div>
                                </dl>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    Saving will update these details in <strong>Event Bookings → Settings</strong>.
                                  </p>
                                  <div>
                                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Title</label>
                                    <input
                                      type="text"
                                      value={form.title}
                                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                      className={editableFieldClass}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">From</label>
                                      <input
                                        type="datetime-local"
                                        value={form.event_date}
                                        onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                                        className={editableFieldClass}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">To</label>
                                      <input
                                        type="datetime-local"
                                        value={form.event_date_to}
                                        min={form.event_date || undefined}
                                        onChange={(e) => setForm((f) => ({ ...f, event_date_to: e.target.value }))}
                                        className={editableFieldClass}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Location</label>
                                    <input
                                      type="text"
                                      value={form.location}
                                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                                      className={editableFieldClass}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Cost (R)</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8C8278]">R</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.cost}
                                        onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                                        className={`${editableFieldClass} pl-8`}
                                      />
                                    </div>
                                    {defaultEventFee > 0 && (
                                      <p className="text-[10px] text-[#8C8278] mt-1">
                                        Session fee overrides Default Event Fee (R{defaultEventFee}) when set on the session.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => setShowSyncedOverrides(prev => !prev)}
                                className="text-xs font-semibold text-[#C4622D] hover:underline"
                              >
                                {showSyncedOverrides ? 'Hide editable fields' : 'Edit synced details'}
                              </button>
                            </div>

                            {/* Marketing-only fields */}
                            <div className="space-y-4 border-t border-[#EDE7DA] pt-4">
                              <p className="text-xs font-bold text-[#5C5347] uppercase tracking-wider">Step 2 — Marketing details</p>
                              <p className="text-xs text-[#8C8278] -mt-2">These appear on the public Events page only.</p>

                              <div>
                                <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                                  Description
                                </label>
                                <textarea
                                  value={form.description}
                                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                  placeholder="Event description for the public card"
                                  rows={3}
                                  className={`${editableFieldClass} resize-none`}
                                />
                              </div>

                              {renderEventImageSection()}

                              <div>
                                <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                                  Event Menu
                                </label>
                                <textarea
                                  value={form.event_menu}
                                  onChange={(e) => setForm((f) => ({ ...f, event_menu: e.target.value }))}
                                  placeholder="e.g. Chocolate Chip Cookies, Banana Bread..."
                                  rows={3}
                                  className={`${editableFieldClass} resize-none`}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Info-only event — manual entry */}
                        <p className="text-xs font-bold text-[#5C5347] uppercase tracking-wider">Event details</p>

                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                            Title <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Event title"
                            className={editableFieldClass}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                            Description
                          </label>
                          <textarea
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Event description"
                            rows={3}
                            className={`${editableFieldClass} resize-none`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                            Event Date &amp; Time <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-[#8C8278] mb-1">From</p>
                              <input
                                type="datetime-local"
                                value={form.event_date}
                                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                                className={editableFieldClass}
                              />
                            </div>
                            <div>
                              <p className="text-xs text-[#8C8278] mb-1">To <span className="text-[#B0A89E] font-normal">(optional)</span></p>
                              <input
                                type="datetime-local"
                                value={form.event_date_to}
                                min={form.event_date || undefined}
                                onChange={(e) => setForm((f) => ({ ...f, event_date_to: e.target.value }))}
                                className={editableFieldClass}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-1.5">
                            Location
                          </label>
                          <input
                            type="text"
                            value={form.location}
                            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                            placeholder="Event location or venue"
                            className={editableFieldClass}
                          />
                        </div>

                        {renderEventImageSection()}
                      </>
                    )}

                    {form.is_registered && (
                      <div className={`rounded-xl px-4 py-3 text-xs border ${
                        bookableFormComplete && form.is_published
                          ? 'bg-green-50 border-green-200 text-green-800' :'bg-[#F5F0E8] border-[#EDE7DA] text-[#5C5347]'
                      }`}>
                        <p className="font-semibold mb-2">Public Events page preview</p>
                        <ul className="space-y-1">
                          <li>{isLinkedToSettings ? '✓' : '○'} Linked to Event Bookings → Settings</li>
                          <li>{hasValidCost ? '✓' : '○'} Price set {hasValidCost ? `(R ${Number(form.cost).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})` : '— select a bookable event with a fee'}</li>
                          <li>{form.is_published ? '✓' : '○'} Published (visible on /events)</li>
                        </ul>
                        <p className="mt-2 font-medium">
                          {bookableFormComplete && form.is_published
                            ? 'Enroll Now button and price will appear on the public Events page.'
                            : form.is_published && !bookableFormComplete
                              ? 'Published, but Enroll Now will not show until linked and a fee is set.'
                              : !form.is_published && bookableFormComplete
                                ? 'Almost ready — turn Published on to show this on /events.' :'Complete the steps above, then publish.'}
                        </p>
                      </div>
                    )}

                    {/* Published toggle */}
                    <div className="flex items-center justify-between bg-[#e9e0cf] rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1A1612]">Published</p>
                        <p className="text-xs text-[#8C8278]">
                          {form.is_registered
                            ? 'Must be on for the event and Enroll Now to appear on /events'
                            : 'Visible to the public on the Events page'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, is_published: !f.is_published }))}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          form.is_published ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            form.is_published ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-[#EDE7DA] flex gap-3">
                    <button
                      onClick={() => setShowForm(false)}
                      className="flex-1 border border-[#DDD5C8] text-[#5C5347] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#e9e0cf] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || uploadingImage}
                      className="flex-1 bg-[#C4622D] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60"
                    >
                      {saving || uploadingImage ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirm Modal */}
            {confirmDeleteId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-[#DDD5C8] w-full max-w-sm p-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1612] text-center mb-2">Delete Event</h3>
                  <p className="text-sm text-[#5C5347] text-center mb-5">
                    Are you sure you want to delete this event? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 border border-[#DDD5C8] text-[#5C5347] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#e9e0cf] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(confirmDeleteId)}
                      disabled={deletingId === confirmDeleteId}
                      className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
                    >
                      {deletingId === confirmDeleteId ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Events List */}
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#EDE7DA] p-10 text-center">
                <span className="text-4xl">🗓️</span>
                <p className="text-[#8C8278] mt-3 text-sm">
                  {searchQuery ? 'No events match your search.' : 'No events yet. Click "Add Event" to create one.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((ev) => {
                  const past = isPast(ev.event_date);
                  return (
                    <div
                      key={ev.id}
                      className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden flex flex-col sm:flex-row"
                    >
                      {/* Image */}
                      <div className="sm:w-32 h-28 sm:h-auto flex-shrink-0 bg-[#e9e0cf] flex items-center justify-center">
                        {ev.imageUrl ? (
                          <img
                            src={ev.imageUrl}
                            alt={ev.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">🗓️</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 px-4 py-3 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-[#1A1612]">{ev.title}</h3>
                              {ev.is_registered ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFF0E8] text-[#C4622D] border border-[#F0D5C4] font-semibold">
                                  Bookable
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F0E8] text-[#5C5347] border border-[#EDE7DA] font-medium">
                                  Info only
                                </span>
                              )}
                              {ev.event_management_event_id && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                                  Linked
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {past && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                  Past
                                </span>
                              )}
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border ${
                                  ev.is_published
                                    ? 'bg-green-50 text-green-700 border-green-200' :'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {ev.is_published ? 'Published' : 'Draft'}
                              </span>
                            </div>
                          </div>
                          {ev.description && (
                            <p className="text-xs text-[#8C8278] mt-1 line-clamp-2">{ev.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-[#5C5347]">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {formatEventDateTime(ev.event_date, ev.event_date_to)}
                            </span>
                            {ev.location && (
                              <span className="flex items-center gap-1 text-xs text-[#5C5347]">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {ev.location}
                              </span>
                            )}
                            {ev.is_registered && ev.cost != null && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-[#C4622D]">
                                R{Number(ev.cost).toFixed(2)}
                              </span>
                            )}
                          </div>
                          {ev.is_registered && ev.event_menu && (
                            <p className="text-xs text-[#8C8278] mt-1 line-clamp-1">
                              <span className="font-semibold text-[#5C5347]">Menu: </span>{ev.event_menu}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <button
                            onClick={() => handleTogglePublish(ev)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              ev.is_published
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' :'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            }`}
                          >
                            {ev.is_published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(ev)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-[#e9e0cf] text-[#5C5347] hover:bg-[#EDE7DA] border border-[#DDD5C8] transition-colors"
                          >
                            Edit
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setConfirmDeleteId(ev.id)}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
