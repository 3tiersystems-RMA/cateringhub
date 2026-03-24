'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";
import { APP_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

interface SocialLink {
  platform: string;
  url: string;
  display_order: number;
}

// Social icon positions in the sprite image (Screenshot_2026-03-24_at_08.52.59)
// The image contains: Facebook, X/Twitter, Instagram, Pinterest, and a custom logo icon
// We render the full image and use CSS clip/object-position to show each icon
const SOCIAL_ICONS: { platform: string; label: string; bgPosition: string }[] = [
  { platform: 'facebook',  label: 'Facebook',  bgPosition: '0% 50%' },
  { platform: 'twitter',   label: 'X / Twitter', bgPosition: '25% 50%' },
  { platform: 'instagram', label: 'Instagram', bgPosition: '50% 50%' },
  { platform: 'pinterest', label: 'Pinterest', bgPosition: '75% 50%' },
  { platform: 'custom',    label: 'Custom',    bgPosition: '100% 50%' },
];

export default function Footer() {
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('social_links')
        .select('platform, url, display_order')
        .order('display_order');
      if (data) setSocialLinks(data);
    };
    load();
  }, []);

  const getUrl = (platform: string) =>
    socialLinks.find(s => s.platform === platform)?.url || '#';

  return (
    <footer className="border-t border-[#DDD5C8] bg-[#F5F0E8]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-3">
              <AppLogo size={64} iconName="FireIcon" text={APP_NAME} textClassName="text-[#8C8278]" className="[&>img]:bg-black [&>img]:rounded-md" />
              <img
                src="/assets/images/SANHA_CK_Transparent-1774211701949.png"
                alt="SANHA Halaal certified logo"
                className="h-16 w-auto object-contain"
              />
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-6 text-sm font-medium text-[#8C8278]">
            <Link href="/homepage" className="hover:text-[#C4622D] transition-colors">
              Home
            </Link>
            <Link href="/products" className="hover:text-[#C4622D] transition-colors">
              Menu & Order
            </Link>
            <Link href="/weekly-menu" className="hover:text-[#C4622D] transition-colors">
              Weekly Menu
            </Link>
            <a href="#services" className="hover:text-[#C4622D] transition-colors">
              Services
            </a>
            <a href="#contact" className="hover:text-[#C4622D] transition-colors">
              Contact
            </a>
          </nav>

          {/* Social + Copyright */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-2">
              {SOCIAL_ICONS.map(({ platform, label }) => (
                <a
                  key={platform}
                  href={getUrl(platform)}
                  aria-label={label}
                  target={getUrl(platform) !== '#' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <img
                    src="/assets/images/Screenshot_2026-03-24_at_08.52.59-1774335297294.png"
                    alt={label}
                    className="h-8 w-8 object-cover rounded-full border border-[#DDD5C8]"
                    style={{
                      objectPosition: (() => {
                        const positions: Record<string, string> = {
                          facebook: '0% 50%',
                          twitter: '25% 50%',
                          instagram: '50% 50%',
                          pinterest: '75% 50%',
                          custom: '100% 50%',
                        };
                        return positions[platform] || '0% 50%';
                      })(),
                      width: '32px',
                      height: '32px',
                    }}
                  />
                </a>
              ))}
            </div>
            <p className="text-xs text-[#B5ADA5]">
              © {new Date()?.getFullYear()} {APP_NAME} · Privacy · Terms | Powered by SERiTi Digital Studio
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}