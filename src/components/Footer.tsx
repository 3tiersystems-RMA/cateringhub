'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from 'next/navigation';
import AppLogo from "@/components/ui/AppLogo";
import { APP_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import Icon from '@/components/ui/AppIcon';


interface SocialLink {
  platform: string;
  url: string;
  display_order: number;
}

// SVG icons for each social platform
const FacebookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
  </svg>
);

const SOCIAL_ICONS: { platform: string; label: string; Icon: React.FC }[] = [
  { platform: 'facebook',  label: 'Facebook',  Icon: FacebookIcon },
  { platform: 'twitter',   label: 'X / Twitter', Icon: XIcon },
  { platform: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { platform: 'custom',    label: APP_NAME,    Icon: () => (
    <img src="/assets/images/Luv_Cape_Town-1779196261692.png" alt="Luv Cape Town" className="w-4 h-4 object-contain rounded-full" />
  )},
];

export default function Footer() {
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

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

  const isHomepage = pathname === '/homepage' || pathname === '/';

  return (
    <footer className="border-t border-[#DDD5C8] bg-[#e9e0cf]">
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
            <Link href="/contact" className="hover:text-[#C4622D] transition-colors">
              Contact
            </Link>
            <Link href="/staff/login" className="hover:text-[#C4622D] transition-colors">
              Admin Portal
            </Link>
          </nav>

          {/* Social + Copyright */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-2">
              {SOCIAL_ICONS.map(({ platform, label, Icon }) => (
                <a
                  key={platform}
                  href={getUrl(platform)}
                  aria-label={label}
                  target={getUrl(platform) !== '#' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="hover:opacity-80 transition-opacity"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center${platform !== 'custom' ? ' bg-black' : ' bg-white'}`}>
                    <Icon />
                  </div>
                </a>
              ))}
            </div>
            <p className="text-xs text-[#B5ADA5]">
              © {currentYear} {APP_NAME} · <Link href="/privacy" className="hover:text-[#C4622D] transition-colors">Privacy</Link> · <Link href="/terms" className="hover:text-[#C4622D] transition-colors">Terms</Link> | Powered by SERiTi Digital Studio
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
