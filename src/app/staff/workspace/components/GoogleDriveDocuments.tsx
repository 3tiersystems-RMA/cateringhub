'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────
type DocType = 'auto' | 'doc' | 'sheet' | 'slide' | 'pdf' | 'video' | 'other';

interface DriveDoc {
  id: string;
  fileId: string;
  type: Exclude<DocType, 'auto'>;
  embedUrl: string;
  originalUrl: string;
  title: string;
  folderName: string;
  createdTime?: string;
  modifiedTime?: string;
}

interface GoogleDriveDocumentsProps {
  isSuperAdmin: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<Exclude<DocType, 'auto'>, string> = {
  doc:   'Google Doc',
  sheet: 'Google Sheet',
  slide: 'Google Slides',
  pdf:   'PDF',
  video: 'Video',
  other: 'Other',
};

const DEFAULT_FOLDER = 'General';

// ─── File Type Icons ──────────────────────────────────────────────────────────
function FileTypeIcon({ type, size = 20 }: { type: Exclude<DocType, 'auto'>; size?: number }) {
  const s = size;
  switch (type) {
    case 'doc':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#4285F4"/>
          <path d="M6 7h7l4 4v8a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1z" fill="white" opacity="0.9"/>
          <path d="M13 7l4 4h-3a1 1 0 01-1-1V7z" fill="white" opacity="0.6"/>
          <rect x="7.5" y="12" width="9" height="1.2" rx="0.6" fill="#4285F4"/>
          <rect x="7.5" y="14.2" width="9" height="1.2" rx="0.6" fill="#4285F4"/>
          <rect x="7.5" y="16.4" width="6" height="1.2" rx="0.6" fill="#4285F4"/>
        </svg>
      );
    case 'sheet':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#0F9D58"/>
          <path d="M6 7h7l4 4v8a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1z" fill="white" opacity="0.9"/>
          <path d="M13 7l4 4h-3a1 1 0 01-1-1V7z" fill="white" opacity="0.6"/>
          <rect x="7" y="12" width="10" height="5.5" rx="0.5" fill="none" stroke="#0F9D58" strokeWidth="0.8"/>
          <line x1="7" y1="14" x2="17" y2="14" stroke="#0F9D58" strokeWidth="0.8"/>
          <line x1="11" y1="12" x2="11" y2="17.5" stroke="#0F9D58" strokeWidth="0.8"/>
        </svg>
      );
    case 'slide':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#F4B400"/>
          <path d="M6 7h7l4 4v8a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1z" fill="white" opacity="0.9"/>
          <path d="M13 7l4 4h-3a1 1 0 01-1-1V7z" fill="white" opacity="0.6"/>
          <rect x="7.5" y="12" width="9" height="5.5" rx="0.8" fill="none" stroke="#F4B400" strokeWidth="0.9"/>
          <rect x="9" y="13.5" width="6" height="2.5" rx="0.4" fill="#F4B400" opacity="0.5"/>
        </svg>
      );
    case 'pdf':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#DB4437"/>
          <path d="M6 5h7l4 4v11a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1z" fill="white" opacity="0.9"/>
          <path d="M13 5l4 4h-3a1 1 0 01-1-1V5z" fill="white" opacity="0.6"/>
          <text x="5.5" y="17.5" fontSize="5.5" fontWeight="bold" fill="#DB4437" fontFamily="Arial">PDF</text>
        </svg>
      );
    case 'video':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#6B46C1"/>
          <path d="M6 7h7l4 4v8a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1z" fill="white" opacity="0.9"/>
          <path d="M13 7l4 4h-3a1 1 0 01-1-1V7z" fill="white" opacity="0.6"/>
          <polygon points="9,12.5 9,16.5 14,14.5" fill="#6B46C1"/>
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="4" fill="#8C8278"/>
          <path d="M6 7h7l4 4v8a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1z" fill="white" opacity="0.9"/>
          <path d="M13 7l4 4h-3a1 1 0 01-1-1V7z" fill="white" opacity="0.6"/>
          <rect x="7.5" y="12" width="9" height="1.2" rx="0.6" fill="#8C8278"/>
          <rect x="7.5" y="14.2" width="7" height="1.2" rx="0.6" fill="#8C8278"/>
          <rect x="7.5" y="16.4" width="5" height="1.2" rx="0.6" fill="#8C8278"/>
        </svg>
      );
  }
}

