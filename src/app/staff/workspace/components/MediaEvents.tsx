'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────
type MediaType = 'image' | 'video' | 'promo';

interface EventMedia {
  id: string;
  event_id: string | null;
  event_name: string;
  media_type: MediaType;
  storage_path: string | null;
  external_url: string | null;
  title: string;
  description: string | null;
  file_size: number | null;
  created_at: string;
  signedUrl?: string;
}

interface MediaEventsProps {
  canManage?: boolean;
}

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  image: 'Image',
  video: 'Video',
  promo: 'Promo',
};

const MEDIA_TYPE_COLORS: Record<MediaType, string> = {
  image: 'bg-purple-50 text-purple-700 border-purple-200',
  video: 'bg-blue-50 text-blue-700 border-blue-200',
  promo: 'bg-amber-50 text-amber-700 border-amber-200',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [eventName, setEventName] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
    // Auto-detect type
    if (f.type.startsWith('video/')) setMediaType('video');
    else if (f.type.startsWith('image/')) setMediaType('image');
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!eventName.trim()) { setError('Please enter an event name.'); return; }
    if (inputMode === 'upload' && !file) { setError('Please select a file.'); return; }
    if (inputMode === 'url' && !externalUrl.trim()) { setError('Please enter a URL.'); return; }

    setUploading(true);
    setError('');

    let storagePath: string | null = null;

    if (inputMode === 'upload' && file) {
      const ext = file.name.split('.').pop() ?? 'bin';
      storagePath = `event-media/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage
        .from('event-media')
        .upload(storagePath, file, { upsert: false });
      if (storageError) {
        setError('Upload failed: ' + storageError.message);
        setUploading(false);
        return;
      }
    }

    const { error: dbError } = await supabase.from('event_media').insert({
      event_name: eventName.trim(),
      media_type: mediaType,
      storage_path: storagePath,
      external_url: inputMode === 'url' ? externalUrl.trim() : null,
      title: title.trim(),
      description: description.trim() || null,
      file_size: file?.size ?? null,
    });

    if (dbError) {
      setError('Failed to save: ' + dbError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    onUploaded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-[#1A1612]">Add Event Media</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Input mode toggle */}
          <div className="flex rounded-xl border border-[#DDD5C8] overflow-hidden">
            {(['upload', 'url'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  inputMode === mode ? 'bg-[#C4622D] text-white' : 'text-[#5C5347] hover:bg-[#F5EFE8]'
                }`}
              >
                {mode === 'upload' ? '⬆ Upload File' : '🔗 External URL'}
              </button>
            ))}
          </div>

          {inputMode === 'upload' ? (
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">File</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#DDD5C8] rounded-xl p-4 text-center cursor-pointer hover:border-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
              >
                {preview ? (
                  <div className="relative">
                    {file?.type.startsWith('video/') ? (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <svg className="w-8 h-8 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        <p className="text-sm font-medium text-[#1A1612]">{file?.name}</p>
                      </div>
                    ) : (
                      <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded-lg object-contain" />
                    )}
                    <p className="text-xs text-[#8C8278] mt-1">Click to change</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 mx-auto mb-2 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm text-[#5C5347]">Click to select image or video</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">External URL</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Media title"
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Event Name</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Summer Gala 2026"
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Media Type</label>
            <div className="flex gap-2">
              {(Object.keys(MEDIA_TYPE_LABELS) as MediaType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setMediaType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    mediaType === t ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'text-[#5C5347] border-[#DDD5C8] hover:border-[#C4622D]'
                  }`}
                >
                  {MEDIA_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description…"
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-[#DDD5C8] text-sm font-medium text-[#5C5347] hover:bg-[#F5EFE8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={uploading}
            className="flex-1 px-4 py-2 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A8521F] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Saving…
              </>
            ) : 'Add Media'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Media Card ───────────────────────────────────────────────────────────────
function MediaCard({
  item,
  canManage,
  onDelete,
  onView,
}: {
  item: EventMedia;
  canManage: boolean;
  onDelete: (item: EventMedia) => void;
  onView: (item: EventMedia) => void;
}) {
  const isVideo = item.media_type === 'video';
  const displayUrl = item.signedUrl ?? item.external_url ?? null;

  return (
    <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden hover:shadow-md transition-shadow group">
      {/* Thumbnail */}
      <div
        className="relative h-40 bg-[#F5EFE8] cursor-pointer overflow-hidden"
        onClick={() => onView(item)}
      >
        {displayUrl && !isVideo ? (
          <img
            src={displayUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : isVideo ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#C4622D]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-[#DDD5C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}
        {/* Type badge */}
        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-xs font-semibold border ${MEDIA_TYPE_COLORS[item.media_type]}`}>
          {MEDIA_TYPE_LABELS[item.media_type]}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-[#1A1612] truncate">{item.title}</p>
        <p className="text-xs text-[#8C8278] truncate mt-0.5">{item.event_name}</p>
        {item.description && (
          <p className="text-xs text-[#8C8278] truncate mt-0.5">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[#8C8278]">{formatDate(item.created_at)}</span>
          <span className="text-xs text-[#8C8278]">{formatFileSize(item.file_size)}</span>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onView(item)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#FDF6F0] text-[#C4622D] text-xs font-semibold rounded-lg hover:bg-[#F5E6D8] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            View
          </button>
          {canManage && (
            <button
              onClick={() => onDelete(item)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MediaEvents({ canManage = true }: MediaEventsProps) {
  const supabase = createClient();

  const [media, setMedia] = useState<EventMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | MediaType>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [viewItem, setViewItem] = useState<EventMedia | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<EventMedia | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('event_media')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Failed to load media: ' + fetchError.message);
      setLoading(false);
      return;
    }

    const items = data as EventMedia[];
    const withUrls = await Promise.all(
      items.map(async (item) => {
        if (item.storage_path) {
          const { data: urlData } = await supabase.storage
            .from('event-media')
            .createSignedUrl(item.storage_path, 3600);
          return { ...item, signedUrl: urlData?.signedUrl };
        }
        return item;
      })
    );

    setMedia(withUrls);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleDelete = async (item: EventMedia) => {
    setDeletingId(item.id);
    if (item.storage_path) {
      await supabase.storage.from('event-media').remove([item.storage_path]);
    }
    const { error: dbError } = await supabase.from('event_media').delete().eq('id', item.id);
    if (dbError) {
      showToast('error', 'Failed to delete media.');
    } else {
      showToast('success', 'Media deleted.');
      setMedia(prev => prev.filter(m => m.id !== item.id));
    }
    setDeletingId(null);
    setConfirmDeleteItem(null);
  };

  const filtered = media.filter(item => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || item.media_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const counts = {
    total: media.length,
    image: media.filter(m => m.media_type === 'image').length,
    video: media.filter(m => m.media_type === 'video').length,
    promo: media.filter(m => m.media_type === 'promo').length,
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1A1612]">Events Media</h2>
          <p className="text-xs text-[#8C8278] mt-0.5">Manage images, videos and promos for events</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#C4622D] text-white text-sm font-semibold rounded-xl hover:bg-[#A8521F] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Media
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Media', value: counts.total, color: 'text-[#C4622D]', bg: 'bg-[#FDF6F0]' },
          { label: 'Images', value: counts.image, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Videos', value: counts.video, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Promos', value: counts.promo, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl border border-[#EDE7DA] p-4`}>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-[#8C8278] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8278]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or event name…"
            className="w-full pl-9 pr-3 py-2 border border-[#DDD5C8] rounded-xl text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'image', 'video', 'promo'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors capitalize ${
                typeFilter === t
                  ? 'bg-[#C4622D] text-white border-[#C4622D]'
                  : 'bg-white text-[#5C5347] border-[#DDD5C8] hover:border-[#C4622D] hover:text-[#C4622D]'
              }`}
            >
              {t === 'all' ? 'All' : MEDIA_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 animate-spin text-[#C4622D]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#EDE7DA]">
          <svg className="w-12 h-12 mx-auto mb-3 text-[#DDD5C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <p className="text-[#5C5347] font-medium">No media found</p>
          <p className="text-xs text-[#8C8278] mt-1">
            {searchQuery || typeFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first event media to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <MediaCard
              key={item.id}
              item={item}
              canManage={canManage}
              onDelete={setConfirmDeleteItem}
              onView={setViewItem}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUploaded={loadMedia} />
      )}

      {/* View Modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setViewItem(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDE7DA]">
              <div>
                <h3 className="text-sm font-bold text-[#1A1612]">{viewItem.title}</h3>
                <p className="text-xs text-[#8C8278]">{viewItem.event_name}</p>
              </div>
              <button
                onClick={() => setViewItem(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              {viewItem.media_type === 'video' ? (
                viewItem.signedUrl || viewItem.external_url ? (
                  <video
                    src={viewItem.signedUrl ?? viewItem.external_url ?? ''}
                    controls
                    className="w-full rounded-xl max-h-80 bg-black"
                  />
                ) : (
                  <div className="flex items-center justify-center h-40 bg-[#F5EFE8] rounded-xl">
                    <p className="text-sm text-[#8C8278]">No video source available</p>
                  </div>
                )
              ) : (viewItem.signedUrl ?? viewItem.external_url) ? (
                <img
                  src={viewItem.signedUrl ?? viewItem.external_url ?? ''}
                  alt={viewItem.title}
                  className="w-full rounded-xl max-h-80 object-contain bg-[#F5EFE8]"
                />
              ) : (
                <div className="flex items-center justify-center h-40 bg-[#F5EFE8] rounded-xl">
                  <p className="text-sm text-[#8C8278]">No preview available</p>
                </div>
              )}
              {viewItem.description && (
                <p className="text-sm text-[#5C5347] mt-3">{viewItem.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-[#8C8278]">
                <span className={`px-2 py-0.5 rounded-lg border font-semibold ${MEDIA_TYPE_COLORS[viewItem.media_type]}`}>
                  {MEDIA_TYPE_LABELS[viewItem.media_type]}
                </span>
                <span>{formatDate(viewItem.created_at)}</span>
                <span>{formatFileSize(viewItem.file_size)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1A1612]">Delete Media</h3>
                <p className="text-xs text-[#8C8278]">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-[#5C5347] mb-5">
              Are you sure you want to delete <span className="font-semibold text-[#1A1612]">{confirmDeleteItem.title}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteItem(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-[#DDD5C8] text-sm font-medium text-[#5C5347] hover:bg-[#F5EFE8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteItem)}
                disabled={deletingId === confirmDeleteItem.id}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deletingId === confirmDeleteItem.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
