'use client';

import {
  formatBookingPaymentMethod,
  getBookingPaymentMethodBadgeClass,
} from '@/lib/booking-payment-status';

interface BookingPaymentMethodBadgeProps {
  paymentMethod?: string | null;
  payfastPaymentId?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

export default function BookingPaymentMethodBadge({
  paymentMethod,
  payfastPaymentId,
  className = '',
  size = 'md',
}: BookingPaymentMethodBadgeProps) {
  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] font-medium'
      : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex w-fit max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-full border leading-none ${sizeClass} ${getBookingPaymentMethodBadgeClass(paymentMethod, payfastPaymentId)} ${className}`}
    >
      {formatBookingPaymentMethod(paymentMethod, payfastPaymentId)}
    </span>
  );
}