// ─── Folder Icon ──────────────────────────────────────────────────────────────
function FolderIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" fill="#C4622D" opacity="0.15" stroke="#C4622D" strokeWidth="1.5"/>
      <path d="M3 9h18" stroke="#C4622D" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{25,})/,
    /\/d\/([a-zA-Z0-9_-]{25,})/,
    /[?&]id=([a-zA-Z0-9_-]{25,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isFolderUrl(url: string): boolean {
  return /\/folders\/[a-zA-Z0-9_-]/.test(url);
}

function detectTypeFromMime(mimeType: string): Exclude<DocType, 'auto'> {
  if (mimeType === 'application/vnd.google-apps.document') return 'doc';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'sheet';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'slide';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  return 'other';
}

function detectTypeFromUrl(url: string): Exclude<DocType, 'auto'> {
  if (url.includes('/document/'))     return 'doc';
  if (url.includes('/spreadsheets/')) return 'sheet';
  if (url.includes('/presentation/')) return 'slide';
  if (/\.(pdf)(\?|$)/i.test(url))     return 'pdf';
  if (/\.(mp4|webm|mov|avi)(\?|$)/i.test(url)) return 'video';
  return 'other';
}

function buildEmbedUrl(fileId: string, type: Exclude<DocType, 'auto'>): string {
  switch (type) {
    case 'doc':   return `https://docs.google.com/document/d/${fileId}/preview`;
    case 'sheet': return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    case 'slide': return `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`;
    default:      return `https://drive.google.com/file/d/${fileId}/preview`;
  }
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Fetch file metadata from Google Drive API ────────────────────────────────
async function fetchDriveFileMeta(fileId: string): Promise<{
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
} | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,createdTime,modifiedTime&key=${apiKey}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  doc,
  onSave,
  onClose,
}: {
  doc: DriveDoc;
  onSave: (id: string, title: string, folderName: string) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [folderName, setFolderName] = useState(doc.folderName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) { setError('File name cannot be empty.'); return; }
    if (!folderName.trim()) { setError('Folder name cannot be empty.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(doc.id, title.trim(), folderName.trim());
      onClose();
    } catch {
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-[#1A1612]">Edit Document</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">File Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
              placeholder="Enter file name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Folder / Group Name</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
              placeholder="e.g. Contracts"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#F5F0E8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DocRow ───────────────────────────────────────────────────────────────────
function DocRow({
  doc,
  isSuperAdmin,
  onRemove,
  onEdit,
}: {
  doc: DriveDoc;
  isSuperAdmin: boolean;
  onRemove: (id: string) => void;
  onEdit: (doc: DriveDoc) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-[#EDE7DA] overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-shrink-0 mt-0.5">
          <FileTypeIcon type={doc.type} size={22} />
        </div>

        <div className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-[#1A1612] truncate">{doc.title}</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {doc.createdTime && (
              <span className="text-xs text-[#B5ADA5]">
                <span className="text-[#8C8278] font-medium">Created:</span> {formatDate(doc.createdTime)}
              </span>
            )}
            {doc.modifiedTime && (
              <span className="text-xs text-[#B5ADA5]">
                <span className="text-[#8C8278] font-medium">Updated:</span> {formatDate(doc.modifiedTime)}
              </span>
            )}
          </div>
        </div>

        <span className="hidden sm:inline-flex text-xs text-[#8C8278] bg-[#F5F0E8] px-2 py-0.5 rounded-full border border-[#EDE7DA] flex-shrink-0 self-center">
          {TYPE_LABELS[doc.type]}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0 self-center">
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse preview' : 'Preview'}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Open in Drive */}
          <a
            href={doc.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Google Drive"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {/* Edit — Super Admin only */}
          {isSuperAdmin && (
            <button
              onClick={() => onEdit(doc)}
              title="Edit file name or folder"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          )}

          {/* Remove — Super Admin only */}
          {isSuperAdmin && (
            <button
              onClick={() => onRemove(doc.id)}
              title="Remove document"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="relative bg-[#F5F0E8]" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={doc.embedUrl}
            title={doc.title}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            allow="autoplay"
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      )}
    </div>
  );
}

// ─── Folder Group ─────────────────────────────────────────────────────────────
function FolderGroup({
  folderName,
  items,
  isSuperAdmin,
  onRemove,
  onEdit,
}: {
  folderName: string;
  items: DriveDoc[];
  isSuperAdmin: boolean;
  onRemove: (id: string) => void;
  onEdit: (doc: DriveDoc) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-[#FDFAF6] rounded-2xl border border-[#DDD5C8] overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-[#F5F0E8] border-b border-[#EDE7DA] hover:bg-[#EDE7DA] transition-colors"
      >
        <FolderIcon size={18} />
        <span className="flex-1 text-left text-sm font-bold text-[#3D3530]">{folderName}</span>
        <span className="text-xs text-[#8C8278] mr-1">{items.length} file{items.length !== 1 ? 's' : ''}</span>
        <svg
          className={`h-4 w-4 text-[#8C8278] transition-transform ${collapsed ? '-rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="divide-y divide-[#EDE7DA]">
          {items.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              isSuperAdmin={isSuperAdmin}
              onRemove={onRemove}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GoogleDriveDocuments({ isSuperAdmin }: GoogleDriveDocumentsProps) {
  const supabase = createClient();
  const [documents, setDocuments] = useState<DriveDoc[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [fileNameInput, setFileNameInput] = useState('');
  const [typeSelect, setTypeSelect] = useState<DocType>('auto');
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [editingDoc, setEditingDoc] = useState<DriveDoc | null>(null);

  // ── Load documents from Supabase ──
  const loadDocuments = useCallback(async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from('drive_documents')
      .select('*')
      .order('added_at', { ascending: true });

    if (!error && data) {
      setDocuments(
        data.map((row) => ({
          id: row.id,
          fileId: row.file_id,
          type: row.file_type as Exclude<DocType, 'auto'>,
          embedUrl: row.embed_url,
          originalUrl: row.original_url,
          title: row.title,
          folderName: row.folder_name,
          createdTime: row.created_time ?? undefined,
          modifiedTime: row.modified_time ?? undefined,
        }))
      );
    }
    setIsFetching(false);
  }, [supabase]);

  useEffect(() => {
    loadDocuments();

    // Real-time subscription — re-fetch whenever any row changes
    const channel = supabase
      .channel('drive_documents_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drive_documents' },
        () => {
          loadDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDocuments]);

  // ── Add document ──
  const handleAdd = async () => {
    setFormError(null);
    const rawUrl = urlInput.trim();

    if (!rawUrl) {
      setFormError('Please paste a Google Drive file share link.');
      return;
    }

    if (isFolderUrl(rawUrl)) {
      setFormError('Folder links are not supported. Please share an individual file link (right-click a file → Share → copy link).');
      return;
    }

    const fileId = extractFileId(rawUrl);
    if (!fileId) {
      setFormError("Could not find a file ID in that URL. Make sure it's a valid Google Drive file share link.");
      return;
    }

    if (documents.some((d) => d.fileId === fileId)) {
      setFormError('This file has already been added.');
      return;
    }

    setIsLoading(true);

    const meta = await fetchDriveFileMeta(fileId);

    let resolvedType: Exclude<DocType, 'auto'>;
    let title: string;
    let createdTime: string | undefined;
    let modifiedTime: string | undefined;

    if (meta) {
      resolvedType = typeSelect === 'auto' ? detectTypeFromMime(meta.mimeType) : typeSelect;
      title = fileNameInput.trim() || meta.name;
      createdTime = meta.createdTime;
      modifiedTime = meta.modifiedTime;
    } else {
      resolvedType = typeSelect === 'auto' ? detectTypeFromUrl(rawUrl) : typeSelect;
      title = fileNameInput.trim() || `Document ${documents.length + 1}`;
    }

    const embedUrl = buildEmbedUrl(fileId, resolvedType);
    const folderName = folderInput.trim() || DEFAULT_FOLDER;

    const { error } = await supabase.from('drive_documents').insert({
      file_id: fileId,
      file_type: resolvedType,
      embed_url: embedUrl,
      original_url: rawUrl,
      title,
      folder_name: folderName,
      created_time: createdTime ?? null,
      modified_time: modifiedTime ?? null,
    });

    if (error) {
      setFormError('Failed to save document. Please try again.');
    } else {
      await loadDocuments();
      setUrlInput('');
      setFolderInput('');
      setFileNameInput('');
      setTypeSelect('auto');
    }

    setIsLoading(false);
  };

  // ── Remove document ──
  const handleRemove = async (id: string) => {
    setFormError(null);
    // .select() lets us confirm a row was actually deleted. If RLS blocks the
    // delete it returns 0 rows — surface that instead of silently dropping it
    // from the UI while it lingers in the database.
    const { data, error } = await supabase
      .from('drive_documents')
      .delete()
      .eq('id', id)
      .select('id');

    if (error || !data || data.length === 0) {
      setFormError('Could not remove the document — only a Super Admin can remove documents.');
      await loadDocuments();
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // ── Edit document (save) ──
  const handleEditSave = async (id: string, title: string, folderName: string) => {
    const { error } = await supabase
      .from('drive_documents')
      .update({ title, folder_name: folderName, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title, folderName } : d))
    );
  };

  // Group documents by folder name
  const grouped = documents.reduce<Record<string, DriveDoc[]>>((acc, doc) => {
    const folder = doc.folderName || DEFAULT_FOLDER;
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(doc);
    return acc;
  }, {});

  const folderNames = Object.keys(grouped).sort((a, b) =>
    a === DEFAULT_FOLDER ? 1 : b === DEFAULT_FOLDER ? -1 : a.localeCompare(b)
  );

  return (
    <div className="space-y-6">
      {/* Edit Modal */}
      {editingDoc && (
        <EditModal
          doc={editingDoc}
          onSave={handleEditSave}
          onClose={() => setEditingDoc(null)}
        />
      )}

      {/* ── Add Document Form — Super Admin only ── */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-[#DDD5C8] p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 87.3 78" fill="none">
              <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
              <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 49.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00AC47"/>
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#EA4335"/>
              <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832D"/>
              <path d="M59.8 54H27.5L13.75 77.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684FC"/>
              <path d="M73.4 26.5l-12.6-21.8c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 54h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00"/>
            </svg>
            <h3 className="text-sm font-bold text-[#1A1612]">Add a Google Drive File</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">
                File Share Link <span className="text-[#C4622D]">*</span>
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="https://docs.google.com/…"
                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Group / Folder Label <span className="text-[#B5ADA5] font-normal">(optional)</span></label>
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Contracts"
                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">File Name <span className="text-[#B5ADA5] font-normal">(optional — overrides Google Drive name)</span></label>
            <input
              type="text"
              value={fileNameInput}
              onChange={(e) => setFileNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. House Rules 2026"
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="w-44">
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">File Type</label>
              <select
                value={typeSelect}
                onChange={(e) => setTypeSelect(e.target.value as DocType)}
                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors bg-white"
              >
                <option value="auto">Auto-detect</option>
                <option value="doc">Google Doc</option>
                <option value="sheet">Google Sheet</option>
                <option value="slide">Google Slides</option>
                <option value="pdf">PDF</option>
                <option value="video">Video</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button
              onClick={handleAdd}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Fetching…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add File
                </>
              )}
            </button>
          </div>

          {formError && (
            <p className="mt-2.5 text-xs text-red-600 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {formError}
            </p>
          )}

          <p className="mt-3 text-xs text-[#B5ADA5]">
            In Google Drive: right-click an <strong>individual file</strong> → <strong>Share</strong> → <em>Anyone with the link</em> → <strong>Viewer</strong> → copy the link and paste it above. Folder links are not supported.
          </p>
        </div>
      )}

      {/* ── Documents grouped by folder ── */}
      {isFetching ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-[#DDD5C8]">
          <svg className="h-8 w-8 animate-spin text-[#C4622D] mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          <p className="text-sm text-[#8C8278]">Loading documents…</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-[#DDD5C8]">
          <div className="flex justify-center mb-3">
            <svg className="h-10 w-10 text-[#DDD5C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#8C8278]">No documents added yet</p>
          <p className="text-xs text-[#B5ADA5] mt-1">
            {isSuperAdmin
              ? 'Paste a public Google Drive file link above to add a document.'
              : 'No documents have been shared yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {folderNames.map((folder) => (
            <FolderGroup
              key={folder}
              folderName={folder}
              items={grouped[folder]}
              isSuperAdmin={isSuperAdmin}
              onRemove={handleRemove}
              onEdit={setEditingDoc}
            />
          ))}
        </div>
      )}
    </div>
  );
}
