'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    category: string;
  };
  quantity: number;
}

interface AbandonedCart {
  id: string;
  guest_token: string;
  items: CartItem[];
  customer_email: string | null;
  customer_name: string | null;
  last_activity_at: string;
  reminder_sent_at: string | null;
  created_at: string;
}

function timeSince(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function cartTotal(items: CartItem[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item?.product?.price ?? 0) * (item?.quantity ?? 0), 0);
}

function cartItemCount(items: CartItem[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item?.quantity ?? 0), 0);
}

export default function AbandonedCarts() {
  const supabase = createClient();

  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Date range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Reminder state
  const [triggeringAll, setTriggeringAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<{ processed: number; results: Array<{ token: string; status: string; email?: string }> } | null>(null);
  const [reminderPaused, setReminderPaused] = useState('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCarts = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, err } = await (supabase
      .from('guest_carts')
      .select('*')
      .order('last_activity_at', { ascending: false }) as any);
    if (err) {
      setError((err as any).message || 'Failed to load abandoned carts');
    } else {
      setCarts((data || []) as AbandonedCart[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCarts();
  }, [loadCarts]);

  // Filtered carts
  const filteredCarts = carts.filter(cart => {
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (new Date(cart.last_activity_at) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(cart.last_activity_at) > to) return false;
    }
    return true;
  });

  const handleTriggerAllReminders = async () => {
    setTriggeringAll(true);
    setReminderResult(null);
    setReminderPaused('');
    setError('');
    try {
      const res = await fetch('/api/abandoned-cart/trigger', { method: 'POST' });
      const data = await res.json();
      if (res.status === 503 || (data && data.message && !data.processed)) {
        setReminderPaused(data.message || 'Abandoned cart reminders are currently paused.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to trigger reminders');
      setReminderResult(data);
      showToast('success', `Reminders sent: ${data.processed ?? 0} processed`);
      await loadCarts();
    } catch (err: any) {
      setError(err?.message || 'Failed to trigger reminders');
      showToast('error', err?.message || 'Failed to trigger reminders');
    } finally {
      setTriggeringAll(false);
    }
  };

  const handleSendSingleReminder = async (cart: AbandonedCart) => {
    if (!cart.customer_email) {
      showToast('error', 'No email address for this cart');
      return;
    }
    setSendingId(cart.id);
    try {
      const res = await fetch('/api/send-payment-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cart.customer_email, cartId: cart.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder');
      showToast('success', `Reminder sent to ${cart.customer_email}`);
      await loadCarts();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to send reminder');
    } finally {
      setSendingId(null);
    }
  };

  const totalValue = filteredCarts.reduce((sum, c) => sum + cartTotal(c.items), 0);
  const withEmail = filteredCarts.filter(c => c.customer_email).length;

  return (
    <div className="p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1612]">Abandoned Carts</h2>
          <p className="text-sm text-[#8C8278] mt-0.5">
            {filteredCarts.length} cart{filteredCarts.length !== 1 ? 's' : ''} · R{totalValue.toFixed(2)} potential revenue · {withEmail} with email
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadCarts}
            disabled={loading}
            className="border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#FAF5EE] transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            onClick={handleTriggerAllReminders}
            disabled={triggeringAll || loading}
            className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {triggeringAll && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />}
            Send All Reminders
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-2xl border border-[#EDE7DA] p-4 mb-5 flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium text-[#5C5347]">Filter by date:</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#8C8278]">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-[#DDD5C8] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#8C8278]">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-[#DDD5C8] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-[#C4622D] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Paused / Reminder result banners */}
      {reminderPaused && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          ⚠️ {reminderPaused}
        </div>
      )}
      {reminderResult && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-800">
          ✅ Processed {reminderResult.processed} reminder{reminderResult.processed !== 1 ? 's' : ''}.
          {reminderResult.results?.length > 0 && (
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
              {reminderResult.results.map((r, i) => (
                <li key={i}>{r.email ?? r.token} — <span className="font-medium">{r.status}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCarts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EDE7DA] p-10 text-center">
          <p className="text-3xl mb-3">🛒</p>
          <p className="text-[#8C8278] text-sm">No abandoned carts found{(dateFrom || dateTo) ? ' for the selected date range' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCarts.map(cart => {
            const total = cartTotal(cart.items);
            const itemCount = cartItemCount(cart.items);
            const isExpanded = expandedId === cart.id;
            const hasEmail = !!cart.customer_email;
            const isSending = sendingId === cart.id;

            return (
              <div key={cart.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                {/* Row */}
                <div className="p-4 flex items-center gap-4 flex-wrap">
                  {/* Customer */}
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-semibold text-[#1A1612] text-sm">
                      {cart.customer_name || <span className="text-[#8C8278] italic">Guest</span>}
                    </p>
                    <p className="text-xs text-[#8C8278] mt-0.5 truncate">
                      {cart.customer_email || 'No email'}
                    </p>
                  </div>

                  {/* Items summary */}
                  <div className="text-sm text-[#5C5347] min-w-[80px]">
                    <span className="font-medium">{itemCount}</span>
                    <span className="text-[#8C8278]"> item{itemCount !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Total */}
                  <div className="min-w-[80px]">
                    <span className="font-bold text-[#C4622D] text-sm">R{total.toFixed(2)}</span>
                  </div>

                  {/* Date abandoned */}
                  <div className="min-w-[120px]">
                    <p className="text-xs text-[#5C5347] font-medium">{formatDate(cart.last_activity_at)}</p>
                    <p className="text-xs text-[#8C8278]">{formatTime(cart.last_activity_at)}</p>
                  </div>

                  {/* Time since */}
                  <div className="min-w-[70px]">
                    <span className="text-xs bg-[#FDF6EE] text-[#C4622D] border border-[#EDE7DA] px-2 py-1 rounded-full font-medium">
                      {timeSince(cart.last_activity_at)}
                    </span>
                  </div>

                  {/* Reminder badge */}
                  <div className="min-w-[110px]">
                    {cart.reminder_sent_at ? (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full font-medium">
                        Reminded {timeSince(cart.reminder_sent_at)}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-2 py-1 rounded-full font-medium">
                        Not reminded
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : cart.id)}
                      className="text-xs text-[#5C5347] border border-[#DDD5C8] px-3 py-1.5 rounded-xl font-medium hover:bg-[#FAF5EE] transition-colors"
                    >
                      {isExpanded ? 'Hide' : 'Items'}
                    </button>
                    <button
                      onClick={() => handleSendSingleReminder(cart)}
                      disabled={!hasEmail || isSending}
                      title={!hasEmail ? 'No email address available' : 'Send reminder email'}
                      className="text-xs text-white bg-[#C4622D] px-3 py-1.5 rounded-xl font-medium hover:bg-[#A04E22] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isSending && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />}
                      Remind
                    </button>
                  </div>
                </div>

                {/* Expanded items */}
                {isExpanded && (
                  <div className="border-t border-[#EDE7DA] bg-[#FDF6EE] px-4 py-3">
                    <p className="text-xs font-semibold text-[#5C5347] mb-2 uppercase tracking-wide">Cart Items</p>
                    {Array.isArray(cart.items) && cart.items.length > 0 ? (
                      <div className="space-y-1.5">
                        {cart.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-[#8C8278] text-xs w-5 text-right">{item.quantity}×</span>
                              <span className="text-[#1A1612] font-medium">{item.product?.name ?? 'Unknown item'}</span>
                              {item.product?.category && (
                                <span className="text-xs text-[#8C8278] bg-white border border-[#EDE7DA] px-1.5 py-0.5 rounded-full">
                                  {item.product.category}
                                </span>
                              )}
                            </div>
                            <span className="text-[#C4622D] font-semibold text-xs">
                              R{((item.product?.price ?? 0) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-[#EDE7DA] mt-2 pt-2 flex justify-between text-sm font-bold text-[#1A1612]">
                          <span>Total</span>
                          <span className="text-[#C4622D]">R{total.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#8C8278]">No item details available.</p>
                    )}
                    <div className="mt-3 pt-2 border-t border-[#EDE7DA] grid grid-cols-2 gap-2 text-xs text-[#8C8278]">
                      <div><span className="font-medium text-[#5C5347]">Token:</span> {cart.guest_token?.slice(0, 12)}…</div>
                      <div><span className="font-medium text-[#5C5347]">Created:</span> {formatDate(cart.created_at)} {formatTime(cart.created_at)}</div>
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
