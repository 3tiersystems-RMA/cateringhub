'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');
  const status = searchParams?.get('status');
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    loadAndSync();
  }, [id]);

  async function loadAndSync() {
    const { data } = await supabase?.from('cooking_class_registrations')?.select('payment_status, synced_to_sheet')?.eq('id', id)?.single();

    if (status === 'success' && data?.payment_status === 'paid' && !data?.synced_to_sheet) {
      await fetch('/api/cooking-classes/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: id }),
      });
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF5EE] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isSuccess = status === 'success';

  return (
    <div className="min-h-screen bg-[#FAF5EE] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 shadow-sm text-center max-w-md w-full">
        {isSuccess ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A1612] mb-2">Payment Successful!</h2>
            <p className="text-sm text-[#5C5347] mb-6">
              Your registration for the Cooking &amp; Baking Class has been confirmed. You will receive a confirmation email shortly.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1A1612] mb-2">Payment Cancelled</h2>
            <p className="text-sm text-[#5C5347] mb-6">
              Your payment was cancelled. Your registration has been saved — you can return to complete payment.
            </p>
            <Link href="/cooking-classes" className="inline-block bg-[#C4622D] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors mb-3">
              Try Again
            </Link>
            <br />
          </>
        )}
        <Link href="/homepage" className="inline-block text-sm text-[#C4622D] hover:underline">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF5EE] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PaymentReturnContent />
    </Suspense>
  );
}
