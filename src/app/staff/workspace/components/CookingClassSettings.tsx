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
}

const DEFAULT_LOCATION = '12 Cardamom Street, Cape Town, 7441';

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  awaiting_confirmation: 'bg-blue-100 text-blue-700',
};

const EMPTY_DATE_ROW = (eventId = '', sortOrder = 0): Omit<EventDateRow, 'id'> => ({
  event_id: eventId,
  event_date: '',
  start_time: '',
  end_time: '',
  location: DEFAULT_LOCATION,
  sort_order: sortOrder,
  seating: 0,
  status_id: '',
  class_fee: '',
});

export default function CookingClassSettings() {
  const supabase = createClient();
  const [settings, setSettings] = useState<ClassSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [flyerUrl, setFlyerUrl] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('');

  // Events management
  const [events, setEvents] = useState<ClassEvent[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventMsg, setEventMsg] = useState('');

  // Session statuses management
  const [sessionStatuses, setSessionStatuses] = useState<SessionStatus[]>([]);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // (6) General Event Details block (no event_id) — 5 sessions
  const [generalDateRows, setGeneralDateRows] = useState<EventDateRow[]>(
    Array.from({ length: 5 }, (_, i) => ({ ...EMPTY_DATE_ROW('', i) }))
  );
  const [savingGeneralDates, setSavingGeneralDates] = useState(false);
  const [generalDatesMsg, setGeneralDatesMsg] = useState('');

  // (6) Per-event Event Details block — 5 sessions per event, keyed by event_id
  const [eventDateRows, setEventDateRows] = useState<Record<string, EventDateRow[]>>({});
  const [savingEventDates, setSavingEventDates] = useState<Record<string, boolean>>({});
  const [eventDatesMsg, setEventDatesMsg] = useState<Record<string, string>>({});

  // Collapsible state for event blocks and individual sessions
  const [collapsedEventBlocks, setCollapsedEventBlocks] = useState<Record<string, boolean>>({});
  const [collapsedSessions, setCollapsedSessions] = useState<Record<string, boolean>>({});

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [regsError, setRegsError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'registrations'>('settings');

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    loadSettings();
    loadEvents();
    loadSessionStatuses();
    loadAllDateRows();
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
        location: r.location || DEFAULT_LOCATION,
        sort_order: r.sort_order || 0,
        seating: r.seating || 0,
        status_id: r.status_id || '',
        class_fee: r.class_fee != null ? String(r.class_fee) : '',
      }));
      while (filledGeneral.length < 5) {
        filledGeneral.push({ ...EMPTY_DATE_ROW('', filledGeneral.length) });
      }
      setGeneralDateRows(filledGeneral.slice(0, 5));

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
          location: r.location || DEFAULT_LOCATION,
          sort_order: r.sort_order || 0,
          seating: r.seating || 0,
          status_id: r.status_id || '',
          class_fee: r.class_fee != null ? String(r.class_fee) : '',
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
        if (!updated[ev.id]) {
          updated[ev.id] = Array.from({ length: 5 }, (_, i) => ({ ...EMPTY_DATE_ROW(ev.id, i) }));
        } else {
          // Pad to 5
          while (updated[ev.id].length < 5) {
            updated[ev.id].push({ ...EMPTY_DATE_ROW(ev.id, updated[ev.id].length) });
          }
        }
      });
      return updated;
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

  async function handleSaveSettings() {
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const payload = {
        flyer_image_url: flyerUrl || null,
        sheet_id: sheetId || null,
        sheet_name: sheetName || 'Registrations',
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
          .insert(payload);
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

  async function handleAddEvent() {
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
    try {
      await supabase.from('cooking_class_events').delete().eq('id', id);
      await loadEvents();
    } catch {
      // ignore
    }
  }

  async function handleToggleEventActive(ev: ClassEvent) {
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

  async function handleSaveGeneralDates() {
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
          location: r.location || DEFAULT_LOCATION,
          sort_order: i,
          seating: r.seating || 0,
          status_id: r.status_id || null,
          class_fee: r.class_fee ? parseFloat(r.class_fee) : null,
        }));

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('cooking_class_event_dates').insert(rowsToInsert);
        if (error) throw error;
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
          location: r.location || DEFAULT_LOCATION,
          sort_order: i,
          seating: r.seating || 0,
          status_id: r.status_id || null,
          class_fee: r.class_fee ? parseFloat(r.class_fee) : null,
        }));

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('cooking_class_event_dates').insert(rowsToInsert);
        if (error) throw error;
      }

      setEventDatesMsg(prev => ({ ...prev, [eventId]: 'Session dates saved!' }));
      await loadAllDateRows();
    } catch (err: any) {
      setEventDatesMsg(prev => ({ ...prev, [eventId]: err?.message || 'Failed to save session dates' }));
    } finally {
      setSavingEventDates(prev => ({ ...prev, [eventId]: false }));
    }
  }

  async function handleSyncToSheet(regId: string) {
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
    await supabase
      .from('cooking_class_registrations')
      .update({ payment_status: 'paid' })
      .eq('id', regId);
    await loadRegistrations();
  }

  // Reusable session card renderer
  function renderSessionCard(
    row: EventDateRow,
    index: number,
    onChange: (field: keyof Omit<EventDateRow, 'id'>, value: string | number) => void,
    sessionKey?: string
  ) {
    const key = sessionKey || `general-${index}`;
    const isCollapsed = collapsedSessions[key] ?? false;

    return (
      <div key={index} className="bg-[#FAF5EE] rounded-xl border border-[#EDE7DA] overflow-hidden">
        {/* Session header — always visible, click to toggle */}
        <button
          type="button"
          onClick={() => setCollapsedSessions(prev => ({ ...prev, [key]: !prev[key] }))}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#F0EAE0] transition-colors"
        >
          <p className="text-xs font-semibold text-[#5C5347]">Session {index + 1}</p>
          <span className="text-[#8C8278] text-xs">{isCollapsed ? '▶' : '▼'}</span>
        </button>

        {/* Session body — collapsible */}
        {!isCollapsed && (
          <div className="px-3 pb-3 pt-1">
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
                value={row.location || DEFAULT_LOCATION}
                onChange={e => onChange('location', e.target.value)}
                placeholder={DEFAULT_LOCATION}
                className="w-full border border-[#DDD5C8] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
              />
            </div>
            {/* (5) Class Fee inside each session card */}
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
                <label className="block text-xs text-[#8C8278] mb-1">Class Fee (ZAR)</label>
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
          </div>
        )}
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
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1612]">Cooking &amp; Baking Classes</h2>
        <p className="text-sm text-[#8C8278] mt-0.5">Manage class settings, flyer, events, and registrations</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-[#F5F0E8] rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === 'settings' ? 'bg-white text-[#C4622D] shadow-sm' : 'text-[#5C5347] hover:text-[#C4622D]'}`}
        >
          ⚙️ Settings
        </button>
        <button
          onClick={() => setActiveSubTab('registrations')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSubTab === 'registrations' ? 'bg-white text-[#C4622D] shadow-sm' : 'text-[#5C5347] hover:text-[#C4622D]'}`}
        >
          📋 Registrations
        </button>
      </div>

      {/* SETTINGS TAB */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">

          {/* (4) Class Flyer Image — moved to top */}
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
            <h3 className="text-base font-semibold text-[#1A1612] mb-4">Class Flyer Image</h3>

            {flyerUrl && (
              <div className="mb-4 rounded-xl overflow-hidden border border-[#EDE7DA]">
                <img
                  src={flyerUrl}
                  alt="Current cooking class flyer"
                  className="w-full max-h-48 object-contain"
                />
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
                  <span className="bg-[#F5F0E8] border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#EDE7DA] transition-colors">
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

          {/* (4) Google Sheet Sync — moved to top (above Events) */}
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
            <h3 className="text-base font-semibold text-[#1A1612] mb-1">Google Sheet Sync</h3>
            <p className="text-xs text-[#8C8278] mb-4">Confirmed registrations will be written to this sheet automatically.</p>

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
            <h3 className="text-base font-semibold text-[#1A1612] mb-1">Events</h3>
            <p className="text-xs text-[#8C8278] mb-4">Add the events that will appear on the registration form (e.g. Kids Event, Adults Event, Leadership Workshop).</p>

            {events.length > 0 && (
              <div className="space-y-2 mb-4">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 bg-[#FAF5EE] rounded-xl px-3 py-2">
                    <span className={`flex-1 text-sm ${ev.is_active ? 'text-[#1A1612]' : 'text-[#8C8278] line-through'}`}>{ev.name}</span>
                    <button
                      onClick={() => handleToggleEventActive(ev)}
                      className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${ev.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {ev.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
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
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
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

          {/* ── General Event Details (no event link) ── */}
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
            <h3 className="text-base font-semibold text-[#1A1612] mb-1">Event Details</h3>
            <p className="text-xs text-[#8C8278] mb-4">Enter up to 5 general event sessions. These dates will appear on the registration form under "Select Attendance" for all events.</p>

            <div className="space-y-3">
              {generalDateRows.map((row, i) =>
                renderSessionCard(row, i, (field, value) => updateGeneralDateRow(i, field, value), `general-${i}`)
              )}
            </div>

            {generalDatesMsg && (
              <p className={`text-xs mt-3 ${generalDatesMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{generalDatesMsg}</p>
            )}

            <button
              onClick={handleSaveGeneralDates}
              disabled={savingGeneralDates}
              className="mt-4 bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
            >
              {savingGeneralDates ? 'Saving...' : 'Save Event Dates'}
            </button>
          </div>

          {/* (6) Per-event Event Details blocks — one per event, each collapsible */}
          {events.map(ev => {
            const isBlockCollapsed = collapsedEventBlocks[ev.id] ?? false;
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
                      Event Details — <span className="text-[#C4622D]">{ev.name}</span>
                    </h3>
                    <p className="text-xs text-[#8C8278] mt-0.5">
                      Enter up to 5 sessions specific to <strong>{ev.name}</strong>. When a customer selects this event, only these dates will appear under "Select Attendance".
                    </p>
                  </div>
                  <span className="text-[#8C8278] text-sm ml-4 flex-shrink-0">{isBlockCollapsed ? '▶' : '▼'}</span>
                </button>

                {/* Event block body — collapsible */}
                {!isBlockCollapsed && (
                  <div className="px-5 pb-5">
                    <div className="space-y-3">
                      {(eventDateRows[ev.id] || Array.from({ length: 5 }, (_, i) => ({ ...EMPTY_DATE_ROW(ev.id, i) }))).map((row, i) =>
                        renderSessionCard(row, i, (field, value) => updateEventDateRow(ev.id, i, field, value), `${ev.id}-session-${i}`)
                      )}
                    </div>

                    {eventDatesMsg[ev.id] && (
                      <p className={`text-xs mt-3 ${eventDatesMsg[ev.id].includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>{eventDatesMsg[ev.id]}</p>
                    )}

                    <button
                      onClick={() => handleSaveEventDates(ev.id)}
                      disabled={savingEventDates[ev.id]}
                      className="mt-4 bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                    >
                      {savingEventDates[ev.id] ? 'Saving...' : `Save ${ev.name} Dates`}
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
                      {reg.payment_status === 'awaiting_confirmation' && (
                        <button
                          onClick={() => handleMarkPaid(reg.id)}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                      {!reg.synced_to_sheet && (
                        <button
                          onClick={() => handleSyncToSheet(reg.id)}
                          disabled={syncingId === reg.id}
                          className="text-xs bg-[#F5F0E8] border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-lg hover:bg-[#EDE7DA] transition-colors font-medium disabled:opacity-50"
                        >
                          {syncingId === reg.id ? 'Syncing...' : 'Sync to Sheet'}
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
