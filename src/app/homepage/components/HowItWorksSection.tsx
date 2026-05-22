"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/AppIcon";
import { getHomepageSectionVisibility } from "@/lib/homepage-sections";

const steps = [
  {
    number: "01",
    icon: "ClipboardDocumentListIcon" as const,
    title: "Choose Your Service",
    description:
      "Browse our menu and select from full catering packages, weekly meal prep subscriptions, or individual platters.",
    detail: "Takes about 5 minutes",
  },
  {
    number: "02",
    icon: "CalendarDaysIcon" as const,
    title: "Pick Your Date & Details",
    description:
      "Tell us your event date, guest count, dietary needs, and any special requests. We'll confirm availability within 2 hours.",
    detail: "48hr minimum lead time",
  },
  {
    number: "03",
    icon: "CreditCardIcon" as const,
    title: "Secure Your Booking",
    description:
      "Pay a 25% deposit online to lock in your date. We accept all major cards and EFT bank transfers.",
    detail: "Secure payment portal",
  },
  {
    number: "04",
    icon: "SparklesIcon" as const,
    title: "We Handle the Rest",
    description:
      "Our team preps, delivers, and serves. For catering, we arrive 90 minutes early for setup. You just enjoy the food.",
    detail: "Full setup & cleanup",
  },
];

export default function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [sectionVisible, setSectionVisible] = useState<boolean | null>(null);

  useEffect(() => {
    getHomepageSectionVisibility('the_process', true).then(setSectionVisible);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll(".hiw-reveal").forEach((el, i) => {
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
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  if (sectionVisible === false) return null;

  return (
    <section id="how-it-works" ref={sectionRef} className="py-24 md:py-32 bg-[#F5F0E8]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="hiw-reveal reveal hidden-init text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-3">
            / The Process
          </p>
          <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-[#1A1612] leading-tight">
            Effortless From
            <span className="italic text-[#C4622D]"> Start to Serve</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`hiw-reveal reveal hidden-init group relative bg-[#FAF7F2] border border-[#DDD5C8] rounded-4xl p-7 hover:border-[#C4622D]/40 hover:shadow-warm transition-all duration-400 overflow-hidden`}
            >
              {/* Left orange border accent */}
              <div className="absolute left-0 top-4 bottom-4 w-1 bg-[#C4622D] rounded-full" />

              {/* Connector line (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 -right-3 w-6 h-px bg-[#DDD5C8] z-10" />
              )}

              {/* Number */}
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-5xl font-bold text-[#C4622D] leading-none">
                  {step.number}
                </span>
                <div className="w-10 h-10 rounded-2xl bg-[#C4622D]/10 border border-[#C4622D]/20 flex items-center justify-center group-hover:bg-[#C4622D] group-hover:border-[#C4622D] transition-all duration-300">
                  <Icon name={step.icon} size={18} className="text-[#C4622D] group-hover:text-white transition-colors" />
                </div>
              </div>

              <h3 className="font-display text-lg font-semibold text-[#1A1612] mb-3">
                {step.title}
              </h3>
              <p className="text-sm text-[#8C8278] leading-relaxed mb-4">
                {step.description}
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#C4622D] bg-[#C4622D]/08 px-2.5 py-1 rounded-full border border-[#C4622D]/15">
                <span className="w-1 h-1 rounded-full bg-[#C4622D]" />
                {step.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="hiw-reveal reveal hidden-init mt-14 text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-3 bg-[#1A1612] text-white px-10 py-4 rounded-full text-sm font-semibold hover:bg-[#2C2520] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-warm"
          >
            Start Your Order
            <Icon name="ArrowRightIcon" size={16} />
          </Link>
          <p className="mt-4 text-xs text-[#B5ADA5] font-mono">
            No commitment required · Free quote within 24 hours
          </p>
        </div>
      </div>
    </section>
  );
}