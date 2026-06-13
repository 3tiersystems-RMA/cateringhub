'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import type { WeeklyMenuEntry, WeeklyMenuItemForm } from '../../types';

interface WeeklyMenuTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function WeeklyMenuTab({ can }: WeeklyMenuTabProps) {
  const supabase = createClient();

  const [weeklyMenuEntries, setWeeklyMenuEntries] = useState<WeeklyMenuEntry[]>([]);
  const [weeklyMenuLoading, setWeeklyMenuLoading] = useState(false);
  const [showWeeklyMenuForm, setShowWeeklyMenuForm] = useState(false);
  const [editingWeeklyEntry, setEditingWeeklyEntry] = useState<WeeklyMenuEntry | null>(null);
  const [weeklyMenuForm, setWeeklyMenuForm] = useState<WeeklyMenuItemForm>({
    meal_date: '', day_name: '', meal_name: '', description: '', price: '', is_closed: false, closed_reason: '',
  });
  const [weeklyMenuFormError, setWeeklyMenuFormError] = useState('');
  const [weeklyMenuFormSuccess, setWeeklyMenuFormSuccess] = useState('');
  const [savingWeeklyEntry, setSavingWeeklyEntry] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [closingDayDate, setClosingDayDate] = useState<string | null>(null);
  const [savingClosedDay, setSavingClosedDay] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const showGlobalError = (msg: string, title = 'Weekly Menu Error') => {
    setGlobalError(msg);
    setGlobalErrorTitle(title);
  };

  const showWeeklyMenuFormError = (msg: string) => {
    if (msg) showGlobalError(msg);
  };

