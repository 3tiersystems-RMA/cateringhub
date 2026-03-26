'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_date_to: string | null;
  location: string | null;
  image_path: string | null;
  is_published: boolean;
  imageUrl?: string;
}

function EventsContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'past'>(
    tabParam === 'past' ? 'past' : 'current'
  );

  useEffect(() => {
    if (tabParam === 'past') setActiveTab('past');
    else setActiveTab('current');
  }, [tabParam]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .order('event_date', { ascending: false });

    if (!error && data) {
      const withUrls = await Promise.all(
        data.map(async (ev: Event) => {
          if (ev.image_path) {
            const { data: urlData } = await supabase.storage
              .from('event-photos')
              .createSignedUrl(ev.image_path, 3600);
            return { ...ev, imageUrl: urlData?.signedUrl };
          }
          return ev;
        })
      );
      setEvents(withUrls);
    }
    setLoading(false);
  };

  const now = new Date();
  const currentEvents = events.filter((e) => new Date(e.event_date) >= now);
  const pastEvents = events.filter((e) => new Date(e.event_date) < now);
  const displayedEvents = activeTab === 'current' ? currentEvents : pastEvents;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateRange = (from: string, to: string | null) => {
    const fromDate = formatDateShort(from);
    if (!to) return fromDate;
    const toNorm = to.slice(0, 10);
    const fromNorm = from.slice(0, 10);
    if (toNorm === fromNorm) return fromDate;
    return `${fromDate} – ${formatDateShort(to)}`;
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-ZA', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="pt-28 pb-12 bg-black text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8 text-center">
          <p className="text-[#C4622D] text-sm font-semibold uppercase tracking-widest mb-3">
            What&apos;s On
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Events</h1>
          <p className="text-[#A09890] text-lg max-w-xl mx-auto">
            Discover our upcoming events and browse past highlights from Cardamom Kitchen.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 w-full mt-8">
        <div className="flex gap-1 bg-white border border-[#EDE7DA] rounded-2xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'current' ?'bg-[#C4622D] text-white shadow-sm' :'text-[#5C5347] hover:text-[#C4622D]'
            }`}
          >
            Current Events
            {currentEvents.length > 0 && (
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === 'current' ?'bg-white/20 text-white' :'bg-[#F5F0E8] text-[#C4622D]'
                }`}
              >
                {currentEvents.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'past' ?'bg-[#C4622D] text-white shadow-sm' :'text-[#5C5347] hover:text-[#C4622D]'
            }`}
          >
            Past Events
            {pastEvents.length > 0 && (
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === 'past' ?'bg-white/20 text-white' :'bg-[#F5F0E8] text-[#C4622D]'
                }`}
              >
                {pastEvents.length}
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Events Grid */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 w-full py-8 flex-1">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedEvents.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-5xl">🗓️</span>
            <h3 className="text-xl font-bold text-[#1A1612] mt-4 mb-2">
              {activeTab === 'current' ? 'No Upcoming Events' : 'No Past Events'}
            </h3>
            <p className="text-[#8C8278] text-sm">
              {activeTab === 'current' ?'Check back soon for upcoming events from Cardamom Kitchen.' :'Past events will appear here once they have concluded.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedEvents.map((ev) => (
              <div
                key={ev.id}
                className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image */}
                <div className="h-48 bg-[#F5F0E8] flex items-center justify-center overflow-hidden">
                  {ev.imageUrl ? (
                    <img
                      src={ev.imageUrl}
                      alt={ev.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl">🗓️</span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  {activeTab === 'past' && (
                    <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 mb-3">
                      Past Event
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-[#1A1612] mb-2">{ev.title}</h3>
                  {ev.description && (
                    <p className="text-sm text-[#5C5347] mb-4 line-clamp-3">{ev.description}</p>
                  )}

                  <div className="space-y-2 border-t border-[#F0EBE3] pt-3">
                    <div className="flex items-center gap-2 text-sm text-[#5C5347]">
                      <svg className="w-4 h-4 text-[#C4622D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDateRange(ev.event_date, ev.event_date_to)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#5C5347]">
                      <svg className="w-4 h-4 text-[#C4622D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {ev.event_date_to && ev.event_date_to.slice(0, 10) !== ev.event_date.slice(0, 10) ? (
                        <span>{formatTime(ev.event_date)} – {formatTime(ev.event_date_to)}</span>
                      ) : (
                        <span>{formatTime(ev.event_date)}</span>
                      )}
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-2 text-sm text-[#5C5347]">
                        <svg className="w-4 h-4 text-[#C4622D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{ev.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      <Header />
      <Suspense fallback={
        <div className="flex justify-center py-40">
          <div className="w-10 h-10 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <EventsContent />
      </Suspense>
      <Footer />
    </div>
  );
}
