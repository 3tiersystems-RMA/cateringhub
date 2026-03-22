'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type DocType = 'auto' | 'doc' | 'sheet' | 'slide' | 'pdf' | 'video';

interface DriveDoc {
  fileId: string;
  type: Exclude<DocType, 'auto'>;
  embedUrl: string;
  originalUrl: string;
  title: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<Exclude<DocType, 'auto'>, string> = {
  doc: 'Google Doc',
  sheet: 'Google Sheet',
  slide: 'Google Slides',
  pdf: 'PDF',
  video: 'Video',
};

const TYPE_COLORS: Record<Exclude<DocType, 'auto'>, { bg: string; text: string; border: string }> = {
  doc:   { bg: '#EBF3FF', text: '#2B579A', border: '#BDD3F5' },
  sheet: { bg: '#E8F5EE', text: '#217346', border: '#B2DFC4' },
  slide: { bg: '#FFF0EB', text: '#D24726', border: '#F5C4B2' },
  pdf:   { bg: '#FDF6F0', text: '#C4622D', border: '#EDD5C0' },
  video: { bg: '#F3F0FF', text: '#6B46C1', border: '#D4C8F5' },
};

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
  return 'doc';
}

function buildEmbedUrl(fileId: string, type: Exclude<DocType, 'auto'>): string {
  switch (type) {
    case 'doc':   return `https://docs.google.com/document/d/${fileId}/preview`;
    case 'sheet': return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    case 'slide': return `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`;
    case 'pdf': case'video':
    default:      return `https://drive.google.com/file/d/${fileId}/preview`;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: Exclude<DocType, 'auto'> }) {
  const c = TYPE_COLORS[type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

function DocCard({
  doc,
  index,
  onRemove,
}: {
  doc: DriveDoc;
  index: number;
  onRemove: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-[#DDD5C8] overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#FDFAF6] border-b border-[#EDE7DA]">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Drive icon */}
          <svg className="h-4 w-4 flex-shrink-0 text-[#C4622D]" viewBox="0 0 87.3 78" fill="currentColor">
            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
            <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 49.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00AC47"/>
            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#EA4335"/>
            <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832D"/>
            <path d="M59.8 54H27.5L13.75 77.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684FC"/>
            <path d="M73.4 26.5l-12.6-21.8c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 54h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00"/>
          </svg>
          <span className="text-sm font-semibold text-[#1A1612] truncate">{doc.title}</span>
          <TypeBadge type={doc.type} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse' : 'Expand'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
          >
            <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {/* Open in Drive */}
          <a
            href={doc.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Google Drive"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-[#C4622D] hover:bg-[#FDF6F0] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          {/* Remove */}
          <button
            onClick={() => onRemove(index)}
            title="Remove document"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8C8278] hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Iframe embed */}
      {expanded && (
        <div className="relative bg-[#F5F0E8]" style={{ paddingBottom: '62.5%' }}>
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

      {/* Collapsed hint */}
      {!expanded && (
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs text-[#B5ADA5]">Publicly shared via Google Drive</span>
          <button
            onClick={() => setExpanded(true)}
            className="text-xs font-semibold text-[#C4622D] hover:underline"
          >
            Preview ↓
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GoogleDriveDocuments() {
  const [documents, setDocuments] = useState<DriveDoc[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
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

    setDocuments((prev) => [
      ...prev,
      { fileId, type: resolvedType, embedUrl, originalUrl: rawUrl, title },
    ]);

    setUrlInput('');
    setTitleInput('');
    setTypeSelect('auto');
  };

  const handleRemove = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* ── Add Document Form ── */}
      <div className="bg-white rounded-2xl border border-[#DDD5C8] p-5">
        <div className="flex items-center gap-2 mb-4">
          {/* Google Drive colour icon */}
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

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_140px_auto] gap-3 items-end">
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

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Label (optional)</label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Q1 Menu"
              className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-[#5C5347] mb-1.5">Type</label>
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
            </select>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors whitespace-nowrap"
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

      {/* ── Document Cards ── */}
      {documents.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-[#DDD5C8]">
          <div className="flex justify-center mb-3">
            <svg className="h-10 w-10 text-[#DDD5C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#8C8278]">No documents added yet</p>
          <p className="text-xs text-[#B5ADA5] mt-1">Paste a public Google Drive link above to embed a document here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8C8278] uppercase tracking-wide">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
          </div>
          {documents.map((doc, i) => (
            <DocCard key={`${doc.fileId}-${i}`} doc={doc} index={i} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
