'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import type { DiscountVoucher } from '../../types';

interface DiscountVouchersTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function DiscountVouchersTab({ can }: DiscountVouchersTabProps) {
  const supabase = createClient();

  const [discountVouchers, setDiscountVouchers] = useState<DiscountVoucher[]>([]);
  const [dvLoading, setDvLoading] = useState(false);
  const [showDvForm, setShowDvForm] = useState(false);
  const [editingDv, setEditingDv] = useState<DiscountVoucher | null>(null);
  const [dvForm, setDvForm] = useState({
    dv_code: '', dv_type: 'Discount' as 'Discount' | 'Gift', dv_amount: '',
    status: 'Active\' as \'Active\' | \'Inactive', expiry_date: '', created_at: '',
  });
  const [dvFormError, setDvFormError] = useState('');
  const [dvFormSuccess, setDvFormSuccess] = useState('');
  const [savingDv, setSavingDv] = useState(false);
  const [dvSearchQuery, setDvSearchQuery] = useState('');
  const [dvFilterExpired, setDvFilterExpired] = useState<'all' | 'active' | 'expired'>('all');
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const loadDiscountVouchers = async () => {
    setDvLoading(true);
    await supabase
      .from('discount_vouchers')
      .update({ status: 'Inactive' })
      .lt('expiry_date', new Date().toISOString().split('T')[0])
      .eq('status', 'Active');
    const { data } = await supabase.from('discount_vouchers').select('*').order('created_at', { ascending: false });
    if (data) setDiscountVouchers(data);
    setDvLoading(false);
  };

  useEffect(() => {
    loadDiscountVouchers();
  }, []);

