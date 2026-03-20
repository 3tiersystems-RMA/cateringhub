"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppIcon from "@/components/ui/AppIcon";
import { createClient } from "@/lib/supabase/client";

type PaymentStatus = "pending" | "paid" | "failed" | "awaiting_payment" | "refunded" | "discounted";
type FulfillmentStatus = "new" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  category?: string;
}

interface Order {
  id: string;
  m_payment_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  event_date: string | null;
  delivery_address: string;
  notes: string;
  created_at: string;
}

const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  new: "Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const FULFILLMENT_COLORS: Record<FulfillmentStatus, string> = {
  new: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  confirmed: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  preparing: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  ready: "bg-teal-500/15 text-teal-300 border border-teal-500/30",
  delivered: "bg-white text-black border border-green-500/30",
  cancelled: "bg-red-500/15 text-red-300 border border-red-500/30",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  awaiting_payment: "Awaiting Payment",
  refunded: "Refunded",
  discounted: "Discounted",
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  paid: "bg-green-500/15 text-green-300 border border-green-500/30",
  failed: "bg-red-500/15 text-red-300 border border-red-500/30",
  awaiting_payment: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  refunded: "bg-gray-500/15 text-gray-400 border border-gray-500/30",
  discounted: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return `R ${amount.toFixed(2)}`;
}

const VOUCHER_MEAL_PRICES: Record<number, number> = {
  6: 690,
  10: 1350,
  12: 1320,
  24: 2520,
};

