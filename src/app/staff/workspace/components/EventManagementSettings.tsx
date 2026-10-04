'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { marketingFieldsFromSession, type BookableSession } from '@/lib/event-management-sync';

interface EventSettings {
  id: string;
  flyer_image_url: string | null;
  flyer_image_path: string | null;
  sheet_id: string | null;
  sheet_name: string | null;
  event_fee: number;
  online_form_status: string | null;
}

interface MgmtEvent {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
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
  event_fee: string;
  session_name: string;
}

interface EventManagementSettingsProps {
  isSuperAdmin?: boolean;
  readOnly?: boolean;
  isAdminOrAbove?: boolean;
}

const EMPTY_DATE_ROW = (eventId = '', sortOrder = 0, defaultLoc = ''): Omit<EventDateRow, 'id'> => ({
  event_id: eventId,
  event_date: '',
  start_time: '',
  end_time: '',
  location: defaultLoc,
  sort_order: sortOrder,
  seating: 0,
  status_id: '',
  event_fee: '',
  session_name: '',
});

export default function EventManagementSettings({ isSuperAdmin = false, readOnly = false, isAdminOrAbove = false }: EventManagementSettingsProps) {
  const supabase = createClient();
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savingFormStatus, setSavingFormStatus] = useState(false);
  const [statusSaveMsg, setStatusSaveMsg] = useState('');

  const [flyerUrl, setFlyerUrl] = useState('');
  const [eventFee, setEventFee] = useState('');
  const [onlineFormStatus, setOnlineFormStatus] = useState<'active' | 'inactive'>('active');

  const [events, setEvents] = useState<MgmtEvent[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventMsg, setEventMsg] = useState('');

  const [sessionStatuses, setSessionStatuses] = useState<SessionStatus[]>([]);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [eventDateRows, setEventDateRows] = useState<Record<string, EventDateRow[]>>({});
  const [savingEventDates, setSavingEventDates] = useState<Record<string, boolean>>({});
  const [eventDatesMsg, setEventDatesMsg] = useState<Record<string, string>>({});
  const [collapsedEventBlocks, setCollapsedEventBlocks] = useState<Record<string, boolean>>({});

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventName, setEditingEventName] = useState('');
  const [savingEventName, setSavingEventName] = useState(false);

  // Event Fee validation popup state
  const [feeValidationPopup, setFeeValidationPopup] = useState<{ visible: boolean; eventId: string | null }>({ visible: false, eventId: null });

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
    if (events.length > 0) initEventDateRows();
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
      const { data } = await supabase.from('event_management_settings').select('*').limit(1).single();
      if (data) {
        setSettings(data);
        setFlyerUrl(data.flyer_image_url || '');
        setEventFee(data.event_fee != null ? String(data.event_fee) : '');
        setOnlineFormStatus(data.online_form_status === 'inactive' ? 'inactive' : 'active');
      }
    } catch { /* no settings yet */ }
    finally { setLoading(false); }
  }

  async function loadEvents() {
    try {
      const { data } = await supabase.from('event_management_events').select('*').order('sort_order', { ascending: true });
      if (data) setEvents(data);
    } catch { /* ignore */ }
  }

  async function loadSessionStatuses() {
    try {
      const { data } = await supabase.from('event_management_session_statuses').select('*').order('sort_order', { ascending: true });
      if (data) setSessionStatuses(data);
    } catch { /* ignore */ }
  }

  async function loadAllDateRows() {
    try {
      const { data } = await supabase.from('event_management_event_dates').select('*').order('sort_order', { ascending: true });
      if (!data) return;
      const perEventMap: Record<string, EventDateRow[]> = {};
      data.forEach((r: any) => {
        if (!r.event_id) return;
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
          event_fee: r.event_fee != null ? String(r.event_fee) : '',
          session_name: r.session_name || '',
        });
      });
      setEventDateRows(perEventMap);
    } catch { /* ignore */ }
  }

  function initEventDateRows() {
    setEventDateRows(prev => {
      const updated = { ...prev };
      events.forEach(ev => {
        if (!updated[ev.id]) updated[ev.id] = [{ ...EMPTY_DATE_ROW(ev.id, 0, defaultLocation), event_fee: eventFee || '' }];
      });
      return updated;
    });
  }

  async function saveSettings() {
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const payload = {
        flyer_image_url: flyerUrl || null,
        event_fee: Number(eventFee) || 0,
        updated_at: new Date().toISOString(),
      };
      if (settings?.id) {
        const { error } = await supabase.from('event_management_settings').update(payload).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_management_settings').insert({ ...payload, online_form_status: 'active' });
        if (error) throw error;
      }
      const newFee = Number(eventFee) || 0;
      if (newFee > 0) {
        const { error: syncError } = await supabase
          .from('event_management_event_dates')
          .update({ event_fee: newFee })
          .not('event_id', 'is', null);
        if (syncError) throw syncError;
        await loadAllDateRows();
        for (const ev of events) {
          await syncLinkedMarketingEvents(ev.id);
        }
      }
      setSaveSuccess(newFee > 0 ? 'Settings saved — all session fees updated to match default' : 'Settings saved successfully');
      await loadSettings();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
      setTimeout(() => { setSaveSuccess(''); setSaveError(''); }, 3000);
    }
  }

  async function saveFormStatus() {
    setSavingFormStatus(true);
    setStatusSaveMsg('');
    try {
      if (settings?.id) {
        await supabase.from('event_management_settings').update({ online_form_status: onlineFormStatus, updated_at: new Date().toISOString() }).eq('id', settings.id);
      }
      setStatusSaveMsg('Status updated');
    } catch { setStatusSaveMsg('Failed to update status'); }
    finally {
      setSavingFormStatus(false);
      setTimeout(() => setStatusSaveMsg(''), 3000);
    }
  }

  async function addEvent() {
    if (!newEventName.trim()) return;
    setSavingEvent(true);
    setEventMsg('');
    try {
      const { error } = await supabase.from('event_management_events').insert({ name: newEventName.trim(), sort_order: events.length, is_active: true });
      if (error) throw error;
      setNewEventName('');
      setEventMsg('Event added');
      await loadEvents();
    } catch (err: any) {
      setEventMsg(err.message || 'Failed to add event');
    } finally {
      setSavingEvent(false);
      setTimeout(() => setEventMsg(''), 3000);
    }
  }

  async function toggleEventActive(ev: MgmtEvent) {
    try {
      await supabase.from('event_management_events').update({ is_active: !ev.is_active }).eq('id', ev.id);
      await loadEvents();
    } catch { /* ignore */ }
  }

  async function deleteEvent(id: string) {
    setDeletingId(id);
    try {
      await supabase.from('event_management_events').delete().eq('id', id);
      setDeleteConfirmId(null);
      await loadEvents();
      await loadAllDateRows();
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  async function syncLinkedMarketingEvents(mgmtEventId: string, eventName?: string) {
    const mgmtName = eventName || events.find(e => e.id === mgmtEventId)?.name;
    if (!mgmtName) return;

    const defaultFee = Number(eventFee) || Number(settings?.event_fee) || 0;
    const { data: linkedCards } = await supabase
      .from('events')
      .select('id, event_management_session_id')
      .eq('event_management_event_id', mgmtEventId)
      .eq('is_registered', true);

    if (!linkedCards?.length) return;

    const sessionIds = linkedCards
      .map(c => c.event_management_session_id)
      .filter((id): id is string => !!id);

    if (!sessionIds.length) return;

    const { data: sessions } = await supabase
      .from('event_management_event_dates')
      .select('id, event_id, event_date, start_time, end_time, location, event_fee')
      .in('id', sessionIds);

    if (!sessions?.length) return;

    const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));

    await Promise.all(
      linkedCards.map(async card => {
        if (!card.event_management_session_id) return;
        const session = sessionMap[card.event_management_session_id] as BookableSession | undefined;
        if (!session) return;
        const fields = marketingFieldsFromSession(mgmtName, session, defaultFee);
        await supabase.from('events').update(fields).eq('id', card.id);
      })
    );
  }

  async function updateEventName(id: string) {
    if (!editingEventName.trim()) return;
    setSavingEventName(true);
    try {
      const { error } = await supabase.from('event_management_events').update({ name: editingEventName.trim() }).eq('id', id);
      if (error) throw error;
      await syncLinkedMarketingEvents(id, editingEventName.trim());
      setEditingEventId(null);
      setEditingEventName('');
      await loadEvents();
    } catch { /* ignore */ }
    finally { setSavingEventName(false); }
  }

  async function addStatus() {
    if (!newStatusLabel.trim()) return;
    setSavingStatus(true);
    setStatusMsg('');
    try {
      const { error } = await supabase.from('event_management_session_statuses').insert({ label: newStatusLabel.trim(), sort_order: sessionStatuses.length });
      if (error) throw error;
      setNewStatusLabel('');
      setStatusMsg('Status added');
      await loadSessionStatuses();
    } catch (err: any) {
      setStatusMsg(err.message || 'Failed to add status');
    } finally {
      setSavingStatus(false);
      setTimeout(() => setStatusMsg(''), 3000);
    }
  }

  async function deleteStatus(id: string) {
    try {
      await supabase.from('event_management_session_statuses').delete().eq('id', id);
      await loadSessionStatuses();
    } catch { /* ignore */ }
  }

  function updateDateRow(eventId: string, idx: number, field: keyof EventDateRow, value: string | number) {
    setEventDateRows(prev => {
      const rows = [...(prev[eventId] || [])];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, [eventId]: rows };
    });
  }

  function addDateRow(eventId: string) {
    setEventDateRows(prev => {
      const rows = prev[eventId] || [];
      return {
        ...prev,
        [eventId]: [...rows, { ...EMPTY_DATE_ROW(eventId, rows.length, defaultLocation), event_fee: eventFee || '' }],
      };
    });
  }

  function removeDateRow(eventId: string, idx: number) {
    setEventDateRows(prev => {
      const rows = [...(prev[eventId] || [])];
      rows.splice(idx, 1);
      return { ...prev, [eventId]: rows.length > 0 ? rows : [{ ...EMPTY_DATE_ROW(eventId, 0, defaultLocation) }] };
    });
  }

  function validateEventFees(eventId: string): boolean {
    const rows = eventDateRows[eventId] || [];
    return rows.every(r => {
      const fee = Number(r.event_fee);
      return !isNaN(fee) && fee > 0;
    });
  }

  async function saveEventDates(eventId: string) {
    if (!validateEventFees(eventId)) {
      setFeeValidationPopup({ visible: true, eventId });
      return;
    }
    setSavingEventDates(prev => ({ ...prev, [eventId]: true }));
    setEventDatesMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      const rows = eventDateRows[eventId] || [];

      const rowsToSave = rows
        .filter(r => r.event_date && r.event_date.trim() !== '')
        .map((r, i) => ({
          id: r.id,
          event_id: eventId,
          event_date: r.event_date,
          start_time: r.start_time || null,
          end_time: r.end_time || null,
          location: r.location || defaultLocation,
          sort_order: i,
          seating: Number(r.seating) || 0,
          status_id: r.status_id || null,
          event_fee: r.event_fee !== '' ? Number(r.event_fee) : null,
          session_name: r.session_name || null,
        }));

      const keptIds = rowsToSave.filter(r => r.id).map(r => r.id as string);
      const { data: existingRows } = await supabase
        .from('event_management_event_dates')
        .select('id')
        .eq('event_id', eventId);

      const idsToRemove = (existingRows || [])
        .map(r => r.id)
        .filter(id => !keptIds.includes(id));

      if (idsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('event_management_event_dates')
          .delete()
          .in('id', idsToRemove);
        if (deleteError) throw deleteError;
      }

      for (let i = 0; i < rowsToSave.length; i++) {
        const r = rowsToSave[i];
        const payload = {
          event_id: eventId,
          event_date: r.event_date,
          start_time: r.start_time || null,
          end_time: r.end_time || null,
          location: r.location || defaultLocation,
          sort_order: i,
          seating: Number(r.seating) || 0,
          status_id: r.status_id || null,
          event_fee: r.event_fee,
          session_name: r.session_name || null,
        };

        if (r.id) {
          const { error: updateError } = await supabase
            .from('event_management_event_dates')
            .update(payload)
            .eq('id', r.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('event_management_event_dates')
            .insert(payload);
          if (insertError) throw insertError;
        }
      }

      await syncLinkedMarketingEvents(eventId);

      setEventDatesMsg(prev => ({ ...prev, [eventId]: 'Saved' }));
      await loadAllDateRows();
    } catch (err: any) {
      setEventDatesMsg(prev => ({ ...prev, [eventId]: err.message || 'Failed to save' }));
    } finally {
      setSavingEventDates(prev => ({ ...prev, [eventId]: false }));
      setTimeout(() => setEventDatesMsg(prev => ({ ...prev, [eventId]: '' })), 3000);
    }
  }

  async function handleEventImageUpload(eventId: string, file: File) {
    if (readOnly) return;
    setUploadingEventImage(prev => ({ ...prev, [eventId]: true }));
    setEventImageMsg(prev => ({ ...prev, [eventId]: '' }));
    try {
      const ext = file.name.split('.').pop();
      const path = `event-${eventId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('cooking-class-flyers')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('cooking-class-flyers').getPublicUrl(path);
      const imageUrl = urlData?.publicUrl || '';
      const { error: updateErr } = await supabase
        .from('event_management_events')
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
        .from('event_management_events')
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

  // Reusable session card renderer — always expanded, with optional remove button
  function renderSessionCard(
    row: EventDateRow,
    index: number,
    onChange: (field: keyof EventDateRow, value: string | number) => void,
    onRemove?: () => void
  ) {
    const isFirst = index === 0;
    return (
      <div className="bg-[#FAF5EE] rounded-xl border border-[#EDE7DA] overflow-hidden">
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
        {/* Session body */}
        <div className="px-3 pb-3 pt-2">
          {/* Session Name */}
          <div className="mb-2">
            <label className="block text-xs text-[#8C8278] mb-1">Session Name <span className="text-[#B0A89C] font-normal">— optional label for this session</span></label>
            <input
              type="text"
              value={row.session_name || ''}
              onChange={e => onChange('session_name', e.target.value)}
              disabled={readOnly}
              placeholder="e.g. Morning Session, Weekend Workshop..."
              className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-[#F5F0E8]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-[#8C8278] mb-1">Date</label>
              <input
                type="date"
                value={row.event_date || ''}
                onChange={e => onChange('event_date', e.target.value)}
                disabled={readOnly}
                className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-[#F5F0E8]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[#8C8278] mb-1">Start Time</label>
                <input
                  type="time"
                  value={row.start_time || ''}
                  onChange={e => onChange('start_time', e.target.value)}
                  disabled={readOnly}
                  className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-[#F5F0E8]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8C8278] mb-1">End Time</label>
                <input
                  type="time"
                  value={row.end_time || ''}
                  onChange={e => onChange('end_time', e.target.value)}
                  disabled={readOnly}
                  className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-[#F5F0E8]"
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
              disabled={readOnly}
              placeholder={defaultLocation || 'e.g. 14 Sergeant Street, Rondebosch East'}
              className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-[#F5F0E8]"
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
                disabled={readOnly}
                placeholder="0"
                className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-[#F5F0E8]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8C8278] mb-1">Status</label>
              <select
                value={row.status_id || ''}
                onChange={e => onChange('status_id', e.target.value)}
                disabled={readOnly}
                className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-[#F5F0E8]"
              >
                <option value="">— Status —</option>
                {sessionStatuses.map(st => (
                  <option key={st.id} value={st.id}>{st.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8C8278] mb-1">Event Fee (ZAR)</label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-[#5C5347]">R</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.event_fee || ''}
                  onChange={e => onChange('event_fee', e.target.value)}
                  disabled={readOnly}
                  placeholder="0.00"
                  className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white disabled:bg-[#F5F0E8]"
                />
              </div>
              <p className="text-[10px] text-[#8C8278] mt-0.5">Used for this session when set; otherwise Default Event Fee applies</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">🎪</span>
        <h2 className="text-xl font-bold text-[#1A1612]">Event Management Settings</h2>
      </div>

      {/* Online Form Status */}
      <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
        <h3 className="text-base font-semibold text-[#1A1612] mb-4">Online Form Status</h3>
        <div className="flex gap-6 mb-4">
          {(['active', 'inactive'] as const).map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="formStatus"
                value={opt}
                checked={onlineFormStatus === opt}
                onChange={() => setOnlineFormStatus(opt)}
                disabled={readOnly}
                className="w-4 h-4 text-[#C4622D] border-[#DDD5C8] focus:ring-[#C4622D]"
              />
              <span className="text-sm text-[#1A1612] capitalize">{opt}</span>
            </label>
          ))}
        </div>
        {!readOnly && (
          <button
            onClick={saveFormStatus}
            disabled={savingFormStatus}
            className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
          >
            {savingFormStatus ? 'Saving…' : 'Save Status'}
          </button>
        )}
        {statusSaveMsg && <p className="text-xs text-green-600 mt-2">{statusSaveMsg}</p>}
      </div>

      {/* Events */}
      <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
        <h3 className="text-base font-semibold text-[#1A1612] mb-4">Events</h3>
        <div className="space-y-2 mb-4">
          {events.length === 0 && <p className="text-sm text-[#8C8278] italic">No events yet.</p>}
          {events.map(ev => (
            <div key={ev.id} className="flex items-center justify-between gap-3 bg-[#FAF5EE] border border-[#EDE7DA] rounded-xl px-4 py-2.5">
              {editingEventId === ev.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editingEventName}
                    onChange={e => setEditingEventName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') updateEventName(ev.id); if (e.key === 'Escape') { setEditingEventId(null); setEditingEventName(''); } }}
                    className="flex-1 border border-[#C4622D] rounded-lg px-2 py-1 text-sm focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => updateEventName(ev.id)} disabled={savingEventName || !editingEventName.trim()} className="text-xs text-white bg-[#C4622D] hover:bg-[#A04E22] px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                    {savingEventName ? '…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditingEventId(null); setEditingEventName(''); }} className="text-xs text-[#5C5347] hover:text-[#C4622D] px-2 py-1 rounded-lg border border-[#DDD5C8]">Cancel</button>
                </div>
              ) : (
                <span className={`text-sm font-medium ${ev.is_active ? 'text-[#1A1612]' : 'text-[#8C8278] line-through'}`}>{ev.name}</span>
              )}
              {!readOnly && editingEventId !== ev.id && (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingEventId(ev.id); setEditingEventName(ev.name); }} className="text-xs text-[#5C5347] hover:text-[#C4622D] transition-colors px-2 py-1 rounded-lg border border-[#DDD5C8] hover:border-[#C4622D]">
                    Edit
                  </button>
                  <button onClick={() => toggleEventActive(ev)} className={`text-xs text-white transition-colors px-2 py-1 rounded-lg ${ev.is_active ? 'bg-black hover:bg-[#222]' : 'bg-[#C4622D] hover:bg-[#A04E22]'}`}>
                    {ev.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  {deleteConfirmId === ev.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteEvent(ev.id)} disabled={deletingId === ev.id} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                        {deletingId === ev.id ? '…' : 'Confirm'}
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-[#5C5347] hover:text-[#C4622D] px-2 py-1 rounded-lg border border-[#DDD5C8]">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(ev.id)} className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-2 py-1 rounded-xl hover:bg-red-50 transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newEventName}
              onChange={e => setNewEventName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEvent()}
              placeholder="New event name"
              className="flex-1 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
            />
            <button onClick={addEvent} disabled={savingEvent || !newEventName.trim()} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
              {savingEvent ? '…' : '+ Add'}
            </button>
          </div>
        )}
        {eventMsg && <p className="text-xs text-green-600 mt-2">{eventMsg}</p>}
      </div>

      {/* Session Statuses */}
      <div className="bg-white border border-[#EDE7DA] rounded-2xl p-5">
        <h3 className="text-base font-semibold text-[#1A1612] mb-4">Session Statuses</h3>
        <div className="space-y-2 mb-4">
          {sessionStatuses.length === 0 && <p className="text-sm text-[#8C8278] italic">No statuses yet.</p>}
          {sessionStatuses.map(st => (
            <div key={st.id} className="flex items-center justify-between gap-3 bg-[#FAF5EE] border border-[#EDE7DA] rounded-xl px-4 py-2.5">
              <span className="text-sm font-medium text-[#1A1612]">{st.label}</span>
              {!readOnly && (
                <button onClick={() => deleteStatus(st.id)} className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-2 py-1 rounded-xl hover:bg-red-50 transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete</button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newStatusLabel}
              onChange={e => setNewStatusLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStatus()}
              placeholder="New status label"
              className="flex-1 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
            />
            <button onClick={addStatus} disabled={savingStatus || !newStatusLabel.trim()} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
              {savingStatus ? '…' : '+ Add'}
            </button>
          </div>
        )}
        {statusMsg && <p className="text-xs text-green-600 mt-2">{statusMsg}</p>}
      </div>

      {/* Per-event Session Details */}
      {events.map(ev => {
        const rows = eventDateRows[ev.id] || [];
        const isCollapsed = collapsedEventBlocks[ev.id] ?? !ev.is_active;
        return (
          <div key={ev.id} className="bg-white border border-[#EDE7DA] rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsedEventBlocks(prev => ({ ...prev, [ev.id]: !prev[ev.id] }))}
              className="w-full flex items-center justify-between px-5 py-4 bg-[#F5F0E8] hover:bg-[#EDE7DA] transition-colors"
            >
              <span className="text-sm font-semibold text-[#1A1612]">Session Details — {ev.name}</span>
              <span className="text-xs text-[#8C8278]">{isCollapsed ? '▼' : '▲'}</span>
            </button>
            {!isCollapsed && (
              <div className="p-5">
                {/* Event Image */}
                <div className="mb-5 pb-5 border-b border-[#EDE7DA]">
                  <h4 className="text-sm font-semibold text-[#1A1612] mb-3">Event Image</h4>
                  {ev.image_url && (
                    <div className="mb-3 rounded-xl overflow-hidden border border-[#EDE7DA] max-w-xs">
                      <img src={ev.image_url} alt={`${ev.name} event image`} className="w-full max-h-40 object-contain" />
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

                <div className="space-y-3 mb-3">
                  {(rows.length > 0 ? rows : [{ ...EMPTY_DATE_ROW(ev.id, 0, defaultLocation) }]).map((row, idx) =>
                    renderSessionCard(
                      row,
                      idx,
                      (field, value) => updateDateRow(ev.id, idx, field, value),
                      idx > 0 ? () => removeDateRow(ev.id, idx) : undefined
                    )
                  )}
                </div>
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => addDateRow(ev.id)}
                      className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-[#C4622D] text-[#C4622D] rounded-xl py-2.5 text-sm font-medium hover:bg-[#FFF8F4] transition-colors"
                    >
                      <span className="text-lg leading-none">+</span>
                      Add another session
                    </button>

                    {eventDatesMsg[ev.id] && (
                      <p className={`text-xs mt-3 ${eventDatesMsg[ev.id].includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{eventDatesMsg[ev.id]}</p>
                    )}

                    <button
                      onClick={() => saveEventDates(ev.id)}
                      disabled={savingEventDates[ev.id] || !validateEventFees(ev.id)}
                      className={`mt-4 px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        !validateEventFees(ev.id)
                          ? 'bg-[#C4622D] text-white opacity-40 cursor-not-allowed'
                          : 'bg-[#C4622D] text-white hover:bg-[#A04E22] disabled:opacity-50'
                      }`}
                    >
                      {savingEventDates[ev.id] ? 'Saving…' : 'Save the Event Details'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Event Fee Validation Popup */}
      {feeValidationPopup.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#2C2420]">Event Fee Required</h3>
            </div>
            <p className="text-sm text-[#5C5347] mb-5">
              All sessions must have an <strong>Event Fee</strong> greater than zero before saving. Please enter a valid fee for every session.
            </p>
            <button
              onClick={() => setFeeValidationPopup({ visible: false, eventId: null })}
              className="w-full bg-[#C4622D] text-white py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
            >
              OK, I'll fix it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
