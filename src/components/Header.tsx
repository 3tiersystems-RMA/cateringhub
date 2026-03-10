"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppLogo from "@/components/ui/AppLogo";
import Icon from "@/components/ui/AppIcon";

const navLinks = [
  { label: "Home", href: "/homepage" },
  { label: "Menu & Order", href: "/products" },
];

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-black/95 backdrop-blur-xl shadow-warm border-b border-[#333]"
          : "bg-black"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-18 flex items-center justify-between py-4">
        {/* Logo */}
        <Link href="/homepage" className="flex items-center gap-2 group">
          <AppLogo
            size={64}
            iconName="FireIcon"
            text="CateringHub"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks?.map((link) => {
            const isActive = pathname === link?.href;
            return (
              <Link
                key={link?.href}
                href={link?.href}
                className={`text-sm font-medium tracking-wide transition-colors duration-200 relative group ${
                  isActive
                    ? "text-[#C4622D]"
                    : "text-[#D4CFC9] hover:text-white"
                }`}
              >
                {link?.label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-0.5 bg-[#C4622D] transition-all duration-300 ${
                    isActive ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#A09890]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot inline-block" />
            Now Taking Orders
          </div>
          <Link
            href="/products"
            className="bg-[#C4622D] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#A04E22] transition-all duration-200 shadow-terra hover:shadow-terra-lg hover:-translate-y-0.5"
          >
            Order Now
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg text-[#D4CFC9] hover:bg-[#222] transition-colors"
          aria-label="Toggle navigation"
        >
          <Icon name={mobileOpen ? "XMarkIcon" : "Bars3Icon"} size={22} />
        </button>
      </div>
      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-black/98 backdrop-blur-xl border-t border-[#333] px-4 py-6 space-y-4">
          {navLinks?.map((link) => {
            const isActive = pathname === link?.href;
            return (
              <Link
                key={link?.href}
                href={link?.href}
                onClick={() => setMobileOpen(false)}
                className={`block py-2 text-base font-medium transition-colors ${
                  isActive ? "text-[#C4622D]" : "text-[#D4CFC9]"
                }`}
              >
                {link?.label}
              </Link>
            );
          })}
          <Link
            href="/products"
            onClick={() => setMobileOpen(false)}
            className="block w-full text-center bg-[#C4622D] text-white px-5 py-3 rounded-full text-sm font-semibold mt-2"
          >
            Order Now
          </Link>
        </div>
      )}
    </header>
  );
}