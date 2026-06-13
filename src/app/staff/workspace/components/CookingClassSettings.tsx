'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ClassSettings {
  id: string;
  flyer_image_url: string | null;
  flyer_image_path: string | null;
  sheet_id: string | null;
  sheet_name: string | null;
  class_fee: number;
  online_form_status: string | null;
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
  synced_to_sheet: boolean;
  created_at: string;
  proof_of_payment_url: string | null;
  proof_of_payment_path: string | null;
}

interface ClassEvent {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  instructor?: string | null;
  image_url?: string | null;
  image_path?: string | null;
}

interface SessionStatus {
  id: string;
  label: string;
  sort_order: number;
}

interface EventDateRow {
  id?: string;
  event_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  sort_order: number;
  seating: number;
  status_id: string;
  class_fee: string;
  child_fee: string;
  session_name: string;
}

interface CookingClassSettingsProps {
  isSuperAdmin?: boolean;
  readOnly?: boolean;
  isAdminOrAbove?: boolean;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  awaiting_confirmation: 'bg-blue-100 text-blue-700',
};

const EMPTY_DATE_ROW = (eventId = '', sortOrder = 0, defaultLoc = ''): Omit<EventDateRow, 'id'> => ({
  event_id: eventId,
  event_date: '',
  start_time: '',
  end_time: '',
  location: defaultLoc,
  sort_order: sortOrder,
  seating: 0,
  status_id: '',
  class_fee: '',
  child_fee: '',
  session_name: '',
});

