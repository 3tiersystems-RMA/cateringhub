import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PaymentSettings {
  payfast_enabled: boolean;
  eft_enabled: boolean;
  loaded: boolean;
}

export function usePaymentSettings(): PaymentSettings {
  const [settings, setSettings] = useState<PaymentSettings>({
    payfast_enabled: true,
    eft_enabled: true,
    loaded: false,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('global_settings')
      .select('setting_key, is_enabled')
      .in('setting_key', ['payfast_payment', 'eft_payment'])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, boolean> = {};
          data.forEach((row: { setting_key: string; is_enabled: boolean }) => {
            map[row.setting_key] = row.is_enabled;
          });
          setSettings({
            payfast_enabled: map['payfast_payment'] ?? true,
            eft_enabled: map['eft_payment'] ?? true,
            loaded: true,
          });
        } else {
          setSettings(prev => ({ ...prev, loaded: true }));
        }
      })
      .catch(() => {
        setSettings(prev => ({ ...prev, loaded: true }));
      });
  }, []);

  return settings;
}
