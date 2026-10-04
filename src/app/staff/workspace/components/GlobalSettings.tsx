'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface GlobalSetting {
  id: string;
  setting_key: string;
  setting_label: string;
  is_enabled: boolean;
  updated_at: string;
}

const PAYMENT_SETTINGS: { key: string; label: string; description: string; icon: string }[] = [
  {
    key: 'payfast_payment',
    label: 'PayFast Payment',
    description: 'Online card, instant EFT & SnapScan payments via PayFast gateway.',
    icon: 'CreditCardIcon',
  },
  {
    key: 'eft_payment',
    label: 'EFT Payment',
    description: 'Manual bank transfer (EFT) with proof of payment upload.',
    icon: 'BuildingLibraryIcon',
  },
];

export default function GlobalSettings() {
  const supabase = createClient();
  const [settings, setSettings] = useState<GlobalSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('global_settings')
      .select('*')
      .order('setting_key');
    if (err) {
      setError('Failed to load settings: ' + err.message);
    } else {
      setSettings(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggle = async (setting: GlobalSetting) => {
    setSaving(setting.setting_key);
    setError(null);
    const newValue = !setting.is_enabled;

    // Optimistic update
    setSettings(prev =>
      prev.map(s =>
        s.setting_key === setting.setting_key ? { ...s, is_enabled: newValue } : s
      )
    );

    const { error: err } = await supabase
      .from('global_settings')
      .update({ is_enabled: newValue, updated_at: new Date().toISOString() })
      .eq('setting_key', setting.setting_key);

    if (err) {
      // Revert on error
      setSettings(prev =>
        prev.map(s =>
          s.setting_key === setting.setting_key ? { ...s, is_enabled: !newValue } : s
        )
      );
      setError('Failed to save: ' + err.message);
    } else {
      setSuccessKey(setting.setting_key);
      setTimeout(() => setSuccessKey(null), 2000);
    }
    setSaving(null);
  };

  const getSettingMeta = (key: string) =>
    PAYMENT_SETTINGS.find(p => p.key === key);

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1612]">Global Settings</h2>
        <p className="text-sm text-[#8C8278] mt-1">
          Control which payment methods are available across products, classes, and event bookings.
          Setting a method to hidden will display &ldquo;Not Available&rdquo; to customers.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white border border-[#DDD5C8] rounded-2xl p-5 animate-pulse">
              <div className="h-5 bg-[#EDE7DA] rounded w-1/3 mb-2" />
              <div className="h-4 bg-[#EDE7DA] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Payment Methods Section */}
          <div className="bg-white border border-[#DDD5C8] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDE7DA] bg-[#FAF7F3]">
              <div className="flex items-center gap-2">
                <Icon name="CreditCardIcon" size={16} className="text-[#C4622D]" />
                <h3 className="text-sm font-semibold text-[#1A1612]">Payment Methods</h3>
              </div>
              <p className="text-xs text-[#8C8278] mt-0.5">
                Applies to product orders, cooking class bookings, and event registrations.
              </p>
            </div>

            <div className="divide-y divide-[#F0EBE3]">
              {PAYMENT_SETTINGS.map(meta => {
                const setting = settings.find(s => s.setting_key === meta.key);
                const isEnabled = setting?.is_enabled ?? true;
                const isSaving = saving === meta.key;
                const isSuccess = successKey === meta.key;

                return (
                  <div key={meta.key} className="px-5 py-4 flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isEnabled ? 'bg-[#C4622D]/10 text-[#C4622D]' : 'bg-[#EDE7DA] text-[#B5ADA5]'}`}>
                      <Icon name={meta.icon as any} size={18} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${isEnabled ? 'text-[#1A1612]' : 'text-[#8C8278]'}`}>
                          {meta.label}
                        </p>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isEnabled
                            ? 'bg-green-100 text-green-700' :'bg-[#EDE7DA] text-[#8C8278]'
                        }`}>
                          {isEnabled ? 'Visible' : 'Hidden'}
                        </span>
                        {isSuccess && (
                          <span className="text-[10px] font-semibold text-green-600 flex items-center gap-1">
                            <Icon name="CheckCircleIcon" size={12} /> Saved
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8C8278] mt-0.5 leading-relaxed">{meta.description}</p>
                      {!isEnabled && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2 leading-relaxed">
                          ⚠️ This payment method is hidden. Customers will see &ldquo;Not Available&rdquo; instead.
                        </p>
                      )}
                    </div>

                    {/* Toggle */}
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setting && handleToggle(setting)}
                        disabled={isSaving || !setting}
                        aria-label={`${isEnabled ? 'Hide' : 'Show'} ${meta.label}`}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#C4622D] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isEnabled ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info card */}
          <div className="bg-[#FDF6EE] border border-[#EDE7DA] rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <Icon name="InformationCircleIcon" size={16} className="text-[#C4622D] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#5C5347] mb-1">How visibility works</p>
                <ul className="text-xs text-[#8C8278] space-y-1 leading-relaxed">
                  <li>• <strong>Visible</strong> — payment method appears normally for customers to select.</li>
                  <li>• <strong>Hidden</strong> — payment method is replaced with a &ldquo;Not Available&rdquo; badge and cannot be selected.</li>
                  <li>• Changes take effect immediately across all payment pages.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
