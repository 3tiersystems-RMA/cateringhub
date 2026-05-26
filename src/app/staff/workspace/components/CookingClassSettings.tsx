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
}

const EVENT_LABELS: Record<string, string> = {
  kids_cooking_baking: 'Kids Cooking & Baking',
  adult_classes: 'Adult Classes',
  luncheon: 'Luncheon',
  other: 'Other',
};

const DATE_LABELS: Record<string, string> = {
  wed_13_may: 'Wed 13 May',
  sun_31_may: 'Sun 31 May',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  awaiting_confirmation: 'bg-blue-100 text-blue-700',
};

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
  const [classFee, setClassFee] = useState('');

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [regsError, setRegsError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'registrations'>('settings');

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'registrations') loadRegistrations();
  }, [activeSubTab]);

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
        setClassFee(data.class_fee ? String(data.class_fee) : '');
      }
    } catch {
      // no settings yet
    } finally {
      setLoading(false);
    }
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
        class_fee: parseFloat(classFee) || 0,
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
        <p className="text-sm text-[#8C8278] mt-0.5">Manage class settings, flyer, and registrations</p>
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
          {/* Flyer Image */}
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

          {/* Google Sheet Config */}
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

          {/* Class Fee */}
          <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
            <h3 className="text-base font-semibold text-[#1A1612] mb-4">Registration Fee</h3>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Class Fee (ZAR)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#5C5347]">R</span>
                <input
                  type="number"
                  value={classFee}
                  onChange={e => setClassFee(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-40 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                />
              </div>
              <p className="text-xs text-[#8C8278] mt-1">Set to 0 for free classes</p>
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
        </div>
      )}

      {/* REGISTRATIONS TAB */}
      {activeSubTab === 'registrations' && (
        <div>
          {syncMsg && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-blue-700">{syncMsg}</p>
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
                        Events: {(reg.selected_events || []).map(e => EVENT_LABELS[e] || e).join(', ')}
                      </p>
                      {reg.adult_class_dates?.length > 0 && (
                        <p className="text-xs text-[#8C8278]">
                          Dates: {reg.adult_class_dates.map(d => DATE_LABELS[d] || d).join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-[#8C8278] mt-1">
                        Payment: {reg.payment_method === 'payfast' ? 'PayFast' : 'EFT'}
                        {reg.amount ? ` · R${Number(reg.amount).toFixed(2)}` : ''}
                        {' · '}{new Date(reg.created_at).toLocaleDateString('en-ZA')}
                      </p>
                      {reg.proof_of_payment_url && (
                        <a
                          href={reg.proof_of_payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#C4622D] hover:underline mt-1 inline-block"
                        >
                          View Proof of Payment ↗
                        </a>
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
