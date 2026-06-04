'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkspaceDocument {
  id: string;
  name: string;
  file_type: string;
  file_size: number | null;
  storage_path: string;
  category: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

interface DocumentManagementProps {
  canManage?: boolean;
}

const CATEGORIES = ['All', 'Contracts', 'Invoices', 'Menus', 'Policies', 'Reports', 'Templates', 'Other'];

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-50 text-red-700 border-red-200',
  doc: 'bg-blue-50 text-blue-700 border-blue-200',
  docx: 'bg-blue-50 text-blue-700 border-blue-200',
  xls: 'bg-green-50 text-green-700 border-green-200',
  xlsx: 'bg-green-50 text-green-700 border-green-200',
  ppt: 'bg-amber-50 text-amber-700 border-amber-200',
  pptx: 'bg-amber-50 text-amber-700 border-amber-200',
  jpg: 'bg-purple-50 text-purple-700 border-purple-200',
  jpeg: 'bg-purple-50 text-purple-700 border-purple-200',
  png: 'bg-purple-50 text-purple-700 border-purple-200',
  txt: 'bg-gray-100 text-gray-600 border-gray-200',
};

function getFileTypeColor(ext: string) {
  return FILE_TYPE_COLORS[ext.toLowerCase()] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

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

function FileIcon({ ext }: { ext: string }) {
  const e = ext.toLowerCase();
  let color = '#8C8278';
  if (e === 'pdf') color = '#DB4437';
  else if (e === 'doc' || e === 'docx') color = '#4285F4';
  else if (e === 'xls' || e === 'xlsx') color = '#0F9D58';
  else if (e === 'ppt' || e === 'pptx') color = '#F4B400';
  else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e)) color = '#9C27B0';

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill={color} fillOpacity="0.12" />
      <path d="M10 9h10l7 7v14a1.5 1.5 0 01-1.5 1.5h-15.5A1.5 1.5 0 0110 30V10.5A1.5 1.5 0 0110 9z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.2" />
      <path d="M20 9l7 7h-5.5A1.5 1.5 0 0120 14.5V9z" fill={color} fillOpacity="0.5" />
      <text x="18" y="26" fontSize="6" fontWeight="bold" fill={color} textAnchor="middle" fontFamily="Arial">
        {ext.toUpperCase().slice(0, 4)}
      </text>
    </svg>
  );
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
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file.'); return; }
    if (!name.trim()) { setError('Please enter a document name.'); return; }

    setUploading(true);
    setError('');

    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `documents/${Date.now()}-${file.name}`;

    const { error: storageError } = await supabase.storage
      .from('workspace-documents')
      .upload(storagePath, file, { upsert: false });

    if (storageError) {
      setError('Upload failed: ' + storageError.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('workspace_documents').insert({
      name: name.trim(),
      file_type: ext,
      file_size: file.size,
      storage_path: storagePath,
      category,
      notes: notes.trim() || null,
    });

    if (dbError) {
      setError('Failed to save document record: ' + dbError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    onUploaded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-[#1A1612]">Upload Document</h3>
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
          {/* File picker */}
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">File</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#DDD5C8] rounded-xl p-4 text-center cursor-pointer hover:border-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
            >
              {file ? (
                <div className="flex items-center gap-2 justify-center">
                  <FileIcon ext={file.name.split('.').pop() ?? 'bin'} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-[#1A1612] truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-[#8C8278]">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 mx-auto mb-2 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm text-[#5C5347]">Click to select a file</p>
                  <p className="text-xs text-[#8C8278] mt-0.5">PDF, Word, Excel, Images, etc.</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Document Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter document name"
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors bg-white"
            >
              {CATEGORIES.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
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
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 px-4 py-2 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A8521F] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading…
              </>
            ) : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DocumentManagement({ canManage = true }: DocumentManagementProps) {
  const supabase = createClient();

  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await supabase
      .from('workspace_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Failed to load documents: ' + fetchError.message);
    } else {
      setDocuments((data as WorkspaceDocument[]) || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDownload = async (doc: WorkspaceDocument) => {
    setDownloadingId(doc.id);
    const { data, error: dlError } = await supabase.storage
      .from('workspace-documents')
      .createSignedUrl(doc.storage_path, 60);

    if (dlError || !data?.signedUrl) {
      showToast('error', 'Failed to generate download link.');
    } else {
      window.open(data.signedUrl, '_blank');
    }
    setDownloadingId(null);
  };

  const handleDelete = async (doc: WorkspaceDocument) => {
    setDeletingId(doc.id);
    await supabase.storage.from('workspace-documents').remove([doc.storage_path]);
    const { error: dbError } = await supabase.from('workspace_documents').delete().eq('id', doc.id);
    if (dbError) {
      showToast('error', 'Failed to delete document.');
    } else {
      showToast('success', 'Document deleted.');
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const filtered = documents.filter(doc => {
    const matchesSearch =
      !searchQuery ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.file_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.notes ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1A1612]">Document Management</h2>
          <p className="text-xs text-[#8C8278] mt-0.5">Upload and manage workspace documents</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#C4622D] text-white text-sm font-semibold rounded-xl hover:bg-[#A8521F] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload Document
          </button>
        )}
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
            placeholder="Search documents…"
            className="w-full pl-9 pr-3 py-2 border border-[#DDD5C8] rounded-xl text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                categoryFilter === cat
                  ? 'bg-[#C4622D] text-white border-[#C4622D]'
                  : 'bg-white text-[#5C5347] border-[#DDD5C8] hover:border-[#C4622D] hover:text-[#C4622D]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Documents', value: documents.length, icon: '📄' },
          { label: 'PDFs', value: documents.filter(d => d.file_type.toLowerCase() === 'pdf').length, icon: '📕' },
          { label: 'Spreadsheets', value: documents.filter(d => ['xls','xlsx'].includes(d.file_type.toLowerCase())).length, icon: '📊' },
          { label: 'Other Files', value: documents.filter(d => !['pdf','xls','xlsx','doc','docx'].includes(d.file_type.toLowerCase())).length, icon: '📁' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-[#EDE7DA] p-4">
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-bold text-[#1A1612]">{stat.value}</div>
            <div className="text-xs text-[#8C8278] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Document List */}
      <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
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
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3 text-[#DDD5C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-[#5C5347] font-medium">No documents found</p>
            <p className="text-xs text-[#8C8278] mt-1">
              {searchQuery || categoryFilter !== 'All' ? 'Try adjusting your filters' : 'Upload your first document to get started'}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-[#F9F5F0] border-b border-[#EDE7DA] text-xs font-semibold text-[#8C8278] uppercase tracking-wide">
              <span>Name</span>
              <span>Type</span>
              <span>Category</span>
              <span>Uploaded</span>
              <span>Actions</span>
            </div>

            <div className="divide-y divide-[#F5EFE8]">
              {filtered.map(doc => (
                <div key={doc.id} className="px-5 py-4 hover:bg-[#FDFAF7] transition-colors">
                  {/* Mobile layout */}
                  <div className="sm:hidden flex items-start gap-3">
                    <FileIcon ext={doc.file_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1612] truncate">{doc.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border ${getFileTypeColor(doc.file_type)}`}>
                          {doc.file_type.toUpperCase()}
                        </span>
                        <span className="text-xs text-[#8C8278]">{doc.category}</span>
                        <span className="text-xs text-[#8C8278]">{formatDate(doc.created_at)}</span>
                      </div>
                      {doc.notes && <p className="text-xs text-[#8C8278] mt-1 truncate">{doc.notes}</p>}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#FDF6F0] text-[#C4622D] text-xs font-semibold rounded-lg hover:bg-[#F5E6D8] transition-colors disabled:opacity-60"
                        >
                          {downloadingId === doc.id ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          )}
                          View / Download
                        </button>
                        {canManage && (
                          <button
                            onClick={() => setConfirmDeleteId(doc.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileIcon ext={doc.file_type} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1A1612] truncate">{doc.name}</p>
                        {doc.notes && <p className="text-xs text-[#8C8278] truncate">{doc.notes}</p>}
                        <p className="text-xs text-[#8C8278]">{formatFileSize(doc.file_size)}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border w-fit ${getFileTypeColor(doc.file_type)}`}>
                      {doc.file_type.toUpperCase()}
                    </span>
                    <span className="text-sm text-[#5C5347]">{doc.category}</span>
                    <span className="text-sm text-[#5C5347]">{formatDate(doc.created_at)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        title="View / Download"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#C4622D] hover:bg-[#FDF6F0] transition-colors disabled:opacity-60"
                      >
                        {downloadingId === doc.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        )}
                      </button>
                      {canManage && (
                        <button
                          onClick={() => setConfirmDeleteId(doc.id)}
                          title="Delete"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={loadDocuments}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (() => {
        const doc = documents.find(d => d.id === confirmDeleteId);
        if (!doc) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1A1612]">Delete Document</h3>
                  <p className="text-xs text-[#8C8278]">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-[#5C5347] mb-5">
                Are you sure you want to delete <span className="font-semibold text-[#1A1612]">{doc.name}</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-[#DDD5C8] text-sm font-medium text-[#5C5347] hover:bg-[#F5EFE8] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deletingId === doc.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : null}
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
