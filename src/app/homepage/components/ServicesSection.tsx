"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";

// Currency: South African Rand (R)
const services = [
{
  id: "catering",
  label: "Full-Service Catering",
  description:
  "From setup to cleanup — we handle everything. Staff, equipment, linens, and a custom menu built around your event.",
  image:
  "https://images.unsplash.com/photo-1670529775980-4e215b82f2ae",
  imageAlt: "Elegant catering service with white tablecloths and plated dishes",
  badge: "Most Popular",
  badgeColor: "bg-[#C4622D] text-white",
  stat: "From R45/head",
  features: ["Custom menu design", "Staffed service", "Equipment included"],
  span: "lg:col-span-2 lg:row-span-2",
  tall: true
},
{
  id: "meals",
  label: "Weekly Meal Prep",
  description:
  "Chef-crafted meals portioned for your household, delivered every Sunday. Eat well without the effort.",
  image:
  "https://img.rocket.new/generatedImages/rocket_gen_img_126780fad-1767071716470.png",
  imageAlt: "Neatly arranged meal prep containers with colorful healthy food",
  badge: "New",
  badgeColor: "bg-[#D4A853] text-[#1A1612]",
  stat: "From R12/meal",
  features: ["Weekly delivery", "Macro-balanced", "Dietary options"],
  span: "lg:col-span-1",
  tall: false
},
{
  id: "alacarte",
  label: "À La Carte Platters",
  description:
  "Order individual platters — perfect for smaller gatherings, office meetings, or last-minute hosting.",
  image:
  "https://images.unsplash.com/photo-1641297074000-6f06ad82ef04",
  imageAlt: "Beautiful charcuterie and food platter arrangement with fresh fruits",
  badge: "Quick Order",
  badgeColor: "bg-[#EDE7DA] text-[#5C5347] border border-[#DDD5C8]",
  stat: "From R35/platter",
  features: ["48hr notice", "Pickup or delivery", "Seasonal items"],
  span: "lg:col-span-1",
  tall: false
}];


export default function ServicesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll(".srv-reveal").forEach((el, i) => {
              setTimeout(() => {
                el.classList.add("active");
                el.classList.remove("hidden-init");
              }, i * 120);
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    if (sectionRef?.current) observer?.observe(sectionRef?.current);
    return () => observer?.disconnect();
  }, []);

  return (
    <section id="services" ref={sectionRef} className="py-24 md:py-32 bg-[#F5F0E8]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="srv-reveal reveal hidden-init flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-3">
              01 / What We Do
            </p>
            <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-[#1A1612] leading-tight">
              Three Ways to
              <br />
              <span className="italic text-[#C4622D]">Enjoy Our Food</span>
            </h2>
          </div>
          <p className="max-w-sm text-[#8C8278] leading-relaxed text-sm md:text-base">
            Whether you need full event catering, weekly meal prep, or quick platters — we&apos;ve got a service that fits.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid lg:grid-cols-3 lg:grid-rows-2 gap-4">
          {services?.map((svc) => {
            const cardContent =
            <div
              key={svc?.id}
              className={`srv-reveal reveal hidden-init group relative overflow-hidden rounded-4xl bg-[#EDE7DA] border border-[#DDD5C8] hover:border-[#C4622D]/40 transition-all duration-500 cursor-pointer ${svc?.span} ${svc?.tall ? "min-h-[500px]" : "min-h-[240px]"}`}>
              
                {/* Image */}
                <div className="absolute inset-0">
                  <AppImage
                  src={svc?.image}
                  alt={svc?.imageAlt}
                  fill
                  className="object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 opacity-60 group-hover:opacity-80" />
                
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A1612]/80 via-[#1A1612]/20 to-transparent" />
                </div>

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-between p-7">
                  <div className="flex items-start justify-between">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${svc?.badgeColor}`}>
                      {svc?.badge}
                    </span>
                    <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm group-hover:bg-[#C4622D] group-hover:border-[#C4622D] transition-all duration-300">
                      <Icon name="ArrowRightIcon" size={14} className="text-white" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[#D97B4A] text-xs font-mono uppercase tracking-widest mb-2">
                      {svc?.stat}
                    </p>
                    <h3 className="font-display text-xl md:text-2xl font-semibold text-white mb-2">
                      {svc?.label}
                    </h3>
                    <p className="text-white/65 text-sm leading-relaxed mb-4 hidden group-hover:block transition-all">
                      {svc?.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {svc?.features?.map((f) =>
                    <span
                      key={f}
                      className="text-xs text-white/60 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
                      
                          {f}
                        </span>
                    )}
                    </div>
                  </div>
                </div>
              </div>;


            if (svc?.id === "meals") {
              return (
                <Link key={svc?.id} href="/weekly-menu" className={`${svc?.span} block`}>
                  {cardContent}
                </Link>);

            }

            return cardContent;
          })}
        </div>

        {/* Bottom CTA */}
        <div className="srv-reveal reveal hidden-init mt-10 text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#C4622D] hover:text-[#A04E22] transition-colors group">
            
            Browse the full menu
            <Icon
              name="ArrowRightIcon"
              size={16}
              className="group-hover:translate-x-1 transition-transform" />
            
          </Link>
        </div>
      </div>
    </section>);

}