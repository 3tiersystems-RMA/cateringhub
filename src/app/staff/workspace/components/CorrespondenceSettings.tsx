'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CorrespondenceSettingsData {
  id: string;
  form_header_title: string;
  logo_url: string | null;
  terms_and_conditions: string | null;
  sales_representative: string | null;
  office_number: string | null;
  comments: string | null;
  info_email: string | null;
  admin_email: string | null;
}

const defaultSettings: Omit<CorrespondenceSettingsData, 'id'> = {
  form_header_title: 'Cardamom Catering',
  logo_url: null,
  terms_and_conditions: null,
  sales_representative: null,
  office_number: null,
  comments: null,
  info_email: null,
  admin_email: null,
};

export default function CorrespondenceSettings() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('correspondence_settings')
      .select('*')
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      setError('Failed to load settings.');
    } else if (data) {
      setSettingsId(data.id);
      setForm({
        form_header_title: data.form_header_title || 'Cardamom Catering',
        logo_url: data.logo_url || null,
        terms_and_conditions: data.terms_and_conditions || null,
        sales_representative: data.sales_representative || null,
        office_number: data.office_number || null,
        comments: data.comments || null,
        info_email: data.info_email || null,
        admin_email: data.admin_email || null,
      });
    }
    setLoading(false);
  };

  const handleChange = (field: keyof typeof defaultSettings, value: string) => {
    setForm(prev => ({ ...prev, [field]: value || null }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a valid image file (PNG, JPG, GIF, WebP, SVG).');
      return;
    }

    setUploadingLogo(true);
    setError(null);

    const ext = file.name.split('.').pop();
    const fileName = `correspondence-logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      setError('Logo upload failed: ' + uploadError.message);
      setUploadingLogo(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    setForm(prev => ({ ...prev, logo_url: urlData.publicUrl }));
    setUploadingLogo(false);
  };

  const handleRemoveLogo = () => {
    setForm(prev => ({ ...prev, logo_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    const payload = {
      form_header_title: form.form_header_title || 'Cardamom Catering',
      logo_url: form.logo_url || null,
      terms_and_conditions: form.terms_and_conditions || null,
      sales_representative: form.sales_representative || null,
      office_number: form.office_number || null,
      comments: form.comments || null,
      info_email: form.info_email || null,
      admin_email: form.admin_email || null,
      updated_at: new Date().toISOString(),
    };

    let saveError = null;

    if (settingsId) {
      const { error: updateError } = await supabase
        .from('correspondence_settings')
        .update(payload)
        .eq('id', settingsId);
      saveError = updateError;
    } else {
      const { data: insertData, error: insertError } = await supabase
        .from('correspondence_settings')
        .insert(payload)
        .select()
        .single();
      saveError = insertError;
      if (insertData) setSettingsId(insertData.id);
    }

    if (saveError) {
      setError('Failed to save settings: ' + saveError.message);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="flex items-center gap-2 text-[#8C8278]">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1612]">Correspondence Settings</h2>
        <p className="text-sm text-[#8C8278] mt-0.5">
          Configure fields used across email forms and correspondence sent to customers.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Settings saved successfully.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 space-y-6">

        {/* Form Header Title */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1612] mb-1.5">
            Form Header Title <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-[#8C8278] mb-2">Displayed as the heading on email forms (e.g. Payment Reminder).</p>
          <input
            type="text"
            value={form.form_header_title}
            onChange={e => handleChange('form_header_title', e.target.value)}
            placeholder="e.g. Cardamom Catering"
            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
          />
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1612] mb-1.5">Logo</label>
          <p className="text-xs text-[#8C8278] mb-2">Upload your company logo to appear on email forms.</p>
          {form.logo_url ? (
            <div className="flex items-center gap-4">
              <div className="w-24 h-16 rounded-xl border border-[#DDD5C8] overflow-hidden bg-[#F5F0E8] flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.logo_url} alt="Correspondence logo" className="max-w-full max-h-full object-contain p-1" />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="text-xs font-semibold text-[#C4622D] hover:text-[#A04E22] transition-colors disabled:opacity-50"
                >
                  Replace Logo
                </button>
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove Logo
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex items-center gap-2 border-2 border-dashed border-[#DDD5C8] rounded-xl px-5 py-4 text-sm text-[#8C8278] hover:border-[#C4622D] hover:text-[#C4622D] transition-colors disabled:opacity-50"
            >
              {uploadingLogo ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Uploading…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Logo
                </>
              )}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>

        {/* Info Email */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1612] mb-1.5">Info Email</label>
          <p className="text-xs text-[#8C8278] mb-2">
            CC&apos;d on all payment reminders and new order notifications (e.g. info@yourdomain.com).
          </p>
          <input
            type="email"
            value={form.info_email || ''}
            onChange={e => handleChange('info_email', e.target.value)}
            placeholder="e.g. info@cardamomkitchen.co.za"
            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
          />
        </div>

        {/* Admin Email */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1612] mb-1.5">Admin Email</label>
          <p className="text-xs text-[#8C8278] mb-2">
            CC&apos;d on new order notifications alongside the info email (e.g. admin@yourdomain.com).
          </p>
          <input
            type="email"
            value={form.admin_email || ''}
            onChange={e => handleChange('admin_email', e.target.value)}
            placeholder="e.g. admin@cardamomkitchen.co.za"
            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
          />
        </div>

        {/* Sales Representative */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1612] mb-1.5">Sales Representative</label>
          <p className="text-xs text-[#8C8278] mb-2">Name of the sales representative shown on correspondence.</p>
          <input
            type="text"
            value={form.sales_representative || ''}
            onChange={e => handleChange('sales_representative', e.target.value)}
            placeholder="e.g. Jane Smith"
            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
          />
        </div>

        {/* Office Number */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1612] mb-1.5">Office Number</label>
          <p className="text-xs text-[#8C8278] mb-2">
            Included in the closing line of emails — e.g. &quot;please don&apos;t hesitate to contact us (087 265 2262)&quot;.
          </p>
          <input
            type="text"
            value={form.office_number || ''}
            onChange={e => handleChange('office_number', e.target.value)}
            placeholder="e.g. 087 265 2262"
            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
          />
        </div>

        {/* Comments / NOTE */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1612] mb-1.5">Comments</label>
          <p className="text-xs text-[#8C8278] mb-2">
            Displayed as <span className="font-semibold text-[#5C5347]">NOTE:</span> on email forms.
          </p>
          <textarea
            rows={3}
            value={form.comments || ''}
            onChange={e => handleChange('comments', e.target.value)}
            placeholder="e.g. Please ensure payment is made via EFT to the account details provided."
            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D] resize-none"
          />
        </div>

        {/* Terms & Conditions */}
        <div>
          <label className="block text-sm font-semibold text-[#1A1612] mb-1.5">Terms &amp; Conditions</label>
          <p className="text-xs text-[#8C8278] mb-2">Terms and conditions text shown at the bottom of email forms.</p>
          <textarea
            rows={5}
            value={form.terms_and_conditions || ''}
            onChange={e => handleChange('terms_and_conditions', e.target.value)}
            placeholder="Enter your terms and conditions here…"
            className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D] resize-none"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving || uploadingLogo}
            className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
