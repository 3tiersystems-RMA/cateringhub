"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Icon from "@/components/ui/AppIcon";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get("order_id") || "";

  return (
    <main className="pt-20 min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Icon name="CheckIcon" size={40} className="text-green-600" />
          </div>

          {/* Heading */}
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#1A1612] mb-2">
              Payment Successful!
            </h1>
            <p className="text-[#8C8278] text-sm leading-relaxed">
              Your booking has been confirmed. We&apos;ll send a confirmation
              email with your order details shortly.
            </p>
          </div>

          {/* Order Details */}
          <div className="bg-[#F5F0E8] rounded-2xl p-5 text-left space-y-3">
            {orderId && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#8C8278]">Order Reference</span>
                <span className="font-mono font-semibold text-[#1A1612] text-sm">
                  {orderId}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#8C8278]">Payment Status</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                Confirmed
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#8C8278]">Payment Method</span>
              <span className="text-sm font-semibold text-[#1A1612]">EFT</span>
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-[#B5ADA5]">
            <Icon name="ShieldCheckIcon" size={14} className="text-green-500" />
            <span>Secure Payment · PCI DSS Compliant</span>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/products"
              className="block w-full bg-[#C4622D] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#A04E22] transition-all text-center"
            >
              Continue Browsing
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

export default function CheckoutSuccessPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="pt-20 min-h-screen bg-[#F5F0E8] flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#C4622D] border-t-transparent rounded-full" />
          </main>
        }
      >
        <SuccessContent />
      </Suspense>
      <Footer />
    </>
  );
}
