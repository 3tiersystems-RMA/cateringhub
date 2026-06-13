'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import type { Voucher } from '../../types';

interface MealVouchersTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function MealVouchersTab({ can }: MealVouchersTabProps) {
  const supabase = createClient();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [showMvForm, setShowMvForm] = useState(false);
  const [editingMv, setEditingMv] = useState<Voucher | null>(null);
  const [mvForm, setMvForm] = useState({
    voucher_code: '', customer_name: '', customer_email: '', customer_phone: '',
    total_meals: '', meals_remaining: '', status: 'unpaid' as Voucher['status'],
    notes: '', package_type: 'none' as string, purchased_at: '',
  });
  const [mvFormError, setMvFormError] = useState('');
  const [mvFormSuccess, setMvFormSuccess] = useState('');
  const [savingMv, setSavingMv] = useState(false);
  const [mvSearchQuery, setMvSearchQuery] = useState('');
  const [mvFilterStatus, setMvFilterStatus] = useState<'all' | 'active' | 'unpaid' | 'paid' | 'redeemed' | 'expired'>('all');
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const loadMealVouchers = async () => {
    setVouchersLoading(true);
    const { data } = await supabase.from('vouchers').select('*').order('purchased_at', { ascending: false });
    if (data) setVouchers(data);
    setVouchersLoading(false);
  };

  useEffect(() => {
    loadMealVouchers();
  }, []);

  const handleMarkVoucherPaid = async (voucher: Voucher) => {
    await supabase.from('vouchers').update({ status: 'paid' }).eq('id', voucher.id);
    await loadMealVouchers();
  };

