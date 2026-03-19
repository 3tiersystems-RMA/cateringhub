"use client";

import { useEffect, useRef, useState } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import { createClient } from "@/lib/supabase/client";

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  avatar_url: string | null;
  rating: number;
  is_active: boolean;
  display_order: number;
}

const FALLBACK_TESTIMONIALS: Testimonial[] = [
{
  id: "1",
  quote: "Cardamom made our daughter's wedding absolutely magical. Every dish was a conversation starter — guests are still talking about the lamb three months later.",
  name: "Patricia & James Holloway",
  role: "Wedding · 180 guests",
  avatar_url: "https://img.rocket.new/generatedImages/rocket_gen_img_1e8e20ed5-1772436647889.png",
  rating: 5,
  is_active: true,
  display_order: 1
},
{
  id: "2",
  quote: "We've used Cardamom for our quarterly board lunches for two years. Consistent quality, always on time, and the team is a pleasure to work with.",
  name: "Marcus Webb",
  role: "VP Operations · TechNova Inc.",
  avatar_url: "https://img.rocket.new/generatedImages/rocket_gen_img_167c14e98-1772624814714.png",
  rating: 5,
  is_active: true,
  display_order: 2
},
{
  id: "3",
  quote: "The weekly meal prep service changed my life. I eat better than I ever have, and I've reclaimed 6 hours a week I used to spend cooking.",
  name: "Danielle Torres",
  role: "Meal Prep Subscriber · 8 months",
  avatar_url: "https://img.rocket.new/generatedImages/rocket_gen_img_14d8a3889-1770881542627.png",
  rating: 5,
  is_active: true,
  display_order: 3
}];


function NeutralAvatar() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-label="Anonymous reviewer">
      
      <rect width="80" height="80" fill="rgba(255,255,255,0.15)" />
      {/* Left figure (female silhouette) */}
      <circle cx="28" cy="26" r="9" fill="rgba(255,255,255,0.55)" />
      <path
        d="M14 58c0-9 6.3-15 14-15s14 6 14 15"
        fill="rgba(255,255,255,0.55)" />
      
      {/* Right figure (male silhouette) */}
      <circle cx="52" cy="26" r="9" fill="rgba(255,255,255,0.35)" />
      <path
        d="M38 58c0-9 6.3-15 14-15s14 6 14 15"
        fill="rgba(255,255,255,0.35)" />
      
    </svg>);

}

export default function TestimonialSection() {
  const [active, setActive] = useState(0);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK_TESTIMONIALS);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.
        from("testimonials").
        select("*").
        eq("is_active", true).
        order("display_order", { ascending: true });
        if (!error && data && data.length > 0) {
          setTestimonials(data as Testimonial[]);
        }
      } catch {



        // keep fallback
      }};fetchTestimonials();}, []);

  useEffect(() => {
    if (testimonials.length === 0) return;
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const t = testimonials?.[active];

  return (
    <section
      ref={sectionRef}
      className="py-24 md:py-32 bg-[#C4622D] overflow-hidden">
      
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="space-y-8">
            <div className="text-[#D97B4A]/40">
              <svg width="64" height="48" viewBox="0 0 64 48" fill="currentColor">
                <path d="M0 48V29.333C0 12.444 8.889 3.111 26.667 0L30.667 5.333C22.222 7.111 16.889 11.556 14.667 18.667H24V48H0ZM40 48V29.333C40 12.444 48.889 3.111 66.667 0L70.667 5.333C62.222 7.111 56.889 11.556 54.667 18.667H64V48H40Z" />
              </svg>
            </div>

            <blockquote className="font-display text-2xl md:text-4xl font-medium text-white leading-tight tracking-tight">
              &ldquo;{t?.quote}&rdquo;
            </blockquote>

            <div className="flex items-center gap-1">
              {[...Array(t?.rating ?? 5)]?.map((_, i) =>
              <Icon key={i} name="StarIcon" size={16} variant="solid" className="text-[#D4A853]" />
              )}
            </div>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials?.map((_, i) =>
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-8 bg-white" : "w-3 bg-white/30"}`
                }
                aria-label={`Testimonial ${i + 1}`} />
              )}
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/20">
                {t?.avatar_url ?
                <AppImage
                  src={t.avatar_url}
                  alt={`${t?.name ?? "Customer"} testimonial photo`}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full grayscale" /> :

                <NeutralAvatar />
                }
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{t?.name}</p>
                <p className="text-white/60 text-sm font-mono uppercase tracking-wider mt-1">
                  {t?.role}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {[
              { value: "4.9/5", label: "Average Rating" },
              { value: "98%", label: "Would Re-Book" },
              { value: "1,200+", label: "Events Served" },
              { value: "12yr", label: "In Business" }]?.
              map((s) =>
              <div
                key={s?.label}
                className="bg-white/10 border border-white/15 rounded-2xl p-4">
                  <p className="font-display text-2xl font-semibold text-white">{s?.value}</p>
                  <p className="text-white/50 text-xs uppercase tracking-widest font-mono mt-1">
                    {s?.label}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>);

}