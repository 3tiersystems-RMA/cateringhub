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
  m_payment_id: string | null;
  payment_method: string | null;
}

interface CustomerGroup {
  email: string;
  name: string;
  phone: string;
  orders: Order[];
  totalSpend: number;
  orderCount: number;
  lastOrderDate: string;
}

function getFulfillmentColor(status: string): string {
  const map: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    preparing: 'bg-amber-50 text-amber-700 border-amber-200',
    ready: 'bg-purple-50 text-purple-700 border-purple-200',
    delivered: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

function getPaymentColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600 border-gray-200',
    paid: 'bg-green-50 text-green-700 border-green-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    awaiting_payment: 'bg-amber-50 text-amber-700 border-amber-200',
    awaiting_confirmation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    refunded: 'bg-purple-50 text-purple-700 border-purple-200',
    discounted: 'bg-teal-50 text-teal-700 border-teal-200',
    unpaid: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function CustomerOrderHistory() {
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Failed to load order history: ' + fetchError.message);
    } else {
      setOrders((data as Order[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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

  // Group orders by customer email
  const customerGroups: CustomerGroup[] = (() => {
    const map = new Map<string, CustomerGroup>();

    orders.forEach(order => {
      const key = order.customer_email.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          email: order.customer_email,
          name: order.customer_name,
          phone: order.customer_phone || '',
          orders: [],
          totalSpend: 0,
          orderCount: 0,
          lastOrderDate: order.created_at,
        });
      }
      const group = map.get(key)!;
      group.orders.push(order);
      group.totalSpend += Number(order.total);
      group.orderCount += 1;
      // Keep the most recent order date
      if (new Date(order.created_at) > new Date(group.lastOrderDate)) {
        group.lastOrderDate = order.created_at;
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
    );
  })();

  // Filter customer groups
  const filteredGroups = customerGroups.filter(group => {
    const matchesSearch = !searchQuery.trim() || (() => {
      const q = searchQuery.toLowerCase();
      return (
        group.name.toLowerCase().includes(q) ||
        group.email.toLowerCase().includes(q) ||
        group.phone.toLowerCase().includes(q)
      );
    })();

    // Date range filter — applies to individual orders within the group
    const hasMatchingOrder = !dateFrom && !dateTo
      ? true
      : group.orders.some(order => {
          const orderDate = new Date(order.created_at);
          const from = dateFrom ? new Date(dateFrom) : null;
          const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
          if (from && orderDate < from) return false;
          if (to && orderDate > to) return false;
          return true;
        });

    return matchesSearch && hasMatchingOrder;
  });

  // Filter orders within a group by date range
  const getFilteredOrders = (groupOrders: Order[]): Order[] => {
    if (!dateFrom && !dateTo) return groupOrders;
    return groupOrders.filter(order => {
      const orderDate = new Date(order.created_at);
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
      if (from && orderDate < from) return false;
      if (to && orderDate > to) return false;
      return true;
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#1A1612]">Customer Order History</h2>
          <p className="text-sm text-[#8C8278] mt-0.5">Browse full order history per customer — search by name or filter by date range</p>
        </div>
        <button
          onClick={loadOrders}
          className="border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm hover:bg-[#F5F0E8] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8278]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search by customer name, email or phone…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm focus:outline-none focus:border-[#C4622D] bg-white"
          />
        </div>
        {/* Date From */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#8C8278] whitespace-nowrap">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white text-[#1A1612]"
          />
        </div>
        {/* Date To */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#8C8278] whitespace-nowrap">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white text-[#1A1612]"
          />
        </div>
        {(dateFrom || dateTo || searchQuery) && (
          <button
            onClick={() => { setSearchQuery(''); setDateFrom(''); setDateTo(''); }}
            className="border border-[#DDD5C8] text-[#5C5347] px-3 py-2.5 rounded-xl text-sm hover:bg-[#F5F0E8] transition-colors whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary */}
      {!loading && !error && (
        <div className="mb-4 flex items-center gap-4 text-sm text-[#8C8278]">
          <span><strong className="text-[#1A1612]">{filteredGroups.length}</strong> customer{filteredGroups.length !== 1 ? 's' : ''}</span>
          <span className="text-[#DDD5C8]">·</span>
          <span><strong className="text-[#1A1612]">{filteredGroups.reduce((acc, g) => acc + getFilteredOrders(g.orders).length, 0)}</strong> order{filteredGroups.reduce((acc, g) => acc + getFilteredOrders(g.orders).length, 0) !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">{error}</div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EDE7DA] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F5F0E8] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-[#1A1612] font-semibold">
            {searchQuery || dateFrom || dateTo ? 'No customers match your filters' : 'No order history found'}
          </p>
          <p className="text-[#8C8278] text-sm mt-1">
            {searchQuery || dateFrom || dateTo ? 'Try adjusting your search or date range.' : 'Customer order history will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(group => {
            const isExpanded = expandedCustomer === group.email;
            const visibleOrders = getFilteredOrders(group.orders);

            return (
              <div key={group.email} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                {/* Customer Row */}
                <div
                  className="p-4 flex items-center justify-between gap-4 flex-wrap cursor-pointer hover:bg-[#FAF7F2] transition-colors"
                  onClick={() => setExpandedCustomer(isExpanded ? null : group.email)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#EDE7DA] flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#C4622D]">
                        {group.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1A1612] text-sm">{group.name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <p className="text-xs text-[#5C5347]">{group.email}</p>
                        {group.phone && (
                          <>
                            <span className="text-[#DDD5C8]">·</span>
                            <p className="text-xs text-[#5C5347]">{group.phone}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-[#8C8278]">Total Spend</p>
                      <p className="text-sm font-bold text-[#C4622D]">{formatCurrency(group.totalSpend)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-[#8C8278]">Orders</p>
                      <p className="text-sm font-bold text-[#1A1612]">{group.orderCount}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-[#8C8278]">Last Order</p>
                      <p className="text-xs text-[#5C5347]">{formatDate(group.lastOrderDate)}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-[#8C8278] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Mobile stats */}
                {!isExpanded && (
                  <div className="sm:hidden px-4 pb-3 flex items-center gap-4 text-xs text-[#8C8278]">
                    <span><strong className="text-[#C4622D]">{formatCurrency(group.totalSpend)}</strong> total</span>
                    <span className="text-[#DDD5C8]">·</span>
                    <span><strong className="text-[#1A1612]">{group.orderCount}</strong> orders</span>
                    <span className="text-[#DDD5C8]">·</span>
                    <span>Last: {formatDate(group.lastOrderDate)}</span>
                  </div>
                )}

                {/* Expanded Order History */}
                {isExpanded && (
                  <div className="border-t border-[#EDE7DA] bg-[#FAF7F2] px-4 py-4">
                    {/* Mobile stats in expanded */}
                    <div className="sm:hidden flex items-center gap-4 text-xs text-[#8C8278] mb-3 pb-3 border-b border-[#EDE7DA]">
                      <span><strong className="text-[#C4622D]">{formatCurrency(group.totalSpend)}</strong> total spend</span>
                      <span className="text-[#DDD5C8]">·</span>
                      <span><strong className="text-[#1A1612]">{group.orderCount}</strong> orders</span>
                    </div>

                    <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-3">
                      Order History {(dateFrom || dateTo) && `(${visibleOrders.length} in range)`}
                    </p>

                    {visibleOrders.length === 0 ? (
                      <p className="text-xs text-[#8C8278] py-2">No orders in the selected date range.</p>
                    ) : (
                      <div className="space-y-2">
                        {visibleOrders.map(order => {
                          const itemsArray: OrderItem[] = Array.isArray(order.items) ? order.items : [];
                          const isOrderExpanded = expandedOrderId === order.id;

                          return (
                            <div key={order.id} className="bg-white rounded-xl border border-[#EDE7DA] overflow-hidden">
                              {/* Order Summary Row */}
                              <div
                                className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap cursor-pointer hover:bg-[#FAF7F2] transition-colors"
                                onClick={() => setExpandedOrderId(isOrderExpanded ? null : order.id)}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs font-mono text-[#8C8278] truncate">{order.id.slice(0, 8)}…</p>
                                      <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${getFulfillmentColor(order.fulfillment_status)}`}>
                                        {formatStatusLabel(order.fulfillment_status)}
                                      </span>
                                      <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${getPaymentColor(order.payment_status)}`}>
                                        {formatStatusLabel(order.payment_status)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      <p className="text-xs text-[#8C8278]">{formatDate(order.created_at)}</p>
                                      <span className="text-[#DDD5C8]">·</span>
                                      <p className="text-xs text-[#8C8278]">{itemsArray.length} item{itemsArray.length !== 1 ? 's' : ''}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <p className="text-sm font-bold text-[#C4622D]">{formatCurrency(order.total)}</p>
                                  <svg
                                    className={`w-3.5 h-3.5 text-[#8C8278] transition-transform ${isOrderExpanded ? 'rotate-180' : ''}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Order Items Expanded */}
                              {isOrderExpanded && (
                                <div className="border-t border-[#EDE7DA] bg-[#FAF7F2] px-4 py-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Items */}
                                    <div>
                                      <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Items</p>
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

                                    {/* Order Totals & Info */}
                                    <div className="space-y-1.5">
                                      <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Summary</p>
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
                                          <span className="text-[#8C8278] flex-shrink-0">Delivery</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
