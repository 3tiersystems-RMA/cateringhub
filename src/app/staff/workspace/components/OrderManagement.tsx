'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';

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
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_status: string;
  fulfillment_status: string;
  event_date: string | null;
  delivery_address: string;
  notes: string;
  created_at: string;
  updated_at: string;
  m_payment_id: string | null;
  payment_method: string | null;
  delivered_date: string | null;
}

type FulfillmentStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'collected' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'awaiting_payment' | 'refunded' | 'discounted' | 'unpaid' | 'awaiting_confirmation';

const FULFILLMENT_STATUSES: { value: FulfillmentStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-[#C4622D] text-white border-[#C4622D]' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'preparing', label: 'Preparing', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'ready', label: 'Ready', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'delivered', label: 'Delivered', color: 'bg-black text-white border-black' },
  { value: 'collected', label: 'Collected', color: 'bg-teal-600 text-white border-teal-600' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200' },
];

const PAYMENT_STATUSES: { value: PaymentStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'paid', label: 'Paid', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'failed', label: 'Failed', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'awaiting_payment', label: 'Awaiting Payment', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'awaiting_confirmation', label: 'Awaiting Confirmation', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'refunded', label: 'Refunded', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'discounted', label: 'Discounted', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'unpaid', label: 'Unpaid', color: 'bg-orange-50 text-orange-700 border-orange-200' },
];

function getFulfillmentBadge(status: string) {
  return FULFILLMENT_STATUSES.find(s => s.value === status) ?? { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200' };
}

function getPaymentBadge(status: string) {
  return PAYMENT_STATUSES.find(s => s.value === status) ?? { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200' };
}

interface OrderManagementProps {
  userRole?: string;
}

export default function OrderManagement({ userRole = '' }: OrderManagementProps) {
  const supabase = createClient();
  const canConfirmPayment = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ orderId: string; customerName: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Failed to load orders: ' + fetchError.message);
    } else {
      setOrders((data as Order[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleMarkPaymentReceived = async (orderId: string) => {
    setUpdatingId(orderId);
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'awaiting_confirmation',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      showToast('error', 'Failed to update payment: ' + updateError.message);
    } else {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, payment_status: 'awaiting_confirmation' } : o
        )
      );
      showToast('success', 'Payment marked as received — open Payment Confirmation to email the customer');
    }
    setUpdatingId(null);
  };

  const handleUpdateFulfillmentStatus = async (orderId: string, newStatus: FulfillmentStatus) => {
    setUpdatingId(orderId);
    const { error: updateError } = await supabase
      .from('orders')
      .update({ fulfillment_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateError) {
      showToast('error', 'Failed to update status: ' + updateError.message);
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, fulfillment_status: newStatus } : o));
      showToast('success', 'Order status updated successfully');
    }
    setUpdatingId(null);
  };

  const handleDeleteOrder = async () => {
    if (!deleteConfirm) return;
    setDeletingId(deleteConfirm.orderId);
    setDeleteConfirm(null);
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', deleteConfirm.orderId);

    if (deleteError) {
      showToast('error', 'Failed to delete order: ' + deleteError.message);
    } else {
      setOrders(prev => prev.filter(o => o.id !== deleteConfirm.orderId));
      if (expandedOrderId === deleteConfirm.orderId) setExpandedOrderId(null);
      showToast('success', 'Order deleted successfully');
    }
    setDeletingId(null);
  };

  const formatCurrency = (val: number) => `R ${Number(val).toFixed(2)}`;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchQuery.trim() || (() => {
      const q = searchQuery.toLowerCase();
      return (
        order.id.toLowerCase().includes(q) ||
        order.customer_name.toLowerCase().includes(q) ||
        order.customer_email.toLowerCase().includes(q) ||
        order.customer_phone?.toLowerCase().includes(q)
      );
    })();
    const matchesFulfillment = statusFilter === 'all' || order.fulfillment_status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
    return matchesSearch && matchesFulfillment && matchesPayment;
  });

  // Summary counts
  const summaryCounts = {
    total: orders.length,
    new: orders.filter(o => o.fulfillment_status === 'new').length,
    preparing: orders.filter(o => o.fulfillment_status === 'preparing').length,
    delivered: orders.filter(o => o.fulfillment_status === 'delivered').length,
    collected: orders.filter(o => o.fulfillment_status === 'collected').length,
    cancelled: orders.filter(o => o.fulfillment_status === 'cancelled').length,
  };

  return (
    <div className="p-6">
      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteConfirm}
        productName={deleteConfirm?.customerName ?? ''}
        title="Delete Order"
        message={deleteConfirm ? `Are you sure you want to permanently delete the order for ${deleteConfirm.customerName}? This action cannot be undone.` : ''}
        onConfirm={handleDeleteOrder}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 transition-all ${toastMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toastMessage.type === 'success' ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1A1612]">Order Management</h2>
          <p className="text-sm text-[#8C8278] mt-0.5">View and manage all customer orders — update fulfillment status and track progress</p>
        </div>
        <button
          onClick={loadOrders}
          className="border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm hover:bg-[#F5F0E8] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Orders', value: summaryCounts.total, color: 'bg-[#F5F0E8] text-[#1A1612]' },
          { label: 'New', value: summaryCounts.new, color: 'bg-[#C4622D] text-white' },
          { label: 'Preparing', value: summaryCounts.preparing, color: 'bg-amber-50 text-amber-700' },
          { label: 'Delivered', value: summaryCounts.delivered, color: 'bg-black text-white' },
          { label: 'Collected', value: summaryCounts.collected, color: 'bg-teal-600 text-white' },
          { label: 'Cancelled', value: summaryCounts.cancelled, color: 'bg-red-50 text-red-700' },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl border border-[#EDE7DA] p-4 text-center ${card.color}`}>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8278]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search by name, email, phone or order ID…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm focus:outline-none focus:border-[#C4622D] bg-white"
          />
        </div>
        {/* Fulfillment filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white text-[#1A1612]"
        >
          <option value="all">All Fulfillment Statuses</option>
          {FULFILLMENT_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {/* Payment filter */}
        <select
          value={paymentFilter}
          onChange={e => setPaymentFilter(e.target.value)}
          className="border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white text-[#1A1612]"
        >
          <option value="all">All Payment Statuses</option>
          {PAYMENT_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">{error}</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EDE7DA] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F5F0E8] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <p className="text-[#1A1612] font-semibold">
            {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' ? 'No orders match your filters' : 'No orders found'}
          </p>
          <p className="text-[#8C8278] text-sm mt-1">
            {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Orders will appear here once customers place them.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const fulfillmentBadge = getFulfillmentBadge(order.fulfillment_status);
            const paymentBadge = getPaymentBadge(order.payment_status);
            const isExpanded = expandedOrderId === order.id;
            const isUpdating = updatingId === order.id;
            const itemsArray: OrderItem[] = Array.isArray(order.items) ? order.items : [];

            return (
              <div key={order.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                {/* Order Row */}
                <div className="p-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-[#1A1612] text-sm">{order.customer_name}</p>
                      <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${fulfillmentBadge.color}`}>
                        {fulfillmentBadge.label}
                      </span>
                      <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${paymentBadge.color}`}>
                        {paymentBadge.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#8C8278] font-mono truncate mb-1">{order.id}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-xs text-[#5C5347]">{order.customer_email}</p>
                      {order.customer_phone && (
                        <>
                          <span className="text-[#DDD5C8]">·</span>
                          <p className="text-xs text-[#5C5347]">{order.customer_phone}</p>
                        </>
                      )}
                      <span className="text-[#DDD5C8]">·</span>
                      <p className="text-xs font-semibold text-[#C4622D]">{formatCurrency(order.total)}</p>
                      <span className="text-[#DDD5C8]">·</span>
                      <p className="text-xs text-[#8C8278]">{formatDate(order.created_at)}</p>
                      <span className="text-[#DDD5C8]">·</span>
                      <p className="text-xs text-[#8C8278]">{itemsArray.length} item{itemsArray.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="border border-[#DDD5C8] text-[#5C5347] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F5F0E8] transition-colors flex items-center gap-1.5"
                    >
                      {isExpanded ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                          Collapse
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          View Details
                        </>
                      )}
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => setDeleteConfirm({ orderId: order.id, customerName: order.customer_name })}
                        disabled={deletingId === order.id}
                        className="flex items-center gap-1.5 border border-red-300 bg-white text-red-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-[#EDE7DA] bg-[#FAF7F2] px-4 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {/* Items */}
                      <div>
                        <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Items Ordered</p>
                        {itemsArray.length === 0 ? (
                          <p className="text-xs text-[#8C8278]">No items recorded</p>
                        ) : (
                          <div className="space-y-1.5">
                            {itemsArray.map((item, idx) => (
                              <div key={item.id || idx} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-[#EDE7DA] text-[#5C5347] text-xs font-bold flex items-center justify-center flex-shrink-0">
                                    {item.quantity}
                                  </span>
                                  <span className="text-xs text-[#1A1612] truncate">{item.name}</span>
                                  {item.unit && <span className="text-xs text-[#8C8278] flex-shrink-0">/ {item.unit}</span>}
                                </div>
                                <span className="text-xs font-semibold text-[#C4622D] flex-shrink-0">
                                  {formatCurrency(item.price * item.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Order Info */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Order Details</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#8C8278]">Subtotal</span>
                          <span className="text-[#1A1612] font-medium">{formatCurrency(order.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#8C8278]">Delivery Fee</span>
                          <span className="text-[#1A1612] font-medium">{formatCurrency(order.delivery_fee)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-[#EDE7DA] pt-1.5 mt-1.5">
                          <span className="text-[#1A1612] font-semibold">Total</span>
                          <span className="text-[#C4622D] font-bold">{formatCurrency(order.total)}</span>
                        </div>
                        {order.event_date && (
                          <div className="flex justify-between text-xs pt-1">
                            <span className="text-[#8C8278]">Event Date</span>
                            <span className="text-[#1A1612]">{formatDate(order.event_date)}</span>
                          </div>
                        )}
                        {order.delivery_address && (
                          <div className="flex justify-between text-xs pt-1 gap-4">
                            <span className="text-[#8C8278] flex-shrink-0">Delivery Address</span>
                            <span className="text-[#1A1612] text-right">{order.delivery_address}</span>
                          </div>
                        )}
                        {order.notes && (
                          <div className="flex justify-between text-xs pt-1 gap-4">
                            <span className="text-[#8C8278] flex-shrink-0">Notes</span>
                            <span className="text-[#1A1612] text-right">{order.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {canConfirmPayment && order.payment_status === 'awaiting_payment' && (
                      <div className="border-t border-[#EDE7DA] pt-3 mb-3">
                        <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Payment</p>
                        <button
                          type="button"
                          onClick={() => handleMarkPaymentReceived(order.id)}
                          disabled={isUpdating}
                          className="text-xs px-4 py-2 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {isUpdating ? 'Updating…' : 'Payment received — queue for confirmation email'}
                        </button>
                      </div>
                    )}

                    {/* Update Fulfillment Status */}
                    <div className="border-t border-[#EDE7DA] pt-3">
                      <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Update Fulfillment Status</p>
                      <div className="flex flex-wrap gap-2">
                        {FULFILLMENT_STATUSES.map(s => (
                          <button
                            key={s.value}
                            onClick={() => handleUpdateFulfillmentStatus(order.id, s.value)}
                            disabled={isUpdating || order.fulfillment_status === s.value}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors disabled:opacity-50 ${
                              order.fulfillment_status === s.value
                                ? `${s.color} ring-2 ring-offset-1 ring-[#C4622D]`
                                : 'bg-white border-[#DDD5C8] text-[#5C5347] hover:bg-[#F5F0E8]'
                            }`}
                          >
                            {isUpdating && order.fulfillment_status !== s.value ? (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                {s.label}
                              </span>
                            ) : (
                              <>
                                {order.fulfillment_status === s.value && '✓ '}
                                {s.label}
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
