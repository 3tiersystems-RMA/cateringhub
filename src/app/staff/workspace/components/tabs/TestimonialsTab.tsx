'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import type { Testimonial, TestimonialForm } from '../../types';

interface TestimonialsTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function TestimonialsTab({ can }: TestimonialsTabProps) {
  const supabase = createClient();

  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<TestimonialForm>({
    quote: '', name: '', role: '', avatar_url: '', rating: 5, is_active: true, display_order: '0',
  });
  const [testimonialFormError, setTestimonialFormError] = useState('');
  const [testimonialFormSuccess, setTestimonialFormSuccess] = useState('');
  const [savingTestimonial, setSavingTestimonial] = useState(false);
  const [testimonialSearchQuery, setTestimonialSearchQuery] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const loadTestimonials = async () => {
    setTestimonialsLoading(true);
    const { data } = await supabase.from('testimonials').select('*').order('display_order');
    if (data) setTestimonials(data);
    setTestimonialsLoading(false);
  };

  useEffect(() => {
    loadTestimonials();
  }, []);

  const handleSaveTestimonial = async () => {
    if (!testimonialForm.quote.trim() || !testimonialForm.name.trim()) { setTestimonialFormError('Quote and name are required.'); return; }
    setSavingTestimonial(true);
    const payload = {
      quote: testimonialForm.quote.trim(),
      name: testimonialForm.name.trim(),
      role: testimonialForm.role.trim(),
      avatar_url: testimonialForm.avatar_url.trim() || null,
      rating: Number(testimonialForm.rating),
      is_active: testimonialForm.is_active,
      display_order: Number(testimonialForm.display_order) || 0,
    };
    let saveError: any = null;
    if (editingTestimonial) {
      const { data: upd, error } = await supabase.from('testimonials').update(payload).eq('id', editingTestimonial.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit testimonials.' };
    } else {
      const { data: ins, error } = await supabase.from('testimonials').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the testimonial. Please try again.' };
    }
    if (saveError) { setTestimonialFormError(saveError.message); }
    else {
      setTestimonialFormSuccess(editingTestimonial ? 'Testimonial updated!' : 'Testimonial added!');
      setShowTestimonialForm(false);
      setEditingTestimonial(null);
      await loadTestimonials();
    }
    setSavingTestimonial(false);
  };

  const handleDeleteTestimonial = (t: Testimonial) => {
    setDeleteModal({
      open: true,
      title: 'Delete Testimonial',
      message: `Delete testimonial from "${t.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        await supabase.from('testimonials').delete().eq('id', t.id);
        await loadTestimonials();
      },
    });
  };

  const openAddTestimonialForm = () => {
    setEditingTestimonial(null);
    setTestimonialForm({ quote: '', name: '', role: '', avatar_url: '', rating: 5, is_active: true, display_order: '0' });
    setTestimonialFormError('');
    setTestimonialFormSuccess('');
    setShowTestimonialForm(true);
  };

  const openEditTestimonialForm = (t: Testimonial) => {
    setEditingTestimonial(t);
    setTestimonialForm({ quote: t.quote, name: t.name, role: t.role, avatar_url: t.avatar_url || '', rating: t.rating, is_active: t.is_active, display_order: String(t.display_order) });
    setTestimonialFormError('');
    setTestimonialFormSuccess('');
    setShowTestimonialForm(true);
  };

  return (
    <>
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
          <div><h2 className="text-xl font-bold text-[#1A1612]">Testimonials</h2><p className="text-sm text-[#8C8278] mt-0.5">{testimonials.length} testimonials</p></div>
          <div className="flex items-center gap-3">
            <input type="text" placeholder="Search testimonials…" value={testimonialSearchQuery} onChange={e => setTestimonialSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
            {can('create') && (
              <button onClick={openAddTestimonialForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Add Testimonial</button>
            )}
          </div>
        </div>
        {testimonialsLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {testimonials.filter(t => !testimonialSearchQuery || t.name.toLowerCase().includes(testimonialSearchQuery.toLowerCase()) || t.quote.toLowerCase().includes(testimonialSearchQuery.toLowerCase())).map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-[#1A1612] text-sm">{t.name}</p>
                    <span className="text-xs text-[#8C8278]">{t.role}</span>
                    <span className="text-xs text-amber-500">{'★'.repeat(t.rating)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  {t.quote && <p className="text-xs text-[#8C8278] truncate">{t.quote}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {can('edit') && (
                    <button onClick={() => openEditTestimonialForm(t)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                  )}
                  {can('delete') && (
                    <button onClick={() => handleDeleteTestimonial(t)} className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {testimonials.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No testimonials found.</p></div>}
          </div>
        )}
        {showTestimonialForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A1612]">{editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
                <button onClick={() => setShowTestimonialForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
              </div>
              <div className="p-5 space-y-3">
                <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Quote *</label><textarea value={testimonialForm.quote} onChange={e => setTestimonialForm(f => ({ ...f, quote: e.target.value }))} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Name *</label><input type="text" value={testimonialForm.name} onChange={e => setTestimonialForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                  <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Role/Title</label><input type="text" value={testimonialForm.role} onChange={e => setTestimonialForm(f => ({ ...f, role: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                  <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Rating (1-5)</label><input type="number" min={1} max={5} value={testimonialForm.rating} onChange={e => setTestimonialForm(f => ({ ...f, rating: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                  <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Display Order</label><input type="number" value={testimonialForm.display_order} onChange={e => setTestimonialForm(f => ({ ...f, display_order: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                </div>
                <div className="flex items-center gap-2"><input type="checkbox" id="t-active" checked={testimonialForm.is_active} onChange={e => setTestimonialForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" /><label htmlFor="t-active" className="text-sm text-[#5C5347]">Active (visible on site)</label></div>
                {testimonialFormError && <p className="text-sm text-red-600">{testimonialFormError}</p>}
                {testimonialFormSuccess && <p className="text-sm text-green-600">{testimonialFormSuccess}</p>}
              </div>
              <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                <button onClick={handleSaveTestimonial} disabled={savingTestimonial} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{savingTestimonial ? 'Saving…' : (editingTestimonial ? 'Save Changes' : 'Add Testimonial')}</button>
                <button onClick={() => setShowTestimonialForm(false)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
