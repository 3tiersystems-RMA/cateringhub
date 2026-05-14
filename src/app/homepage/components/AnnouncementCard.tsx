"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/ui/AppIcon";

interface AnnouncementCard {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  image_url: string | null;
  is_visible: boolean;
}

export default function AnnouncementCard() {
  const [card, setCard] = useState<AnnouncementCard | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchCard = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("homepage_cards")
          .select("id, title, description, image_path, image_url, is_visible")
          .eq("card_type", "announcement")
          .eq("is_visible", true)
          .single();

        if (!error && data) {
          setCard(data as AnnouncementCard);

          // Resolve signed URL for uploaded image
          if (data.image_path) {
            const { data: urlData } = await supabase.storage
              .from("homepage-card-images")
              .createSignedUrl(data.image_path, 3600);
            setResolvedImageUrl(urlData?.signedUrl ?? null);
          } else if (data.image_url) {
            setResolvedImageUrl(data.image_url);
          }
        }
      } catch {
        // no announcement card or not visible
      }
    };
    fetchCard();
  }, []);

  if (!card) return null;

  const displayImage = resolvedImageUrl;

  return (
    <>
      {/* Announcement Card — clickable */}
      <div
        onClick={() => setPopupOpen(true)}
        className="float-card w-72 bg-[#D4A853]/15 backdrop-blur-xl border border-[#D4A853]/40 rounded-3xl p-5 shadow-glass cursor-pointer hover:border-[#D4A853]/70 hover:bg-[#D4A853]/20 transition-all duration-300 group"
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setPopupOpen(true); }}
        aria-label={`Open announcement: ${card.title}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">📢</span>
          <p className="text-xs font-mono text-[#D4A853] uppercase tracking-wider">Announcement</p>
          <div className="ml-auto w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center group-hover:bg-[#D4A853]/40 transition-all duration-300">
            <Icon name="ArrowRightIcon" size={12} className="text-white" />
          </div>
        </div>
        <p className="text-white font-semibold text-sm leading-snug line-clamp-2">{card.title}</p>
        {card.description && (
          <p className="text-white/55 text-xs mt-1.5 leading-relaxed line-clamp-2">{card.description}</p>
        )}
        {displayImage && (
          <div className="mt-3 w-full rounded-xl overflow-hidden">
            <img
              src={displayImage}
              alt={`Announcement: ${card.title}`}
              className="w-full h-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-300"
            />
          </div>
        )}
      </div>

      {/* Popup Modal */}
      {popupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPopupOpen(false)}
        >
          <div
            className="relative bg-[#1A1612] border border-[#DDD5C8]/20 rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setPopupOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
              aria-label="Close announcement"
            >
              <Icon name="XMarkIcon" size={16} />
            </button>

            {/* Full image */}
            {displayImage && (
              <div className="w-full rounded-t-3xl overflow-hidden">
                <img
                  src={displayImage}
                  alt={`Announcement image: ${card.title}`}
                  className="w-full h-auto block"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📢</span>
                <span className="text-xs font-mono text-[#D4A853] uppercase tracking-wider">Announcement</span>
              </div>
              <h2 className="font-display text-xl md:text-2xl font-semibold text-white leading-tight mb-3">
                {card.title}
              </h2>
              {card.description && (
                <p className="text-white/70 text-sm leading-relaxed">{card.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
