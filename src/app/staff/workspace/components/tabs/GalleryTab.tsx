'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';

interface GalleryImage {
  id: string;
  title: string;
  description: string | null;
  image_path: string;
  sort_order: number;
  is_visible: boolean;
  imageUrl?: string;
}

interface GalleryTabProps {
  can: (action: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

export default function GalleryTab({ can }: GalleryTabProps) {
  const supabase = createClient();
  const galleryImageRef = useRef<HTMLInputElement>(null);

  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [gallerySectionVisible, setGallerySectionVisible] = useState(true);
  const [gallerySettingsId, setGallerySettingsId] = useState<string | null>(null);
  const [gallerySettingsSaving, setGallerySettingsSaving] = useState(false);
  const [showGalleryForm, setShowGalleryForm] = useState(false);
  const [editingGalleryImage, setEditingGalleryImage] = useState<GalleryImage | null>(null);
  const [galleryForm, setGalleryForm] = useState({ title: '', description: '', sort_order: '0', is_visible: true });
  const [galleryFormError, setGalleryFormError] = useState('');
  const [savingGallery, setSavingGallery] = useState(false);
  const [galleryImageFile, setGalleryImageFile] = useState<File | null>(null);
  const [galleryImagePreview, setGalleryImagePreview] = useState<string | null>(null);
  const [uploadingGalleryImage, setUploadingGalleryImage] = useState(false);
  const [togglingGalleryId, setTogglingGalleryId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  const showGlobalError = (msg: string, title = 'Gallery Error') => {
    setGlobalError(msg);
    setGlobalErrorTitle(title);
  };

  const loadGallery = async () => {
    setGalleryLoading(true);
    const { data: settings } = await supabase.from('gallery_settings').select('*').limit(1).single();
    if (settings) {
      setGallerySectionVisible(settings.section_visible);
      setGallerySettingsId(settings.id);
    }
    const { data } = await supabase.from('gallery_images').select('*').order('sort_order');
    if (data) {
      const withUrls = await Promise.all(data.map(async (img: GalleryImage) => {
        const { data: urlData } = await supabase.storage.from('gallery-images').createSignedUrl(img.image_path, 3600);
        return { ...img, imageUrl: urlData?.signedUrl };
      }));
      setGalleryImages(withUrls);
    }
    setGalleryLoading(false);
  };

  useEffect(() => {
    loadGallery();
  }, []);

  const handleToggleGallerySectionVisible = async (visible: boolean) => {
    setGallerySettingsSaving(true);
    if (gallerySettingsId) {
      await supabase.from('gallery_settings').update({ section_visible: visible, updated_at: new Date().toISOString() }).eq('id', gallerySettingsId);
    } else {
      const { data } = await supabase.from('gallery_settings').insert({ section_visible: visible }).select().single();
      if (data) setGallerySettingsId(data.id);
    }
    setGallerySectionVisible(visible);
    setGallerySettingsSaving(false);
  };

  const openAddGalleryForm = () => {
    setEditingGalleryImage(null);
    setGalleryForm({ title: '', description: '', sort_order: '0', is_visible: true });
    setGalleryImageFile(null);
    setGalleryImagePreview(null);
    setGalleryFormError('');
    setShowGalleryForm(true);
  };

  const openEditGalleryForm = (img: GalleryImage) => {
    setEditingGalleryImage(img);
    setGalleryForm({ title: img.title, description: img.description || '', sort_order: String(img.sort_order), is_visible: img.is_visible });
    setGalleryImageFile(null);
    setGalleryImagePreview(img.imageUrl || null);
    setGalleryFormError('');
    setShowGalleryForm(true);
  };

  const handleSaveGalleryImage = async () => {
    if (!galleryForm.title.trim()) { setGalleryFormError('Title is required.'); return; }
    if (!editingGalleryImage && !galleryImageFile) { setGalleryFormError('Please upload an image.'); return; }
    setSavingGallery(true);
    let image_path = editingGalleryImage?.image_path || '';
    if (galleryImageFile) {
      setUploadingGalleryImage(true);
      const ext = galleryImageFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('gallery-images').upload(path, galleryImageFile);
      if (uploadErr) { setGalleryFormError(uploadErr.message); setSavingGallery(false); setUploadingGalleryImage(false); return; }
      image_path = path;
      setUploadingGalleryImage(false);
    }
    const payload = {
      title: galleryForm.title.trim(),
      description: galleryForm.description.trim() || null,
      image_path,
      sort_order: Number(galleryForm.sort_order),
      is_visible: galleryForm.is_visible,
      updated_at: new Date().toISOString(),
    };
    let saveError: any = null;
    if (editingGalleryImage) {
      const { data: upd, error } = await supabase.from('gallery_images').update(payload).eq('id', editingGalleryImage.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit gallery images.' };
    } else {
      const { data: ins, error } = await supabase.from('gallery_images').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the image. Please try again.' };
    }
    if (saveError) { setGalleryFormError(saveError.message); }
    else {
      setShowGalleryForm(false);
      setEditingGalleryImage(null);
      await loadGallery();
    }
    setSavingGallery(false);
  };

  const handleDeleteGalleryImage = (img: GalleryImage) => {
    setDeleteModal({
      open: true,
      title: 'Delete Gallery Image',
      message: `Delete "${img.title}" from the gallery? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data, error } = await supabase.from('gallery_images').delete().eq('id', img.id).select('id');
        if (error || !data || data.length === 0) {
          showGlobalError('Could not delete the image — you may not have permission, or it was already removed.');
        } else if (img.image_path) {
          await supabase.storage.from('gallery-images').remove([img.image_path]);
        }
        await loadGallery();
      },
    });
  };

  const handleToggleGalleryImageVisible = async (img: GalleryImage) => {
    setTogglingGalleryId(img.id);
    const { data, error } = await supabase.from('gallery_images').update({ is_visible: !img.is_visible }).eq('id', img.id).select('id');
    if (error || !data || data.length === 0) {
      showGlobalError('Could not update image visibility — please try again.');
    }
    await loadGallery();
    setTogglingGalleryId(null);
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
          <div><h2 className="text-xl font-bold text-[#1A1612]">Gallery</h2><p className="text-sm text-[#8C8278] mt-0.5">{galleryImages.length} images</p></div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#5C5347]">Gallery Section</span>
              <button onClick={() => handleToggleGallerySectionVisible(!gallerySectionVisible)} disabled={gallerySettingsSaving} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${gallerySectionVisible ? 'bg-[#C4622D]' : 'bg-gray-200'} disabled:opacity-50`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gallerySectionVisible ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {can('create') && (
              <button onClick={openAddGalleryForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Add Image</button>
            )}
          </div>
        </div>
        {galleryLoading ? (
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryImages.map(img => (
              <div key={img.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                {img.imageUrl && <img src={img.imageUrl} alt={img.title} className="w-full h-32 object-cover" />}
                <div className="p-3">
                  <p className="font-semibold text-[#1A1612] text-xs truncate">{img.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={() => handleToggleGalleryImageVisible(img)} disabled={togglingGalleryId === img.id} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${img.is_visible ? 'bg-[#C4622D]' : 'bg-gray-200'} disabled:opacity-50`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${img.is_visible ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                    <div className="flex gap-1">
                      {can('edit') && <button onClick={() => openEditGalleryForm(img)} className="text-xs text-[#C4622D] border border-[#C4622D] px-2 py-1 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>}
                      {can('delete') && <button onClick={() => handleDeleteGalleryImage(img)} className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-300 bg-white px-2 py-1 rounded-xl hover:bg-red-50 transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete</button>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {galleryImages.length === 0 && <div className="col-span-4 bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No gallery images found.</p></div>}
          </div>
        )}
        {showGalleryForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1A1612]">{editingGalleryImage ? 'Edit Image' : 'Add Gallery Image'}</h3>
                <button
                  onClick={() => { setShowGalleryForm(false); setEditingGalleryImage(null); setGalleryFormError(''); }}
                  className="text-[#8C8278] hover:text-[#1A1612]"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Title *</label>
                  <input
                    type="text"
                    value={galleryForm.title}
                    onChange={e => setGalleryForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                    placeholder="Image title"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                  <textarea
                    value={galleryForm.description}
                    onChange={e => setGalleryForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none"
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Image {editingGalleryImage ? '(leave blank to keep current)' : '*'}</label>
                  <input
                    ref={galleryImageRef}
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setGalleryImageFile(file);
                      if (file) setGalleryImagePreview(URL.createObjectURL(file));
                    }}
                    className="w-full text-sm text-[#5C5347]"
                  />
                  {galleryImagePreview && (
                    <img src={galleryImagePreview} alt="Preview" className="mt-2 h-32 w-full object-cover rounded-xl border border-[#EDE7DA]" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={galleryForm.sort_order}
                    onChange={e => setGalleryForm(f => ({ ...f, sort_order: e.target.value }))}
                    className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="gallery-visible"
                    checked={galleryForm.is_visible}
                    onChange={e => setGalleryForm(f => ({ ...f, is_visible: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="gallery-visible" className="text-sm text-[#5C5347]">Visible on homepage</label>
                </div>
                {galleryFormError && <p className="text-sm text-red-600">{galleryFormError}</p>}
              </div>
              <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                <button
                  onClick={handleSaveGalleryImage}
                  disabled={savingGallery || uploadingGalleryImage}
                  className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                >
                  {savingGallery ? 'Saving…' : (editingGalleryImage ? 'Save Changes' : 'Add Image')}
                </button>
                <button
                  onClick={() => { setShowGalleryForm(false); setEditingGalleryImage(null); setGalleryFormError(''); }}
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
