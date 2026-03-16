'use client';

import { useState, useEffect, useCallback } from 'react';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
}

function formatFileSize(bytes?: string): string {
  if (!bytes) return '—';
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getFileTypeLabel(mimeType: string): { label: string; color: string; bg: string } {
  if (mimeType === 'application/pdf') return { label: 'PDF', color: '#fff', bg: '#C4622D' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { label: 'XLS', color: '#fff', bg: '#217346' };
  if (mimeType.includes('document') || mimeType.includes('word')) return { label: 'DOC', color: '#fff', bg: '#2B579A' };
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return { label: 'PPT', color: '#fff', bg: '#D24726' };
  if (mimeType.includes('folder')) return { label: 'DIR', color: '#fff', bg: '#8C8278' };
  if (mimeType.includes('image')) return { label: 'IMG', color: '#fff', bg: '#6B7280' };
  if (mimeType.includes('text')) return { label: 'TXT', color: '#fff', bg: '#5C5347' };
  return { label: 'FILE', color: '#fff', bg: '#8C8278' };
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const { label, color, bg } = getFileTypeLabel(mimeType);
  return (
    <div
      className="w-10 h-12 rounded-sm flex flex-col items-center justify-end pb-1 flex-shrink-0 relative"
      style={{ backgroundColor: bg }}
    >
      {/* Folded corner */}
      <div
        className="absolute top-0 right-0 w-0 h-0"
        style={{
          borderStyle: 'solid',
          borderWidth: '0 8px 8px 0',
          borderColor: `transparent rgba(255,255,255,0.35) transparent transparent`,
        }}
      />
      <span className="text-[9px] font-bold tracking-wide" style={{ color }}>{label}</span>
    </div>
  );
}

export default function GoogleDriveDocuments() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
  const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;

  const fetchFiles = useCallback(async () => {
    if (!apiKey || !folderId) {
      setError('Google Drive is not configured. Please set NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY and NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID in your environment variables.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed=false`,
        key: apiKey,
        fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
        orderBy: 'name',
        pageSize: '100',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || `API error ${res.status}`;
        setError(`Google Drive API error: ${msg}`);
        setLoading(false);
        return;
      }

      setFiles(data.files || []);
    } catch (err: any) {
      setError(`Failed to fetch documents: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [apiKey, folderId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleCopyLink = async (file: DriveFile) => {
    const link = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleOpen = (file: DriveFile) => {
    const link = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-[#8C8278]">Loading documents from Google Drive…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 mb-1">Unable to load documents</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={fetchFiles}
            className="text-xs font-semibold text-red-600 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-[#DDD5C8]">
        <div className="text-4xl mb-3">📄</div>
        <p className="text-[#8C8278] font-medium">No documents found</p>
        <p className="text-sm text-[#B5ADA5] mt-1">No files were found in the configured Google Drive folder</p>
        <button
          onClick={fetchFiles}
          className="mt-4 text-sm font-semibold text-[#C4622D] border border-[#C4622D] px-4 py-2 rounded-xl hover:bg-[#FDF6F0] transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#DDD5C8] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDE7DA] bg-[#FDFAF6]">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#C4622D]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58q0-1.95 1.17-3.48 1.18-1.53 3.08-1.95.51-2.26 2.3-3.70Q9.34 4 11.5 4q2.69 0 4.6 1.88Q18 7.75 18 10.5v.5q1.73-.02 2.86 1.06Q22 13.14 22 14.9q0 1.65-1.18 2.87Q19.65 19 18 19H13v-6.15l1.6 1.55L16 13l-4-4-4 4 1.4 1.4 1.6-1.55V19H6.5Z"/>
          </svg>
          <span className="text-sm font-semibold text-[#3D3530]">Google Drive — Operational Documents</span>
          <span className="text-xs text-[#8C8278] bg-[#F5F0E8] px-2 py-0.5 rounded-full">{files.length} files</span>
        </div>
        <button
          onClick={fetchFiles}
          className="flex items-center gap-1.5 text-xs font-medium text-[#5C5347] border border-[#DDD5C8] px-3 py-1.5 rounded-lg hover:bg-[#EDE7DA] transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[auto_1fr_140px_140px_100px] gap-4 px-5 py-2.5 border-b border-[#EDE7DA] bg-[#FAF7F2]">
        <div className="w-10" />
        <span className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide">File name</span>
        <span className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide">Size</span>
        <span className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide">Last modified</span>
        <span className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide text-right">Actions</span>
      </div>

      {/* File rows */}
      <div className="divide-y divide-[#F0EBE3]">
        {files.map((file) => (
          <div
            key={file.id}
            className="grid grid-cols-[auto_1fr_140px_140px_100px] gap-4 px-5 py-3.5 items-center hover:bg-[#FDFAF6] transition-colors group"
          >
            {/* Icon */}
            <FileTypeIcon mimeType={file.mimeType} />

            {/* Name */}
            <div className="min-w-0">
              <button
                onClick={() => handleOpen(file)}
                className="text-sm font-medium text-[#1A1612] hover:text-[#C4622D] transition-colors text-left truncate block w-full"
                title={file.name}
              >
                {file.name}
              </button>
            </div>

            {/* Size */}
            <span className="text-sm text-[#8C8278]">{formatFileSize(file.size)}</span>

            {/* Modified */}
            <span className="text-sm text-[#8C8278]">{formatDate(file.modifiedTime)}</span>

            {/* Actions */}
            <div className="flex items-center justify-end gap-1.5">
              {/* Open */}
              <button
                onClick={() => handleOpen(file)}
                title="Open in Google Drive"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
              {/* Copy link */}
              <button
                onClick={() => handleCopyLink(file)}
                title={copiedId === file.id ? 'Copied!' : 'Copy link'}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  copiedId === file.id
                    ? 'text-green-600 bg-green-50' :'text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0]'
                }`}
              >
                {copiedId === file.id ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
