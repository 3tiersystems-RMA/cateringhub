'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { parseCheckoutReturnParams } from '@/lib/checkout-return';
import { logPayfastTestBrowser } from '@/lib/payfast-test-logs';

const PENDING_CODE_KEY = 'eb_pending_registration_code';

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const status = searchParams?.get('status');
  const isSuccess = status === 'success';
  const { orderId: registrationCodeFromUrl, paymentStatus } =
    parseCheckoutReturnParams(searchParams);

  const [registrationCode, setRegistrationCode] = useState(registrationCodeFromUrl);
  const [confirmState, setConfirmState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const completionAttemptedRef = useRef(false);
  const failedRecordedRef = useRef(false);

  useEffect(() => {
    if (registrationCodeFromUrl) {
      setRegistrationCode(registrationCodeFromUrl);
      return;
    }
    try {
      const stored = sessionStorage.getItem(PENDING_CODE_KEY)?.trim() || '';
      if (stored) setRegistrationCode(stored);
    } catch {
      // ignore
    }
  }, [registrationCodeFromUrl]);

  useEffect(() => {
    if (isSuccess || !registrationCode || failedRecordedRef.current) return;
    failedRecordedRef.current = true;

    logPayfastTestBrowser('event', 'Recording failed/cancelled payment', {
      registrationCode,
      paymentStatus: paymentStatus || 'CANCELLED',
    });

    fetch('/api/bookings/record-failed-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingType: 'event',
        mPaymentId: registrationCode,
        paymentStatus: paymentStatus || 'CANCELLED',
      }),
    }).catch(() => {
      // Non-blocking — ITN may still record the failure
    });
  }, [isSuccess, registrationCode, paymentStatus]);

  useEffect(() => {
    // Match cooking-classes payment-return: confirm when status=success and we have
    // the registration code (URL or sessionStorage). Do not require isPayFastReturn —
    // PayFast often redirects to return_url with only ?status=success (no m_payment_id).
    if (!isSuccess || !registrationCode) return;
    if (completionAttemptedRef.current) return;
    completionAttemptedRef.current = true;

    setConfirmState('loading');

    logPayfastTestBrowser('event', 'Payment return success — completing pending payment', {
      registrationCode,
      paymentStatus: paymentStatus || 'COMPLETE',
    });

    fetch('/api/event-bookings/complete-pending-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationCode,
        paymentStatus: paymentStatus || 'COMPLETE',
        pf_payment_id: searchParams?.get('pf_payment_id') || null,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok && res.status !== 404) {
          throw new Error(data.error || 'Failed to confirm booking');
        }
        if (res.ok) {
          setConfirmState('done');
          logPayfastTestBrowser('event', 'Complete pending payment response', data);
          if (data.outcome === 'created') {
            setConfirmMessage('Your booking has been confirmed.');
          } else if (data.outcome === 'updated') {
            setConfirmMessage('Your payment has been recorded.');
          } else if (data.outcome === 'already_paid') {
            setConfirmMessage('Your booking was already confirmed.');
          }
          try {
            sessionStorage.removeItem(PENDING_CODE_KEY);
          } catch {
            // ignore
          }
        } else {
          // Legacy register-first flow: booking already exists; ITN or return will mark paid
          setConfirmState('done');
          setConfirmMessage('Your payment is being verified. You will receive a confirmation email shortly.');
        }
      })
      .catch((err) => {
        logPayfastTestBrowser('event', 'Complete pending payment error', {
          message: err instanceof Error ? err.message : String(err),
        });
        setConfirmState('error');
        setConfirmMessage(
          err instanceof Error ? err.message : 'Could not verify booking. Please contact us with your reference.'
        );
      });
  }, [isSuccess, registrationCode, paymentStatus, searchParams]);

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
            {registrationCode && (
              <p className="text-xs font-mono text-[#C4622D] mb-2">{registrationCode}</p>
            )}
            <p className="text-sm text-[#5C5347] mb-6">
              {confirmState === 'loading'
                ? 'Confirming your booking…'
                : confirmMessage ||
                  'Your event booking has been confirmed. You will receive a confirmation email shortly.'}
            </p>
            {confirmState === 'error' && (
              <p className="text-xs text-amber-700 mb-4">
                If you paid successfully, save reference <strong>{registrationCode}</strong> and contact support.
              </p>
            )}
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
              Your payment was not completed. This attempt has been recorded in our booking history as a failed payment (no booking reference was assigned). You can try again when ready.
            </p>
            <Link href="/event-bookings" className="inline-block bg-[#C4622D] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors mb-3">
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

export default function EventBookingPaymentReturnPage() {
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
