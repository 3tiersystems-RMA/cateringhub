'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  category?: string;
}

interface AwaitingOrder {
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
  m_payment_id: string | null;
}

interface CorrespondenceSettings {
  form_header_title: string | null;
  logo_url: string | null;
}

interface PaymentConfirmationProps {
  userRole: string;
}

export default function PaymentConfirmation({ userRole }: PaymentConfirmationProps) {
  const supabase = createClient();

  const [orders, setOrders] = useState<AwaitingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [correspondenceSettings, setCorrespondenceSettings] = useState<CorrespondenceSettings | null>(null);

  // Preview modal state (send flow)
  const [previewOrder, setPreviewOrder] = useState<AwaitingOrder | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // View Confirmation modal state (read-only preview — Super Admin only)
  const [viewOrder, setViewOrder] = useState<AwaitingOrder | null>(null);

  const isAuthorized = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  const loadData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError('');

    const [ordersResult, settingsResult] = await Promise.all([
      supabase
        .from('orders')
        .select(
          'id, customer_name, customer_email, customer_phone, items, subtotal, delivery_fee, total, payment_status, fulfillment_status, event_date, delivery_address, notes, created_at, m_payment_id, payment_method'
        )
        .eq('payment_status', 'awaiting_confirmation')
        .order('created_at', { ascending: false }),
      supabase
        .from('correspondence_settings')
        .select('form_header_title, logo_url')
        .limit(1)
        .maybeSingle(),
    ]);

    if (ordersResult.error) {
      setError('Failed to load orders: ' + ordersResult.error.message);
      setOrders([]);
    } else {
      setOrders((ordersResult.data as AwaitingOrder[]) || []);
    }

    if (settingsResult.data) {
      setCorrespondenceSettings(settingsResult.data);
    }

    setLoading(false);
  }, [isAuthorized, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSendConfirmation = async () => {
    if (!previewOrder) return;
    setSending(true);
    setSendResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-payment-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          orderId: previewOrder.id,
          customerName: previewOrder.customer_name,
          customerEmail: previewOrder.customer_email,
          customerPhone: previewOrder.customer_phone,
          items: previewOrder.items,
          subtotal: previewOrder.subtotal,
          deliveryFee: previewOrder.delivery_fee,
          orderTotal: previewOrder.total,
          eventDate: previewOrder.event_date,
          deliveryAddress: previewOrder.delivery_address,
          notes: previewOrder.notes,
          paymentMethod: previewOrder.m_payment_id ? 'PayFast' : 'EFT',
          createdAt: previewOrder.created_at,
          formHeaderTitle: correspondenceSettings?.form_header_title || 'Cardamom Kitchen',
          logoUrl: correspondenceSettings?.logo_url || null,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || 'Failed to send confirmation email');
      }

      // Update payment_status to 'paid'
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', previewOrder.id);

      if (updateError) {
        throw new Error('Email sent but failed to update order status: ' + updateError.message);
      }

      setSendResult({ success: true, message: 'Confirmation email sent successfully. Order marked as Paid.' });
      showToast('success', `Confirmation sent to ${previewOrder.customer_email}`);

      // Remove from list and close modal after short delay
      setTimeout(() => {
        setOrders(prev => prev.filter(o => o.id !== previewOrder.id));
        setPreviewOrder(null);
        setSendResult(null);
      }, 2000);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setSendResult({ success: false, message });
      showToast('error', message);
    } finally {
      setSending(false);
    }
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
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.id.toLowerCase().includes(q) ||
      order.customer_name.toLowerCase().includes(q) ||
      order.customer_email.toLowerCase().includes(q)
    );
  });

  // Shared email preview body — used in both modals
  function EmailPreviewBody({ order }: { order: AwaitingOrder }) {
    return (
      <div className="rounded-xl overflow-hidden border border-[#EDE7DA]">
        {/* Dark header */}
        <div className="bg-[#1A1612] px-6 py-5 text-center">
          {correspondenceSettings?.logo_url && (
            <img src={correspondenceSettings.logo_url} alt="Logo" className="h-10 object-contain mx-auto mb-2" />
          )}
          <h4 className="text-white font-bold text-lg">{correspondenceSettings?.form_header_title || 'Cardamom Kitchen'}</h4>
          <p className="text-[#C4622D] text-xs tracking-widest uppercase mt-1">Catering &amp; Meal Prep</p>
        </div>

        {/* Confirmation Banner */}
        <div className="bg-green-50 border-b border-green-200 px-6 py-3 text-center">
          <p className="text-green-700 font-bold text-sm">✅ Customer Payment Confirmation</p>
        </div>

        <div className="bg-white px-6 py-5 space-y-4">
          {/* Greeting */}
          <p className="text-[#5C5347] text-sm leading-relaxed">
            Dear <strong>{order.customer_name}</strong>,<br />
            We are pleased to confirm that your payment has been received and your order is now confirmed.
          </p>

          {/* Customer Information */}
          <div className="rounded-xl overflow-hidden border border-[#EDE7DA]">
            <div className="bg-[#EDE7DA] px-4 py-2.5">
              <p className="text-xs font-bold text-[#8C8278] uppercase tracking-wider">Customer Information</p>
            </div>
            <div className="divide-y divide-[#f0ebe4]">
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-[#8C8278]">Name</span><span className="font-semibold text-[#1A1612]">{order.customer_name}</span></div>
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-[#8C8278]">Email</span><span className="font-semibold text-[#C4622D]">{order.customer_email}</span></div>
              {order.customer_phone && <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-[#8C8278]">Phone</span><span className="font-semibold text-[#1A1612]">{order.customer_phone}</span></div>}
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-[#8C8278]">Order Date</span><span className="font-semibold text-[#1A1612]">{formatDate(order.created_at)}</span></div>
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-[#8C8278]">Payment Method</span><span className="font-semibold text-[#1A1612]">{order.m_payment_id ? 'PayFast' : 'EFT'}</span></div>
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-[#8C8278]">Delivery Address</span><span className="font-semibold text-[#1A1612]">{order.delivery_address || 'N/A'}</span></div>
              {order.notes && <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-[#8C8278]">Notes</span><span className="font-semibold text-[#1A1612] text-right max-w-[60%]">{order.notes}</span></div>}
            </div>
          </div>

          {/* Order Summary */}
          <div className="rounded-xl overflow-hidden border border-[#EDE7DA]">
            <div className="bg-[#EDE7DA] px-4 py-2.5">
              <p className="text-xs font-bold text-[#8C8278] uppercase tracking-wider">ORDER SUMMARY — REF: <span className="font-mono text-[#C4622D]">{order.id}</span></p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f9f6f2]">
                  <th className="px-4 py-2 text-left text-xs text-[#8C8278] font-semibold">Item</th>
                  <th className="px-4 py-2 text-center text-xs text-[#8C8278] font-semibold">Qty</th>
                  <th className="px-4 py-2 text-right text-xs text-[#8C8278] font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, i) => (
                  <tr key={i} className="border-t border-[#f0ebe4]">
                    <td className="px-4 py-2.5 text-[#1A1612]">{item.name}</td>
                    <td className="px-4 py-2.5 text-center text-[#5C5347]">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#1A1612]">{formatCurrency(item.price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {order.subtotal != null && (
                  <tr className="border-t border-[#f0ebe4]">
                    <td colSpan={2} className="px-4 py-2 text-[#8C8278] text-xs">Subtotal</td>
                    <td className="px-4 py-2 text-right font-mono text-[#5C5347] text-xs">{formatCurrency(order.subtotal)}</td>
                  </tr>
                )}
                {order.delivery_fee != null && (
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-[#8C8278] text-xs">Delivery Fee</td>
                    <td className="px-4 py-2 text-right font-mono text-[#5C5347] text-xs">{formatCurrency(order.delivery_fee)}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-[#EDE7DA]">
                  <td colSpan={2} className="px-4 py-3 font-bold text-[#1A1612]">Order Total</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-[#C4622D]">{formatCurrency(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* CTA preview */}
          <div>
            <p className="text-[#5C5347] text-sm mb-2">View and manage this order in the staff workspace:</p>
            <a href="https://cardamomkitchen.co.za/order-history" target="_blank" rel="noopener noreferrer" className="inline-block bg-[#C4622D] text-white text-sm font-bold px-5 py-2.5 rounded-lg">Open Orders Workspace →</a>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-amber-700 font-semibold">Access Restricted</p>
          <p className="text-amber-600 text-sm mt-1">Payment Confirmation is available to Admin and Super Admin only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
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
          <h2 className="text-xl font-bold text-[#1A1612]">Payment Confirmation</h2>
          <p className="text-sm text-[#8C8278] mt-0.5">Orders awaiting payment confirmation — send confirmation email to customer</p>
        </div>
        <button
          onClick={loadData}
          className="border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm hover:bg-[#F5F0E8] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8278]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search by order ref, customer name or email…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm focus:outline-none focus:border-[#C4622D] bg-white"
          />
        </div>
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
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-[#1A1612] font-semibold">
            {searchQuery ? 'No orders match your search' : 'No orders awaiting confirmation'}
          </p>
          <p className="text-[#8C8278] text-sm mt-1 max-w-md mx-auto">
            {searchQuery
              ? 'Try a different search term.'
              : 'PayFast orders appear here after payment. For EFT orders, open Order Management and use “Payment received” to queue them here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-[#1A1612] text-sm">{order.customer_name}</p>
                  <span className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">Awaiting Confirmation</span>
                </div>
                <p className="text-xs text-[#8C8278] font-mono truncate">{order.id}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-xs text-[#5C5347]">{order.customer_email}</p>
                  <span className="text-[#DDD5C8]">·</span>
                  <p className="text-xs font-semibold text-[#C4622D]">{formatCurrency(order.total)}</p>
                  <span className="text-[#DDD5C8]">·</span>
                  <p className="text-xs text-[#8C8278]">{formatDate(order.created_at)}</p>
                  <span className="text-[#DDD5C8]">·</span>
                  <p className="text-xs text-[#8C8278] capitalize">{order.m_payment_id ? 'PayFast' : 'EFT'}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => { setPreviewOrder(order); setSendResult(null); }}
                  className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Send Confirmation
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setViewOrder(order)}
                    className="border border-[#C4622D] text-[#C4622D] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#FDF6EE] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    View Confirmation
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Send Confirmation Modal (existing flow) ── */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-[#EDE7DA] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-base font-bold text-[#1A1612]">Email Preview</h3>
                <p className="text-xs text-[#8C8278] mt-0.5">Review before sending to {previewOrder.customer_email}</p>
              </div>
              <button onClick={() => { setPreviewOrder(null); setSendResult(null); }} className="text-[#8C8278] hover:text-[#1A1612] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Email Preview Body */}
            <div className="p-6">
              <EmailPreviewBody order={previewOrder} />

              {/* Send Result */}
              {sendResult && (
                <div className={`mt-4 rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${sendResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {sendResult.success ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" /></svg>
                  )}
                  {sendResult.message}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-[#EDE7DA] px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => { setPreviewOrder(null); setSendResult(null); }}
                disabled={sending}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendConfirmation}
                disabled={sending || (sendResult?.success === true)}
                className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    Sending…
                  </>
                ) : sendResult?.success ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Sent!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Confirm &amp; Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Confirmation Modal (read-only — Super Admin only) ── */}
      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-[#EDE7DA] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1A1612]">Confirmation Email Preview</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-semibold">Super Admin</span>
                </div>
                <p className="text-xs text-[#8C8278] mt-0.5">Exact email layout the customer will receive — {viewOrder.customer_email}</p>
              </div>
              <button onClick={() => setViewOrder(null)} className="text-[#8C8278] hover:text-[#1A1612] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Info banner */}
            <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-blue-700">This is a read-only preview of the confirmation email. No email will be sent. Use <strong>Send Confirmation</strong> to dispatch the email to the customer.</p>
            </div>

            {/* Email Preview Body */}
            <div className="p-6">
              <EmailPreviewBody order={viewOrder} />
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-[#EDE7DA] px-6 py-4 flex justify-end">
              <button
                onClick={() => setViewOrder(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