export default function CookingClassSettings({ isSuperAdmin = false, readOnly = false, isAdminOrAbove = false }: CookingClassSettingsProps) {
  const supabase = createClient();
  const [settings, setSettings] = useState<ClassSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingFormStatus, setSavingFormStatus] = useState(false);
  const [statusSaveMsg, setStatusSaveMsg] = useState('');

  const [flyerUrl, setFlyerUrl] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [onlineFormStatus, setOnlineFormStatus] = useState<'active' | 'inactive'>('active');

  // Events management
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventMsg, setEventMsg] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventName, setEditingEventName] = useState('');
  // Instructor (optional provision) — per-event drafts + save state
  const [instructorDrafts, setInstructorDrafts] = useState<Record<string, string>>({});
  const [savingInstructor, setSavingInstructor] = useState<Record<string, boolean>>({});
  const [instructorMsg, setInstructorMsg] = useState<Record<string, string>>({});

  // Session statuses management
  const [sessionStatuses, setSessionStatuses] = useState<SessionStatus[]>([]);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // (6) General Session Details block (no event_id) — dynamic sessions
  const [generalDateRows, setGeneralDateRows] = useState<EventDateRow[]>(
    [{ ...EMPTY_DATE_ROW('', 0) }]
  );  const [savingGeneralDates, setSavingGeneralDates] = useState(false);
  const [generalDatesMsg, setGeneralDatesMsg] = useState('');

  // (6) Per-event Session Details block — dynamic sessions per event, keyed by event_id
  const [eventDateRows, setEventDateRows] = useState<Record<string, EventDateRow[]>>({});
  const [savingEventDates, setSavingEventDates] = useState<Record<string, boolean>>({});
  const [eventDatesMsg, setEventDatesMsg] = useState<Record<string, string>>({});

  // Collapsible state for event blocks only (sessions are always expanded now)
  const [collapsedEventBlocks, setCollapsedEventBlocks] = useState<Record<string, boolean>>({});
  const [sheetSyncCollapsed, setSheetSyncCollapsed] = useState(true);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [regsError, setRegsError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'registrations'>(isAdminOrAbove ? 'settings' : 'registrations');

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState('');

  // (2) Delete confirmation popup state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Per-event image upload state
  const [uploadingEventImage, setUploadingEventImage] = useState<Record<string, boolean>>({});
  const [eventImageMsg, setEventImageMsg] = useState<Record<string, string>>({});

  // Default location from Organisation Details (default warehouse street address)
  const [defaultLocation, setDefaultLocation] = useState('');

  useEffect(() => {
    loadSettings();
    loadEvents();
    loadSessionStatuses();
    loadAllDateRows();
    loadDefaultLocation();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'registrations') loadRegistrations();
  }, [activeSubTab]);

  // When events load, initialise per-event date rows
  useEffect(() => {
    if (events.length > 0) {
      initEventDateRows();
    }
  }, [events]);

  async function loadDefaultLocation() {
    try {
      const { data } = await supabase
        .from('org_warehouses')
        .select('address')
        .eq('is_default', true)
        .limit(1)
        .single();
      if (data?.address) {
        setDefaultLocation(data.address);
      }
    } catch {
      // no default warehouse set
    }
  }

  async function loadSettings() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('cooking_class_settings')
        .select('*')
        .limit(1)
        .single();
      if (data) {
        setSettings(data);
        setFlyerUrl(data.flyer_image_url || '');
        setSheetId(data.sheet_id || '');
        setSheetName(data.sheet_name || 'Registrations');
        setOnlineFormStatus((data.online_form_status === 'inactive') ? 'inactive' : 'active');
      }
    } catch {
      // no settings yet
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      const { data } = await supabase
        .from('cooking_class_events')
        .select('*')
        .order('sort_order', { ascending: true });
      if (data) setEvents(data);
    } catch {
      // ignore
    }
  }

  async function loadSessionStatuses() {
    try {
      const { data } = await supabase
        .from('cooking_class_session_statuses')
        .select('*')
        .order('sort_order', { ascending: true });
      if (data) setSessionStatuses(data);
    } catch {
      // ignore
    }
  }

  async function loadAllDateRows() {
    try {
      const { data } = await supabase
        .from('cooking_class_event_dates')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!data) return;

      // General rows (no event_id)
      const generalRows = data.filter((r: any) => !r.event_id);
      const filledGeneral: EventDateRow[] = generalRows.map((r: any) => ({
        id: r.id,
        event_id: '',
        event_date: r.event_date || '',
        start_time: r.start_time || '',
        end_time: r.end_time || '',
        location: r.location || defaultLocation,
        sort_order: r.sort_order || 0,
        seating: r.seating || 0,
        status_id: r.status_id || '',
        class_fee: r.class_fee != null ? String(r.class_fee) : '',
        child_fee: r.child_fee != null ? String(r.child_fee) : '',
        session_name: r.session_name || '',
      }));
      setGeneralDateRows(filledGeneral);

      // Per-event rows
      const perEventMap: Record<string, EventDateRow[]> = {};
      const eventRows = data.filter((r: any) => r.event_id);
      eventRows.forEach((r: any) => {
        if (!perEventMap[r.event_id]) perEventMap[r.event_id] = [];
        perEventMap[r.event_id].push({
          id: r.id,
          event_id: r.event_id,
          event_date: r.event_date || '',
          start_time: r.start_time || '',
          end_time: r.end_time || '',
          location: r.location || defaultLocation,
          sort_order: r.sort_order || 0,
          seating: r.seating || 0,
          status_id: r.status_id || '',
          class_fee: r.class_fee != null ? String(r.class_fee) : '',
          child_fee: r.child_fee != null ? String(r.child_fee) : '',
          session_name: r.session_name || '',
        });
      });
      setEventDateRows(perEventMap);
    } catch {
      // ignore
    }
  }

  function initEventDateRows() {
    setEventDateRows(prev => {
      const updated = { ...prev };
      events.forEach(ev => {
        if (!updated[ev.id] || updated[ev.id].length === 0) {
          updated[ev.id] = [{ ...EMPTY_DATE_ROW(ev.id, 0, defaultLocation) }];
        }
      });
      return updated;
    });
  }

  function addGeneralSession() {
    setGeneralDateRows(prev => [...prev, { ...EMPTY_DATE_ROW('', prev.length, defaultLocation) }]);
  }

  function removeGeneralSession(index: number) {
    setGeneralDateRows(prev => prev.filter((_, i) => i !== index));
  }

  function addEventSession(eventId: string) {
    setEventDateRows(prev => {
      const rows = prev[eventId] || [];
      return { ...prev, [eventId]: [...rows, { ...EMPTY_DATE_ROW(eventId, rows.length, defaultLocation) }] };
    });
  }

  function removeEventSession(eventId: string, index: number) {
    setEventDateRows(prev => {
      const rows = (prev[eventId] || []).filter((_, i) => i !== index);
      return { ...prev, [eventId]: rows.length > 0 ? rows : [{ ...EMPTY_DATE_ROW(eventId, 0, defaultLocation) }] };
    });
  }

  async function loadRegistrations() {
    setLoadingRegs(true);
    setRegsError('');
    try {
      const { data, error } = await supabase
        .from('cooking_class_registrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRegistrations(data || []);
    } catch (err: any) {
      setRegsError(err?.message || 'Failed to load registrations');
    } finally {
      setLoadingRegs(false);
    }
  }

  async function handleFlyerFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSaveError('');
    try {
      const ext = file.name.split('.').pop();
      const path = `flyer-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('cooking-class-flyers')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('cooking-class-flyers').getPublicUrl(path);
      setFlyerUrl(urlData?.publicUrl || '');
      setSaveSuccess('Flyer uploaded! Click Save Settings to apply.');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to upload flyer');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveFlyer() {
    if (readOnly) return;
    setFlyerUrl('');
    setSaveSuccess('');
    setSaveError('');
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from('cooking_class_settings')
          .update({ flyer_image_url: null, flyer_image_path: null, updated_at: new Date().toISOString() })
          .eq('id', settings.id);
        if (error) throw error;
        setSettings(prev => prev ? { ...prev, flyer_image_url: null, flyer_image_path: null } : prev);
        setSaveSuccess('Flyer image removed.');
        setTimeout(() => setSaveSuccess(''), 3000);
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to remove flyer');
    }
  }

  async function handleSaveSettings() {
    if (readOnly) return;
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const payload = {
        flyer_image_url: flyerUrl || null,
        sheet_id: sheetId || null,
        sheet_name: sheetName || 'Registrations',
        online_form_status: onlineFormStatus,
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('cooking_class_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cooking_class_settings')
          .insert({ ...payload, class_fee: 0 });
        if (error) throw error;
      }
      setSaveSuccess('Settings saved successfully!');
      await loadSettings();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleOnlineFormStatus(newStatus: 'active' | 'inactive') {
    setOnlineFormStatus(newStatus);
    setSavingFormStatus(true);
    setStatusSaveMsg('');
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from('cooking_class_settings')
          .update({ online_form_status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', settings.id);
        if (error) throw error;
        setSettings(prev => prev ? { ...prev, online_form_status: newStatus } : prev);
        setStatusSaveMsg('Saved');
      } else {
        const { data, error } = await supabase
          .from('cooking_class_settings')
          .insert({ online_form_status: newStatus, class_fee: 0, sheet_name: 'Registrations' })
          .select()
          .single();
        if (error) throw error;
        if (data) setSettings(data);
        setStatusSaveMsg('Saved');
      }
    } catch (err: any) {
      setStatusSaveMsg('Error: ' + (err?.message || 'Failed to save'));
      setOnlineFormStatus(newStatus === 'active' ? 'inactive' : 'active');
    } finally {
      setSavingFormStatus(false);
      setTimeout(() => setStatusSaveMsg(''), 3000);
    }
  }

  async function handleAddEvent() {
    if (readOnly) return;
    if (!newEventName.trim()) return;
    setSavingEvent(true);
    setEventMsg('');
    try {
      const { error } = await supabase.from('cooking_class_events').insert({
        name: newEventName.trim(),
        sort_order: events.length,
        is_active: true,
      });
      if (error) throw error;
      setNewEventName('');
      setEventMsg('Event added!');
      await loadEvents();
    } catch (err: any) {
      setEventMsg(err?.message || 'Failed to add event');
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeleteEvent(id: string) {
    if (readOnly) return;
    try {
      await supabase.from('cooking_class_events').delete().eq('id', id);
      await loadEvents();
    } catch {
      // ignore
    }
  }

  async function handleSaveEditEvent(id: string) {
    if (readOnly) return;
    if (!editingEventName.trim()) return;
    try {
      await supabase.from('cooking_class_events').update({ name: editingEventName.trim() }).eq('id', id);
      setEditingEventId(null);
      setEditingEventName('');
      await loadEvents();
    } catch {
      // ignore
    }
  }

  async function handleToggleEventActive(ev: ClassEvent) {
    if (readOnly) return;
    try {
      await supabase
        .from('cooking_class_events')
        .update({ is_active: !ev.is_active })
        .eq('id', ev.id);
      await loadEvents();
    } catch {
      // ignore
    }
  }

  async function handleAddStatus() {
    if (readOnly) return;
    if (!newStatusLabel.trim()) return;
    setSavingStatus(true);
    setStatusMsg('');
    try {
      const { error } = await supabase.from('cooking_class_session_statuses').insert({
        label: newStatusLabel.trim(),
        sort_order: sessionStatuses.length,
      });
      if (error) throw error;
      setNewStatusLabel('');
      setStatusMsg('Status added!');
      await loadSessionStatuses();
    } catch (err: any) {
      setStatusMsg(err?.message || 'Failed to add status');
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDeleteStatus(id: string) {
    if (readOnly) return;
    try {
      await supabase.from('cooking_class_session_statuses').delete().eq('id', id);
      await loadSessionStatuses();
    } catch {
      // ignore
    }
  }

  function updateGeneralDateRow(index: number, field: keyof Omit<EventDateRow, 'id'>, value: string | number) {
    setGeneralDateRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function updateEventDateRow(eventId: string, index: number, field: keyof Omit<EventDateRow, 'id'>, value: string | number) {
    setEventDateRows(prev => {
      const rows = [...(prev[eventId] || [])];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, [eventId]: rows };
    });
  }

  // Insert session rows; if the optional `child_fee` column hasn't been migrated
  // yet, gracefully retry without it so saving never breaks.
  async function insertDateRows(rows: Record<string, unknown>[]) {
    const { error } = await supabase.from('cooking_class_event_dates').insert(rows);
    if (error && /child_fee/i.test(error.message || '')) {
      const stripped = rows.map(({ child_fee, ...rest }) => rest);
      const retry = await supabase.from('cooking_class_event_dates').insert(stripped);
      if (retry.error) throw retry.error;
      return;
    }
    if (error) throw error;
  }

  async function handleSaveInstructor(eventId: string) {
    if (readOnly) return;
    const value = (instructorDrafts[eventId] ?? '').trim();
    setSavingInstructor(prev => ({ ...prev, [eventId]: true }));
    setInstructorMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      const { error } = await supabase
        .from('cooking_class_events')
        .update({ instructor: value || null })
        .eq('id', eventId);
      if (error) throw error;
      setInstructorMsg(prev => ({ ...prev, [eventId]: 'Instructor saved!' }));
      await loadEvents();
    } catch (err: any) {
      const raw = err?.message || '';
      const msg = /instructor|column/i.test(raw)
        ? 'Run the new migration to enable the Instructor field.' : (raw ||'Failed to save instructor');
      setInstructorMsg(prev => ({ ...prev, [eventId]: msg }));
    } finally {
      setSavingInstructor(prev => ({ ...prev, [eventId]: false }));
    }
  }

  async function handleSaveGeneralDates() {
    if (readOnly) return;
    setSavingGeneralDates(true);
    setGeneralDatesMsg('');
    try {
      // Delete existing general rows (no event_id)
      await supabase.from('cooking_class_event_dates').delete().is('event_id', null);

      const rowsToInsert = generalDateRows
        .filter(r => r.event_date || r.start_time || r.end_time)
        .map((r, i) => ({
          event_id: null,
          event_date: r.event_date || null,
          start_time: r.start_time || null,
          end_time: r.end_time || null,
          location: r.location || defaultLocation,
          sort_order: i,
          seating: r.seating || 0,
          status_id: r.status_id || null,
          class_fee: r.class_fee !== '' ? parseFloat(r.class_fee) : null,
          child_fee: r.child_fee !== '' ? parseFloat(r.child_fee) : null,
          session_name: r.session_name || null,
        }));

      if (rowsToInsert.length > 0) {
        await insertDateRows(rowsToInsert);
      }

      setGeneralDatesMsg('Event dates saved!');
      await loadAllDateRows();
    } catch (err: any) {
      setGeneralDatesMsg(err?.message || 'Failed to save event dates');
    } finally {
      setSavingGeneralDates(false);
    }
  }

  async function handleSaveEventDates(eventId: string) {
    if (readOnly) return;
    setSavingEventDates(prev => ({ ...prev, [eventId]: true }));
    setEventDatesMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      // Delete existing rows for this event
      await supabase.from('cooking_class_event_dates').delete().eq('event_id', eventId);

      const rows = eventDateRows[eventId] || [];
      const rowsToInsert = rows
        .filter(r => r.event_date || r.start_time || r.end_time)
        .map((r, i) => ({
          event_id: eventId,
          event_date: r.event_date || null,
          start_time: r.start_time || null,
          end_time: r.end_time || null,
          location: r.location || defaultLocation,
          sort_order: i,
          seating: r.seating || 0,
          status_id: r.status_id || null,
          class_fee: r.class_fee !== '' ? parseFloat(r.class_fee) : null,
          child_fee: r.child_fee !== '' ? parseFloat(r.child_fee) : null,
          session_name: r.session_name || null,
        }));

      if (rowsToInsert.length > 0) {
        await insertDateRows(rowsToInsert);
      }

      setEventDatesMsg(prev => ({ ...prev, [eventId]: 'Session dates saved!' }));
      await loadAllDateRows();
    } catch (err: any) {
      setEventDatesMsg(prev => ({ ...prev, [eventId]: err?.message || 'Failed to save session dates' }));
    } finally {
      setSavingEventDates(prev => ({ ...prev, [eventId]: false }));
    }
  }

  async function handleEventImageUpload(eventId: string, file: File) {
    if (readOnly) return;
    setUploadingEventImage(prev => ({ ...prev, [eventId]: true }));
    setEventImageMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      const ext = file.name.split('.').pop();
      const path = `class-event-${eventId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('cooking-class-flyers')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('cooking-class-flyers').getPublicUrl(path);
      const imageUrl = urlData?.publicUrl || '';
      const { error: updateErr } = await supabase
        .from('cooking_class_events')
        .update({ image_url: imageUrl, image_path: path })
        .eq('id', eventId);
      if (updateErr) throw updateErr;
      setEventImageMsg(prev => ({ ...prev, [eventId]: 'Image uploaded!' }));
      await loadEvents();
    } catch (err: any) {
      setEventImageMsg(prev => ({ ...prev, [eventId]: err?.message || 'Upload failed' }));
    } finally {
      setUploadingEventImage(prev => ({ ...prev, [eventId]: false }));
      setTimeout(() => setEventImageMsg(prev => ({ ...prev, [eventId]: '' })), 3000);
    }
  }

  async function handleRemoveEventImage(eventId: string, imagePath: string | null | undefined) {
    if (readOnly) return;
    setUploadingEventImage(prev => ({ ...prev, [eventId]: true }));
    setEventImageMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      if (imagePath) {
        await supabase.storage.from('cooking-class-flyers').remove([imagePath]);
      }
      const { error } = await supabase
        .from('cooking_class_events')
        .update({ image_url: null, image_path: null })
        .eq('id', eventId);
      if (error) throw error;
      setEventImageMsg(prev => ({ ...prev, [eventId]: 'Image removed' }));
      await loadEvents();
    } catch (err: any) {
      setEventImageMsg(prev => ({ ...prev, [eventId]: err?.message || 'Remove failed' }));
    } finally {
      setUploadingEventImage(prev => ({ ...prev, [eventId]: false }));
      setTimeout(() => setEventImageMsg(prev => ({ ...prev, [eventId]: '' })), 3000);
    }
  }

  async function handleSyncToSheet(regId: string) {
    if (readOnly) return;
    setSyncingId(regId);
    setSyncMsg('');
    try {
      const res = await fetch('/api/cooking-classes/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: regId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncMsg('Synced to sheet!');
      await loadRegistrations();
    } catch (err: any) {
      setSyncMsg(err?.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleMarkPaid(regId: string) {
    if (readOnly) return;
    await supabase
      .from('cooking_class_registrations')
      .update({ payment_status: 'paid' })
      .eq('id', regId);
    await loadRegistrations();
  }

  // (2) Delete registration — Super Admin only
  async function handleDeleteRegistration(regId: string) {
    setDeletingId(regId);
    try {
      await supabase.from('cooking_class_registrations').delete().eq('id', regId);
      setDeleteConfirmId(null);
      await loadRegistrations();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  // Reusable session card renderer — always expanded, with optional remove button
  function renderSessionCard(
    row: EventDateRow,
    index: number,
    onChange: (field: keyof Omit<EventDateRow, 'id'>, value: string | number) => void,
    onRemove?: () => void
  ) {
    const isFirst = index === 0;

    return (
      <div key={index} className="bg-[#FAF5EE] rounded-xl border border-[#EDE7DA] overflow-hidden">
        {/* Session header */}
        <div className="w-full flex items-center justify-between px-3 py-2.5 border-b border-[#EDE7DA]">
          <p className="text-xs font-semibold text-[#5C5347]">Session {index + 1}</p>
          {!isFirst && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"
              title="Remove session"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Session body — always visible */}
        <div className="px-3 pb-3 pt-2">
          {/* Session Name */}
          <div className="mb-2">
            <label className="block text-xs text-[#8C8278] mb-1">Session Name <span className="text-[#B0A89C] font-normal">— optional label for this session</span></label>
            <input
              type="text"
              value={row.session_name || ''}
              onChange={e => onChange('session_name', e.target.value)}
              placeholder="e.g. Morning Session, Weekend Workshop..."
              className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-[#8C8278] mb-1">Date</label>
              <input
                type="date"
                value={row.event_date || ''}
                onChange={e => onChange('event_date', e.target.value)}
                className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[#8C8278] mb-1">Start Time</label>
                <input
                  type="time"
                  value={row.start_time || ''}
                  onChange={e => onChange('start_time', e.target.value)}
                  className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8C8278] mb-1">End Time</label>
                <input
                  type="time"
                  value={row.end_time || ''}
                  onChange={e => onChange('end_time', e.target.value)}
                  className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                />
              </div>
            </div>
          </div>
          <div className="mb-2">
            <label className="block text-xs text-[#8C8278] mb-1">Location</label>
            <input
              type="text"
              value={row.location}
              onChange={e => onChange('location', e.target.value)}
              placeholder={defaultLocation || 'e.g. 14 Sergeant Street, Rondebosch East'}
              className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-[#8C8278] mb-1">Seating Capacity</label>
              <input
                type="number"
                min="0"
                value={row.seating || 0}
                onChange={e => onChange('seating', parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8C8278] mb-1">Status</label>
              <select
                value={row.status_id || ''}
                onChange={e => onChange('status_id', e.target.value)}
                className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
              >
                <option value="">— Status —</option>
                {sessionStatuses.map(st => (
                  <option key={st.id} value={st.id}>{st.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8C8278] mb-1">Class / Adult Fee (ZAR)</label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-[#5C5347]">R</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.class_fee || ''}
                  onChange={e => onChange('class_fee', e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                />
              </div>
            </div>
          </div>
          {/* Child fee — only applies to MIXED classes (name contains "Mixed"). */}
          <div className="mt-2">
            <label className="block text-xs text-[#8C8278] mb-1">
              Child Fee (ZAR) <span className="text-[#B0A89C]">— Mixed classes only; blank = same as Adult fee</span>
            </label>
            <div className="flex items-center gap-1 max-w-[160px]">
              <span className="text-xs font-semibold text-[#5C5347]">R</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.child_fee || ''}
                onChange={e => onChange('child_fee', e.target.value)}
                placeholder="0.00"
                className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* (2) Delete Confirmation Popup — Super Admin only */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1A1612] mb-2">Delete Registration</h3>
            <p className="text-sm text-[#5C5347] mb-6">
              Are you sure you want to permanently delete this registration? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 border border-[#DDD5C8] text-[#5C5347] py-2.5 rounded-xl font-semibold text-sm hover:bg-[#FAF5EE] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRegistration(deleteConfirmId)}
                disabled={deletingId === deleteConfirmId}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingId === deleteConfirmId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1612]">Cooking &amp; Baking Classes</h2>
        <p className="text-sm text-[#8C8278] mt-0.5">Manage class settings, flyer, events, and registrations</p>
      </div>

      {readOnly && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          You have view-only access to Cooking &amp; Baking Classes. Changes can only be made by an Admin or Super Admin.
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-[#e9e0cf] rounded-xl p-1 w-fit">
        {isAdminOrAbove && (
          <button
            onClick={() => setActiveSubTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === 'settings' ? 'bg-white text-[#C4622D] shadow-sm' : 'text-[#5C5347] hover:text-[#C4622D]'}`}
          >
            ⚙️ Settings
          </button>
        )}
        <button
          disabled
          className="px-4 py-2 rounded-lg text-sm font-medium text-[#B0A89E] cursor-not-allowed opacity-50"
        >
          📋 Registrations
        </button>
      </div>

      {/* SETTINGS TAB */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">

          {/* Online Form Status — shown at the very top of settings */}
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
            <h3 className="text-base font-semibold text-[#1A1612] mb-1">Online Form Status</h3>
            <p className="text-xs text-[#8C8278] mb-4">
              Controls whether customers can access the online booking form for in-person classes.
            </p>
            <div className="flex gap-3 items-center">
              <button
                type="button"
                disabled={savingFormStatus}
                onClick={() => handleToggleOnlineFormStatus('active')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  onlineFormStatus === 'active' ?'border-green-500 bg-green-50 text-green-700' :'border-[#DDD5C8] text-[#8C8278] hover:border-green-400'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${onlineFormStatus === 'active' ? 'bg-green-500' : 'bg-[#DDD5C8]'}`} />
                Active
              </button>
              <button
                type="button"
                disabled={savingFormStatus}
                onClick={() => handleToggleOnlineFormStatus('inactive')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  onlineFormStatus === 'inactive' ?'border-red-400 bg-red-50 text-red-600' :'border-[#DDD5C8] text-[#8C8278] hover:border-red-300'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${onlineFormStatus === 'inactive' ? 'bg-red-500' : 'bg-[#DDD5C8]'}`} />
                Inactive
              </button>
              {savingFormStatus && <span className="text-xs text-[#8C8278]">Saving…</span>}
              {statusSaveMsg && !savingFormStatus && (
                <span className={`text-xs font-medium ${statusSaveMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                  {statusSaveMsg.startsWith('Error') ? statusSaveMsg : '✓ Saved'}
                </span>
              )}
            </div>
            {onlineFormStatus === 'inactive' && (
              <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ The booking form is currently <strong>inactive</strong>. Customers will see "No online registration available — please contact our office for further information."
              </p>
            )}
          </div>

          {/* (4) Class Flyer Image — moved to top */}
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-base font-semibold text-[#1A1612]">Class Flyer Image</h3>
              <span className="text-xs text-[#8C8278] bg-[#F5F0E8] border border-[#EDE7DA] px-2 py-0.5 rounded-full">Optional</span>
            </div>

            {flyerUrl && (
              <div className="mb-4">
                <div className="rounded-xl overflow-hidden border border-[#EDE7DA]">
                  <img
                    src={flyerUrl}
                    alt="Current cooking class flyer"
                    className="w-full max-h-48 object-contain"
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleRemoveFlyer}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Remove Image
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Flyer Image URL</label>
                <input
                  type="url"
                  value={flyerUrl}
                  onChange={e => setFlyerUrl(e.target.value)}
                  placeholder="https://example.com/flyer.jpg"
                  className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8C8278]">
                <span>— or —</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Upload Flyer Image</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="bg-[#e9e0cf] border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#EDE7DA] transition-colors">
                    {uploading ? 'Uploading...' : 'Choose File'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFlyerFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* (4) Google Sheet Sync — Super Admin only, collapsible */}
          {isSuperAdmin && (
            <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => setSheetSyncCollapsed(prev => !prev)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF5EE] transition-colors"
              >
                <div className="text-left">
                  <h3 className="text-base font-semibold text-[#1A1612]">Google Sheet Sync</h3>
                  <p className="text-xs text-[#8C8278] mt-0.5">Confirmed registrations will be written to this sheet automatically.</p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Super Admin</span>
                  <span className="text-[#8C8278] text-sm">{sheetSyncCollapsed ? '▶' : '▼'}</span>
                </div>
              </button>

              {/* Collapsible body */}
              {!sheetSyncCollapsed && (
                <div className="px-5 pb-5 pt-1 border-t border-[#EDE7DA]">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Google Sheet ID</label>
                      <input
                        type="text"
                        value={sheetId}
                        onChange={e => setSheetId(e.target.value)}
                        placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                        className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] font-mono"
                      />
                      <p className="text-xs text-[#8C8278] mt-1">Found in the spreadsheet URL between /d/ and /edit</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sheet Tab Name</label>
                      <input
                        type="text"
                        value={sheetName}
                        onChange={e => setSheetName(e.target.value)}
                        placeholder="Registrations"
                        className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-sm text-green-700">{saveSuccess}</p>
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{saveError}</p>
            </div>
          )}

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          {/* ── Events Management ── */}
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
            <h3 className="text-base font-semibold text-[#1A1612] mb-1">Classes</h3>
            <p className="text-xs text-[#8C8278] mb-4">Add the events that will appear on the registration form (e.g. Kids Event, Adults Event, Leadership Workshop).</p>

            {events.length > 0 && (
              <div className="space-y-2 mb-4">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 bg-[#FAF5EE] rounded-xl px-3 py-2">
                    {editingEventId === ev.id ? (
                      <>
                        <input
                          type="text"
                          value={editingEventName}
                          onChange={e => setEditingEventName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEditEvent(ev.id); if (e.key === 'Escape') { setEditingEventId(null); setEditingEventName(''); } }}
                          className="flex-1 border border-[#C4622D] rounded-lg px-2 py-1 text-sm focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditEvent(ev.id)}
                          className="text-xs text-[#C4622D] hover:text-[#A04E22] px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingEventId(null); setEditingEventName(''); }}
                          className="text-xs text-[#8C8278] hover:text-[#1A1612] px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`flex-1 text-sm ${ev.is_active ? 'text-[#1A1612]' : 'text-[#8C8278] line-through'}`}>{ev.name}</span>
                        <button
                          onClick={() => handleToggleEventActive(ev)}
                          className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${ev.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {ev.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => { setEditingEventId(ev.id); setEditingEventName(ev.name); }}
                          className="text-xs text-[#C4622D] hover:text-[#A04E22] px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-2 py-1 rounded-xl hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddEvent(); }}
                placeholder="e.g. Kids Event, Leadership Workshop..."
                className="flex-1 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
              />
              <button
                onClick={handleAddEvent}
                disabled={savingEvent || !newEventName.trim()}
                className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
              >
                {savingEvent ? 'Adding...' : '+ Add'}
              </button>
            </div>
            {eventMsg && (
              <p className={`text-xs mt-2 ${eventMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{eventMsg}</p>
            )}
          </div>

          {/* ── Session Status Options ── */}
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
            <h3 className="text-base font-semibold text-[#1A1612] mb-1">Session Status Options</h3>
            <p className="text-xs text-[#8C8278] mb-4">Manage the status labels available for each session (e.g. Active, Fully Booked, Cancelled, Venue Change).</p>

            {sessionStatuses.length > 0 && (
              <div className="space-y-2 mb-4">
                {sessionStatuses.map(st => (
                  <div key={st.id} className="flex items-center gap-3 bg-[#FAF5EE] rounded-xl px-3 py-2">
                    <span className="flex-1 text-sm text-[#1A1612]">{st.label}</span>
                    <button
                      onClick={() => handleDeleteStatus(st.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-2 py-1 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newStatusLabel}
                onChange={e => setNewStatusLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddStatus(); }}
                placeholder="e.g. Active, Fully Booked, Cancelled..."
                className="flex-1 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
              />
              <button
                onClick={handleAddStatus}
                disabled={savingStatus || !newStatusLabel.trim()}
                className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
              >
                {savingStatus ? 'Adding...' : '+ Add'}
              </button>
            </div>
            {statusMsg && (
              <p className={`text-xs mt-2 ${statusMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{statusMsg}</p>
            )}
          </div>

          {/* (6) Per-event Session Details blocks — one per event, each collapsible */}
          {events.map(ev => {
            const isBlockCollapsed = collapsedEventBlocks[ev.id] ?? true;
            return (
              <div key={ev.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                {/* Event block header — always visible, click to collapse */}
                <button
                  type="button"
                  onClick={() => setCollapsedEventBlocks(prev => ({ ...prev, [ev.id]: !prev[ev.id] }))}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF5EE] transition-colors"
                >
                  <div className="text-left">
                    <h3 className="text-base font-semibold text-[#1A1612]">
                      Session Details — <span className="text-[#C4622D]">{ev.name}</span>
                    </h3>
                    <p className="text-xs text-[#8C8278] mt-0.5">
                      Enter sessions specific to <strong>{ev.name}</strong>. When a customer selects this event, only these dates will appear under "Select Attendance".
                    </p>
                  </div>
                  <span className="text-[#8C8278] text-sm ml-4 flex-shrink-0">{isBlockCollapsed ? '▶' : '▼'}</span>
                </button>

                {/* Event block body — collapsible */}
                {!isBlockCollapsed && (
                  <div className="px-5 pb-5">
                    {/* Event Image */}
                    <div className="mb-5 pb-5 border-b border-[#EDE7DA]">
                      <h4 className="text-sm font-semibold text-[#1A1612] mb-3">Event Image</h4>
                      {ev.image_url && (
                        <div className="mb-3 rounded-xl overflow-hidden border border-[#EDE7DA] max-w-xs">
                          <img src={ev.image_url} alt={`${ev.name} class image`} className="w-full max-h-40 object-contain" />
                        </div>
                      )}
                      {!readOnly && (
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="bg-[#e9e0cf] border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#EDE7DA] transition-colors">
                              {uploadingEventImage[ev.id] ? 'Uploading…' : ev.image_url ? 'Replace Image' : 'Upload Image'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingEventImage[ev.id]}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleEventImageUpload(ev.id, f); e.target.value = ''; }}
                              className="hidden"
                            />
                          </label>
                          {ev.image_url && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEventImage(ev.id, ev.image_path)}
                              disabled={uploadingEventImage[ev.id]}
                              className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Remove Image
                            </button>
                          )}
                        </div>
                      )}
                      {eventImageMsg[ev.id] && (
                        <p className={`text-xs mt-2 ${eventImageMsg[ev.id].includes('failed') || eventImageMsg[ev.id].includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{eventImageMsg[ev.id]}</p>
                      )}
                    </div>

                    {/* Instructor / Chef — optional provision, shown on the public class card */}
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">
                        Instructor / Chef <span className="text-[#B0A89C] font-normal">— optional, shown on the class card</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={instructorDrafts[ev.id] ?? ev.instructor ?? ''}
                          onChange={e => setInstructorDrafts(prev => ({ ...prev, [ev.id]: e.target.value }))}
                          placeholder="e.g. Chef Nisreen"
                          disabled={readOnly}
                          className="flex-1 border border-[#DDD5C8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-gray-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInstructor(ev.id)}
                          disabled={readOnly || !!savingInstructor[ev.id]}
                          className="bg-[#C4622D] text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                        >
                          {savingInstructor[ev.id] ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                      {instructorMsg[ev.id] && (
                        <p className={`text-xs mt-1 ${/Failed|migration/i.test(instructorMsg[ev.id]) ? 'text-red-500' : 'text-green-600'}`}>{instructorMsg[ev.id]}</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(eventDateRows[ev.id] || [{ ...EMPTY_DATE_ROW(ev.id, 0) }]).map((row, i) =>
                        renderSessionCard(row, i, (field, value) => updateEventDateRow(ev.id, i, field, value), i > 0 ? () => removeEventSession(ev.id, i) : undefined)
                      )}
                    </div>

                    {/* + Add another session button */}
                    <button
                      type="button"
                      onClick={() => addEventSession(ev.id)}
                      className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-[#C4622D] text-[#C4622D] rounded-xl py-2.5 text-sm font-medium hover:bg-[#FFF8F4] transition-colors"
                    >
                      <span className="text-lg leading-none">+</span>
                      Add another session
                    </button>

                    {eventDatesMsg[ev.id] && (
                      <p className={`text-xs mt-3 ${eventDatesMsg[ev.id].includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{eventDatesMsg[ev.id]}</p>
                    )}

                    <button
                      onClick={() => handleSaveEventDates(ev.id)}
                      disabled={savingEventDates[ev.id]}
                      className="mt-4 bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                    >
                      {savingEventDates[ev.id] ? 'Saving...' : `Save ${ev.name} Session(s)`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      )}

      {/* REGISTRATIONS TAB */}
      {activeSubTab === 'registrations' && (
        <div>
          {syncMsg && (
            <div className={`border rounded-xl p-3 mb-4 ${syncMsg.toLowerCase().includes('synced') || syncMsg === 'Synced to sheet!' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-sm ${syncMsg.toLowerCase().includes('synced') || syncMsg === 'Synced to sheet!' ? 'text-green-700' : 'text-red-700'}`}>{syncMsg}</p>
              {(syncMsg.toLowerCase().includes('oauth') || syncMsg.toLowerCase().includes('google_client') || syncMsg.toLowerCase().includes('refresh_token')) && (
                <p className="text-xs text-red-600 mt-1">
                  To enable Google Sheets sync, add <strong>GOOGLE_CLIENT_ID</strong>, <strong>GOOGLE_CLIENT_SECRET</strong>, and <strong>GOOGLE_REFRESH_TOKEN</strong> to your environment variables.
                </p>
              )}
            </div>
          )}

          {loadingRegs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : regsError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600">{regsError}</p>
            </div>
          ) : registrations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center">
              <span className="text-4xl">📋</span>
              <p className="text-[#8C8278] mt-3 text-sm">No registrations yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {registrations.map(reg => (
                <div key={reg.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-[#1A1612]">
                          {reg.title} {reg.first_name} {reg.surname}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[reg.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                          {reg.payment_status}
                        </span>
                        {reg.synced_to_sheet && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">✓ Synced</span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C5347]">{reg.email} · {reg.cellphone}</p>
                      <p className="text-xs text-[#8C8278] mt-1">
                        Events: {(reg.selected_events || []).join(', ')}
                      </p>
                      {reg.adult_class_dates?.length > 0 && (
                        <p className="text-xs text-[#8C8278]">
                          Dates: {reg.adult_class_dates.join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-[#8C8278] mt-1">
                        Payment: {reg.payment_method === 'payfast' ? 'PayFast' : 'EFT'}
                        {reg.amount ? ` · R${Number(reg.amount).toFixed(2)}` : ''}
                        {' · '}{new Date(reg.created_at).toLocaleDateString('en-ZA')}
                      </p>
                      {(reg.proof_of_payment_path || reg.proof_of_payment_url) && (
                        <button
                          onClick={async () => {
                            const supabase = createClient();
                            const filePath = reg.proof_of_payment_path || (() => {
                              try {
                                const url = new URL(reg.proof_of_payment_url!);
                                const parts = url.pathname.split('/cooking-class-proofs/');
                                return parts[1] || null;
                              } catch { return null; }
                            })();
                            if (!filePath) return;
                            const { data, error } = await supabase.storage
                              .from('cooking-class-proofs')
                              .createSignedUrl(filePath, 60);
                            if (error || !data?.signedUrl) {
                              alert('Could not generate proof of payment link. Please try again.');
                              return;
                            }
                            window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-xs text-[#C4622D] hover:underline mt-1 inline-block cursor-pointer bg-transparent border-none p-0"
                        >
                          View Proof of Payment ↗
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {/* (3) 'Mark Paid' button — orange background with white text */}
                      {reg.payment_status === 'awaiting_confirmation' && (
                        <button
                          onClick={() => handleMarkPaid(reg.id)}
                          className="text-xs bg-[#C4622D] text-white px-3 py-1.5 rounded-lg hover:bg-[#A04E22] transition-colors font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                      {!reg.synced_to_sheet && (
                        <button
                          onClick={() => handleSyncToSheet(reg.id)}
                          disabled={syncingId === reg.id}
                          className="text-xs bg-[#e9e0cf] border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-lg hover:bg-[#EDE7DA] transition-colors font-medium disabled:opacity-50"
                        >
                          {syncingId === reg.id ? 'Syncing...' : 'Sync to Sheet'}
                        </button>
                      )}
                      {/* (2) Delete button — Super Admin only, triggers confirmation popup */}
                      {isSuperAdmin && (
                        <button
                          onClick={() => setDeleteConfirmId(reg.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
