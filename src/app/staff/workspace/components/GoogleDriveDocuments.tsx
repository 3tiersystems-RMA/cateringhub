'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type DocType = 'auto' | 'doc' | 'sheet' | 'slide' | 'pdf' | 'video' | 'other';

interface DriveDoc {
  fileId: string;
  type: Exclude<DocType, 'auto'>;
  embedUrl: string;
  originalUrl: string;
  title: string;
  folderName: string;
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

function detectType(url: string): Exclude<DocType, 'auto'> {
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

// ─── DocRow (compact list item) ───────────────────────────────────────────────
function DocRow({
  doc,
  index,
  isSuperAdmin,
  onRemove,
}: {
  doc: DriveDoc;
  index: number;
  isSuperAdmin: boolean;
  onRemove: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-[#EDE7DA] overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* File type icon */}
        <div className="flex-shrink-0">
          <FileTypeIcon type={doc.type} size={22} />
        </div>

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-[#1A1612] truncate">{doc.title}</span>

        {/* Type label */}
        <span className="hidden sm:inline-flex text-xs text-[#8C8278] bg-[#F5F0E8] px-2 py-0.5 rounded-full border border-[#EDE7DA] flex-shrink-0">
          {TYPE_LABELS[doc.type]}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
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

          {/* Remove — Super Admin only */}
          {isSuperAdmin && (
            <button
              onClick={() => onRemove(index)}
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

      {/* Iframe preview */}
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GoogleDriveDocuments({ isSuperAdmin }: GoogleDriveDocumentsProps) {
  const [documents, setDocuments] = useState<DriveDoc[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [typeSelect, setTypeSelect] = useState<DocType>('auto');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = () => {
    setFormError(null);
    const rawUrl = urlInput.trim();

    if (!rawUrl) {
      setFormError('Please paste a Google Drive share link.');
      return;
    }

    const fileId = extractFileId(rawUrl);
    if (!fileId) {
      setFormError("Could not find a file ID in that URL. Make sure it's a valid Google Drive share link.");
      return;
    }

    const resolvedType = typeSelect === 'auto' ? detectType(rawUrl) : typeSelect;
    const embedUrl = buildEmbedUrl(fileId, resolvedType);
    const title = titleInput.trim() || `Document ${documents.length + 1}`;
    const folderName = folderInput.trim() || DEFAULT_FOLDER;

    setDocuments((prev) => [
      ...prev,
      { fileId, type: resolvedType, embedUrl, originalUrl: rawUrl, title, folderName },
    ]);

    setUrlInput('');
    setTitleInput('');
    setFolderInput('');
    setTypeSelect('auto');
  };

  const handleRemove = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Group documents by folder name
  const grouped = documents.reduce<Record<string, { doc: DriveDoc; originalIndex: number }[]>>(
    (acc, doc, i) => {
      const folder = doc.folderName || DEFAULT_FOLDER;
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push({ doc, originalIndex: i });
      return acc;
    },
    {}
  );

  const folderNames = Object.keys(grouped).sort((a, b) =>
    a === DEFAULT_FOLDER ? 1 : b === DEFAULT_FOLDER ? -1 : a.localeCompare(b)
  );

  return (
    <div className="space-y-6">
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
            <h3 className="text-sm font-bold text-[#1A1612]">Add a Google Drive Document</h3>
          </div>

          {/* Row 1: URL + Label + Folder */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_160px] gap-3 mb-3">
            {/* URL */}
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Share Link <span className="text-[#C4622D]">*</span></label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="https://docs.google.com/…"
                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
              />
            </div>
            {/* Label */}
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">File Label (optional)</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Q1 Menu"
                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
              />
            </div>
            {/* Folder */}
            <div>
              <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Folder Name (optional)</label>
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

          {/* Row 2: Type + Add button */}
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
              className="flex items-center gap-1.5 bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors whitespace-nowrap"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          {/* Error */}
          {formError && (
            <p className="mt-2.5 text-xs text-red-600 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {formError}
            </p>
          )}

          {/* Hint */}
          <p className="mt-3 text-xs text-[#B5ADA5]">
            In Google Drive: right-click a file → <strong>Share</strong> → <em>Anyone with the link</em> → <strong>Viewer</strong> → copy the link and paste it above. No API key required.
          </p>
        </div>
      )}

      {/* ── Documents grouped by folder ── */}
      {documents.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-[#DDD5C8]">
          <div className="flex justify-center mb-3">
            <svg className="h-10 w-10 text-[#DDD5C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#8C8278]">No documents added yet</p>
          <p className="text-xs text-[#B5ADA5] mt-1">
            {isSuperAdmin
              ? 'Paste a public Google Drive link above to add a document.'
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
            />
          ))}
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
}: {
  folderName: string;
  items: { doc: DriveDoc; originalIndex: number }[];
  isSuperAdmin: boolean;
  onRemove: (i: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-[#FDFAF6] rounded-2xl border border-[#DDD5C8] overflow-hidden">
      {/* Folder header */}
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

      {/* File list */}
      {!collapsed && (
        <div className="divide-y divide-[#EDE7DA]">
          {items.map(({ doc, originalIndex }) => (
            <DocRow
              key={`${doc.fileId}-${originalIndex}`}
              doc={doc}
              index={originalIndex}
              isSuperAdmin={isSuperAdmin}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