  const handleDeleteVoucher = (voucher: Voucher) => {
    setDeleteModal({
      open: true,
      title: 'Delete Voucher',
      message: `Delete voucher ${voucher.voucher_code}? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data: del, error } = await supabase.from('vouchers').delete().eq('id', voucher.id).select('id');
        if (error || !del || del.length === 0) {
          setGlobalError(error?.message || 'Delete was blocked — you may not have permission to delete vouchers.');
          setGlobalErrorTitle('Voucher Error');
        }
        await loadMealVouchers();
      },
    });
  };

  const handleSaveMv = async () => {
    if (!mvForm.voucher_code.trim() || !mvForm.customer_name.trim() || !mvForm.customer_email.trim()) {
      setMvFormError('Code, name, and email are required.');
      return;
    }
    setSavingMv(true);
    const payload: Record<string, unknown> = {
      voucher_code: mvForm.voucher_code.trim(),
      customer_name: mvForm.customer_name.trim(),
      customer_email: mvForm.customer_email.trim(),
      customer_phone: mvForm.customer_phone.trim() || null,
      total_meals: Number(mvForm.total_meals) || 0,
      meals_remaining: Number(mvForm.meals_remaining) || 0,
      status: mvForm.status,
      notes: mvForm.notes.trim() || null,
      package_type: mvForm.package_type || 'none',
      purchased_at: mvForm.purchased_at || new Date().toISOString(),
    };
    let saveError: { message: string } | null = null;
    if (editingMv) {
      const { data: upd, error } = await supabase.from('vouchers').update(payload).eq('id', editingMv.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit vouchers.' };
    } else {
      const { data: ins, error } = await supabase.from('vouchers').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the voucher. Please try again.' };
    }
    if (saveError) {
      setMvFormError(/duplicate|unique/i.test(saveError.message || '') ? 'That voucher code already exists. Use a unique code.' : saveError.message);
    } else {
      setMvFormSuccess(editingMv ? 'Voucher updated!' : 'Voucher added!');
      setShowMvForm(false);
      setEditingMv(null);
      await loadMealVouchers();
    }
    setSavingMv(false);
  };

  const openAddForm = () => {
    setEditingMv(null);
    setMvForm({ voucher_code: '', customer_name: '', customer_email: '', customer_phone: '', total_meals: '', meals_remaining: '', status: 'unpaid', notes: '', package_type: 'none', purchased_at: '' });
    setMvFormError('');
    setMvFormSuccess('');
    setShowMvForm(true);
  };

  const openEditForm = (v: Voucher) => {
    setEditingMv(v);
    setMvForm({
      voucher_code: v.voucher_code,
      customer_name: v.customer_name,
      customer_email: v.customer_email,
      customer_phone: v.customer_phone || '',
      total_meals: String(v.total_meals),
      meals_remaining: String(v.meals_remaining),
      status: v.status,
      notes: v.notes || '',
      package_type: v.package_type || 'none',
      purchased_at: v.purchased_at ? v.purchased_at.slice(0, 10) : '',
    });
    setMvFormError('');
    setMvFormSuccess('');
    setShowMvForm(true);
  };

  const filteredVouchers = vouchers.filter(v => {
    const q = mvSearchQuery.toLowerCase();
    const matchSearch = !q ||
      v.voucher_code.toLowerCase().includes(q) ||
      v.customer_name.toLowerCase().includes(q) ||
      v.customer_email.toLowerCase().includes(q) ||
      (v.customer_phone || '').toLowerCase().includes(q);
    const matchStatus = mvFilterStatus === 'all' || v.status === mvFilterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <VoucherErrorModal
        isOpen={!!globalError}
        title={globalErrorTitle || 'Error'}
        message={globalError}
        onClose={() => { setGlobalError(''); setGlobalErrorTitle(''); }}
      />
      <DeleteConfirmModal
        isOpen={deleteModal.open}
        productName=""
        title={deleteModal.title}
        message={deleteModal.message}
        onConfirm={deleteModal.onConfirm}
        onCancel={() => setDeleteModal(prev => ({ ...prev, open: false }))}
      />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1A1612]">Meal Vouchers</h2>
            <p className="text-sm text-[#8C8278] mt-0.5">{vouchers.length} voucher{vouchers.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search vouchers…"
              value={mvSearchQuery}
              onChange={e => setMvSearchQuery(e.target.value)}
              className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
            />
            <select
              value={mvFilterStatus}
              onChange={e => setMvFilterStatus(e.target.value as typeof mvFilterStatus)}
              className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="redeemed">Redeemed</option>
              <option value="expired">Expired</option>
            </select>
            {can('create') && (
              <button onClick={openAddForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">
                + Add Voucher
              </button>
            )}
          </div>
        </div>

        {vouchersLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF5EE] border-b border-[#EDE7DA]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Voucher Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Phone</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Remaining</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Purchase Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE7DA]">
                  {filteredVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-[#FAF5EE] transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-[#C4622D] text-xs">{v.voucher_code}</td>
                      <td className="px-4 py-3 font-medium text-[#1A1612]">{v.customer_name}</td>
                      <td className="px-4 py-3 text-[#5C5347] text-xs">{v.customer_email}</td>
                      <td className="px-4 py-3 text-[#5C5347] text-xs">{v.customer_phone || '—'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-[#1A1612]">{v.total_meals}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${v.meals_remaining === 0 ? 'text-[#8C8278]' : 'text-green-700'}`}>
                          {v.meals_remaining}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          v.status === 'active' ? 'bg-green-100 text-green-700' :
                          v.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                          v.status === 'unpaid' ? 'bg-yellow-100 text-yellow-700' :
                          v.status === 'redeemed' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#5C5347] text-xs">
                        {v.purchased_at ? new Date(v.purchased_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {v.status === 'unpaid' && can('edit') && (
                            <button onClick={() => handleMarkVoucherPaid(v)} className="text-xs text-blue-600 border border-blue-300 px-2.5 py-1 rounded-lg font-semibold hover:bg-blue-50 transition-colors whitespace-nowrap">
                              Mark Paid
                            </button>
                          )}
                          {can('edit') && (
                            <button onClick={() => openEditForm(v)} className="text-xs text-[#C4622D] border border-[#C4622D] px-2.5 py-1 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">
                              Edit
                            </button>
                          )}
                          {can('delete') && (
                            <button onClick={() => handleDeleteVoucher(v)} className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-2.5 py-1 rounded-xl hover:bg-red-50 transition-colors">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-[#8C8278] text-sm">No vouchers found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showMvForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
              <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A1612]">
                  {editingMv ? 'Edit Meal Voucher' : 'Issue / Add Meal Voucher'}
                </h3>
                <button onClick={() => { setShowMvForm(false); setEditingMv(null); setMvFormError(''); setMvFormSuccess(''); }} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
              </div>
              <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Voucher Code *</label>
                    <input type="text" value={mvForm.voucher_code} onChange={e => setMvForm(f => ({ ...f, voucher_code: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. MV-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Status</label>
                    <select value={mvForm.status} onChange={e => setMvForm(f => ({ ...f, status: e.target.value as Voucher['status'] }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                      <option value="active">Active</option>
                      <option value="redeemed">Redeemed</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Customer Name *</label>
                  <input type="text" value={mvForm.customer_name} onChange={e => setMvForm(f => ({ ...f, customer_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Customer Email *</label>
                  <input type="email" value={mvForm.customer_email} onChange={e => setMvForm(f => ({ ...f, customer_email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Customer Phone</label>
                  <input type="tel" value={mvForm.customer_phone} onChange={e => setMvForm(f => ({ ...f, customer_phone: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Total Meals</label>
                    <input type="number" min="0" value={mvForm.total_meals} onChange={e => setMvForm(f => ({ ...f, total_meals: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Meals Remaining</label>
                    <input type="number" min="0" value={mvForm.meals_remaining} onChange={e => setMvForm(f => ({ ...f, meals_remaining: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Purchase Date</label>
                  <input type="date" value={mvForm.purchased_at} onChange={e => setMvForm(f => ({ ...f, purchased_at: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Notes</label>
                  <textarea value={mvForm.notes} onChange={e => setMvForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" />
                </div>
                {mvFormError && <p className="text-sm text-red-600">{mvFormError}</p>}
                {mvFormSuccess && <p className="text-sm text-green-600">{mvFormSuccess}</p>}
              </div>
              <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                <button onClick={handleSaveMv} disabled={savingMv} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                  {savingMv ? 'Saving…' : (editingMv ? 'Save Changes' : 'Add Voucher')}
                </button>
                <button onClick={() => { setShowMvForm(false); setEditingMv(null); setMvFormError(''); setMvFormSuccess(''); }} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
