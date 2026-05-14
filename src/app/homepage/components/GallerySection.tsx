'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface GalleryImage {
  id: string;
  title: string;
  description: string | null;
  image_path: string;
  sort_order: number;
  is_visible: boolean;
  imageUrl?: string;
}

export default function GallerySection() {
  const supabase = createClient();
  const trackRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const posRef = useRef(0);
  const pausedRef = useRef(false);

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [sectionVisible, setSectionVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupIndex, setPopupIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Load section visibility
      const { data: settings } = await supabase
        .from('gallery_settings')
        .select('section_visible')
        .limit(1)
        .single();
      if (settings) setSectionVisible(settings.section_visible);

      // Load visible gallery images
      const { data } = await supabase
        .from('gallery_images')
        .select('*')
        .eq('is_visible', true)
        .order('sort_order');

      if (data && data.length > 0) {
        const withUrls = await Promise.all(
          data.map(async (img: GalleryImage) => {
            const { data: urlData } = await supabase.storage
              .from('gallery-images')
              .createSignedUrl(img.image_path, 3600);
            return { ...img, imageUrl: urlData?.signedUrl };
          })
        );
        setImages(withUrls.filter(img => img.imageUrl));
      }
      setLoading(false);
    };
    load();
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    if (!images.length || !trackRef.current) return;
    const track = trackRef.current;
    const speed = 0.5; // px per frame

    const animate = () => {
      if (!pausedRef.current) {
        posRef.current += speed;
        const halfWidth = track.scrollWidth / 2;
        if (posRef.current >= halfWidth) {
          posRef.current = 0;
        }
        track.style.transform = `translateX(-${posRef.current}px)`;
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [images]);

  const openPopup = (index: number) => {
    pausedRef.current = true;
    setPopupIndex(index);
    setPopupOpen(true);
  };

  const closePopup = () => {
    setPopupOpen(false);
    pausedRef.current = false;
  };

  const goNext = useCallback(() => {
    setPopupIndex(prev => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setPopupIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!popupOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') closePopup();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [popupOpen, goNext, goPrev]);

  if (loading || !sectionVisible || images.length === 0) return null;

  // Duplicate images for seamless loop
  const displayImages = [...images, ...images];
  const currentImage = images[popupIndex];

  return (
    <section className="py-24 md:py-32 bg-[#1A1612] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-12">
        <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-3">
          04 / Gallery
        </p>
        <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-white leading-tight">
          A Taste of
          <span className="italic text-[#C4622D]"> Our Work</span>
        </h2>
      </div>

      {/* Scrolling track */}
      <div
        className="relative w-full overflow-hidden"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { if (!popupOpen) pausedRef.current = false; }}
      >
        <div
          ref={trackRef}
          className="flex gap-4 will-change-transform"
          style={{ width: 'max-content' }}
        >
          {displayImages.map((img, i) => (
            <button
              key={`${img.id}-${i}`}
              onClick={() => openPopup(i % images.length)}
              className="flex-shrink-0 w-72 h-52 rounded-2xl overflow-hidden border border-white/10 hover:border-[#C4622D]/60 transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#C4622D] group relative"
              aria-label={`View ${img.title}`}
            >
              <img
                src={img.imageUrl}
                alt={img.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <p className="text-white text-sm font-semibold truncate">{img.title}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Popup / Lightbox */}
      {popupOpen && currentImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={closePopup}
        >
          <div
            className="relative bg-[#1A1612] border border-white/10 rounded-3xl overflow-hidden w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closePopup}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image */}
            <div className="relative w-full bg-black flex items-center justify-center" style={{ minHeight: '300px', maxHeight: '60vh' }}>
              <img
                src={currentImage.imageUrl}
                alt={currentImage.title}
                className="w-full h-full object-contain"
                style={{ maxHeight: '60vh' }}
              />

              {/* Prev / Next arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-[#C4622D] hover:border-[#C4622D] transition-all duration-200"
                    aria-label="Previous image"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-[#C4622D] hover:border-[#C4622D] transition-all duration-200"
                    aria-label="Next image"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Info */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-display text-xl font-semibold text-white leading-tight">{currentImage.title}</h3>
                <span className="text-xs font-mono text-[#8C8278] flex-shrink-0 mt-1">
                  {popupIndex + 1} / {images.length}
                </span>
              </div>
              {currentImage.description && (
                <p className="text-sm text-[#B5ADA5] leading-relaxed">{currentImage.description}</p>
              )}
              {/* Navigation hint */}
              {images.length > 1 && (
                <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/10">
                  <button
                    onClick={goPrev}
                    className="flex items-center gap-2 text-xs text-[#8C8278] hover:text-[#C4622D] transition-colors font-mono"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    previous
                  </button>
                  <div className="flex gap-1.5 flex-1 justify-center">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPopupIndex(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${idx === popupIndex ? 'bg-[#C4622D] w-4' : 'bg-white/30 hover:bg-white/60'}`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={goNext}
                    className="flex items-center gap-2 text-xs text-[#8C8278] hover:text-[#C4622D] transition-colors font-mono"
                  >
                    next
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
