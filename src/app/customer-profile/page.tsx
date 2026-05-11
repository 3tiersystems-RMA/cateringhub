"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppIcon from "@/components/ui/AppIcon";

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

interface CustomerProfile {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  first_order_date: string;
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

const VOUCHER_MEAL_PRICES: Record<number, number> = {
  6: 690,
  10: 1350,
  12: 1320,
  24: 2520,
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

function extractUniqueAddresses(orders: Order[]): string[] {
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const order of orders) {
    const addr = order.delivery_address?.trim();
    if (addr && !seen.has(addr.toLowerCase())) {
      seen.add(addr.toLowerCase());
      addresses.push(addr);
    }
  }
  return addresses;
}

type ActiveTab = "profile" | "addresses" | "orders";
type ViewState = "lookup" | "profile";

export default function CustomerProfilePage() {
  const router = useRouter();

  // Lookup state
  const [viewState, setViewState] = useState<ViewState>("lookup");
  const [identifier, setIdentifier] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Profile state
  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [voucherAmounts, setVoucherAmounts] = useState<Record<string, number>>({});

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLookupLoading(true);
    setLookupError(null);

    try {
      const res = await fetch("/api/customer-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLookupError(data.error || "Lookup failed. Please try again.");
        return;
      }

      setProfile(data.profile);
      setOrders(data.orders || []);

      // Compute voucher amounts from order notes
      await computeVoucherAmounts(data.orders || []);

      setViewState("profile");
    } catch {
      setLookupError("An unexpected error occurred. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const computeVoucherAmounts = async (fetchedOrders: Order[]) => {
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

    try {
      const res = await fetch("/api/customer-lookup/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: voucherCodes }),
      });
      if (res.ok) {
        const vData = await res.json();
        const amounts: Record<string, number> = {};
        for (const v of vData.vouchers || []) {
          const orderId = codeToOrderId[v.voucher_code];
          if (orderId) amounts[orderId] = VOUCHER_MEAL_PRICES[v.total_meals] ?? 0;
        }
        setVoucherAmounts(amounts);
      }
    } catch {
      // Non-critical — voucher amounts just won't show
    }
  };

  const handleReorder = (order: Order) => {
    sessionStorage.setItem("reorder_items", JSON.stringify(order.items));
    router.push("/products?reorder=1");
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const handleSignOut = () => {
    setViewState("lookup");
    setProfile(null);
    setOrders([]);
    setIdentifier("");
    setActiveTab("profile");
  };

  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: "profile", label: "My Profile", icon: "UserCircleIcon" },
    { id: "addresses", label: "Saved Addresses", icon: "MapPinIcon" },
    { id: "orders", label: "Order History", icon: "ClipboardDocumentListIcon" },
  ];

  const savedAddresses = profile ? extractUniqueAddresses(orders) : [];

  // ── LOOKUP SCREEN ──────────────────────────────────────────────────────────
  if (viewState === "lookup") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <Header />
        <main className="pt-24 pb-20 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            {/* Back link */}
            <div className="mb-6">
              <Link
                href="/homepage"
                className="text-[#A09890] hover:text-white transition-colors text-sm flex items-center gap-1"
              >
                <AppIcon name="ArrowLeftIcon" size={14} />
                Back to Home
              </Link>
            </div>

            {/* Card */}
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-8">
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-[#C4622D]/15 border border-[#C4622D]/25 flex items-center justify-center mx-auto mb-5">
                <AppIcon name="UserCircleIcon" size={28} className="text-[#C4622D]" />
              </div>

              <h1 className="text-2xl font-bold text-white text-center mb-1">
                View Your Profile
              </h1>
              <p className="text-[#A09890] text-sm text-center mb-7 leading-relaxed">
                Enter the email address or mobile number you used when placing your order(s) to access your profile and order history.
              </p>

              <form onSubmit={handleLookup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">
                    Email Address or Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                      <AppIcon
                        name={identifier.includes("@") ? "EnvelopeIcon" : "PhoneIcon"}
                        size={16}
                        className="text-[#555]"
                      />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setLookupError(null);
                      }}
                      placeholder="e.g. jane@example.com or 082 123 4567"
                      className="w-full bg-[#1A1A1A] border border-[#333] rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#C4622D] transition-colors"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </div>

