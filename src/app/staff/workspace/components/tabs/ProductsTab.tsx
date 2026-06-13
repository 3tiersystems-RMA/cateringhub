'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import type { Product, ProductForm } from '../../types';

const emptyForm: ProductForm = {
  name: '',
  category: 'Catering Packages',
  price: '',
  unit: 'per serving',
  description: '',
  tags: '',
  badge: '',
  min_order: '',
  available: true,
  featured: false,
  sort_order: 0,
  package_type: 'none',
  image_fit: 'fill',
  old_price: '',
  saving_percent: '',
  attribute1: '',
  attribute2: '',
  attribute3: '',
  long_description: '',
  visual_type: '',
};

interface ProductsTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function ProductsTab({ can }: ProductsTabProps) {
  const supabase = createClient();
  const productImageRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [staffProductCategory, setStaffProductCategory] = useState<string>('All');
  const [oldPriceErrorModal, setOldPriceErrorModal] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const showGlobalError = (msg: string, title = 'Product Error') => {
    setGlobalError(msg);
    setGlobalErrorTitle(title);
  };

  const loadCategoryNames = async () => {
    const { data } = await supabase.from('categories').select('name').eq('active', true).order('sort_order');
    if (data) setCategoryNames(data.map((c: { name: string }) => c.name));
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('sort_order');
    if (!error && data) {
      const withUrls = data.map((p: Product) => {
        if (p.image_path) {
          if (p.image_path.startsWith('/')) {
            return { ...p, imageUrl: p.image_path };
          }
          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(p.image_path);
          return { ...p, imageUrl: urlData?.publicUrl };
        }
        return p;
      });
      setProducts(withUrls);
    }
    setProductsLoading(false);
  };

  useEffect(() => {
    loadCategoryNames();
    loadProducts();
  }, []);

