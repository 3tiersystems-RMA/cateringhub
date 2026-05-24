"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppLogo from "@/components/ui/AppLogo";
import Icon from "@/components/ui/AppIcon";

const navLinks = [
  { label: "Home", href: "/homepage" },
  { label: "Menu & Order", href: "/products" },
  { label: "Meal Vouchers", href: "/vouchers" },
];

const eventsSubLinks = [
  { label: "Current Events", href: "/events#current" },
  { label: "Past Events", href: "/events#past" },
];

const customerProfileSubLinks = [
  { label: "View Profile", href: "/customer-profile" },
  { label: "Order History", href: "/order-history" },
  { label: "Voucher Dashboard", href: "/customer-dashboard" },
];

export default function Header() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [mobileEventsOpen, setMobileEventsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (eventsDropdownRef.current && !eventsDropdownRef.current.contains(e.target as Node)) {
        setEventsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isCustomerProfileActive =
    mounted && (pathname === "/customer-profile" || pathname === "/order-history" || pathname === "/customer-dashboard");
  const isEventsActive = mounted && pathname === "/events";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        mounted && scrolled
          ? "bg-black/95 backdrop-blur-xl shadow-warm border-b border-[#333]"
          : "bg-black"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-18 flex items-center justify-between py-4">
        {/* Logo */}
        <Link href="/homepage" className="flex items-center gap-2 group">
          <AppLogo size={80} />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks?.map((link) => {
            const isActive = mounted && pathname === link?.href;
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

          {/* Events Dropdown */}
          <div className="relative" ref={eventsDropdownRef}>
            <button
              onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
              className={`flex items-center gap-1.5 text-sm font-medium tracking-wide transition-colors duration-200 relative group ${
                isEventsActive
                  ? "text-[#C4622D]"
                  : "text-[#D4CFC9] hover:text-white"
              }`}
            >
              Events
              <Icon
                name={eventsDropdownOpen ? "ChevronUpIcon" : "ChevronDownIcon"}
                size={14}
              />
              <span
                className={`absolute -bottom-0.5 left-0 h-0.5 bg-[#C4622D] transition-all duration-300 ${
                  isEventsActive ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </button>

            {eventsDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-44 bg-[#141414] border border-[#2A2A2A] rounded-xl shadow-xl overflow-hidden z-50">
                <Link
                  href="/events"
                  onClick={() => { setEventsDropdownOpen(false); }}
                  className={`flex items-center gap-2.5 px-4 py-3 text-sm transition-colors ${
                    isEventsActive
                      ? "bg-[#C4622D]/10 text-[#C4622D]"
                      : "text-[#D4CFC9] hover:bg-[#1E1E1E] hover:text-white"
                  }`}
                >
                  <Icon name="CalendarDaysIcon" size={15} />
                  Current Events
                </Link>
                <Link
                  href="/events?tab=past"
                  onClick={() => { setEventsDropdownOpen(false); }}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm transition-colors text-[#D4CFC9] hover:bg-[#1E1E1E] hover:text-white"
                >
                  <Icon name="ClockIcon" size={15} />
                  Past Events
                </Link>
              </div>
            )}
          </div>

          {/* Customer Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className={`flex items-center gap-1.5 text-sm font-medium tracking-wide transition-colors duration-200 relative group ${
                isCustomerProfileActive
                  ? "text-[#C4622D]"
                  : "text-[#D4CFC9] hover:text-white"
              }`}
            >
              Customer Profile
              <Icon
                name={profileDropdownOpen ? "ChevronUpIcon" : "ChevronDownIcon"}
                size={14}
              />
              <span
                className={`absolute -bottom-0.5 left-0 h-0.5 bg-[#C4622D] transition-all duration-300 ${
                  isCustomerProfileActive ? "w-full" : "w-0 group-hover:w-full"
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-44 bg-[#141414] border border-[#2A2A2A] rounded-xl shadow-xl overflow-hidden z-50">
                {customerProfileSubLinks.map((sub) => {
                  const isSubActive = pathname === sub.href;
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setProfileDropdownOpen(false)}
                      className={`flex items-center gap-2.5 px-4 py-3 text-sm transition-colors ${
                        isSubActive
                          ? "bg-[#C4622D]/10 text-[#C4622D]"
                          : "text-[#D4CFC9] hover:bg-[#1E1E1E] hover:text-white"
                      }`}
                    >
                      <Icon
                        name={sub.label === "View Profile" ? "UserCircleIcon" : sub.label === "Voucher Dashboard" ? "TicketIcon" : "ClipboardDocumentListIcon"}
                        size={15}
                      />
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
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

          {/* Mobile Events */}
          <div>
            <button
              onClick={() => setMobileEventsOpen(!mobileEventsOpen)}
              className={`flex items-center justify-between w-full py-2 text-base font-medium transition-colors ${
                isEventsActive ? "text-[#C4622D]" : "text-[#D4CFC9]"
              }`}
            >
              Events
              <Icon
                name={mobileEventsOpen ? "ChevronUpIcon" : "ChevronDownIcon"}
                size={16}
              />
            </button>
            {mobileEventsOpen && (
              <div className="pl-4 mt-1 space-y-1 border-l border-[#2A2A2A]">
                <Link
                  href="/events"
                  onClick={() => { setMobileOpen(false); setMobileEventsOpen(false); }}
                  className="flex items-center gap-2 py-2 text-sm transition-colors text-[#A09890] hover:text-white"
                >
                  <Icon name="CalendarDaysIcon" size={14} />
                  Current Events
                </Link>
                <Link
                  href="/events?tab=past"
                  onClick={() => { setMobileOpen(false); setMobileEventsOpen(false); }}
                  className="flex items-center gap-2 py-2 text-sm transition-colors text-[#A09890] hover:text-white"
                >
                  <Icon name="ClockIcon" size={14} />
                  Past Events
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Customer Profile */}
          <div>
            <button
              onClick={() => setMobileProfileOpen(!mobileProfileOpen)}
              className={`flex items-center justify-between w-full py-2 text-base font-medium transition-colors ${
                isCustomerProfileActive ? "text-[#C4622D]" : "text-[#D4CFC9]"
              }`}
            >
              Customer Profile
              <Icon
                name={mobileProfileOpen ? "ChevronUpIcon" : "ChevronDownIcon"}
                size={16}
              />
            </button>
            {mobileProfileOpen && (
              <div className="pl-4 mt-1 space-y-1 border-l border-[#2A2A2A]">
                {customerProfileSubLinks.map((sub) => {
                  const isSubActive = pathname === sub.href;
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => { setMobileOpen(false); setMobileProfileOpen(false); }}
                      className={`flex items-center gap-2 py-2 text-sm transition-colors ${
                        isSubActive ? "text-[#C4622D]" : "text-[#A09890] hover:text-white"
                      }`}
                    >
                      <Icon
                        name={sub.label === "View Profile" ? "UserCircleIcon" : sub.label === "Voucher Dashboard" ? "TicketIcon" : "ClipboardDocumentListIcon"}
                        size={14}
                      />
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

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