                {lookupError && (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 text-red-400 text-sm px-4 py-3 rounded-xl">
                    <AppIcon name="ExclamationCircleIcon" size={16} className="shrink-0 mt-0.5" />
                    <span>{lookupError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={lookupLoading || !identifier.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  {lookupLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Looking up…
                    </>
                  ) : (
                    <>
                      <AppIcon name="MagnifyingGlassIcon" size={16} />
                      Find My Profile
                    </>
                  )}
                </button>
              </form>

              <p className="text-xs text-[#555] text-center mt-5 leading-relaxed">
                Your information is used only to retrieve your order history and is never stored in a new account.
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── PROFILE SCREEN ─────────────────────────────────────────────────────────
  if (!profile) return null;

  const initials = profile.customer_name
    ? profile.customer_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (profile.customer_email[0] || "?").toUpperCase();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Header />

      <main className="pt-24 pb-20">
        {/* Page Header */}
        <div className="max-w-5xl mx-auto px-4 md:px-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleSignOut}
              className="text-[#A09890] hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              <AppIcon name="ArrowLeftIcon" size={14} />
              Look up a different account
            </button>
          </div>

          {/* Profile Hero */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-[#C4622D]/20 border border-[#C4622D]/30 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-[#C4622D]">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                {profile.customer_name || "Customer"}
              </h1>
              {profile.customer_email && (
                <p className="text-[#A09890] text-sm mt-1">{profile.customer_email}</p>
              )}
              {profile.customer_phone && (
                <p className="text-[#666] text-xs mt-0.5">{profile.customer_phone}</p>
              )}
              <p className="text-[#666] text-xs mt-1">
                First order: {formatDate(profile.first_order_date)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center px-4 py-2 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                <p className="text-lg font-bold text-white">{orders.length}</p>
                <p className="text-xs text-[#666]">Orders</p>
              </div>
              <div className="text-center px-4 py-2 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                <p className="text-lg font-bold text-white">{savedAddresses.length}</p>
                <p className="text-xs text-[#666]">Addresses</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-[#141414] border border-[#2A2A2A] rounded-xl p-1 mb-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
                  activeTab === tab.id
                    ? "bg-[#C4622D] text-white shadow-sm"
                    : "text-[#A09890] hover:text-white hover:bg-[#1E1E1E]"
                }`}
              >
                <AppIcon name={tab.icon} size={15} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Profile */}
          {activeTab === "profile" && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 md:p-8">
              <h2 className="text-lg font-semibold text-white mb-6">Profile Details</h2>
              <div className="space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">
                    Full Name
                  </label>
                  <p className="text-white text-sm bg-[#1A1A1A] border border-[#222] rounded-xl px-4 py-3">
                    {profile.customer_name || <span className="text-[#555]">Not set</span>}
                  </p>
                </div>

                {/* Email */}
                {profile.customer_email && (
                  <div>
                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <p className="text-[#A09890] text-sm bg-[#1A1A1A] border border-[#222] rounded-xl px-4 py-3 flex items-center gap-2">
                      <AppIcon name="EnvelopeIcon" size={14} className="text-[#555]" />
                      {profile.customer_email}
                    </p>
                  </div>
                )}

                {/* Phone */}
                {profile.customer_phone && (
                  <div>
                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">
                      Mobile / Cell Number
                    </label>
                    <p className="text-[#A09890] text-sm bg-[#1A1A1A] border border-[#222] rounded-xl px-4 py-3 flex items-center gap-2">
                      <AppIcon name="PhoneIcon" size={14} className="text-[#555]" />
                      {profile.customer_phone}
                    </p>
                  </div>
                )}

                {/* First Order */}
                <div>
                  <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">
                    Customer Since
                  </label>
                  <p className="text-[#A09890] text-sm bg-[#1A1A1A] border border-[#222] rounded-xl px-4 py-3 flex items-center gap-2">
                    <AppIcon name="CalendarDaysIcon" size={14} className="text-[#555]" />
                    {formatDate(profile.first_order_date)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Saved Addresses */}
          {activeTab === "addresses" && (
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Saved Addresses</h2>
                  <p className="text-xs text-[#666] mt-1">Addresses used in your previous orders</p>
                </div>
              </div>

              {savedAddresses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-[#1E1E1E] flex items-center justify-center mx-auto mb-4">
                    <AppIcon name="MapPinIcon" size={28} className="text-[#555]" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">No addresses yet</h3>
                  <p className="text-[#A09890] text-sm mb-6">
                    Delivery addresses from your orders will appear here.
                  </p>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] text-white px-6 py-3 rounded-full text-sm font-semibold transition-colors"
                  >
                    <AppIcon name="ShoppingCartIcon" size={16} />
                    Place an Order
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedAddresses.map((address, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-4 hover:border-[#3A3A3A] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#C4622D]/15 flex items-center justify-center shrink-0 mt-0.5">
                        <AppIcon name="MapPinIcon" size={15} className="text-[#C4622D]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white leading-relaxed">{address}</p>
                        <p className="text-xs text-[#666] mt-1">Used in previous order</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Order History */}
          {activeTab === "orders" && (
            <div>
              {orders.length === 0 ? (
                <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#1E1E1E] flex items-center justify-center mx-auto mb-4">
                    <AppIcon name="ShoppingBagIcon" size={28} className="text-[#555]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No orders yet</h3>
                  <p className="text-[#A09890] text-sm mb-6">
                    Your order history will appear here once you place an order.
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
                        onClick={() => toggleExpand(order.id)}
                        className="bg-[#141414] border border-[#2A2A2A] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#3A3A3A] cursor-pointer"
                      >
                        {/* Order Header Row */}
                        <div className="p-5 md:p-6">
                          <div className="flex flex-col md:flex-row md:items-center gap-4">
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
                                  <span className="text-[#A09890] font-normal"> · {voucherNumber}</span>
                                ) : !isVoucherOrder && order.event_date ? (
                                  <span className="text-[#A09890] font-normal"> · Event: {formatDate(order.event_date)}</span>
                                ) : null}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${FULFILLMENT_COLORS[order.fulfillment_status]}`}>
                                {FULFILLMENT_LABELS[order.fulfillment_status]}
                              </span>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_COLORS[order.payment_status]}`}>
                                {PAYMENT_LABELS[order.payment_status]}
                              </span>
                            </div>

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
                                <AppIcon name={isExpanded ? "ChevronUpIcon" : "ChevronDownIcon"} size={16} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Order Details */}
                        {isExpanded && (
                          <div className="border-t border-[#222] px-5 md:px-6 py-5">
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
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
