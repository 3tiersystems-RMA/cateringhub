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
  rating: number;
  orders: number;
}

const staticFeatured: FeaturedItem[] = [
  { id: '1', name: "Herb-Crusted Rack of Lamb", category: "Catering", price: 52, image: "https://images.unsplash.com/photo-1687795798426-b62055363dc0", imageAlt: "Elegant herb-crusted rack of lamb with roasted vegetables on a white plate", tags: ["Signature", "Gluten-Free"], rating: 4.9, orders: 340 },
  { id: '2', name: "Truffle Mushroom Risotto", category: "Meal Prep", price: 16, image: "https://images.unsplash.com/photo-1680420574628-225def8eea0a", imageAlt: "Creamy truffle mushroom risotto garnished with parmesan and fresh herbs", tags: ["Vegetarian", "Weekly Pick"], rating: 4.8, orders: 520 },
  { id: '3', name: "Seared Duck Breast", category: "Catering", price: 44, image: "https://images.unsplash.com/photo-1727056353497-a5ee553727fa", imageAlt: "Perfectly seared duck breast with cherry sauce and microgreens", tags: ["Chef's Choice"], rating: 4.9, orders: 215 },
  { id: '4', name: "Mediterranean Mezze Platter", category: "À La Carte", price: 38, image: "https://images.unsplash.com/photo-1577576156366-14e9d9454511", imageAlt: "Colorful Mediterranean mezze platter with hummus, olives, and fresh vegetables", tags: ["Vegan", "Crowd Favorite"], rating: 4.7, orders: 680 },
  { id: '5', name: "Braised Short Rib", category: "Meal Prep", price: 22, image: "https://img.rocket.new/generatedImages/rocket_gen_img_14dfb28c4-1764835135955.png", imageAlt: "Tender braised short rib with mashed potatoes and red wine reduction", tags: ["Comfort", "High Protein"], rating: 5.0, orders: 445 },
];

export default function FeaturedMenu() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [featured, setFeatured] = useState<FeaturedItem[]>(staticFeatured);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('featured', true)
          .eq('available', true)
          .order('sort_order', { ascending: true })
          .limit(5);

        if (error || !data || data.length === 0) return;

        const items = await Promise.all(
          data.map(async (p) => {
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
              rating: 4.8,
              orders: 0,
            } as FeaturedItem;
          })
        );
        setFeatured(items);
      } catch (err) {
        console.log('FeaturedMenu fetch error:', err);
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
        {/* Header */}
        <div className="fm-reveal reveal hidden-init flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-3">
              02 / Fan Favorites
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

        {/* Cards */}
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
                <div className="absolute top-3 left-3 flex flex-wrap gap-1">
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
                      ${item?.price}
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
      </div>
    </section>
  );
}