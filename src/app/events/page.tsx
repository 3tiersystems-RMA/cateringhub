'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { resolveEnrollmentUrl, resolveCheckoutFee } from '@/lib/event-management-sync';
import { buildCookingClassEnrollmentUrl } from '@/lib/cooking-class-params';
import { COOKING_CLASS_TABLES } from '@/lib/cooking-class-db';
import { DEFAULT_REGISTERED_EVENT_BADGE } from '@/lib/marketing-events-db';

type OfferingType = 'event' | 'class';

/** Shared pill styles — high contrast on busy flyer photos */
const CARD_BADGE_PILL =
  'inline-flex items-center font-bold rounded-full shadow-lg ring-2 ring-white/90 backdrop-blur-[2px]';
const EVENT_CATEGORY_BADGE = `${CARD_BADGE_PILL} bg-[#C4622D] text-white text-xs px-3 py-1 tracking-wide`;
const EVENT_TAG_BADGE = `${CARD_BADGE_PILL} bg-white text-[#1A1612] text-[10px] px-2.5 py-1 uppercase tracking-wide`;
const CLASS_CATEGORY_BADGE = `${CARD_BADGE_PILL} bg-[#1E40AF] text-white text-xs px-3 py-1 tracking-wide`;
const CLASS_TAG_BADGE = `${CARD_BADGE_PILL} bg-[#FFF8F4] text-[#A04E22] text-[10px] px-2.5 py-1 border border-[#F0D5C4] uppercase tracking-wide`;

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
  is_registered: boolean;
  cost: number | null;
  enrollment_url: string | null;
  event_menu: string | null;
  event_management_event_id: string | null;
  event_management_session_id: string | null;
  imageUrl?: string;
  /** 'class' = a Cooking & Baking Class surfaced from cooking_class_* tables. */
  offering_type?: OfferingType;
  /** Audience tag for class cards: derived from the class name. */
  audience?: 'kids' | 'adults' | 'mixed';
  /** MIXED classes: per-child fee (adult/guardian fee is `cost`). */
  child_cost?: number | null;
  /** Optional instructor/chef name (provision). */
  instructor?: string | null;
  /** Class-level menu items (from cooking_classes.menu_items). */
  menu_items?: string[] | null;
  /** Class-level menu note (from cooking_classes.menu_note). */
  menu_note?: string | null;
  /** Badge label for marketing event cards (from events.badge). */
  badge?: string | null;
  /** Tag pills for marketing event or class cards. */
  tags?: string[] | null;
  /** Optional splash banner overlay text shown on the event card. */
  splash_banner_text?: string | null;
  /** True when seating capacity is reached (auto-computed from booking counts). */
  isFullyBooked?: boolean;
  /** True when the session status is 'Bookings Close'. */
  isBookingsClose?: boolean;
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
  const [offeringFilter, setOfferingFilter] = useState<'all' | 'events' | 'classes'>('all');

  useEffect(() => {
    if (tabParam === 'past') setActiveTab('past');
    else setActiveTab('current');
  }, [tabParam]);

  useEffect(() => {
    loadEvents();
  }, []);

  // Build "Cooking Class" cards straight from the cooking_class_* tables so every
  // active class with a scheduled date is automatically discoverable on /events —
  // mirroring how Events are surfaced, but without a separate marketing table.
  const loadClassCards = async (): Promise<Event[]> => {
    try {
      const results = await Promise.all([
        supabase.from(COOKING_CLASS_TABLES.classes).select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from(COOKING_CLASS_TABLES.sessions).select('*'),
        supabase.from(COOKING_CLASS_TABLES.sessionStatuses).select('id, label'),
        supabase.from(COOKING_CLASS_TABLES.settings).select('*').limit(1).single(),
        supabase.from(COOKING_CLASS_TABLES.bookingCounts).select('event_date_id, registration_id'),
      ]);
      const classEvents = results[0].data;
      const dates = results[1].data;
      const statuses = results[2].data;
      const classSettings = results[3].data;
      const rawBookingCounts = results[4].data ?? [];

      if (!classEvents || classEvents.length === 0) return [];

      const statusLabelById = new Map<string, string>(
        (statuses ?? []).map((s: { id: string; label: string | null }) => [s.id, (s.label ?? '').toLowerCase()])
      );
      const defaultFee = Number(classSettings?.class_fee ?? 0) || 0;
      const flyerUrl =
        classSettings?.flyer_image_url ||
        (classSettings?.flyer_image_path
          ? supabase.storage.from('cooking-class-flyers').getPublicUrl(classSettings.flyer_image_path).data?.publicUrl
          : null) ||
        undefined;
      const today = new Date().toISOString().slice(0, 10);

      // Build a map: session_id → count of unique paid registrations
      // We count distinct registration_id per event_date_id as a proxy for participant count
      const sessionBookingMap = new Map<string, number>();
      for (const row of rawBookingCounts as Array<{ event_date_id: string; registration_id: string }>) {
        sessionBookingMap.set(row.event_date_id, (sessionBookingMap.get(row.event_date_id) ?? 0) + 1);
      }

      const cards: Event[] = [];
      for (const ce of classEvents as Array<{ id: string; name: string; instructor?: string | null; image_url?: string | null; image_path?: string | null; menu_items?: string[] | null; menu_note?: string | null }>) {
        const sessions = (dates ?? [])
          .filter((d: { class_id: string | null; event_date: string | null; status_id: string | null }) =>
            d.class_id === ce.id && !!d.event_date && statusLabelById.get(d.status_id ?? '') !== 'cancelled'
          )
          .sort((a: { event_date: string }, b: { event_date: string }) => (a.event_date < b.event_date ? -1 : 1));
        if (sessions.length === 0) continue;

        const upcoming = sessions.filter((s: { event_date: string }) => s.event_date >= today);
        const chosen = (upcoming[0] ?? sessions[sessions.length - 1]) as {
          id: string; event_date: string; start_time: string | null; end_time: string | null; location: string | null; class_fee: number | null; child_fee: number | null;
        };
        const start = (chosen.start_time ?? '00:00').slice(0, 5);
        const end = (chosen.end_time ?? chosen.start_time ?? '00:00').slice(0, 5);
        const fee = resolveCheckoutFee(defaultFee, chosen.class_fee != null ? Number(chosen.class_fee) : null);
        const lname = ce.name.toLowerCase();
        const audience: 'kids' | 'adults' | 'mixed' = lname.includes('mixed') ? 'mixed' : lname.includes('adult') ? 'adults' : 'kids';
        // MIXED: guardian/adult pays `fee`, each child pays child_fee (falls back to fee).
        const childFee = audience === 'mixed'
          ? (chosen.child_fee != null && Number(chosen.child_fee) > 0 ? Number(chosen.child_fee) : fee)
          : null;
        const instructor = ce.instructor && ce.instructor.trim() ? ce.instructor.trim() : null;

        // Determine if the chosen (next upcoming) session is fully booked
        const sessionSeating = (chosen as { seating?: number | null }).seating ?? 0;
        const sessionBooked = sessionBookingMap.get(chosen.id) ?? 0;
        const statusLabel = statusLabelById.get((chosen as { status_id?: string | null }).status_id ?? '') ?? '';
        const isFullyBooked =
          statusLabel === 'fully booked' ||
          (sessionSeating > 0 && sessionBooked >= sessionSeating);
        const isBookingsClose = statusLabel.toLowerCase() === 'bookings closed';

        // Resolve image: per-event image takes priority over global flyer
        const eventImageUrl =
          ce.image_url ||
          (ce.image_path
            ? supabase.storage.from('cooking-class-flyers').getPublicUrl(ce.image_path).data?.publicUrl
            : null) ||
          flyerUrl ||
          undefined;

        const descParts: string[] = [];
        if (instructor) descParts.push(`With ${instructor}.`);
        if (upcoming.length > 1) descParts.push(`${upcoming.length} sessions available — choose your dates when registering.`);

        cards.push({
          id: `class-${ce.id}`,
          title: ce.name,
          description: descParts.length ? descParts.join(' ') : null,
          event_date: `${chosen.event_date}T${start}`,
          event_date_to: `${chosen.event_date}T${end}`,
          location: chosen.location,
          image_path: null,
          image_url: eventImageUrl ?? null,
          is_published: true,
          is_registered: true,
          cost: fee > 0 ? fee : null,
          enrollment_url: buildCookingClassEnrollmentUrl(ce.id, chosen.id),
          event_menu: null,
          event_management_event_id: null,
          event_management_session_id: null,
          imageUrl: eventImageUrl,
          offering_type: 'class',
          audience,
          child_cost: childFee,
          instructor,
          menu_items: ce.menu_items ?? null,
          menu_note: ce.menu_note ?? null,
          badge: (ce as { badge?: string | null }).badge ?? null,
          tags: (ce as { tags?: string[] | null }).tags ?? null,
          isFullyBooked,
          isBookingsClose,
        });
      }
      return cards;
    } catch (e) {
      console.error('Failed to load cooking class cards:', e);
      return [];
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    const [eventsResult, classCards] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('is_published', true)
        .order('event_date', { ascending: false }),
      loadClassCards(),
    ]);
    const data = eventsResult.data;
    const error = eventsResult.error;

    if (!error && data) {
      // Collect all image_path values that need signed URLs
      const pathsToSign = data
        .map((ev: Event) => ev.image_path)
        .filter((p): p is string => !!p);

      let signedUrlMap: Record<string, string> = {};

      if (pathsToSign.length > 0) {
        try {
          const res = await fetch('/api/events/signed-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: pathsToSign }),
          });
          if (res.ok) {
            const json = await res.json();
            signedUrlMap = json.urls ?? {};
          }
        } catch (e) {
          console.error('Failed to fetch signed URLs:', e);
        }
      }

      // Fetch event management booking counts to determine fully booked status for event cards
      const eventMgmtSessionIds = data
        .map((ev: Event) => ev.event_management_session_id)
        .filter((id): id is string => !!id);

      let eventMgmtFullyBookedIds = new Set<string>();
      if (eventMgmtSessionIds.length > 0) {
        try {
          const [datesRes, bookingsRes, statusesRes] = await Promise.all([
            supabase
              .from('event_management_event_dates')
              .select('id, seating, status_id')
              .in('id', eventMgmtSessionIds),
            supabase
              .from('event_management_booking_counts')
              .select('event_date_id, registration_id')
              .in('event_date_id', eventMgmtSessionIds),
            supabase
              .from('event_management_session_statuses')
              .select('id, label'),
          ]);
          const datesData = datesRes.data ?? [];
          const bookingsData = bookingsRes.data ?? [];
          const statusesData = (statusesRes.data ?? []) as Array<{ id: string; label: string }>;

          const statusLabelByIdEvt = new Map<string, string>(
            statusesData.map(s => [s.id, (s.label ?? '').toLowerCase()])
          );

          // Count bookings per session
          const bookingCountMap = new Map<string, number>();
          for (const b of bookingsData as Array<{ event_date_id: string; registration_id: string }>) {
            bookingCountMap.set(b.event_date_id, (bookingCountMap.get(b.event_date_id) ?? 0) + 1);
          }

          for (const d of datesData as Array<{ id: string; seating: number | null; status_id: string | null }>) {
            const seating = d.seating ?? 0;
            const booked = bookingCountMap.get(d.id) ?? 0;
            if (seating > 0 && booked >= seating) {
              eventMgmtFullyBookedIds.add(d.id);
            }
          }

          // Build a set of session IDs whose status is 'bookings closed'
          const eventMgmtBookingsClosedIds = new Set<string>(
            (datesData as Array<{ id: string; status_id: string | null }>)
              .filter(d => statusLabelByIdEvt.get(d.status_id ?? '') === 'bookings closed')
              .map(d => d.id)
          );

          const withUrls = data.map((ev: Event) => {
            const isFullyBooked = ev.event_management_session_id
              ? eventMgmtFullyBookedIds.has(ev.event_management_session_id)
              : false;
            const isBookingsClose = !isFullyBooked && ev.event_management_session_id
              ? eventMgmtBookingsClosedIds.has(ev.event_management_session_id)
              : false;
            if (ev.image_path && signedUrlMap[ev.image_path]) {
              return { ...ev, imageUrl: signedUrlMap[ev.image_path], offering_type: 'event' as const, isFullyBooked, isBookingsClose };
            }
            if (ev.image_url) {
              return { ...ev, imageUrl: ev.image_url, offering_type: 'event' as const, isFullyBooked, isBookingsClose };
            }
            return { ...ev, offering_type: 'event' as const, isFullyBooked, isBookingsClose };
          });

          setEvents([...withUrls, ...classCards]);
        } catch (e) {
          console.error('Failed to fetch event management booking counts:', e);
          // Fall back: map without status
          const withUrls = data.map((ev: Event) => {
            const isFullyBooked = false;
            if (ev.image_path && signedUrlMap[ev.image_path]) {
              return { ...ev, imageUrl: signedUrlMap[ev.image_path], offering_type: 'event' as const, isFullyBooked };
            }
            if (ev.image_url) {
              return { ...ev, imageUrl: ev.image_url, offering_type: 'event' as const, isFullyBooked };
            }
            return { ...ev, offering_type: 'event' as const, isFullyBooked };
          });
          setEvents([...withUrls, ...classCards]);
        }
        setLoading(false);
        return;
      }

      const withUrls = data.map((ev: Event) => {
        const isFullyBooked = ev.event_management_session_id
          ? eventMgmtFullyBookedIds.has(ev.event_management_session_id)
          : false;
        if (ev.image_path && signedUrlMap[ev.image_path]) {
          return { ...ev, imageUrl: signedUrlMap[ev.image_path], offering_type: 'event' as const, isFullyBooked };
        }
        if (ev.image_url) {
          return { ...ev, imageUrl: ev.image_url, offering_type: 'event' as const, isFullyBooked };
        }
        return { ...ev, offering_type: 'event' as const, isFullyBooked };
      });

      setEvents([...withUrls, ...classCards]);
    } else {
      setEvents(classCards);
    }
    setLoading(false);
  };

  const now = new Date();
  const matchesOffering = (e: Event) =>
    offeringFilter === 'all'
      ? true
      : offeringFilter === 'classes'
      ? e.offering_type === 'class'
      : e.offering_type !== 'class';
  const currentEvents = events.filter((e) => new Date(e.event_date) >= now);
  const pastEvents = events.filter((e) => new Date(e.event_date) < now);
  const displayedEvents = (activeTab === 'current' ? currentEvents : pastEvents).filter(matchesOffering);

  const formatDateOnly = (from: string) => {
    try {
      const d = new Date(from);
      if (Number.isNaN(d.getTime())) return from;
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const weekday = dayNames[d.getDay()];
      const day = String(d.getDate()).padStart(2, '0');
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${weekday}, ${day} ${month} ${year}`;
    } catch {
      return from;
    }
  };

  const areSameUTCDate = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();

  const formatDateRange = (from: string, to: string | null) => {
    const fromLabel = formatDateOnly(from);
    if (!to) return fromLabel;
    try {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return fromLabel;
      if (areSameUTCDate(fromDate, toDate)) return fromLabel;
      return `${fromLabel} – ${formatDateOnly(to)}`;
    } catch {
      return fromLabel;
    }
  };

  /**
   * Extract HH:MM for SAST from ISO-ish timestamp strings.
   * Keeps output stable across client environments by validating parse
   * and handling UTC / offset / local datetime forms explicitly.
   */
  const extractSASTTime = (isoString: string): string => {
    try {
      if (!isoString?.trim()) return '';

      // Treat timezone-less datetime values as already-local event time.
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(isoString)) {
        return isoString.slice(11, 16);
      }

      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return '';

      // SAST is UTC+2 (no DST).
      const sastMinutes = ((d.getUTCHours() * 60 + d.getUTCMinutes() + 120) % (24 * 60) + (24 * 60)) % (24 * 60);
      const hh = Math.floor(sastMinutes / 60);
      const mm = sastMinutes % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const formatTimeRange = (from: string, to: string | null) => {
    try {
      const fromTime = extractSASTTime(from);
      if (!fromTime) return '';
      if (!to) return fromTime;
      const toTime = extractSASTTime(to);
      if (!toTime) return fromTime;
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return `${fromTime} – ${toTime}`;
      }
      if (!areSameUTCDate(fromDate, toDate)) {
        // Include end date when event spans multiple dates.
        return `${fromTime} – ${formatDateOnly(to)}, ${toTime}`;
      }
      return `${fromTime} – ${toTime}`;
    } catch {
      return '';
    }
  };

  const formatDateWithTime = (from: string, to: string | null) => {
    try {
      const fromDate = new Date(from);
      const day = String(fromDate.getUTCDate()).padStart(2, '0');
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      // Use UTC date parts to avoid local timezone shifting the date
      const month = monthNames[fromDate.getUTCMonth()];
      const year = fromDate.getUTCFullYear();
      const dateLabel = `${day} ${month} ${year}`;
      const fromTime = extractSASTTime(from);
      if (!to) return `${dateLabel}, ${fromTime}`;
      const toTime = extractSASTTime(to);
      return `${dateLabel}, ${fromTime} – ${toTime}`;
    } catch {
      return from;
    }
  };

  const ensureAbsoluteUrl = (url: string): string => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
      if (typeof window !== 'undefined') return `${window.location.origin}${url}`;
      return url;
    }
    return `https://${url}`;
  };

  const getEnrollHref = (ev: Event): string => {
    const resolved = resolveEnrollmentUrl(
      ev.enrollment_url,
      ev.event_management_event_id,
      ev.event_management_session_id
    );
    return ensureAbsoluteUrl(resolved);
  };

  return (
    <>
      {/* Hero */}
      <section className="pt-28 pb-12 bg-black text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8 text-center">
          <p className="text-[#C4622D] text-sm font-semibold uppercase tracking-widest mb-3">
            What&apos;s On
          </p>
          <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">Events &amp; Cooking Classes</h1>
          <p className="text-[#A09890] text-lg max-w-xl mx-auto">
            Discover our upcoming events and cooking classes, and browse past highlights from Cardamom Kitchen.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 w-full mt-8">
        <div className="flex gap-1 bg-white border border-[#EDE7DA] rounded-2xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'current' ? 'bg-[#C4622D] text-white shadow-sm' : 'text-[#5C5347] hover:text-[#C4622D]'
            }`}
          >
            Current
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold min-w-[22px] text-center ${
                activeTab === 'current' ?'bg-white/25 text-white' :'bg-[#C4622D] text-white'
              }`}
            >
              {currentEvents.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'past' ? 'bg-[#C4622D] text-white shadow-sm' : 'text-[#5C5347] hover:text-[#C4622D]'
            }`}
          >
            Past
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold min-w-[22px] text-center ${
                activeTab === 'past' ?'bg-white/25 text-white' :'bg-[#C4622D] text-white'
              }`}
            >
              {pastEvents.length}
            </span>
          </button>
        </div>

        {/* Offering type filter — All / Events / Cooking Classes */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {([
            { key: 'all', label: 'All' },
            { key: 'events', label: 'Events' },
            { key: 'classes', label: 'Cooking Classes' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setOfferingFilter(opt.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                offeringFilter === opt.key
                  ? 'bg-[#1A1612] text-white border-[#1A1612]'
                  : 'bg-white text-[#5C5347] border-[#EDE7DA] hover:border-[#C4622D] hover:text-[#C4622D]'
              }`}
            >
              {opt.label}
            </button>
          ))}
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
            <h3 className="text-xl font-bold font-display text-[#1A1612] mt-4 mb-2">
              {activeTab === 'current'
                ? (offeringFilter === 'classes' ? 'No Upcoming Classes' : 'No Upcoming Events')
                : (offeringFilter === 'classes' ? 'No Past Classes' : 'No Past Events')}
            </h3>
            <p className="text-[#8C8278] text-sm">
              {activeTab === 'current'
                ? (offeringFilter === 'classes' ?'Check back soon for upcoming classes from Cardamom Kitchen.' :'Check back soon for upcoming events from Cardamom Kitchen.')
                : (offeringFilter === 'classes' ?'Past classes will appear here once they have concluded.' :'Past events will appear here once they have concluded.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedEvents.map((ev) =>
              ev.is_registered ? (
                /* ── REGISTERED EVENT CARD ── */
                <div
                  key={ev.id}
                  className="bg-white rounded-2xl border-2 border-[#C4622D] overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Image */}
                  <div className="relative h-48 bg-[#F5F0E8] flex items-center justify-center overflow-hidden">
                    {ev.imageUrl ? (
                      <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl">🍪</span>
                    )}
                    {/* Readability scrim behind badges on busy images */}
                    <div
                      className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 via-black/25 to-transparent pointer-events-none"
                      aria-hidden
                    />
                    {/* Category + tag badges */}
                    <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center gap-1.5 z-[1]">
                      {ev.offering_type === 'class' ? (
                        <>
                          <span className={CLASS_CATEGORY_BADGE}>
                            {ev.badge || 'Cooking Class'}
                          </span>
                          {ev.tags && ev.tags.length > 0 && ev.tags.map((tag, i) => (
                            <span key={i} className={CLASS_TAG_BADGE}>
                              {tag}
                            </span>
                          ))}
                        </>
                      ) : (
                        <>
                          <span className={EVENT_CATEGORY_BADGE}>
                            {ev.badge || DEFAULT_REGISTERED_EVENT_BADGE}
                          </span>
                          {ev.tags && ev.tags.length > 0 && ev.tags.map((tag, i) => (
                            <span key={i} className={EVENT_TAG_BADGE}>
                              {tag}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                    {activeTab === 'past' && (
                      <div className="absolute top-3 right-3 z-[1]">
                        <span className={`${CARD_BADGE_PILL} bg-gray-800/90 text-white text-xs px-2.5 py-1`}>
                          Past Event
                        </span>
                      </div>
                    )}
                    {/* Fully Booked diagonal badge */}
                    {ev.isFullyBooked && (
                      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[2]">
                        <div
                          className="absolute bg-red-600 text-white text-xs font-extrabold tracking-widest uppercase shadow-lg"
                          style={{
                            width: '160%',
                            textAlign: 'center',
                            padding: '6px 0',
                            top: '38%',
                            left: '-30%',
                            transform: 'rotate(-35deg)',
                            transformOrigin: 'center',
                          }}
                        >
                          Fully Booked
                        </div>
                      </div>
                    )}
                    {/* Bookings Closed diagonal badge */}
                    {!ev.isFullyBooked && ev.isBookingsClose && (
                      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[2]">
                        <div
                          className="absolute bg-amber-600 text-white text-xs font-extrabold tracking-widest uppercase shadow-lg"
                          style={{
                            width: '160%',
                            textAlign: 'center',
                            padding: '6px 0',
                            top: '38%',
                            left: '-30%',
                            transform: 'rotate(-35deg)',
                            transformOrigin: 'center',
                          }}
                        >
                          Bookings Closed
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold font-display text-[#1A1612] mb-1">{ev.title}</h3>
                    {ev.description && (
                      <p className="text-sm text-[#5C5347] mb-3 line-clamp-2">{ev.description}</p>
                    )}

                    {/* Date & Location */}
                    <div className="space-y-2 border-t border-[#F0EBE3] pt-3 mb-3">
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
                        <span>{formatTimeRange(ev.event_date, ev.event_date_to)}</span>
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

                    {/* Cost */}
                    {ev.cost != null && (
                      <div className="flex items-center gap-2 bg-[#FFF8F4] border border-[#F0D5C4] rounded-xl px-4 py-2.5 mb-3">
                        <svg className="w-4 h-4 text-[#C4622D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {ev.audience === 'mixed' && ev.child_cost != null ? (
                          <span className="text-sm font-bold text-[#C4622D]">
                            Adults R{Number(ev.cost).toFixed(2)} · Kids R{Number(ev.child_cost).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-[#C4622D]">R{Number(ev.cost).toFixed(2)} per person</span>
                        )}
                      </div>
                    )}

                    {/* Class Menu — class-level menu_items/menu_note (in-person classes) */}
                    {ev.offering_type === 'class' && ev.menu_items && ev.menu_items.length > 0 && (
                      <div className="bg-[#F5F0E8] rounded-xl p-4 mb-3">
                        <p className="text-xs font-bold text-[#5C5347] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Event Menu
                        </p>
                        <div className="space-y-1 mb-2">
                          {ev.menu_items.map((item, idx) => (
                            <p key={idx} className="text-sm text-[#5C5347]">- {item}</p>
                          ))}
                        </div>
                        {ev.menu_note && (
                          <p className="text-sm text-[#5C5347] mt-2">*{ev.menu_note}</p>
                        )}
                      </div>
                    )}

                    {/* Event Menu — legacy event_menu text field (non-class events) */}
                    {ev.offering_type !== 'class' && ev.event_menu && (
                      <div className="bg-[#F5F0E8] rounded-xl p-4 mb-3">
                        <p className="text-xs font-bold text-[#5C5347] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Event Menu
                        </p>
                        <p className="text-sm text-[#5C5347] whitespace-pre-line leading-relaxed">{ev.event_menu}</p>
                      </div>
                    )}

                    {/* Enroll Button */}
                    {ev.enrollment_url && activeTab === 'current' && (
                      <div className="mt-auto pt-1">
                        {ev.isFullyBooked ? (
                          <button
                            disabled
                            className="block w-full text-center bg-gray-300 text-gray-500 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed"
                          >
                            Register Now
                          </button>
                        ) : ev.isBookingsClose ? (
                          <button
                            disabled
                            className="block w-full text-center bg-gray-300 text-gray-500 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed"
                          >
                            Register Now
                          </button>
                        ) : (
                          <a
                            href={getEnrollHref(ev)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-center bg-[#C4622D] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
                          >
                            Register Now
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── REGULAR EVENT CARD (existing design) ── */
                <div
                  key={ev.id}
                  className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  <div className="h-48 bg-[#F5F0E8] flex items-center justify-center overflow-hidden">
                    {ev.imageUrl ? (
                      <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover" />
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
                    <h3 className="text-lg font-bold font-display text-[#1A1612] mb-2">{ev.title}</h3>
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
                        <span>{formatTimeRange(ev.event_date, ev.event_date_to)}</span>
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

                    {/* Splash Banner */}
                    {ev.splash_banner_text && (
                      <div className="relative w-full h-32 rounded-xl overflow-hidden mb-3 mt-6">
                        <img
                          src="/assets/images/Splash_banner-1781696232809.webp"
                          alt="Splash banner"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className="text-black font-extrabold text-lg tracking-widest uppercase drop-shadow-lg"
                            style={{ transform: 'rotate(-8deg)' }}
                          >
                            {ev.splash_banner_text}
                          </span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </>
  );
}

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-[#e9e0cf] flex flex-col">
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
