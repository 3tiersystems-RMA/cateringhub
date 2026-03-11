'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import AppIcon from '@/components/ui/AppIcon';
import Link from 'next/link';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'awaiting_payment' | 'refunded';
type FulfillmentStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
}

interface Order {
  id: string;
  m_payment_id: string | null;
  payfast_transaction_id: string | null;
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
  updated_at: string;
}

interface OrderUpdateState {
  fulfillmentSaving: boolean;
  paymentSaving: boolean;
  fulfillmentSuccess: boolean;
  paymentSuccess: boolean;
  fulfillmentError: string;
  paymentError: string;
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  awaiting_payment: 'Awaiting Payment',
  refunded: 'Refunded',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  awaiting_payment: 'bg-blue-100 text-blue-700 border-blue-200',
  refunded: 'bg-gray-100 text-gray-600 border-gray-200',
};

const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const FULFILLMENT_STATUS_COLORS: Record<FulfillmentStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmed: 'bg-purple-100 text-purple-700 border-purple-200',
  preparing: 'bg-orange-100 text-orange-700 border-orange-200',
  ready: 'bg-teal-100 text-teal-700 border-teal-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};

const FULFILLMENT_OPTIONS: FulfillmentStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
const PAYMENT_OPTIONS: PaymentStatus[] = ['awaiting_payment', 'paid', 'refunded', 'pending', 'failed'];

