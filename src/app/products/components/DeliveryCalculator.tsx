"use client";

import { useState } from 'react';
import { useDeliveryCalculator } from './useDeliveryCalculator';
import type { DeliveryResult } from './useDeliveryCalculator';

interface DeliveryCalculatorProps {
  despatchMethod: 'collection' | 'delivery';
  orderSubtotal: number;
  minimumFee?: number;
  onConfirm: (result: { deliveryCost: number; total: number; distanceKm?: number; distanceText?: string; durationText?: string }) => void;
  onCancel: () => void;
}

export default function DeliveryCalculator({
  despatchMethod,
  orderSubtotal,
  minimumFee = 0,
  onConfirm,
  onCancel,
}: DeliveryCalculatorProps) {
  const [customerAddress, setCustomerAddress] = useState('');
  const { calculate, result, loading, error, errorCode, reset, defaultDespatchAddress, settingsLoading } =
    useDeliveryCalculator({ minimumFee });

  if (despatchMethod === 'collection') {
    return (
      <div className="flex-1 flex flex-col px-6 py-5 space-y-4">
        <div className="bg-[#EDE7DA] rounded-2xl p-4 space-y-1">
          <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Collection Point</p>
          <p className="text-sm text-[#1A1612] font-medium leading-snug">
            {settingsLoading ? (
              <span className="text-[#B5ADA5]">Loading address...</span>
            ) : (
              defaultDespatchAddress || <span className="text-[#B5ADA5]">Address not configured</span>
            )}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#DDD5C8] p-4 space-y-2 text-sm">
          <div className="flex justify-between text-[#5C5347]">
            <span>Delivery fee</span>
            <span className="font-semibold text-green-600">R 0.00</span>
          </div>
          <div className="flex justify-between font-semibold text-[#1A1612] text-base pt-2 border-t border-[#DDD5C8]">
            <span>Total</span>
            <span>R {orderSubtotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={onCancel}
            className="w-full border border-[#C4622D] text-[#C4622D] py-3 rounded-full font-semibold text-sm hover:bg-[#F5EDE6] transition-all"
          >
            Change despatch method
          </button>
          <button
            onClick={() => onConfirm({ deliveryCost: 0, total: orderSubtotal })}
            className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra"
          >
            Confirm collection
          </button>
        </div>
      </div>
    );
  }

  // Determine if the error is an API configuration issue
  const isApiNotConfigured = error === 'API_NOT_CONFIGURED' || errorCode === 'API_NOT_CONFIGURED';

  // Delivery view
  return (
    <div className="flex-1 flex flex-col px-6 py-5 space-y-4 overflow-y-auto">
      {/* From address (read-only) */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider">From (Despatch Address)</p>
        <div className="flex items-start gap-2 bg-[#EDE7DA] rounded-xl px-4 py-3">
          <span className="mt-1 w-2 h-2 rounded-full bg-[#C4622D] flex-shrink-0" />
          <p className="text-sm text-[#1A1612] leading-snug">
            {settingsLoading ? (
              <span className="text-[#B5ADA5]">Loading...</span>
            ) : (
              defaultDespatchAddress || <span className="text-[#B5ADA5]">Not configured</span>
            )}
          </p>
        </div>
      </div>

      {/* Customer address input */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-[#5C5347] uppercase tracking-wider">
          Your Delivery Address *
        </label>
        <div className="flex items-start gap-2">
          <span className="mt-3.5 w-2 h-2 rounded-full bg-[#1A1612] flex-shrink-0" />
          <input
            type="text"
            placeholder="Enter your delivery address"
            value={customerAddress}
            onChange={(e) => {
              reset();
              setCustomerAddress(e.target.value);
            }}
            aria-label="Your delivery address"
            className="flex-1 bg-white border border-[#DDD5C8] rounded-xl px-4 py-3 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
          />
        </div>
      </div>

      <button
        onClick={() => calculate(customerAddress, orderSubtotal)}
        disabled={loading || !customerAddress.trim() || settingsLoading}
        className="w-full bg-[#1A1612] text-white py-3 rounded-full font-semibold text-sm hover:bg-[#2D2520] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Calculating...
          </>
        ) : (
          'Calculate delivery cost'
        )}
      </button>

      {/* API not configured — distinct banner */}
      {isApiNotConfigured && !result && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Delivery calculation unavailable
          </p>
          <p className="text-xs text-amber-700">
            The delivery distance service is not configured. Please contact us directly to confirm your delivery charge, or choose collection.
          </p>
        </div>
      )}

      {/* Generic error (non-API-config) without fallback */}
      {error && !isApiNotConfigured && !result && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <>
          {/* Fallback notice — shown when default delivery charge was applied */}
          {result.isFallback && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                {isApiNotConfigured ? 'Delivery calculation unavailable' : 'Estimated delivery charge'}
              </p>
              <p className="text-xs text-amber-700">
                {isApiNotConfigured
                  ? 'The delivery distance service is not configured. A standard delivery charge has been applied. Our team has been notified and will confirm the final amount with you.'
                  : 'The exact delivery distance could not be calculated. A standard delivery charge has been applied. Our team has been notified and will confirm the final amount with you.'}
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#DDD5C8] p-4 space-y-2 text-sm">
            {!result.isFallback && (
              <>
                <div className="flex justify-between text-[#5C5347]">
                  <span>Distance</span>
                  <span>{result.distanceText}</span>
                </div>
                <div className="flex justify-between text-[#5C5347]">
                  <span>Est. drive time</span>
                  <span>{result.durationText}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-[#5C5347]">
              <span>Delivery fee{result.isFallback ? ' (standard rate)' : ''}</span>
              <span className="font-semibold text-[#C4622D]">R {result.deliveryCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-[#1A1612] text-base pt-2 border-t border-[#DDD5C8]">
              <span>Total</span>
              <span>R {result.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={onCancel}
              className="w-full border border-[#C4622D] text-[#C4622D] py-3 rounded-full font-semibold text-sm hover:bg-[#F5EDE6] transition-all"
            >
              Change despatch method
            </button>
            <button
              onClick={() => onConfirm(result as DeliveryResult)}
              className="w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all shadow-terra"
            >
              Confirm order
            </button>
          </div>
        </>
      )}
    </div>
  );
}
