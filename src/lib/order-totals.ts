const DISCOUNT_VOUCHER_PATTERN = /Discount Voucher:.*?\(R([\d.]+)\s*credit\)/i;

export type OrderTotalInput = {
  subtotal?: number | null;
  delivery_fee?: number | null;
  total?: number | null;
  notes?: string | null;
};

export function parseDiscountFromNotes(notes?: string | null): number {
  if (!notes) return 0;
  const match = notes.match(DISCOUNT_VOUCHER_PATTERN);
  return match ? parseFloat(match[1]) : 0;
}

/** Subtotal + delivery − discount voucher credit; falls back to stored total when calculation is zero. */
export function calculateOrderTotal(order: OrderTotalInput): number {
  const subtotal = Number(order.subtotal) || 0;
  const delivery = Number(order.delivery_fee) || 0;
  const discount = parseDiscountFromNotes(order.notes);
  const calculated = subtotal + delivery - discount;
  return calculated > 0 ? calculated : Number(order.total) || 0;
}

export function isFulfillmentStatusLocked(status: string): boolean {
  return status === 'delivered' || status === 'cancelled';
}
