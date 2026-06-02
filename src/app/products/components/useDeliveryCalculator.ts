"use client";

import { useState, useEffect, useCallback } from 'react';

interface DeliverySettings {
  defaultDespatchAddress: string;
  ratePerKm: number;
}

export interface DeliveryResult {
  distanceKm: number;
  durationMin: number;
  distanceText: string;
  durationText: string;
  deliveryCost: number;
  total: number;
}

interface UseDeliveryCalculatorOptions {
  minimumFee?: number;
}

export function useDeliveryCalculator({ minimumFee = 0 }: UseDeliveryCalculatorOptions = {}) {
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/delivery-settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError('Could not load delivery settings.');
        } else {
          setSettings(d);
        }
      })
      .catch(() => setError('Could not load delivery settings.'));
  }, []);

  const calculate = useCallback(
    async (customerAddress: string, orderSubtotal: number) => {
      if (!settings) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ destination: customerAddress });
        const res = await fetch(`/api/distance?${params}`);
        if (!res.ok) throw new Error('Distance API error');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const el = data?.rows?.[0]?.elements?.[0];
        if (!el || el.status !== 'OK') {
          throw new Error('Route not found. Please check the delivery address.');
        }
        const distanceKm = el.distance.value / 1000;
        const durationMin = Math.round(el.duration.value / 60);
        const deliveryCost = Math.max(distanceKm * settings.ratePerKm, minimumFee);
        setResult({
          distanceKm,
          durationMin,
          distanceText: el.distance.text,
          durationText: el.duration.text,
          deliveryCost,
          total: orderSubtotal + deliveryCost,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not calculate delivery. Please check the address.'
        );
      } finally {
        setLoading(false);
      }
    },
    [settings, minimumFee]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    calculate,
    result,
    loading,
    error,
    reset,
    defaultDespatchAddress: settings?.defaultDespatchAddress ?? null,
    settingsLoading: !settings && !error,
  };
}