  const handleSaveDv = async () => {
    setDvFormError('');
    setDvFormSuccess('');
    if (!dvForm.dv_code.trim() || !dvForm.dv_amount) { setDvFormError('Code and amount are required.'); return; }
    if (Number(dvForm.dv_amount) <= 0) { setDvFormError('Amount must be greater than zero.'); return; }
    if (!dvForm.expiry_date) { setDvFormError('Expiry date is required.'); return; }
    setSavingDv(true);
    const payload: Record<string, unknown> = {
      dv_code: dvForm.dv_code.trim().toUpperCase(),
      dv_amount: Number(dvForm.dv_amount),
      status: dvForm.status,
      expiry_date: dvForm.expiry_date,
    };
    let saveError: { message: string } | null = null;
    if (editingDv) {
      const { data: upd, error } = await supabase.from('discount_vouchers').update(payload).eq('id', editingDv.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit vouchers.' };
    } else {
      const { data: ins, error } = await supabase.from('discount_vouchers').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the voucher. Please try again.' };
    }
    if (saveError) {
      setDvFormError(/duplicate|unique/i.test(saveError.message || '') ? 'That voucher code already exists. Use a unique code.' : saveError.message);
    } else {
      setDvFormSuccess(editingDv ? 'Voucher updated!' : 'Voucher added!');
      setShowDvForm(false);
      setEditingDv(null);
      await loadDiscountVouchers();
    }
    setSavingDv(false);
  };

  const handleDeleteDv = (dv: DiscountVoucher) => {
    setDeleteModal({
      open: true,
      title: 'Delete Discount Voucher',
      message: `Delete voucher ${dv.dv_code}? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data: del, error } = await supabase.from('discount_vouchers').delete().eq('id', dv.id).select('id');
        if (error || !del || del.length === 0) {
          setGlobalError(error?.message || 'Delete was blocked — you may not have permission to delete vouchers.');
          setGlobalErrorTitle('Voucher Error');
        }
        await loadDiscountVouchers();
      },
    });
  };

  const openAddForm = () => {
    setEditingDv(null);
    setDvForm({ dv_code: '', dv_type: 'Discount', dv_amount: '', status: 'Active', expiry_date: '', created_at: '' });
    setDvFormError('');
    setDvFormSuccess('');
    setShowDvForm(true);
  };

  const openEditForm = (dv: DiscountVoucher) => {
    setEditingDv(dv);
    setDvForm({
      dv_code: dv.dv_code,
      dv_type: 'Discount',
      dv_amount: String(dv.dv_amount),
      status: dv.status,
      expiry_date: dv.expiry_date ? dv.expiry_date.slice(0, 10) : '',
      created_at: dv.created_at || '',
    });
    setDvFormError('');
    setDvFormSuccess('');
    setShowDvForm(true);
  };

  const filteredVouchers = discountVouchers.filter(dv => {
    const q = dvSearchQuery.toLowerCase();
    const matchSearch = !q || dv.dv_code.toLowerCase().includes(q);
    const now = new Date();
    const expiry = dv.expiry_date ? new Date(dv.expiry_date) : null;
    const isExpired = expiry ? expiry < now : false;
    const matchFilter =
      dvFilterExpired === 'all' ||
      (dvFilterExpired === 'active' && !isExpired && dv.status === 'Active') ||
      (dvFilterExpired === 'expired' && (isExpired || dv.status === 'Inactive'));
    return matchSearch && matchFilter;
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
            <h2 className="text-xl font-bold text-[#1A1612]">Discount Vouchers</h2>
            <p className="text-sm text-[#8C8278] mt-0.5">{discountVouchers.length} voucher{discountVouchers.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search vouchers…"
              value={dvSearchQuery}
              onChange={e => setDvSearchQuery(e.target.value)}
              className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
            />
            <select
              value={dvFilterExpired}
              onChange={e => setDvFilterExpired(e.target.value as typeof dvFilterExpired)}
              className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
            {can('create') && (
              <button onClick={openAddForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">
                + Add Voucher
              </button>
            )}
          </div>
        </div>

        {dvLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF5EE] border-b border-[#EDE7DA]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Code</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Expiry Date</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Times Used</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE7DA]">
                  {filteredVouchers.map(dv => {
                    const expiry = dv.expiry_date ? new Date(dv.expiry_date) : null;
                    const isExpired = expiry ? expiry < new Date() : false;
                    return (
                      <tr key={dv.id} className="hover:bg-[#FAF5EE] transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-[#C4622D] text-xs">{dv.dv_code}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#1A1612]">R {Number(dv.dv_amount).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            dv.status === 'Active' && !isExpired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isExpired ? 'Expired' : dv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#5C5347] text-xs">
                          {dv.expiry_date
                            ? new Date(dv.expiry_date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-[#5C5347]">{dv.times_used ?? 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {can('edit') && (
                              <button onClick={() => openEditForm(dv)} className="text-xs text-[#C4622D] border border-[#C4622D] px-2.5 py-1 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">
                                Edit
                              </button>
                            )}
                            {can('delete') && (
                              <button onClick={() => handleDeleteDv(dv)} className="text-xs text-red-500 border border-red-300 px-2.5 py-1 rounded-lg font-semibold hover:bg-red-50 transition-colors">
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredVouchers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#8C8278] text-sm">No discount vouchers found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showDvForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A1612]">
                  {editingDv ? 'Edit Discount Voucher' : 'Add Discount Voucher'}
                </h3>
                <button onClick={() => { setShowDvForm(false); setEditingDv(null); setDvFormError(''); setDvFormSuccess(''); }} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Voucher Code *</label>
                    <input type="text" value={dvForm.dv_code} onChange={e => setDvForm(f => ({ ...f, dv_code: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. SAVE10" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Status</label>
                    <select value={dvForm.status} onChange={e => setDvForm(f => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Amount (R) *</label>
                    <input type="number" min="0" step="0.01" value={dvForm.dv_amount} onChange={e => setDvForm(f => ({ ...f, dv_amount: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Expiry Date *</label>
                    <input type="date" value={dvForm.expiry_date} onChange={e => setDvForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                  </div>
                </div>
                {dvFormError && <p className="text-sm text-red-600">{dvFormError}</p>}
                {dvFormSuccess && <p className="text-sm text-green-600">{dvFormSuccess}</p>}
              </div>
              <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                <button onClick={handleSaveDv} disabled={savingDv} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                  {savingDv ? 'Saving…' : (editingDv ? 'Save Changes' : 'Add Voucher')}
                </button>
                <button onClick={() => { setShowDvForm(false); setEditingDv(null); setDvFormError(''); setDvFormSuccess(''); }} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">
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
