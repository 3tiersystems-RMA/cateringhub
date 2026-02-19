import Link from "next/link";
import AppLogo from "@/components/ui/AppLogo";
import Icon from "@/components/ui/AppIcon";

export default function Footer() {
  return (
    <footer className="border-t border-[#DDD5C8] bg-[#F5F0E8]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <AppLogo size={64} iconName="FireIcon" text="CateringHub" />
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-6 text-sm font-medium text-[#8C8278]">
            <Link href="/homepage" className="hover:text-[#C4622D] transition-colors">
              Home
            </Link>
            <Link href="/products" className="hover:text-[#C4622D] transition-colors">
              Menu & Order
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
            <div className="flex items-center gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="p-2 rounded-full border border-[#DDD5C8] text-[#8C8278] hover:border-[#C4622D] hover:text-[#C4622D] transition-all"
              >
                <Icon name="CameraIcon" size={16} />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="p-2 rounded-full border border-[#DDD5C8] text-[#8C8278] hover:border-[#C4622D] hover:text-[#C4622D] transition-all"
              >
                <Icon name="GlobeAltIcon" size={16} />
              </a>
              <a
                href="#"
                aria-label="Phone"
                className="p-2 rounded-full border border-[#DDD5C8] text-[#8C8278] hover:border-[#C4622D] hover:text-[#C4622D] transition-all"
              >
                <Icon name="PhoneIcon" size={16} />
              </a>
            </div>
            <p className="text-xs text-[#B5ADA5]">
              © 2026 CateringHub LLC · Privacy · Terms
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}