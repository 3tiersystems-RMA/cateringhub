"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { createClient } from "@/lib/supabase/client";
import { getHomepageSectionVisibility } from "@/lib/homepage-sections";
import AnnouncementCard from "./AnnouncementCard";
import { useCart } from "@/app/products/components/CartContext";
import ProductModal from "@/app/products/components/ProductModal";

import type { CartProduct } from "@/app/products/components/CartContext";


interface HomepageCard {
  id: string;
  card_type: 'todays_special' | 'next_booking' | 'customer_review';
  title: string;
  subtitle: string | null;
  description: string | null;
  price: number | null;
  price_unit: string | null;
  badge_label: string | null;
  product_link: string | null;
  event_date: string | null;
  guest_count: number | null;
  prep_percentage: number | null;
  reviewer_name: string | null;
  reviewer_event: string | null;
  rating: number | null;
  is_visible: boolean;
  display_order: number;
  image_path: string | null;
  imageUrl?: string | null;
}

function HeroSectionInner() {
  const scanRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<HomepageCard[]>([]);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [showViewServices, setShowViewServices] = useState(false);
  const [showHeroBadge, setShowHeroBadge] = useState(true);
  const [modalProduct, setModalProduct] = useState<CartProduct | null>(null);
  const [modalAdded, setModalAdded] = useState(false);
  const { addItem, setIsOpen } = useCart();

  useEffect(() => {
    // Trigger reveal animations on mount
    const reveals = document.querySelectorAll(".hero-reveal");
    reveals?.forEach((el, i) => {
      setTimeout(() => {
        el?.classList?.add("active");
        el?.classList?.remove("hidden-init");
      }, 200 + i * 150);
    });
  }, []);

  useEffect(() => {
    getHomepageSectionVisibility('what_we_do', true).then(setShowViewServices);
    getHomepageSectionVisibility('hero_badge', true).then(setShowHeroBadge);
  }, []);

  useEffect(() => {
    const fetchCards = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.
      from('homepage_cards').
      select('*').
      eq('is_visible', true).
      order('display_order', { ascending: true });

      if (!error && data) {
        const withUrls = (data as HomepageCard[]).map((card) => {
          if (card.card_type === 'todays_special' && card.image_path) {
            const { data: urlData } = supabase.storage.
            from('homepage-card-images').
            getPublicUrl(card.image_path);
            return { ...card, imageUrl: urlData?.publicUrl ?? null };
          }
          return { ...card, imageUrl: null };
        });
        setCards(withUrls);
      }
      setCardsLoaded(true);
    };
    fetchCards();
  }, []);

  const handleSpecialCardClick = useCallback(async () => {
    const specialCard = cards.find((c) => c.card_type === 'todays_special');
    if (!specialCard) return;

    // If there's a linked product, fetch full product details
    if (specialCard.product_link) {
      const supabase = createClient();
      const { data: product } = await supabase.
      from('products').
      select('*').
      eq('id', specialCard.product_link).
      single();

      if (product) {
        let imageUrl = '';
        if (product.image_path) {
          // product-images is a public bucket — a signed URL 400s here. Use the public URL.
          const { data: urlData } = supabase.storage.
          from('product-images').
          getPublicUrl(product.image_path);
          imageUrl = urlData?.publicUrl ?? '';
        }
        const cartProduct: CartProduct = {
          id: product.id,
          name: product.name,
          category: product.category,
          price: Number(product.price),
          unit: product.unit,
          image: imageUrl,
          imageAlt: product.name,
          tags: product.tags ?? [],
          rating: 4.8,
          reviews: 0,
          description: product.description ?? '',
          minOrder: product.min_order ?? undefined,
          badge: product.badge ?? undefined,
          available: product.available,
          packageType: product.package_type,
          imageFit: product.image_fit,
          oldPrice: product.old_price ? Number(product.old_price) : undefined,
          savingPercent: product.saving_percent ? Number(product.saving_percent) : undefined
        };
        setModalAdded(false);
        setModalProduct(cartProduct);
        return;
      }
    }

    // Fallback: build a CartProduct from the card's own data
    const fallbackProduct: CartProduct = {
      id: specialCard.id,
      name: specialCard.title,
      category: "Today's Special",
      price: specialCard.price ?? 0,
      unit: specialCard.price_unit ?? '',
      image: specialCard.imageUrl ?? '',
      imageAlt: `Today's Special: ${specialCard.title}`,
      tags: specialCard.badge_label ? [specialCard.badge_label] : [],
      rating: 4.8,
      reviews: 0,
      description: specialCard.description ?? specialCard.subtitle ?? '',
      available: true,
      packageType: undefined,
      imageFit: undefined
    };
    setModalAdded(false);
    setModalProduct(fallbackProduct);
  }, [cards]);

  const handleModalAdd = useCallback(() => {
    if (!modalProduct) return;
    addItem(modalProduct, 1);
    setModalAdded(true);
    setTimeout(() => {
      setModalProduct(null);
      setModalAdded(false);
      setIsOpen(true);
    }, 900);
  }, [modalProduct, addItem, setIsOpen]);

  const handleModalClose = useCallback(() => {
    setModalProduct(null);
    setModalAdded(false);
  }, []);

  const specialCard = cards.find((c) => c.card_type === 'todays_special');
  const bookingCard = cards.find((c) => c.card_type === 'next_booking');
  const reviewCard = cards.find((c) => c.card_type === 'customer_review');

  const isSpecialClickable = !!specialCard;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#1A1612]" suppressHydrationWarning>
      {/* Background Image — Ken Burns */}
      <div className="absolute inset-0 z-0" suppressHydrationWarning>
        <AppImage
          src="https://img.rocket.new/generatedImages/rocket_gen_img_16632d37b-1772253532353.png"
          alt="Elegant catering spread with beautifully plated dishes and garnishes on a long table"
          fill
          className="object-cover hero-img opacity-60"
          priority />
        
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1612]/85 via-[#1A1612]/50 to-[#1A1612]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1612]/60 via-transparent to-transparent" />
      </div>
      {/* Scan Line */}
      <div ref={scanRef} className="hero-scan absolute inset-x-0 h-40 z-10 w-full" />
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-warm opacity-30 z-0" />
      <div className="relative z-20 max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-16 w-full" suppressHydrationWarning>
        <div className="grid lg:grid-cols-12 gap-8 items-center" suppressHydrationWarning>
          {/* Left: Content */}
          <div className="lg:col-span-7 space-y-8">
            {/* Badge */}
            {showHeroBadge &&
            <div className="reveal hidden-init hero-reveal inline-flex items-center gap-2 px-4 py-2 bg-[#C4622D]/15 border border-[#C4622D]/30 rounded-full backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C4622D] pulse-dot" />
              <span className="text-xs font-semibold tracking-widest uppercase text-[#D97B4A]">
                Now Accepting 2026 Bookings
              </span>
            </div>
            }

            {/* Headline */}
            <div className="reveal hidden-init hero-reveal space-y-2">
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold leading-[0.9] tracking-tight text-white">
                Food That
              </h1>
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold leading-[0.9] tracking-tight text-[#D97B4A] italic">
                Tells a Story.
              </h1>
            </div>

            <p className="reveal hidden-init hero-reveal max-w-lg text-base md:text-lg text-white/65 leading-relaxed font-light">
              From intimate dinner parties to 500-person corporate galas — Cardamom Central Kitchen crafts memorable meals with locally sourced ingredients and a Master chef-driven menu that changes with the seasons.
            </p>

            {/* Stats Row */}
            <div className="reveal hidden-init hero-reveal flex flex-wrap gap-6 pt-2">
              {[
              { value: "1,200+", label: "Events Catered" },
              { value: "4.9★", label: "Average Rating" },
              { value: "48hr", label: "Booking Lead Time" }]?.
              map((stat) =>
              <div key={stat?.label} className="text-left">
                  <p className="text-2xl font-display font-semibold text-white">{stat?.value}</p>
                  <p className="text-xs text-white/45 uppercase tracking-widest font-medium mt-0.5">
                    {stat?.label}
                  </p>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="reveal hidden-init hero-reveal flex flex-wrap gap-4">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-[#C4622D] text-white px-8 py-4 rounded-full text-sm font-semibold hover:bg-[#A04E22] transition-all duration-300 shadow-terra hover:shadow-terra-lg hover:-translate-y-0.5">
                
                Explore Our Menu
                <Icon name="ArrowRightIcon" size={16} />
              </Link>
              {showViewServices &&
              <a
                href="#services"
                className="inline-flex items-center gap-2 border border-white/25 text-white/90 px-8 py-4 rounded-full text-sm font-semibold hover:bg-white/10 transition-all duration-300 backdrop-blur-sm">
                  
                  View Services
                </a>
              }
            </div>
          </div>

          {/* Right: Floating Cards — only render if at least one card is visible */}
          {cardsLoaded && (specialCard || bookingCard || reviewCard) &&
          <div className="lg:col-span-5 hidden lg:flex flex-col gap-4 items-end">

              {/* Card 1 — Today's Special */}
              {specialCard &&
            <div
              className={`float-card w-72 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 shadow-glass transition-all duration-300 group${isSpecialClickable ? ' cursor-pointer hover:border-white/40 hover:bg-white/15' : ''}`}
              onClick={isSpecialClickable ? handleSpecialCardClick : undefined}
              role={isSpecialClickable ? 'button' : undefined}
              tabIndex={isSpecialClickable ? 0 : undefined}
              onKeyDown={isSpecialClickable ? (e) => {if (e.key === 'Enter' || e.key === ' ') handleSpecialCardClick();} : undefined}
              aria-label={isSpecialClickable ? `Open product: ${specialCard.title}` : undefined}>
              
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0">
                      {specialCard.imageUrl ?
                  <img
                    src={specialCard.imageUrl}
                    alt={`Today's Special: ${specialCard.title}`}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full" /> :


                  <AppImage
                    src="https://img.rocket.new/generatedImages/rocket_gen_img_1017a97cd-1765873722883.png"
                    alt="Beautifully plated salmon dish with herbs and lemon"
                    width={48}
                    height={48}
                    className="object-cover w-full h-full" />
                  }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-[#D97B4A] uppercase tracking-wider">Today&apos;s Special</p>
                      <p className="text-sm font-semibold text-white">{specialCard.title}</p>
                    </div>
                    {isSpecialClickable &&
                <div className="ml-auto w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center group-hover:bg-white/25 transition-all duration-300 flex-shrink-0">
                        <Icon name="ArrowRightIcon" size={12} className="text-white" />
                      </div>
                }
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-display font-semibold text-white">
                      {specialCard.price != null ?
                  <>R{specialCard.price}{specialCard.price_unit && <span className="text-xs text-white/50 font-sans font-normal"> / {specialCard.price_unit}</span>}</> :
                  specialCard.subtitle ?
                  specialCard.subtitle.replace(/\$/g, 'R') :
                  null
                  }
                    </span>
                    {specialCard.badge_label &&
                <span className="text-xs bg-[#C4622D]/25 text-[#D97B4A] px-2.5 py-1 rounded-full border border-[#C4622D]/30">
                        {specialCard.badge_label}
                      </span>
                }
                  </div>
                </div>
            }

              {/* Card 2 — Next Booking */}
              {bookingCard &&
            <div className="float-card-delay w-64 bg-[#C4622D]/90 backdrop-blur-xl border border-[#D97B4A]/40 rounded-3xl p-5 shadow-terra">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="CalendarDaysIcon" size={16} className="text-white/70" />
                    <p className="text-xs font-mono text-white/70 uppercase tracking-wider">Next Booking</p>
                  </div>
                  <p className="text-white font-semibold text-sm">{bookingCard.title}</p>
                  {(bookingCard.event_date || bookingCard.guest_count) &&
              <p className="text-white/60 text-xs mt-1">
                      {bookingCard.event_date}{bookingCard.event_date && bookingCard.guest_count ? ' · ' : ''}{bookingCard.guest_count ? `${bookingCard.guest_count} guests` : ''}
                    </p>
              }
                  {bookingCard.prep_percentage !== null &&
              <>
                      <div className="mt-3 h-1 bg-white/20 rounded-full">
                        <div
                    className="h-1 bg-white rounded-full"
                    style={{ width: `${bookingCard.prep_percentage}%` }} />
                  
                      </div>
                      <p className="text-white/50 text-xs mt-1.5">Prep: {bookingCard.prep_percentage}% complete</p>
                    </>
              }
                </div>
            }

              {/* Card 3 — Customer Review */}
              {reviewCard &&
            <div className="float-card w-56 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 shadow-glass">
                  <div className="flex gap-0.5 mb-2">
                    {[...Array(reviewCard.rating || 5)]?.map((_, i) =>
                <Icon key={i} name="StarIcon" size={14} variant="solid" className="text-[#D4A853]" />
                )}
                  </div>
                  <p className="text-white/85 text-xs leading-relaxed">
                    &quot;{reviewCard.description}&quot;
                  </p>
                  {(reviewCard.reviewer_name || reviewCard.reviewer_event) &&
              <div className="flex items-center gap-2 mt-3">
                      <div className="w-6 h-6 rounded-full bg-[#C4622D]/50 flex items-center justify-center text-white text-xs font-bold">
                        {reviewCard.reviewer_name?.charAt(0) || 'R'}
                      </div>
                      <p className="text-white/50 text-xs">
                        {reviewCard.reviewer_name}{reviewCard.reviewer_name && reviewCard.reviewer_event ? ' · ' : ''}{reviewCard.reviewer_event}
                      </p>
                    </div>
              }
                </div>
            }

              {/* Card 4 — Announcement */}
              <AnnouncementCard />

            </div>
          }
        </div>
      </div>
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <p className="text-xs text-white/30 uppercase tracking-widest font-mono">Scroll</p>
        <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </div>

      {/* Product Modal for Today's Special */}
      <ProductModal
        product={modalProduct}
        onClose={handleModalClose}
        added={modalAdded}
        onAdd={handleModalAdd} />
      
    </section>);

}

export default function HeroSection() {
  return <HeroSectionInner />;
}