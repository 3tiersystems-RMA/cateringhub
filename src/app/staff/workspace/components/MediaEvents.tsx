'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_date_to: string | null;
  location: string | null;
  image_path: string | null;
  image_url: string | null;
  is_published: boolean;
  cost: number | null;
  enrollment_url: string | null;
  event_menu: string | null;
  resolvedImageUrl?: string;
}

interface MediaEventsProps {
  userRole?: string;
}

function formatEventDate(dateStr: string, dateToStr?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  const from = new Date(dateStr).toLocaleDateString('en-ZA', opts);
  if (dateToStr) {
    const to = new Date(dateToStr).toLocaleDateString('en-ZA', opts);
    return `${from} – ${to}`;
  }
  return from;
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event }: { event: Event }) {
  const imgSrc = event.resolvedImageUrl || event.image_url;

  return (
    <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="h-44 bg-[#F5EFE8] flex items-center justify-center overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#C4A882]">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        {/* Published badge */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
              event.is_published
                ? 'bg-green-50 text-green-700 border-green-200' :'bg-[#F5EFE8] text-[#8C8278] border-[#DDD5C8]'
            }`}
          >
            {event.is_published ? 'Published' : 'Draft'}
          </span>
          {event.cost != null && (
            <span className="text-xs font-semibold text-[#C4622D]">
              R{Number(event.cost).toFixed(2)}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-[#1A1612] leading-snug line-clamp-2">{event.title}</h3>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-xs text-[#5C5347]">
          <svg className="w-3.5 h-3.5 text-[#C4622D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          <span>{formatEventDate(event.event_date, event.event_date_to)}</span>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-1.5 text-xs text-[#5C5347]">
            <svg className="w-3.5 h-3.5 text-[#C4622D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="line-clamp-1">{event.location}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p className="text-xs text-[#8C8278] line-clamp-2 leading-relaxed">{event.description}</p>
        )}

        {/* Enrollment link */}
        {event.enrollment_url && (
          <a
            href={event.enrollment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#C4622D] hover:underline"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Enrol
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MediaEvents({ userRole }: MediaEventsProps) {
  const supabase = createClient();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'draft'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchEvents = async () => {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });

    if (fetchError) {
      setError('Failed to load events: ' + fetchError.message);
      setLoading(false);
      return;
    }

    // Resolve signed URLs for image_path entries
    const withUrls = await Promise.all(
      (data ?? []).map(async (ev: Event) => {
        if (ev.image_path) {
          const { data: urlData } = await supabase.storage
            .from('event-photos')
            .createSignedUrl(ev.image_path, 3600);
          return { ...ev, resolvedImageUrl: urlData?.signedUrl ?? undefined };
        }
        return ev;
      })
    );

    setEvents(withUrls);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // ─── Filtering ──────────────────────────────────────────────────────────────
  const filtered = events.filter((ev) => {
    const matchSearch =
      !search ||
      ev.title.toLowerCase().includes(search.toLowerCase()) ||
      (ev.location ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (ev.description ?? '').toLowerCase().includes(search.toLowerCase());

    const matchPublished =
      filterPublished === 'all' ||
      (filterPublished === 'published' && ev.is_published) ||
      (filterPublished === 'draft' && !ev.is_published);

    return matchSearch && matchPublished;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1A1612]">Events</h2>
          <p className="text-xs text-[#8C8278] mt-0.5">
            {events.length} event{events.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDD5C8] text-xs font-semibold text-[#5C5347] hover:border-[#C4622D] hover:text-[#C4622D] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8278]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            className="w-full pl-9 pr-3 py-2 border border-[#DDD5C8] rounded-xl text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
          />
        </div>

        {/* Published filter */}
        <div className="flex rounded-xl border border-[#DDD5C8] overflow-hidden">
          {(['all', 'published', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterPublished(f)}
              className={`px-3 py-2 text-xs font-semibold transition-colors capitalize ${
                filterPublished === f
                  ? 'bg-[#C4622D] text-white'
                  : 'text-[#5C5347] hover:bg-[#F5EFE8]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl border border-[#DDD5C8] overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 transition-colors ${viewMode === 'grid' ? 'bg-[#C4622D] text-white' : 'text-[#5C5347] hover:bg-[#F5EFE8]'}`}
            title="Grid view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 transition-colors ${viewMode === 'list' ? 'bg-[#C4622D] text-white' : 'text-[#5C5347] hover:bg-[#F5EFE8]'}`}
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#8C8278]">Loading events…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-12 h-12 text-[#C4A882] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          <p className="text-sm font-semibold text-[#5C5347]">
            {search || filterPublished !== 'all' ? 'No events match your filters' : 'No events found'}
          </p>
          {(search || filterPublished !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterPublished('all'); }}
              className="mt-2 text-xs text-[#C4622D] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="space-y-3">
          {filtered.map((ev) => {
            const imgSrc = ev.resolvedImageUrl || ev.image_url;
            return (
              <div
                key={ev.id}
                className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex gap-4 items-start hover:shadow-sm transition-shadow"
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-xl bg-[#F5EFE8] flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={ev.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <svg className="w-7 h-7 text-[#C4A882]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#1A1612] leading-snug line-clamp-1">{ev.title}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ev.cost != null && (
                        <span className="text-xs font-semibold text-[#C4622D]">R{Number(ev.cost).toFixed(2)}</span>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          ev.is_published
                            ? 'bg-green-50 text-green-700 border-green-200' :'bg-[#F5EFE8] text-[#8C8278] border-[#DDD5C8]'
                        }`}
                      >
                        {ev.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1 text-xs text-[#5C5347]">
                      <svg className="w-3.5 h-3.5 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                      </svg>
                      {formatEventDate(ev.event_date, ev.event_date_to)}
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-1 text-xs text-[#5C5347]">
                        <svg className="w-3.5 h-3.5 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        {ev.location}
                      </div>
                    )}
                  </div>

                  {ev.description && (
                    <p className="text-xs text-[#8C8278] line-clamp-1">{ev.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
