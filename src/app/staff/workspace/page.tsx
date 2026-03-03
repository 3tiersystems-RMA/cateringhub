'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

type BucketType = 'product-images' | 'event-photos';

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: { size?: number; mimetype?: string };
  signedUrl?: string;
}

export default function StaffWorkspacePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [activeBucket, setActiveBucket] = useState<BucketType>('product-images');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.replace('/staff/login');
        return;
      }
      setUser(currentUser);
      await loadFiles(activeBucket);
    };
    init();
  }, []);

  const loadFiles = async (bucket: BucketType) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from(bucket).list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (error) {
        console.log('Load files error:', error.message);
        setFiles([]);
        return;
      }

      const filesWithUrls = await Promise.all(
        (data || []).filter((f) => f.name !== '.emptyFolderPlaceholder').map(async (file) => {
          const { data: signedData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(file.name, 3600);
          return {
            ...file,
            signedUrl: signedData?.signedUrl || '',
          } as StorageFile;
        })
      );

      setFiles(filesWithUrls);
    } catch (err) {
      console.log('Unexpected error loading files:', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBucketChange = async (bucket: BucketType) => {
    setActiveBucket(bucket);
    setUploadError('');
    setUploadSuccess('');
    await loadFiles(bucket);
  };

  const handleUpload = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    let successCount = 0;
    let errorCount = 0;

    for (const file of Array.from(selectedFiles)) {
      if (!file.type.startsWith('image/')) {
        errorCount++;
        continue;
      }
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from(activeBucket).upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) {
        console.log('Upload error:', error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      setUploadSuccess(`${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully!`);
      await loadFiles(activeBucket);
    }
    if (errorCount > 0) {
      setUploadError(`${errorCount} file${errorCount > 1 ? 's' : ''} failed to upload. Only image files are accepted.`);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (fileName: string) => {
    setDeletingId(fileName);
    try {
      const { error } = await supabase.storage.from(activeBucket).remove([fileName]);
      if (error) {
        console.log('Delete error:', error.message);
      } else {
        setFiles((prev) => prev.filter((f) => f.name !== fileName));
      }
    } catch (err) {
      console.log('Unexpected delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/staff/login');
    router.refresh();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const buckets: { id: BucketType; label: string; description: string; icon: string }[] = [
    {
      id: 'product-images',
      label: 'Product Images',
      description: 'Menu items, dishes & catering products',
      icon: '🍽️',
    },
    {
      id: 'event-photos',
      label: 'Event Photos',
      description: 'Marketing photos from events',
      icon: '📸',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-white border-b border-[#DDD5C8] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={40} iconName="FireIcon" text="CateringHub" />
            <div className="hidden sm:block h-5 w-px bg-[#DDD5C8]" />
            <span className="hidden sm:block text-sm font-medium text-[#8C8278]">Staff Workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-[#8C8278]">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-[#C4622D] hover:text-[#A04E22] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#F5F0E8]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1A1612]">Media Library</h1>
          <p className="text-[#8C8278] text-sm mt-1">Upload and manage product images and event photos for marketing</p>
        </div>

        {/* Bucket Tabs */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {buckets.map((bucket) => (
            <button
              key={bucket.id}
              onClick={() => handleBucketChange(bucket.id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeBucket === bucket.id
                  ? 'bg-[#C4622D] text-white shadow-md'
                  : 'bg-white text-[#5C5347] border border-[#DDD5C8] hover:border-[#C4622D] hover:text-[#C4622D]'
              }`}
            >
              <span>{bucket.icon}</span>
              <div className="text-left">
                <div>{bucket.label}</div>
                <div className={`text-xs font-normal ${
                  activeBucket === bucket.id ? 'text-orange-100' : 'text-[#B0A89E]'
                }`}>{bucket.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Upload Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`bg-white rounded-2xl border-2 border-dashed p-8 mb-6 text-center transition-all duration-200 ${
            dragOver
              ? 'border-[#C4622D] bg-orange-50'
              : 'border-[#DDD5C8] hover:border-[#C4622D]'
          }`}
        >
          <div className="text-4xl mb-3">
            {activeBucket === 'product-images' ? '🍽️' : '📸'}
          </div>
          <p className="text-[#3D3530] font-semibold mb-1">
            Drop images here or click to upload
          </p>
          <p className="text-[#B0A89E] text-sm mb-4">
            Supports JPG, PNG, WebP, GIF · Max 10MB per file
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`inline-flex items-center gap-2 bg-[#C4622D] text-white px-6 py-2.5 rounded-full text-sm font-semibold cursor-pointer hover:bg-[#A04E22] transition-all duration-200 ${
              uploading ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Choose Images
              </>
            )}
          </label>
        </div>

        {/* Feedback Messages */}
        {uploadSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {uploadSuccess}
          </div>
        )}
        {uploadError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {uploadError}
          </div>
        )}

        {/* Files Grid */}
        <div className="bg-white rounded-2xl border border-[#DDD5C8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EDE7DA] flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1612]">
              {buckets.find((b) => b.id === activeBucket)?.label}
            </h2>
            <span className="text-sm text-[#8C8278]">
              {loading ? 'Loading...' : `${files.length} image${files.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">{activeBucket === 'product-images' ? '🍽️' : '📸'}</div>
              <p className="text-[#5C5347] font-medium">No images yet</p>
              <p className="text-[#B0A89E] text-sm mt-1">Upload your first image using the area above</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="group relative bg-[#F5F0E8] rounded-xl overflow-hidden aspect-square border border-[#EDE7DA] hover:border-[#C4622D] transition-all duration-200"
                >
                  {file.signedUrl ? (
                    <img
                      src={file.signedUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      🖼️
                    </div>
                  )}

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-2">
                    <p className="text-white text-xs text-center font-medium leading-tight line-clamp-2">
                      {file.name.replace(/^\d+_/, '')}
                    </p>
                    <p className="text-white/70 text-xs">
                      {formatFileSize(file.metadata?.size)}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {file.signedUrl && (
                        <a
                          href={file.signedUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(file.name)}
                        disabled={deletingId === file.name}
                        className="bg-red-500/80 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {deletingId === file.name ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
