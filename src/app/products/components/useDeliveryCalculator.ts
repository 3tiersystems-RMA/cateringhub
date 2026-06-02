"use client";

import { useState, useEffect, useCallback } from 'react';

interface DeliverySettings {
  defaultDespatchAddress: string;
  ratePerKm: number;
  defaultDeliveryCharge: number | null;
  adminEmail: string | null;
}

export interface DeliveryResult {
  distanceKm: number;
  durationMin: number;
  distanceText: string;
  durationText: string;
  deliveryCost: number;
  total: number;
  isFallback?: boolean;
}

interface UseDeliveryCalculatorOptions {
  minimumFee?: number;
}

export function useDeliveryCalculator({ minimumFee = 0 }: UseDeliveryCalculatorOptions = {}) {
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/delivery-settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(`Delivery settings: ${d.error}`);
        } else {
          setSettings({
            defaultDespatchAddress: d.defaultDespatchAddress,
            ratePerKm: d.ratePerKm,
            defaultDeliveryCharge: d.defaultDeliveryCharge ?? null,
            adminEmail: d.adminEmail ?? null,
          });
        }
      })
      .catch(() => setError('Could not load delivery settings. Please try again.'));
  }, []);

  const calculate = useCallback(
    async (customerAddress: string, orderSubtotal: number) => {
      if (!settings) return;
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const params = new URLSearchParams({ destination: customerAddress });
        const res = await fetch(`/api/distance?${params}`);
        const data = await res.json();

        if (!res.ok) {
          const code: string = data?.errorCode ?? '';
          setErrorCode(code);

          // Fall back to default delivery charge if available
          if (settings.defaultDeliveryCharge != null) {
            const fallbackCost = Math.max(settings.defaultDeliveryCharge, minimumFee);
            setResult({
              distanceKm: 0,
              durationMin: 0,
              distanceText: 'N/A',
              durationText: 'N/A',
              deliveryCost: fallbackCost,
              total: orderSubtotal + fallbackCost,
              isFallback: true,
            });
            // Set a user-friendly error message alongside the fallback result
            if (code === 'API_NOT_CONFIGURED') {
              setError('API_NOT_CONFIGURED');
            } else if (code === 'ROUTE_NOT_FOUND') {
              setError('Route not found. Please check the delivery address. A default delivery charge has been applied.');
            } else {
              setError('Delivery distance could not be calculated. A default delivery charge has been applied.');
            }
          } else {
            // No fallback available — surface the error
            if (code === 'API_NOT_CONFIGURED') {
              setError('API_NOT_CONFIGURED');
            } else {
              const googleStatus = data?.googleStatus ? ` (Google: ${data.googleStatus})` : '';
              setError(data.error ? `${data.error}${googleStatus}` : 'Distance API error');
            }
          }
          return;
        }

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
          isFallback: false,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not calculate delivery. Please check the address.';

        // Attempt fallback on unexpected errors too
        if (settings.defaultDeliveryCharge != null) {
          const fallbackCost = Math.max(settings.defaultDeliveryCharge, minimumFee);
          setResult({
            distanceKm: 0,
            durationMin: 0,
            distanceText: 'N/A',
            durationText: 'N/A',
            deliveryCost: fallbackCost,
            total: orderSubtotal + fallbackCost,
            isFallback: true,
          });
          setError('Delivery distance could not be calculated. A default delivery charge has been applied.');
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [settings, minimumFee]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setErrorCode(null);
  }, []);

  return {
    calculate,
    result,
    loading,
    error,
    errorCode,
    reset,
    defaultDespatchAddress: settings?.defaultDespatchAddress ?? null,
    settingsLoading: !settings && !error,
  };
}