export default function StaffOrdersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Per-order update state
  const [orderUpdateStates, setOrderUpdateStates] = useState<Record<string, OrderUpdateState>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterFulfillment, setFilterFulfillment] = useState<string>('all');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/staff/login');
        return;
      }
      await loadOrders();
    };
    init();
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setOrders([]);
        return;
      }
      setOrders(data || []);
    } catch (err) {
      setError('Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const getOrderUpdateState = (orderId: string): OrderUpdateState => {
    return orderUpdateStates[orderId] || {
      fulfillmentSaving: false,
      paymentSaving: false,
      fulfillmentSuccess: false,
      paymentSuccess: false,
      fulfillmentError: '',
      paymentError: '',
    };
  };

  const setOrderUpdateField = (orderId: string, fields: Partial<OrderUpdateState>) => {
    setOrderUpdateStates((prev) => ({
      ...prev,
      [orderId]: { ...getOrderUpdateState(orderId), ...fields },
    }));
  };

  const handleFulfillmentUpdate = async (orderId: string, newStatus: FulfillmentStatus) => {
    setOrderUpdateField(orderId, { fulfillmentSaving: true, fulfillmentSuccess: false, fulfillmentError: '' });
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ fulfillment_status: newStatus })
        .eq('id', orderId);

      if (updateError) {
        setOrderUpdateField(orderId, { fulfillmentSaving: false, fulfillmentError: updateError.message });
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, fulfillment_status: newStatus } : o))
      );
      setOrderUpdateField(orderId, { fulfillmentSaving: false, fulfillmentSuccess: true });
      setTimeout(() => setOrderUpdateField(orderId, { fulfillmentSuccess: false }), 2500);
    } catch (err) {
      setOrderUpdateField(orderId, { fulfillmentSaving: false, fulfillmentError: 'Update failed' });
    }
  };

  const handlePaymentUpdate = async (orderId: string, newStatus: PaymentStatus) => {
    setOrderUpdateField(orderId, { paymentSaving: true, paymentSuccess: false, paymentError: '' });
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_status: newStatus })
        .eq('id', orderId);

      if (updateError) {
        setOrderUpdateField(orderId, { paymentSaving: false, paymentError: updateError.message });
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status: newStatus } : o))
      );
      setOrderUpdateField(orderId, { paymentSaving: false, paymentSuccess: true });
      setTimeout(() => setOrderUpdateField(orderId, { paymentSuccess: false }), 2500);
    } catch (err) {
      setOrderUpdateField(orderId, { paymentSaving: false, paymentError: 'Update failed' });
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.m_payment_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPayment = filterPayment === 'all' || order.payment_status === filterPayment;
    const matchesFulfillment = filterFulfillment === 'all' || order.fulfillment_status === filterFulfillment;

    return matchesSearch && matchesPayment && matchesFulfillment;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) =>
    `R${Number(amount || 0).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#1A1612] border-b border-[#3D342D] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppLogo className="h-8 w-auto" />
            <div className="h-5 w-px bg-[#3D342D]" />
            <span className="text-[#D4A853] text-sm font-semibold tracking-wide uppercase">Order Management</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/staff/workspace"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#B5ADA5] hover:text-white hover:bg-[#3D342D] transition-colors text-sm"
            >
              <AppIcon name="WrenchScrewdriverIcon" size={15} />
              Workspace
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace('/staff/login');
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#B5ADA5] hover:text-red-400 hover:bg-[#3D342D] transition-colors text-sm"
            >
              <AppIcon name="ArrowRightOnRectangleIcon" size={15} />
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title + Refresh */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1612]">Orders</h1>
            <p className="text-sm text-[#8C8278] mt-0.5">{filteredOrders.length} of {orders.length} orders</p>
          </div>
          <button
            onClick={loadOrders}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#DDD5C8] rounded-xl text-sm font-medium text-[#5C5347] hover:bg-[#EDE7DA] transition-colors disabled:opacity-50"
          >
            <AppIcon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-[#DDD5C8] p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <AppIcon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B5ADA5]" />
              <input
                type="text"
                placeholder="Search by name, email, or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
              />
            </div>
            {/* Payment Filter */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-3 py-2.5 border border-[#DDD5C8] rounded-xl text-sm text-[#1A1612] bg-white focus:outline-none focus:border-[#C4622D] transition-colors"
            >
              <option value="all">All Payments</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            {/* Fulfillment Filter */}
            <select
              value={filterFulfillment}
              onChange={(e) => setFilterFulfillment(e.target.value)}
              className="px-3 py-2.5 border border-[#DDD5C8] rounded-xl text-sm text-[#1A1612] bg-white focus:outline-none focus:border-[#C4622D] transition-colors"
            >
              <option value="all">All Fulfillment</option>
              <option value="new">New</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2 text-red-700 text-sm">
            <AppIcon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        {/* Orders Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#DDD5C8] p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#8C8278]">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#DDD5C8] p-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-[#EDE7DA] flex items-center justify-center">
              <AppIcon name="ClipboardDocumentListIcon" size={24} className="text-[#B5ADA5]" />
            </div>
            <p className="text-[#5C5347] font-medium">No orders found</p>
            <p className="text-sm text-[#B5ADA5]">
              {searchQuery || filterPayment !== 'all' || filterFulfillment !== 'all' ?'Try adjusting your filters' :'Orders will appear here once customers complete payments'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#DDD5C8] overflow-hidden">
            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-[1fr_1.5fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 bg-[#F5F0E8] border-b border-[#DDD5C8] text-xs font-semibold text-[#8C8278] uppercase tracking-wider">
              <span className="text-left pl-[22px]">Order ID</span>
              <span className="text-left">Customer</span>
              <span className="text-left">Items</span>
              <span className="text-left">Total</span>
              <span className="text-left">Payment</span>
              <span className="text-left">Fulfillment</span>
              <span className="text-left">Date</span>
            </div>

            {/* Order Rows */}
            <div className="divide-y divide-[#EDE7DA]">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                const itemSummary = Array.isArray(order.items) && order.items.length > 0
                  ? order.items.slice(0, 2).map((i) => `${i.name} x${i.quantity}`).join(', ') +
                    (order.items.length > 2 ? ` +${order.items.length - 2} more` : '')
                  : 'No items';
                const updateState = getOrderUpdateState(order.id);

                return (
                  <div key={order.id}>
                    {/* Main Row */}
                    <div
                      className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr_auto_auto_auto_auto] gap-4 px-5 py-4 hover:bg-[#FDFAF6] cursor-pointer transition-colors"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      {/* Order ID */}
                      <div className="flex items-center gap-2">
                        <AppIcon
                          name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                          size={14}
                          className="text-[#B5ADA5] flex-shrink-0"
                        />
                        <div>
                          <p className="text-xs font-mono font-semibold text-[#1A1612] truncate max-w-[120px]">
                            {order.m_payment_id || order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs text-[#B5ADA5] lg:hidden">{formatDate(order.created_at)}</p>
                        </div>
                      </div>

                      {/* Customer */}
                      <div className="lg:flex lg:flex-col">
                        <p className="text-sm font-semibold text-[#1A1612]">{order.customer_name || '—'}</p>
                        <p className="text-xs text-[#8C8278] truncate">{order.customer_email || '—'}</p>
                      </div>

                      {/* Items */}
                      <div className="hidden lg:block">
                        <p className="text-xs text-[#5C5347] line-clamp-2">{itemSummary}</p>
                        {itemCount > 0 && (
                          <p className="text-xs text-[#B5ADA5]">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
                        )}
                      </div>

                      {/* Total */}
                      <div className="flex items-center">
                        <span className="text-sm font-bold text-[#1A1612]">{formatCurrency(order.total)}</span>
                      </div>

                      {/* Payment Status — editable dropdown */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-start gap-0.5">
                          <select
                            value={order.payment_status}
                            onChange={(e) => handlePaymentUpdate(order.id, e.target.value as PaymentStatus)}
                            disabled={updateState.paymentSaving}
                            className={`text-xs font-semibold border rounded-full px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 transition-colors cursor-pointer disabled:opacity-50 ${PAYMENT_STATUS_COLORS[order.payment_status]}`}
                          >
                            {PAYMENT_OPTIONS.map((s) => (
                              <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                          {updateState.paymentSaving && (
                            <span className="text-xs text-[#8C8278] flex items-center gap-1">
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Saving...
                            </span>
                          )}
                          {updateState.paymentSuccess && (
                            <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              Saved
                            </span>
                          )}
                          {updateState.paymentError && (
                            <span className="text-xs text-red-500">{updateState.paymentError}</span>
                          )}
                        </div>
                      </div>

                      {/* Fulfillment Status — editable dropdown */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-start gap-0.5">
                          <select
                            value={order.fulfillment_status}
                            onChange={(e) => handleFulfillmentUpdate(order.id, e.target.value as FulfillmentStatus)}
                            disabled={updateState.fulfillmentSaving}
                            className={`text-xs font-semibold border rounded-full px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 transition-colors cursor-pointer disabled:opacity-50 ${FULFILLMENT_STATUS_COLORS[order.fulfillment_status]}`}
                          >
                            {FULFILLMENT_OPTIONS.map((s) => (
                              <option key={s} value={s}>{FULFILLMENT_STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                          {updateState.fulfillmentSaving && (
                            <span className="text-xs text-[#8C8278] flex items-center gap-1">
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Saving...
                            </span>
                          )}
                          {updateState.fulfillmentSuccess && (
                            <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              Saved
                            </span>
                          )}
                          {updateState.fulfillmentError && (
                            <span className="text-xs text-red-500">{updateState.fulfillmentError}</span>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="hidden lg:flex items-center">
                        <span className="text-xs text-[#8C8278]">{formatDate(order.created_at)}</span>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-5 pb-5 bg-[#FDFAF6] border-t border-[#EDE7DA]">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-4">
                          {/* Customer Details */}
                          <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                            <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <AppIcon name="UserIcon" size={13} />
                              Customer Details
                            </h4>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-[#B5ADA5]">Name</p>
                                <p className="text-sm font-medium text-[#1A1612]">{order.customer_name || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#B5ADA5]">Email</p>
                                <p className="text-sm text-[#1A1612] break-all">{order.customer_email || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#B5ADA5]">Phone</p>
                                <p className="text-sm text-[#1A1612]">{order.customer_phone || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#B5ADA5]">Event Date</p>
                                <p className="text-sm text-[#1A1612]">{order.event_date ? formatDate(order.event_date) : '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#B5ADA5]">Delivery Address</p>
                                <p className="text-sm text-[#1A1612]">{order.delivery_address || '—'}</p>
                              </div>
                              {order.notes && (
                                <div>
                                  <p className="text-xs text-[#B5ADA5]">Notes</p>
                                  <p className="text-sm text-[#1A1612]">{order.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Items Ordered */}
                          <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                            <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <AppIcon name="ShoppingBagIcon" size={13} />
                              Items Ordered
                            </h4>
                            {Array.isArray(order.items) && order.items.length > 0 ? (
                              <div className="space-y-2">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-[#1A1612] truncate">{item.name}</p>
                                      <p className="text-xs text-[#B5ADA5]">{item.unit} × {item.quantity}</p>
                                    </div>
                                    <span className="text-sm font-semibold text-[#1A1612] flex-shrink-0">
                                      {formatCurrency(item.price * item.quantity)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-[#B5ADA5]">No item details available</p>
                            )}
                          </div>

                          {/* Payment Summary */}
                          <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                            <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <AppIcon name="CreditCardIcon" size={13} />
                              Payment Summary
                            </h4>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-[#8C8278]">Subtotal</span>
                                <span className="text-[#1A1612]">{formatCurrency(order.subtotal)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-[#8C8278]">Delivery</span>
                                <span className="text-[#1A1612]">{formatCurrency(order.delivery_fee)}</span>
                              </div>
                              <div className="flex justify-between text-sm font-bold border-t border-[#EDE7DA] pt-2">
                                <span className="text-[#1A1612]">Total</span>
                                <span className="text-[#C4622D]">{formatCurrency(order.total)}</span>
                              </div>
                              <div className="pt-2 space-y-1.5">
                                <div>
                                  <p className="text-xs text-[#B5ADA5]">Payment Status</p>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>
                                    {PAYMENT_STATUS_LABELS[order.payment_status]}
                                  </span>
                                </div>
                                {order.payfast_transaction_id && (
                                  <div>
                                    <p className="text-xs text-[#B5ADA5]">PayFast Transaction ID</p>
                                    <p className="text-xs font-mono text-[#5C5347]">{order.payfast_transaction_id}</p>
                                  </div>
                                )}
                                {order.m_payment_id && (
                                  <div>
                                    <p className="text-xs text-[#B5ADA5]">Order Reference</p>
                                    <p className="text-xs font-mono text-[#5C5347]">{order.m_payment_id}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