  const openAddForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setPendingImageFile(null);
    setPendingImagePreview(null);
    setFormError('');
    setFormSuccess('');
    loadCategoryNames();
    setShowForm(true);
  };

  const openEditForm = async (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      unit: product.unit,
      description: product.description || '',
      tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
      badge: product.badge || '',
      min_order: product.min_order != null ? String(product.min_order) : '',
      available: product.available,
      featured: product.featured,
      sort_order: product.sort_order,
      package_type: product.package_type || 'none',
      image_fit: product.image_fit || 'fill',
      old_price: product.old_price != null ? String(product.old_price) : '',
      saving_percent: product.saving_percent != null ? String(product.saving_percent) : '',
      attribute1: product.attribute1 || '',
      attribute2: product.attribute2 || '',
      attribute3: product.attribute3 || '',
      long_description: product.long_description || '',
      visual_type: product.visual_type || '',
    });
    setPendingImageFile(null);
    setPendingImagePreview(product.imageUrl || null);
    setFormError('');
    setFormSuccess('');
    await loadCategoryNames();
    setShowEditModal(true);
  };

  const handleSaveProduct = async () => {
    if (!form.name.trim()) { showGlobalError('Product name is required.'); return; }
    const isPackageType = form.package_type && form.package_type.toLowerCase().includes('package');
    if (!isPackageType && (!form.price || isNaN(Number(form.price)))) { showGlobalError('Valid price is required.'); return; }
    if (form.old_price && Number(form.old_price) <= Number(form.price)) {
      setOldPriceErrorModal(true);
      return;
    }
    setSaving(true);
    let image_path = editingProduct?.image_path || null;
    if (pendingImageFile) {
      setUploadingImage(true);
      const ext = pendingImageFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, pendingImageFile);
      if (uploadErr) { showGlobalError(uploadErr.message); setSaving(false); setUploadingImage(false); return; }
      image_path = path;
      setUploadingImage(false);
    }
    const tags = form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price) || 0,
      unit: form.unit,
      description: form.description.trim(),
      tags,
      badge: form.badge.trim() || null,
      min_order: form.min_order ? Number(form.min_order) : null,
      available: form.available,
      featured: form.featured,
      sort_order: Number(form.sort_order) || 0,
      package_type: form.package_type || 'none',
      image_fit: form.image_fit || 'fill',
      old_price: form.old_price ? Number(form.old_price) : null,
      saving_percent: form.saving_percent ? Number(form.saving_percent) : null,
      attribute1: form.attribute1?.trim() || null,
      attribute2: form.attribute2?.trim() || null,
      attribute3: form.attribute3?.trim() || null,
      long_description: form.long_description?.trim() || null,
      visual_type: form.visual_type?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (image_path) payload.image_path = image_path;
    let saveError: { message: string } | null = null;
    if (editingProduct) {
      const { data: upd, error } = await supabase.from('products').update(payload).eq('id', editingProduct.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit products.' };
    } else {
      const { data: ins, error } = await supabase.from('products').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not create the product. Please try again.' };
    }
    if (saveError) { showGlobalError(saveError.message); }
    else {
      setFormSuccess(editingProduct ? 'Product updated!' : 'Product added!');
      setShowForm(false);
      setShowEditModal(false);
      setEditingProduct(null);
      await loadProducts();
    }
    setSaving(false);
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteModal({
      open: true,
      title: 'Delete Product',
      message: `Delete "${product.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data, error } = await supabase.from('products').delete().eq('id', product.id).select('id');
        if (error || !data || data.length === 0) {
          showGlobalError('Could not delete the product — you may not have permission, or it was already removed.');
        }
        await loadProducts();
      },
    });
  };

  const closeForm = () => {
    setShowForm(false);
    setShowEditModal(false);
    setEditingProduct(null);
    setFormError('');
    setFormSuccess('');
  };

  const filteredProducts = products.filter(p => {
    const q = productSearchQuery.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchCat = staffProductCategory === 'All' || p.category === staffProductCategory;
    return matchSearch && matchCat;
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
      {oldPriceErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-[#1A1612] mb-2">Invalid Old Price</h3>
            <p className="text-sm text-[#5C4F3D] mb-5">Old price must be greater than the current price.</p>
            <div className="flex justify-end">
              <button onClick={() => setOldPriceErrorModal(false)} className="px-4 py-2 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A8501F] transition-colors">OK</button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1A1612]">Products &amp; Pricing</h2>
            <p className="text-sm text-[#8C8278] mt-0.5">{products.length} product{products.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search products..."
              value={productSearchQuery}
              onChange={e => setProductSearchQuery(e.target.value)}
              className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
            />
            <select
              value={staffProductCategory}
              onChange={e => setStaffProductCategory(e.target.value)}
              className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
            >
              <option value="All">All Categories</option>
              {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {can('create') && (
              <button
                onClick={openAddForm}
                className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
              >
                + Add Product
              </button>
            )}
          </div>
        </div>

        {productsLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center gap-4">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#EDE7DA]" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#FAF5EE] flex-shrink-0 border border-[#EDE7DA]" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1612] text-sm">{p.name}</p>
                  <p className="text-xs text-[#8C8278]">{p.category}{p.unit ? ` · ${p.unit}` : ''}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-bold text-[#C4622D] text-sm">R{Number(p.price).toFixed(2)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.available ? 'Available' : 'Unavailable'}
                  </span>
                  {can('edit') && (
                    <button
                      onClick={() => openEditForm(p)}
                      className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  {can('delete') && (
                    <button
                      onClick={() => handleDeleteProduct(p)}
                      className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center">
                <p className="text-[#8C8278] text-sm">No products found.</p>
              </div>
            )}
          </div>
        )}

        {(showForm || showEditModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A1612]">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
                <button onClick={closeForm} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Product Image</label>
                  <div className="flex items-center gap-3">
                    {pendingImagePreview && <img src={pendingImagePreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover border border-[#EDE7DA]" />}
                    <button type="button" onClick={() => productImageRef.current?.click()} className="text-xs border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FAF5EE] transition-colors">
                      {pendingImagePreview ? 'Change Image' : 'Upload Image'}
                    </button>
                    <input ref={productImageRef} type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setPendingImageFile(f);
                      const reader = new FileReader();
                      reader.onload = ev => setPendingImagePreview(ev.target?.result as string);
                      reader.readAsDataURL(f);
                    }} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Name *</label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Category</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                      {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price (R)</label>
                    <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Unit</label>
                    <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. per serving" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Old Price (R)</label>
                    <input type="number" min="0" step="0.01" value={form.old_price} onChange={e => setForm(f => ({ ...f, old_price: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Badge</label>
                    <input type="text" value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. New, Popular" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Min Order</label>
                    <input type="number" min="0" value={form.min_order} onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sort Order</label>
                    <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Tags (comma-separated)</label>
                  <input type="text" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. halal, frozen, popular" />
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="rounded" />
                    <span className="text-xs font-semibold text-[#5C5347]">Available</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" />
                    <span className="text-xs font-semibold text-[#5C5347]">Featured</span>
                  </label>
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                {formSuccess && <p className="text-sm text-green-600">{formSuccess}</p>}
              </div>
              <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                <button
                  onClick={handleSaveProduct}
                  disabled={saving || uploadingImage}
                  className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : (editingProduct ? 'Save Changes' : 'Add Product')}
                </button>
                <button onClick={closeForm} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">
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
