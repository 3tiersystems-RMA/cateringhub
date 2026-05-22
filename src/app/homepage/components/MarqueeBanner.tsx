"use client";

import { useEffect, useState } from "react";
import { getTickerBannerSettings } from "@/lib/homepage-sections";

export default function MarqueeBanner() {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [bannerText, setBannerText] = useState("Now Accepting 2027 Bookings");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTickerBannerSettings()?.then(({ isVisible, bannerText }) => {
      setIsVisible(isVisible);
      if (bannerText) setBannerText(bannerText);
      setLoaded(true);
    });
  }, []);

  // Don't render anything until DB value is confirmed
  if (!loaded || !isVisible) return null;

  const items = Array(8)?.fill(bannerText);

  return (
    <div className="border-y border-[#DDD5C8] bg-[#EDE7DA] overflow-hidden py-4">
      <div className="marquee-track">
        {items?.map((item, i) => (
          <span key={i} className="flex items-center gap-6 mr-6">
            <span className="inline-flex items-center gap-2 border border-[#C4622D] rounded-full px-5 py-2">
              <span className="w-2 h-2 rounded-full bg-[#C4622D] flex-shrink-0" />
              <span className="text-sm font-mono uppercase tracking-widest text-[#C4622D] whitespace-nowrap font-semibold">
                {item}
              </span>
            </span>
            <span className="text-[#C4622D] text-lg">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}