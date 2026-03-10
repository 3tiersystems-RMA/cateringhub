"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { createClient } from "@/lib/supabase/client";

interface FeaturedItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  imageAlt: string;
  tags: string[];
  badge: string | null;
  rating: number;
  orders: number;
}

export default function FeaturedMenu() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const supabase = createClient();
        const { data, error, count } = await supabase
          .from('products')
          .select('*', { count: 'exact' })
          .eq('featured', true)
          .eq('available', true)
          .order('sort_order', { ascending: true })
          .limit(5);

        if (error) {
          console.error('FeaturedMenu fetch error:', error.message, error.code, error.details);
          setFeatured([]);
          return;
        }

        console.log('FeaturedMenu: query returned', count, 'total,', data?.length, 'rows:', data);

        const items = await Promise.all(
          (data || []).map(async (p) => {
            let imageUrl = 'https://images.unsplash.com/photo-1594040815648-9251e9baabc8';
            if (p.image_path) {
              const { data: urlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(p.image_path);
              imageUrl = urlData?.publicUrl || imageUrl;
            }
            return {
              id: p.id,
              name: p.name,
              category: p.category,
              price: p.price,
              image: imageUrl,
              imageAlt: `${p.name} - ${p.category}`,
              tags: p.tags || [],
              badge: p.badge || null,
              rating: 4.8,
              orders: 0,
            } as FeaturedItem;
          })
        );
        setFeatured(items);
      } catch (err) {
        console.log('FeaturedMenu fetch error:', err);
        setFeatured([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll(".fm-reveal").forEach((el, i) => {
              setTimeout(() => {
                el.classList.add("active");
                el.classList.remove("hidden-init");
              }, i * 100);
            });
          }
        });
      },
      { threshold: 0.05 }
    );
    if (sectionRef?.current) observer?.observe(sectionRef?.current);
    return () => observer?.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 md:py-32 bg-[#EDE7DA] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header — always visible */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-3">
              02 / Customer Favourites
            </p>
            <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-[#1A1612] leading-tight">
              Menu
              <span className="italic text-[#8C8278]"> Highlights</span>
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#5C5347] hover:text-[#C4622D] transition-colors border-b border-[#DDD5C8] hover:border-[#C4622D] pb-0.5 group"
          >
            View full menu
            <Icon name="ArrowRightIcon" size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="flex md:grid md:grid-cols-5 gap-5 overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 md:mx-0 px-4 md:px-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-60 md:w-auto bg-[#FAF7F2] border border-[#DDD5C8] rounded-3xl overflow-hidden animate-pulse"
              >
                <div className="h-44 bg-[#DDD5C8]" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-[#DDD5C8] rounded w-1/3" />
                  <div className="h-4 bg-[#DDD5C8] rounded w-3/4" />
                  <div className="h-4 bg-[#DDD5C8] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && featured.length === 0 && (
          <p className="text-[#8C8278] text-sm">
            Our featured menu items will appear here shortly.
          </p>
        )}

        {/* Cards */}
        {!loading && featured.length > 0 && (
          <div className="flex md:grid md:grid-cols-5 gap-5 overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 md:mx-0 px-4 md:px-0 snap-x snap-mandatory">
            {featured?.map((item) => (
              <div
                key={item?.id}
                className="fm-reveal reveal hidden-init group flex-shrink-0 w-60 md:w-auto snap-start bg-[#FAF7F2] border border-[#DDD5C8] rounded-3xl overflow-hidden hover:border-[#C4622D]/40 hover:-translate-y-1 hover:shadow-warm transition-all duration-400 cursor-pointer"
              >
                {/* Image */}
                <div className="relative h-44 overflow-hidden">
                  <AppImage
                    src={item?.image}
                    alt={item?.imageAlt}
                    fill
                    className="object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                  />
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    {item?.badge && (
                      <span className="text-xs font-semibold bg-[#C4622D] text-white px-2.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {item?.tags?.slice(0, 1)?.map((tag) => (
                      <span key={tag} className="text-xs bg-[#1A1612]/70 text-white px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-xs font-mono text-[#C4622D] uppercase tracking-wider mb-1">
                    {item?.category}
                  </p>
                  <h3 className="font-display text-base font-semibold text-[#1A1612] leading-snug mb-3 line-clamp-2">
                    {item?.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold text-[#1A1612]">
                        R{item?.price}
                        <span className="text-xs text-[#8C8278] font-normal ml-1">/serving</span>
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon name="StarIcon" size={11} variant="solid" className="text-[#D4A853]" />
                        <span className="text-xs text-[#8C8278]">{item?.rating}</span>
                      </div>
                    </div>
                    <Link
                      href="/products"
                      className="w-8 h-8 rounded-full bg-[#C4622D] flex items-center justify-center hover:bg-[#A04E22] transition-colors shadow-terra"
                    >
                      <Icon name="PlusIcon" size={14} className="text-white" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}