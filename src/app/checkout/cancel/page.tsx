"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Icon from "@/components/ui/AppIcon";
import { parseCheckoutReturnParams } from "@/lib/checkout-return";

const PENDING_ORDER_REF_KEY = "order_pending_m_payment_id";

function CancelContent() {
  const searchParams = useSearchParams();
  const { orderId, isPayFastReturn: isPayFast } =
    parseCheckoutReturnParams(searchParams);

  const failedRecordedRef = useRef(false);

  useEffect(() => {
    const mPaymentId =
      orderId ||
      (() => {
        try {
          return sessionStorage.getItem(PENDING_ORDER_REF_KEY)?.trim() || "";
        } catch {
          return "";
        }
      })();

    if (!isPayFast || !mPaymentId || failedRecordedRef.current) return;
    failedRecordedRef.current = true;

    fetch("/api/bookings/record-failed-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingType: "order",
        mPaymentId,
        paymentStatus: searchParams?.get("payment_status") || "CANCELLED",
      }),
    }).catch(() => {
      // Non-blocking — ITN may still record the failure
    });
  }, [isPayFast, orderId, searchParams]);

  return (
    <main className="pt-20 min-h-screen bg-[#e9e0cf] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
          {/* Cancel Icon */}
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <Icon name="XMarkIcon" size={40} className="text-red-500" />
          </div>

          {/* Heading */}
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#1A1612] mb-2">
              Payment Cancelled
            </h1>
            <p className="text-[#8C8278] text-sm leading-relaxed">
              Your payment was not completed. No charges have been made. You can
              try again or contact us if you need assistance.
            </p>
          </div>

          {/* Order Details */}
          {orderId && (
            <div className="bg-[#F5F0E8] rounded-2xl p-5 text-left">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#8C8278]">Order Reference</span>
                <span className="font-mono font-semibold text-[#1A1612] text-sm">
                  {orderId}
                </span>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
            <Icon name="InformationCircleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              {isPayFast
                ? "Your PayFast payment was cancelled. No charges have been made. You can return to the cart and try again."
                : "Your cart items are still saved. You can go back and try the payment again at any time."}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/products"
              className="block w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all text-center"
            >
              Return to Cart
            </Link>
            <Link
              href="/homepage"
              className="block w-full bg-[#EDE7DA] text-[#5C5347] py-3.5 rounded-full font-semibold text-sm hover:bg-[#DDD5C8] transition-all text-center"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutCancelPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="pt-20 min-h-screen bg-[#e9e0cf] flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#C4622D] border-t-transparent rounded-full" />
          </main>
        }
      >
        <CancelContent />
      </Suspense>
      <Footer />
    </>
  );
}