export default function OrderHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [voucherAmounts, setVoucherAmounts] = useState<Record<string, number>>({});

  const supabase = createClient();

  const fetchVoucherAmounts = async (fetchedOrders: Order[]) => {
    const voucherCodes: string[] = [];
    const codeToOrderId: Record<string, string> = {};

    for (const order of fetchedOrders) {
      if (order.notes) {
        const match = order.notes.match(/Voucher:\s*([A-Z0-9-]+)/i);
        if (match) {
          voucherCodes.push(match[1]);
          codeToOrderId[match[1]] = order.id;
        }
      }
    }

    if (voucherCodes.length === 0) return;

    const { data } = await supabase
      .from("vouchers")
      .select("voucher_code, total_meals")
      .in("voucher_code", voucherCodes);

    if (data) {
      const amounts: Record<string, number> = {};
      for (const v of data) {
        const orderId = codeToOrderId[v.voucher_code];
        if (orderId) {
          amounts[orderId] = VOUCHER_MEAL_PRICES[v.total_meals] ?? 0;
        }
      }
      setVoucherAmounts(amounts);
    }
  };

  const fetchOrdersByEmail = async (email: string) => {
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_email", email.toLowerCase().trim())
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;
    return data as Order[];
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const data = await fetchOrdersByEmail(session.user.email);
          setOrders(data || []);
          setEmailSubmitted(true);
          await fetchVoucherAmounts(data || []);
        }
      } catch (err) {
        console.error("Order fetch error:", err);
        setError("Unable to load orders. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleEmailLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setLookupLoading(true);
    setError(null);
    try {
      const data = await fetchOrdersByEmail(emailInput);
      setOrders(data || []);
      setEmailSubmitted(true);
      await fetchVoucherAmounts(data || []);
    } catch (err) {
      setError("Unable to find orders. Please check your email and try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleReorder = (order: Order) => {
    // Store reorder items in sessionStorage for CartContext to pick up
    sessionStorage.setItem("reorder_items", JSON.stringify(order.items));
    router.push("/products?reorder=1");
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Header />

      <main className="pt-24 pb-20">
        {/* Page Header */}
        <div className="max-w-4xl mx-auto px-4 md:px-8 mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/products"
              className="text-[#A09890] hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              <AppIcon name="ArrowLeftIcon" size={14} />
              Back to Menu
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Order History
          </h1>
          <p className="text-[#A09890] mt-2 text-sm">
            View your past orders, track status, and reorder your favourites.
          </p>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-8">
          {/* Email Lookup (for guests / not logged in) */}
          {!emailSubmitted && !loading && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8 mb-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#C4622D]/15 flex items-center justify-center">
                  <AppIcon name="EnvelopeIcon" size={20} className="text-[#C4622D]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Look up your orders</h2>
                  <p className="text-xs text-[#A09890]">Enter the email address used when placing your order</p>
                </div>
              </div>
              <form onSubmit={handleEmailLookup} className="flex gap-3">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 bg-[#1A1A1A] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#C4622D] transition-colors"
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="bg-[#C4622D] hover:bg-[#A04E22] disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  {lookupLoading ? "Searching..." : "Find Orders"}
                </button>
              </form>
              {error && (
                <p className="mt-3 text-sm text-red-400 flex items-center gap-2">
                  <AppIcon name="ExclamationCircleIcon" size={14} />
                  {error}
                </p>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#A09890] text-sm">Loading your orders…</p>
            </div>
          )}

          {/* Orders List */}
          {emailSubmitted && !loading && (
            <>
              {orders.length === 0 ? (
                <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#1E1E1E] flex items-center justify-center mx-auto mb-4">
                    <AppIcon name="ShoppingBagIcon" size={28} className="text-[#555]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No orders found</h3>
                  <p className="text-[#A09890] text-sm mb-6">
                    We couldn't find any orders for this email address.
                  </p>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] text-white px-6 py-3 rounded-full text-sm font-semibold transition-colors"
                  >
                    <AppIcon name="ShoppingCartIcon" size={16} />
                    Browse Menu
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[#A09890] text-sm mb-4">
                    {orders.length} order{orders.length !== 1 ? "s" : ""} found
                  </p>

                  {orders.map((order) => {
                    const isExpanded = expandedOrder === order.id;
                    const itemCount = order.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
                    const isVoucherOrder = !!(order.notes && /Voucher:\s*[A-Z0-9-]+/i.test(order.notes));
                    const displayTotal = isVoucherOrder && voucherAmounts[order.id] != null
                      ? voucherAmounts[order.id]
                      : order.total;
                    const voucherNumber = isVoucherOrder
                      ? (order.notes?.match(/Voucher:\s*([A-Z0-9-]+)/i)?.[1] ?? null)
                      : null;

                    return (
                      <div
                        key={order.id}
                        className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#3A3A3A]"
                      >
                        {/* Order Header Row */}
                        <div className="p-5 md:p-6">
                          <div className="flex flex-col md:flex-row md:items-center gap-4">
                            {/* Left: Date + Ref */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-[#666] font-mono">
                                  #{order.m_payment_id?.slice(-8) || order.id.slice(-8).toUpperCase()}
                                </span>
                                <span className="text-[#333]">·</span>
                                <span className="text-xs text-[#666]">
                                  {formatDate(order.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-white font-medium truncate">
                                {isVoucherOrder ? "Voucher" : `${itemCount} item${itemCount !== 1 ? "s" : ""}`}
                                {isVoucherOrder && voucherNumber ? (
                                  <span className="text-[#A09890] font-normal">
                                    {" "}· {voucherNumber}
                                  </span>
                                ) : !isVoucherOrder && order.event_date ? (
                                  <span className="text-[#A09890] font-normal">
                                    {" "}· Event: {formatDate(order.event_date)}
                                  </span>
                                ) : null}
                              </p>
                            </div>

                            {/* Middle: Status badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${FULFILLMENT_COLORS[order.fulfillment_status]}`}>
                                {FULFILLMENT_LABELS[order.fulfillment_status]}
                              </span>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_COLORS[order.payment_status]}`}>
                                {PAYMENT_LABELS[order.payment_status]}
                              </span>
                            </div>

                            {/* Right: Total + Actions */}
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-white">
                                {formatCurrency(displayTotal)}
                              </span>
                              <button
                                onClick={() => handleReorder(order)}
                                className="flex items-center gap-1.5 bg-[#C4622D]/10 hover:bg-[#C4622D]/20 text-[#C4622D] border border-[#C4622D]/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <AppIcon name="ArrowPathIcon" size={12} />
                                Reorder
                              </button>
                              <button
                                onClick={() => toggleExpand(order.id)}
                                className="flex items-center gap-1 text-[#A09890] hover:text-white transition-colors text-xs"
                              >
                                <AppIcon
                                  name={isExpanded ? "ChevronUpIcon" : "ChevronDownIcon"}
                                  size={16}
                                />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Order Details */}
                        {isExpanded && (
                          <div className="border-t border-[#222] px-5 md:px-6 py-5">
                            {/* Items */}
                            <h4 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">
                              Items Ordered
                            </h4>
                            <div className="space-y-2 mb-5">
                              {order.items?.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between py-2 border-b border-[#1E1E1E] last:border-0"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-md bg-[#1E1E1E] flex items-center justify-center text-xs text-[#A09890] font-semibold">
                                      {item.quantity}
                                    </span>
                                    <div>
                                      <p className="text-sm text-white">{item.name}</p>
                                      {item.category && (
                                        <p className="text-xs text-[#666]">{item.category}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-sm text-[#A09890]">
                                    {formatCurrency(item.price * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Totals */}
                            <div className="bg-[#0F0F0F] rounded-xl p-4 mb-5 space-y-2">
                              <div className="flex justify-between text-sm text-[#A09890]">
                                <span>Subtotal</span>
                                <span>{formatCurrency(order.subtotal)}</span>
                              </div>
                              {(() => {
                                const discountMatch = order.notes?.match(/\(R([\d.]+)\s*credit\)/);
                                const discountAmt = discountMatch ? parseFloat(discountMatch[1]) : 0;
                                if (discountAmt <= 0) return null;
                                return (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-red-500 font-medium">Discount</span>
                                    <span className="text-red-500 font-medium">R{discountAmt.toFixed(2)}-</span>
                                  </div>
                                );
                              })()}
                              <div className="flex justify-between text-sm text-[#A09890]">
                                <span>Delivery</span>
                                <span>{order.delivery_fee > 0 ? formatCurrency(order.delivery_fee) : "Free"}</span>
                              </div>
                              <div className="flex justify-between text-sm font-bold text-white border-t border-[#222] pt-2 mt-2">
                                <span>Total</span>
                                <span>{(() => {
                                  const discountMatch = order.notes?.match(/\(R([\d.]+)\s*credit\)/);
                                  const discountAmt = discountMatch ? parseFloat(discountMatch[1]) : 0;
                                  return formatCurrency((order.subtotal || 0) - discountAmt + (order.delivery_fee || 0));
                                })()}</span>
                              </div>
                            </div>

                            {/* Delivery Info */}
                            {order.delivery_address && (
                              <div className="flex items-start gap-2 mb-4">
                                <AppIcon name="MapPinIcon" size={14} className="text-[#666] mt-0.5 shrink-0" />
                                <p className="text-xs text-[#A09890]">{order.delivery_address}</p>
                              </div>
                            )}
                            {order.notes && (
                              <div className="flex items-start gap-2 mb-4">
                                <AppIcon name="ChatBubbleLeftIcon" size={14} className="text-[#666] mt-0.5 shrink-0" />
                                <p className="text-xs text-[#A09890]">{order.notes}</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-3 pt-2">
                              <button
                                onClick={() => handleReorder(order)}
                                className="flex items-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                              >
                                <AppIcon name="ArrowPathIcon" size={14} />
                                Reorder This
                              </button>
                              <Link
                                href="/products"
                                className="flex items-center gap-2 bg-[#1E1E1E] hover:bg-[#252525] text-[#A09890] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              >
                                <AppIcon name="ShoppingCartIcon" size={14} />
                                Browse Menu
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Search again */}
              {emailSubmitted && !loading && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      setEmailSubmitted(false);
                      setOrders([]);
                      setEmailInput("");
                      setError(null);
                    }}
                    className="text-sm text-[#A09890] hover:text-white transition-colors underline underline-offset-2"
                  >
                    Search with a different email
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
