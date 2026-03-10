"use client";

import Link from "next/link";
import Icon from "@/components/ui/AppIcon";

export default function ContactBanner() {
  return (
    <section id="contact" className="py-20 bg-[#1A1612]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid-warm opacity-10 absolute inset-0 pointer-events-none" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-3">
              Let&apos;s Talk Food
            </p>
            <h2 className="font-display text-3xl md:text-5xl font-semibold text-white leading-tight">
              Planning an Event?
              <br />
              <span className="italic text-[#D97B4A]">We&apos;d Love to Help.</span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="tel:+27872652262"
              className="inline-flex items-center gap-3 bg-white/10 border border-white/15 text-white px-6 py-3.5 rounded-full text-sm font-medium hover:bg-white/15 transition-all"
            >
              <Icon name="PhoneIcon" size={16} />
              087 265 2262
            </a>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-[#C4622D] text-white px-6 py-3.5 rounded-full text-sm font-semibold hover:bg-[#A04E22] transition-all shadow-terra"
            >
              Order Online
              <Icon name="ArrowRightIcon" size={16} />
            </Link>
          </div>
        </div>

        {/* Info Row */}
        <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: "MapPinIcon" as const, label: "Service Area", value: "Western Cape" },
            { icon: "ClockIcon" as const, label: "Hours", value: "Mon–Sat, 8am–8pm" },
            { icon: "EnvelopeIcon" as const, label: "Email", value: "info@cardamomkitchen.co.za" },
            { icon: "CalendarDaysIcon" as const, label: "Lead Time", value: "48 hrs minimum" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#C4622D]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon name={item.icon} size={14} className="text-[#C4622D]" />
              </div>
              <div>
                <p className="text-xs text-white/35 uppercase tracking-wider font-mono">{item.label}</p>
                <p className="text-sm text-white/75 mt-0.5 font-medium">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}