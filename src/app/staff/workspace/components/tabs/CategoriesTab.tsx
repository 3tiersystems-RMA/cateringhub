'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import type { Category } from '../../types';

interface CategoriesTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function CategoriesTab({ can }: CategoriesTabProps) {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', active: true, sort_order: '0' });
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryFormSuccess, setCategoryFormSuccess] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const showGlobalError = (msg: string, title = 'Category Error') => {
    setGlobalError(msg);
    setGlobalErrorTitle(title);
  };

  const showCategoryFormError = (msg: string) => {
    if (msg) showGlobalError(msg);
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    const { data, error } = await supabase.from('categories').select('*').order('sort_order');
    if (error) showGlobalError(error.message);
    else if (data) setCategories(data);
    setCategoriesLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', slug: '', active: true, sort_order: '0' });
    setCategoryFormError('');
    setCategoryFormSuccess('');
    setShowCategoryForm(true);
  };

  const openEditCategoryForm = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, slug: cat.slug, active: cat.active, sort_order: String(cat.sort_order) });
    setCategoryFormError('');
    setCategoryFormSuccess('');
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) { showCategoryFormError('Category name is required.'); return; }
    setSavingCategory(true);
    const payload = {
      name: categoryForm.name.trim(),
      slug: categoryForm.slug.trim() || categoryForm.name.toLowerCase().replace(/\s+/g, '-'),
      active: categoryForm.active,
      sort_order: Number(categoryForm.sort_order) || 0,
    };
    let saveError: any = null;
    if (editingCategory) {
      const { data: upd, error } = await supabase.from('categories').update(payload).eq('id', editingCategory.id).select('id');
      saveError = error || (!upd || upd.length === 0 ? { message: 'Update was blocked — you may not have permission to edit categories.' } : null);
    } else {
      const { data: ins, error } = await supabase.from('categories').insert(payload).select('id');
      saveError = error || (!ins || ins.length === 0 ? { message: 'Could not add the category. Please try again.' } : null);
    }
    if (saveError) { showCategoryFormError(saveError.message); }
    else {
      setCategoryFormSuccess(editingCategory ? 'Category updated!' : 'Category added!');
      setShowCategoryForm(false);
      setEditingCategory(null);
      await loadCategories();
    }
    setSavingCategory(false);
  };

  const handleDeleteCategory = (cat: Category) => {
    setDeleteModal({
      open: true,
      title: 'Delete Category',
      message: `Delete "${cat.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data, error } = await supabase.from('categories').delete().eq('id', cat.id).select('id');
        if (error || !data || data.length === 0) {
          showGlobalError(error?.message || 'Delete was blocked — you may not have permission to delete categories.');
        } else {
          await loadCategories();
        }
      },
    });
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
            <h2 className="text-xl font-bold text-[#1A1612]">Categories</h2>
            <p className="text-sm text-[#8C8278] mt-0.5">{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          {can('create') && (
            <button
              onClick={openAddCategoryForm}
              className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
            >
              + Add Category
            </button>
          )}
        </div>

        {categoriesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EDE7DA] bg-[#FAF5EE]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Slug</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Sort Order</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE7DA]">
                  {categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-[#FAF5EE] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#1A1612]">{cat.name}</td>
                      <td className="px-4 py-3 text-[#5C5347] font-mono text-xs">{cat.slug}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cat.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {cat.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#5C5347]">{cat.sort_order}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {can('edit') && (
                            <button
                              onClick={() => openEditCategoryForm(cat)}
                              className="text-xs text-[#C4622D] border border-[#C4622D] px-2.5 py-1 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {can('delete') && (
                            <button
                              onClick={() => handleDeleteCategory(cat)}
                              className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-2.5 py-1 rounded-xl hover:bg-red-50 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#8C8278] text-sm">No categories found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showCategoryForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A1612]">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h3>
                <button
                  onClick={() => { setShowCategoryForm(false); setEditingCategory(null); setCategoryFormError(''); }}
                  className="text-[#8C8278] hover:text-[#1A1612]"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Name *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                    placeholder="e.g. Frozen Meals"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Slug *</label>
                  <input
                    type="text"
                    value={categoryForm.slug}
                    onChange={e => setCategoryForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                    placeholder="e.g. frozen-meals"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cat-active"
                    checked={categoryForm.active}
                    onChange={e => setCategoryForm(f => ({ ...f, active: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="cat-active" className="text-sm text-[#5C5347]">Active</label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={categoryForm.sort_order}
                    onChange={e => setCategoryForm(f => ({ ...f, sort_order: e.target.value }))}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                  />
                </div>
                {categoryFormError && <p className="text-sm text-red-600">{categoryFormError}</p>}
              </div>
              <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                <button
                  onClick={handleSaveCategory}
                  disabled={savingCategory}
                  className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                >
                  {savingCategory ? 'Saving…' : (editingCategory ? 'Save Changes' : 'Add Category')}
                </button>
                <button
                  onClick={() => { setShowCategoryForm(false); setEditingCategory(null); setCategoryFormError(''); }}
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