  const getMondayOfWeek = (offset = 0) => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff + offset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getWeekDays = () => {
    const monday = getMondayOfWeek(weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        date: toLocalDateStr(d),
        dayName: d.toLocaleDateString('en-ZA', { weekday: 'long' }),
        shortDate: d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
      };
    });
  };

  const loadWeeklyMenu = async () => {
    setWeeklyMenuLoading(true);
    const monday = getMondayOfWeek(weekOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const from = monday.toISOString().split('T')[0];
    const to = sunday.toISOString().split('T')[0];
    const { data } = await supabase
      .from('weekly_menu')
      .select('*')
      .gte('meal_date', from)
      .lte('meal_date', to)
      .order('meal_date');
    if (data) setWeeklyMenuEntries(data);
    setWeeklyMenuLoading(false);
  };

  useEffect(() => {
    loadWeeklyMenu();
  }, [weekOffset]);

  const openAddWeeklyMenuForm = (date: string, dayName: string) => {
    setEditingWeeklyEntry(null);
    setWeeklyMenuForm({ meal_date: date, day_name: dayName, meal_name: '', description: '', price: '', is_closed: false, closed_reason: '' });
    setWeeklyMenuFormError('');
    setWeeklyMenuFormSuccess('');
    setShowWeeklyMenuForm(true);
  };

  const openEditWeeklyMenuForm = (entry: WeeklyMenuEntry) => {
    setEditingWeeklyEntry(entry);
    setWeeklyMenuForm({
      meal_date: entry.meal_date,
      day_name: entry.day_name,
      meal_name: entry.meal_name || '',
      description: entry.description || '',
      price: entry.price != null ? String(entry.price) : '',
      is_closed: entry.is_closed,
      closed_reason: entry.closed_reason || '',
    });
    setWeeklyMenuFormError('');
    setWeeklyMenuFormSuccess('');
    setShowWeeklyMenuForm(true);
  };

  const handleSaveWeeklyEntry = async () => {
    if (!weeklyMenuForm.is_closed && !weeklyMenuForm.meal_name.trim()) { showWeeklyMenuFormError('Meal name is required.'); return; }
    setSavingWeeklyEntry(true);
    const payload = {
      meal_date: weeklyMenuForm.meal_date,
      day_name: weeklyMenuForm.day_name,
      meal_name: weeklyMenuForm.meal_name.trim() || null,
      description: weeklyMenuForm.description.trim() || null,
      price: weeklyMenuForm.price ? Number(weeklyMenuForm.price) : null,
      is_closed: weeklyMenuForm.is_closed,
      closed_reason: weeklyMenuForm.closed_reason.trim() || null,
    };
    let saveError: any = null;
    if (editingWeeklyEntry) {
      const { data: upd, error } = await supabase.from('weekly_menu').update(payload).eq('id', editingWeeklyEntry.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit the weekly menu.' };
    } else {
      const { data: ins, error } = await supabase.from('weekly_menu').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the menu entry. Please try again.' };
    }
    if (saveError) { showWeeklyMenuFormError(saveError.message); }
    else {
      setWeeklyMenuFormSuccess(editingWeeklyEntry ? 'Entry updated!' : 'Entry added!');
      setShowWeeklyMenuForm(false);
      setEditingWeeklyEntry(null);
      await loadWeeklyMenu();
    }
    setSavingWeeklyEntry(false);
  };

  const handleDeleteWeeklyEntry = (entry: WeeklyMenuEntry) => {
    setDeleteModal({
      open: true,
      title: 'Delete Menu Entry',
      message: `Delete "${entry.meal_name || entry.day_name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data, error } = await supabase.from('weekly_menu').delete().eq('id', entry.id).select('id');
        if (error || !data || data.length === 0) {
          showGlobalError(error?.message || 'Delete was blocked — you may not have permission to edit the weekly menu.');
        }
        await loadWeeklyMenu();
      },
    });
  };

  const handleCloseDay = async (date: string, dayName: string) => {
    setClosingDayDate(date);
    setSavingClosedDay(true);
    const existing = weeklyMenuEntries.find(e => e.meal_date === date);
    let err: any = null;
    if (existing) {
      const { data, error } = await supabase.from('weekly_menu').update({ is_closed: true, meal_name: null, description: null }).eq('id', existing.id).select('id');
      err = error || (!data || data.length === 0 ? { message: 'blocked' } : null);
    } else {
      const { data, error } = await supabase.from('weekly_menu').insert({ meal_date: date, day_name: dayName, is_closed: true }).select('id');
      err = error || (!data || data.length === 0 ? { message: 'blocked' } : null);
    }
    if (err) showGlobalError('Could not mark the day as closed — you may not have permission.');
    await loadWeeklyMenu();
    setSavingClosedDay(false);
    setClosingDayDate(null);
  };

  const handleReopenDay = async (entry: WeeklyMenuEntry) => {
    setClosingDayDate(entry.meal_date);
    setSavingClosedDay(true);
    const { data, error } = await supabase.from('weekly_menu').update({ is_closed: false, closed_reason: null }).eq('id', entry.id).select('id');
    if (error || !data || data.length === 0) {
      showGlobalError('Could not reopen the day — you may not have permission.');
    }
    await loadWeeklyMenu();
    setSavingClosedDay(false);
    setClosingDayDate(null);
  };

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
            <h2 className="text-xl font-bold text-[#1A1612]">Weekly Menu</h2>
            <p className="text-sm text-[#8C8278] mt-0.5">
              {getWeekDays()[0]?.shortDate} – {getWeekDays()[6]?.shortDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="px-3 py-2 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-2 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
            >
              This Week
            </button>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="px-3 py-2 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
            >
              Next →
            </button>
          </div>
        </div>

        {weeklyMenuLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {getWeekDays().map(({ date, dayName, shortDate }) => {
              const dayEntries = weeklyMenuEntries.filter(e => e.meal_date === date);
              const closedEntry = dayEntries.find(e => e.is_closed);
              const isClosed = !!closedEntry;
              const isProcessing = closingDayDate === date && savingClosedDay;

              return (
                <div
                  key={date}
                  className={`bg-white rounded-2xl border ${isClosed ? 'border-red-200 bg-red-50' : 'border-[#EDE7DA]'} flex flex-col overflow-hidden`}
                >
                  <div className={`px-4 py-3 border-b ${isClosed ? 'border-red-200 bg-red-100' : 'border-[#EDE7DA] bg-[#FAF5EE]'} flex items-center justify-between`}>
                    <div>
                      <p className="text-sm font-bold text-[#1A1612]">{dayName}</p>
                      <p className="text-xs text-[#8C8278]">{shortDate}</p>
                    </div>
                    {isClosed ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Closed</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{dayEntries.length} item{dayEntries.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div className="flex-1 p-3 space-y-2">
                    {isClosed ? (
                      <p className="text-xs text-red-500 italic">{closedEntry?.closed_reason || 'No service this day.'}</p>
                    ) : dayEntries.length === 0 ? (
                      <p className="text-xs text-[#8C8278] italic">No entries yet.</p>
                    ) : (
                      dayEntries.map(entry => (
                        <div key={entry.id} className="bg-[#FAF5EE] rounded-xl p-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1A1612] truncate">{entry.meal_name}</p>
                            {entry.description && <p className="text-xs text-[#8C8278] mt-0.5 line-clamp-2">{entry.description}</p>}
                            {entry.price != null && (
                              <p className="text-xs font-semibold text-[#C4622D] mt-1">R{Number(entry.price).toFixed(2)}</p>
                            )}
                          </div>
                          {can('edit') && (
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                onClick={() => openEditWeeklyMenuForm(entry)}
                                className="text-xs text-[#C4622D] border border-[#C4622D] px-2 py-0.5 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors"
                              >
                                Edit
                              </button>
                              {can('delete') && (
                                <button
                                  onClick={() => handleDeleteWeeklyEntry(entry)}
                                  className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-2.5 py-1 rounded-xl hover:bg-red-50 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-3 pb-3 flex flex-col gap-2">
                    {!isClosed && can('create') && (
                      <button
                        onClick={() => openAddWeeklyMenuForm(date, dayName)}
                        className="w-full text-xs text-[#C4622D] border border-dashed border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors"
                      >
                        + Add Entry
                      </button>
                    )}
                    {can('edit') && (
                      isClosed ? (
                        <button
                          disabled={isProcessing}
                          onClick={() => closedEntry && handleReopenDay(closedEntry)}
                          className="w-full text-xs text-green-700 border border-green-400 px-3 py-1.5 rounded-xl font-semibold hover:bg-green-50 transition-colors disabled:opacity-50"
                        >
                          {isProcessing ? 'Reopening…' : 'Reopen Day'}
                        </button>
                      ) : (
                        <button
                          disabled={isProcessing}
                          onClick={() => handleCloseDay(date, dayName)}
                          className="w-full text-xs text-red-600 border border-red-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {isProcessing ? 'Closing…' : 'Close Day'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showWeeklyMenuForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A1612]">
                  {editingWeeklyEntry ? 'Edit Menu Entry' : `Add Entry — ${weeklyMenuForm.day_name}`}
                </h3>
                <button
                  onClick={() => { setShowWeeklyMenuForm(false); setEditingWeeklyEntry(null); setWeeklyMenuFormError(''); setWeeklyMenuFormSuccess(''); }}
                  className="text-[#8C8278] hover:text-[#1A1612]"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Meal Name *</label>
                  <input
                    type="text"
                    value={weeklyMenuForm.meal_name}
                    onChange={e => setWeeklyMenuForm(f => ({ ...f, meal_name: e.target.value }))}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                    placeholder="e.g. Butter Chicken"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                  <textarea
                    value={weeklyMenuForm.description}
                    onChange={e => setWeeklyMenuForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none"
                    placeholder="Optional description…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price (R)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={weeklyMenuForm.price}
                    onChange={e => setWeeklyMenuForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                    placeholder="0.00"
                  />
                </div>
                {weeklyMenuFormError && <p className="text-sm text-red-600">{weeklyMenuFormError}</p>}
                {weeklyMenuFormSuccess && <p className="text-sm text-green-600">{weeklyMenuFormSuccess}</p>}
              </div>
              <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                <button
                  onClick={handleSaveWeeklyEntry}
                  disabled={savingWeeklyEntry}
                  className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                >
                  {savingWeeklyEntry ? 'Saving…' : (editingWeeklyEntry ? 'Save Changes' : 'Add Entry')}
                </button>
                <button
                  onClick={() => { setShowWeeklyMenuForm(false); setEditingWeeklyEntry(null); setWeeklyMenuFormError(''); setWeeklyMenuFormSuccess(''); }}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors"
                >
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
