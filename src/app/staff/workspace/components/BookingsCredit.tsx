'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CustomerCredit {
  id: string;
  customer_email: string;
  customer_name: string;
  original_booking_ref: string;
  booking_type: 'class' | 'event';
  total_issued: number;
  total_used: number;
  remaining_balance: number;
  credit_status: 'active' | 'used';
  issued_at: string;
  notes: string | null;
}

interface CreditTransaction {
  id: string;
  credit_id: string;
  booking_ref: string;
  booking_type: string;
  amount_applied: number;
  balance_before: number;
  balance_after: number;
  applied_by: string;
  applied_at: string;
  notes: string | null;
}

function formatCurrency(val: number | null | undefined) {
  if (val == null) return '—';
  return `R ${Number(val).toFixed(2)}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function BookingsCredit() {
  const supabase = createClient();
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [transactions, setTransactions] = useState<Record<string, CreditTransaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingTx, setLoadingTx] = useState<string | null>(null);

  const loadCredits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('customer_credits')
        .select('*')
        .order('issued_at', { ascending: false });
      if (err) throw err;
      setCredits(data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadCredits(); }, [loadCredits]);

  const loadTransactions = async (creditId: string) => {
    if (transactions[creditId]) return;
    setLoadingTx(creditId);
    try {
      const { data, error: err } = await supabase
        .from('customer_credit_transactions')
        .select('*')
        .eq('credit_id', creditId)
        .order('applied_at', { ascending: false });
      if (!err) {
        setTransactions(prev => ({ ...prev, [creditId]: data || [] }));
      }
    } finally {
      setLoadingTx(null);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadTransactions(id);
    }
  };

  const filtered = credits.filter(c => {
    const matchSearch = !searchQuery ||
      c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.original_booking_ref.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.credit_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalActive = credits.filter(c => c.credit_status === 'active').length;
  const totalActiveBalance = credits
    .filter(c => c.credit_status === 'active')
    .reduce((sum, c) => sum + Number(c.remaining_balance), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1A1612]">Bookings Credit</h2>
        <p className="text-sm text-[#8C8278] mt-1">
          Credits issued to customers for no-show bookings. Credits are applied automatically during future registrations.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
          <p className="text-xs text-[#8C8278] mb-1">Total Credits Issued</p>
          <p className="text-2xl font-bold text-[#1A1612]">{credits.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
          <p className="text-xs text-[#8C8278] mb-1">Active Credits</p>
          <p className="text-2xl font-bold text-green-600">{totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
          <p className="text-xs text-[#8C8278] mb-1">Total Active Balance</p>
          <p className="text-2xl font-bold text-[#C4622D]">{formatCurrency(totalActiveBalance)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by name, email or booking ref…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-[#DDD5C8] bg-white text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'used')}
          className="px-4 py-2.5 rounded-xl border border-[#DDD5C8] bg-white text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="used">Used</option>
        </select>
        <button
          onClick={loadCredits}
          className="px-4 py-2.5 rounded-xl border border-[#DDD5C8] bg-white text-sm text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#8C8278]">
          <p className="text-4xl mb-3">💳</p>
          <p className="font-medium">No credits found</p>
          <p className="text-sm mt-1">Credits are issued automatically when a booking is marked as no-show.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(credit => (
            <div key={credit.id} className="bg-white rounded-xl border border-[#DDD5C8] overflow-hidden">
              {/* Credit Row */}
              <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Customer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#1A1612] text-sm">{credit.customer_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        credit.credit_status === 'active' ?'bg-green-50 text-green-700 border-green-200' :'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {credit.credit_status === 'active' ? 'Active' : 'Used'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        credit.booking_type === 'class' ?'bg-blue-50 text-blue-700 border-blue-200' :'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {credit.booking_type === 'class' ? '👨‍🍳 Class' : '🎪 Event'}
                      </span>
                    </div>
                    <p className="text-xs text-[#8C8278] mt-0.5">{credit.customer_email}</p>
                    <p className="text-xs text-[#8C8278]">
                      Booking Ref: <span className="font-mono font-medium text-[#5C5347]">{credit.original_booking_ref}</span>
                      {' · '}Issued: {formatDate(credit.issued_at)}
                    </p>
                  </div>

                  {/* Credit Amounts */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-[#8C8278]">Issued</p>
                      <p className="text-sm font-semibold text-[#1A1612]">{formatCurrency(credit.total_issued)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[#8C8278]">Used</p>
                      <p className="text-sm font-semibold text-[#5C5347]">{formatCurrency(credit.total_used)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[#8C8278]">Balance</p>
                      <p className={`text-sm font-bold ${Number(credit.remaining_balance) > 0 ? 'text-[#C4622D]' : 'text-gray-400'}`}>
                        {formatCurrency(credit.remaining_balance)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleExpand(credit.id)}
                      className="text-xs text-[#C4622D] hover:underline flex-shrink-0 font-medium"
                    >
                      {expandedId === credit.id ? '▲ Hide' : '▼ Audit Trail'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              {expandedId === credit.id && (
                <div className="border-t border-[#E8DDD0] bg-[#FAF5EE] p-4">
                  <h4 className="text-xs font-semibold text-[#5C5347] uppercase tracking-wide mb-3">
                    Transaction Audit Trail
                  </h4>
                  {loadingTx === credit.id ? (
                    <div className="flex items-center gap-2 text-sm text-[#8C8278]">
                      <div className="w-4 h-4 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                      Loading transactions…
                    </div>
                  ) : !transactions[credit.id] || transactions[credit.id].length === 0 ? (
                    <p className="text-sm text-[#8C8278]">No transactions recorded yet. This credit has not been applied to any booking.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[#8C8278]">
                            <th className="text-left pb-2 pr-4 font-medium">Date</th>
                            <th className="text-left pb-2 pr-4 font-medium">Booking Ref</th>
                            <th className="text-left pb-2 pr-4 font-medium">Type</th>
                            <th className="text-right pb-2 pr-4 font-medium">Applied</th>
                            <th className="text-right pb-2 pr-4 font-medium">Balance Before</th>
                            <th className="text-right pb-2 font-medium">Balance After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions[credit.id].map(tx => (
                            <tr key={tx.id} className="border-t border-[#E8DDD0]">
                              <td className="py-2 pr-4 text-[#5C5347]">{formatDate(tx.applied_at)}</td>
                              <td className="py-2 pr-4 font-mono text-[#1A1612]">{tx.booking_ref}</td>
                              <td className="py-2 pr-4 text-[#5C5347] capitalize">{tx.booking_type}</td>
                              <td className="py-2 pr-4 text-right font-semibold text-[#C4622D]">{formatCurrency(tx.amount_applied)}</td>
                              <td className="py-2 pr-4 text-right text-[#5C5347]">{formatCurrency(tx.balance_before)}</td>
                              <td className="py-2 text-right font-semibold text-[#1A1612]">{formatCurrency(tx.balance_after)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
