'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import {
  WorkspaceTab,
  StaffRole,
  PermAction,
  roleCanAccessTab,
  canDo,
  DEFAULT_TAB_BY_ROLE,
} from '@/app/staff/workspace/rbac';
import GalleryTab from '@/app/staff/workspace/components/tabs/GalleryTab';
import CategoriesTab from '@/app/staff/workspace/components/tabs/CategoriesTab';
import WeeklyMenuTab from '@/app/staff/workspace/components/tabs/WeeklyMenuTab';
import TestimonialsTab from '@/app/staff/workspace/components/tabs/TestimonialsTab';
import ReportingTab from '@/app/staff/workspace/components/tabs/ReportingTab';
import AnalyticsTab from '@/app/staff/workspace/components/tabs/AnalyticsTab';
import ProductsTab from '@/app/staff/workspace/components/tabs/ProductsTab';
import StaffManagementTab from '@/app/staff/workspace/components/tabs/StaffManagementTab';
import SocialMediaTab from '@/app/staff/workspace/components/tabs/SocialMediaTab';
import SectionVisibilityTab from '@/app/staff/workspace/components/tabs/SectionVisibilityTab';
import PackageVisibilityTab from '@/app/staff/workspace/components/tabs/PackageVisibilityTab';
import HomepageCardsTab from '@/app/staff/workspace/components/tabs/HomepageCardsTab';
import MealVouchersTab from '@/app/staff/workspace/components/tabs/MealVouchersTab';
import DiscountVouchersTab from '@/app/staff/workspace/components/tabs/DiscountVouchersTab';
import type { StaffMember } from '@/app/staff/workspace/types';
import FailedTransactions from '@/app/staff/workspace/components/FailedTransactions';






import CookingClassSettings from '@/app/staff/workspace/components/CookingClassSettings';
import CookingClassCustomers from '@/app/staff/workspace/components/CookingClassCustomers';
import CookingClassAnalytics from '@/app/staff/workspace/components/CookingClassAnalytics';
import EventRegistrations from '@/app/staff/workspace/components/EventRegistrations';
import OrganisationDetails from '@/app/staff/workspace/components/OrganisationDetails';
import CorrespondenceSettings from '@/app/staff/workspace/components/CorrespondenceSettings';
import OrderManagement from '@/app/staff/workspace/components/OrderManagement';
import CustomerOrderHistory from '@/app/staff/workspace/components/CustomerOrderHistory';
import AbandonedCarts from '@/app/staff/workspace/components/AbandonedCarts';
import MediaProducts from '@/app/staff/workspace/components/MediaProducts';
import PaymentConfirmation from '@/app/staff/workspace/components/PaymentConfirmation';
import CollectionNotification from '@/app/staff/workspace/components/CollectionNotification';
import EventManagement from '@/app/staff/workspace/components/EventManagement';
import GoogleDriveDocuments from '@/app/staff/workspace/components/GoogleDriveDocuments';
import GlobalSettings from '@/app/staff/workspace/components/GlobalSettings';
import EventManagementSettings from '@/app/staff/workspace/components/EventManagementSettings';
import EventManagementCustomers from '@/app/staff/workspace/components/EventManagementCustomers';
import EventManagementRegistrations from '@/app/staff/workspace/components/EventManagementRegistrations';
import EventBookingRegistrations from '@/app/staff/workspace/components/EventBookingRegistrations';
import EventManagementAnalytics from '@/app/staff/workspace/components/EventManagementAnalytics';
import EventBookingConfirmation from '@/app/staff/workspace/components/EventBookingConfirmation';
import CookingClassConfirmation from '@/app/staff/workspace/components/CookingClassConfirmation';
import BookingsCredit from '@/app/staff/workspace/components/BookingsCredit';
import CustomerRegistrations from '@/app/staff/workspace/components/CustomerRegistrations';
import DatabaseSchema from '@/app/staff/workspace/components/DatabaseSchema';













function RoleBadge({ role }: { role: StaffRole }) {
  const config: Record<StaffRole, { label: string; className: string }> = {
    super_admin: { label: 'Super Admin', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
    admin: { label: 'Admin', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
    staff: { label: 'Staff', className: 'bg-[#e9e0cf] text-[#5C5347] border border-[#DDD5C8]' },
  };
  const { label, className } = config[role] || config.staff;
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${className}`}>{label}</span>
  );
}

function InactivityWarningModal({
  countdown,
  onStayLoggedIn,
  onLogOut,
}: {
  countdown: number;
  onStayLoggedIn: () => void;
  onLogOut: () => void;
}) {
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeStr = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#DDD5C8] w-full max-w-md mx-4 p-8">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 0v4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-[#1A1612] text-center mb-2">Session Expiring Soon</h2>
        <p className="text-[#5C5347] text-sm text-center mb-5">
          You have been inactive for 3 minutes. You will be automatically logged out in 2 minutes.
        </p>
        <div className="flex justify-center mb-6">
          <div className="bg-[#e9e0cf] border border-[#DDD5C8] rounded-xl px-6 py-3 text-center">
            <p className="text-xs text-[#8C8278] mb-1 font-medium uppercase tracking-wide">Logging out in</p>
            <p className="text-3xl font-bold text-[#C4622D] tabular-nums">{timeStr}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onStayLoggedIn}
            className="flex-1 bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-all duration-200"
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogOut}
            className="flex-1 bg-white text-[#5C5347] border border-[#DDD5C8] py-3 rounded-xl font-semibold text-sm hover:bg-[#F5F0E8] transition-all duration-200"
          >
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffWorkspacePage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<StaffMember | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('products');
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [siteContentOpen, setSiteContentOpen] = useState(false);
  const [vouchersMenuOpen, setVouchersMenuOpen] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [cookingClassesOpen, setCookingClassesOpen] = useState(false);
  const [eventManagementOpen, setEventManagementOpen] = useState(false);
  const [customerRelationsOpen, setCustomerRelationsOpen] = useState(false);

  // Inactivity timer
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(120);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setShowInactivityWarning(false);
    setInactivityCountdown(120);
    inactivityTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
      let cd = 120;
      countdownTimerRef.current = setInterval(() => {
        cd -= 1;
        setInactivityCountdown(cd);
        if (cd <= 0) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          handleLogout();
        }
      }, 1000);
    }, 3 * 60 * 1000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/staff/login');
  };

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/staff/login'); return; }
      setUser(authUser);
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      if (!profile || !['admin', 'staff', 'super_admin'].includes(profile.role)) {
        router.push('/staff/login');
        return;
      }
      setUserProfile(profile);
      // Land the user on a tab their role can actually access (staff can't see the
      // default 'products' tab), and never leave them stranded on a forbidden tab.
      setActiveTab((prev) =>
        roleCanAccessTab(profile.role, prev)
          ? prev
          : DEFAULT_TAB_BY_ROLE[profile.role as StaffRole] ?? 'orders'
      );
    };
    checkAuth().then(() => {
      // Only start inactivity timer for non-super_admin roles
      supabase.auth.getUser().then(({ data: { user: u } }) => {
        if (!u) return;
        supabase.from('user_profiles').select('role').eq('id', u.id).single().then(({ data: p }) => {
          if (p?.role === 'super_admin') return;
          resetInactivityTimer();
          const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
          events.forEach(e => window.addEventListener(e, resetInactivityTimer));
        });
      });
    });
    return () => {
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // ─── Tab change handler ───────────────────────────────────────────────────────
  const handleTabChange = (tab: WorkspaceTab) => {
    // Defense-in-depth: ignore navigation to tabs the current role can't access.
    if (!roleCanAccessTab(userProfile?.role, tab)) return;
    setActiveTab(tab);
  };

  // Role-scoped tab visibility helpers for the sidebar.
  const canTab = (tab: WorkspaceTab) => roleCanAccessTab(userProfile?.role, tab);
  const canAnyTab = (...tabs: WorkspaceTab[]) => tabs.some(canTab);
  // Action-level gate per the client role matrix (view/create/edit/delete/status/redeem).
  const can = (tab: WorkspaceTab, action: PermAction) => canDo(userProfile?.role, tab, action);
  // Role gate for standalone /staff/* pages linked from the sidebar.
  const canRole = (...roles: StaffRole[]) =>
    !!userProfile?.role && roles.includes(userProfile.role as StaffRole);

  return (
    <>
      {showInactivityWarning && (
        <InactivityWarningModal countdown={inactivityCountdown} onStayLoggedIn={resetInactivityTimer} onLogOut={handleLogout} />
      )}

      <div className="h-screen bg-[#F5F0E8] overflow-hidden">
        <header className="bg-white border-b border-[#DDD5C8] px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <AppLogo className="h-8 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-[#1A1612]">Staff Workspace</h1>
              {userProfile && (
                <p className="text-xs text-[#8C8278] mt-0.5">{userProfile.full_name} · <RoleBadge role={userProfile.role} /></p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/homepage')} className="text-sm text-[#5C5347] hover:text-[#C4622D] transition-colors">View Site</button>
            <button onClick={handleLogout} className="text-sm bg-[#F5F0E8] border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">Log Out</button>
          </div>
        </header>

        <div className="flex h-[calc(100vh-73px)] overflow-hidden">
          <aside className="w-64 bg-white border-r border-[#DDD5C8] h-full overflow-y-auto flex-shrink-0">
            <nav className="py-4 space-y-0.5">

              {/* ── Site Content (collapsible) ── */}
              {canAnyTab('staff', 'homepage_cards', 'gallery', 'section_visibility', 'correspondence_settings', 'package_visibility', 'testimonials', 'social_media', 'organisation_details', 'global_settings') && (
                <>
                  <button
                    onClick={() => setSiteContentOpen(prev => !prev)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                      ['staff', 'homepage_cards', 'testimonials', 'social_media', 'gallery', 'section_visibility', 'correspondence_settings', 'package_visibility', 'organisation_details', 'global_settings'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                    }`}
                  >
                    <span className="text-base">📁</span>
                    <span className="flex-1">Site Content</span>
                    <span className="text-xs">{siteContentOpen ? '▲' : '▼'}</span>
                  </button>
                  {siteContentOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                      {canTab('global_settings') && (
                        <button onClick={() => { handleTabChange('global_settings'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'global_settings' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">⚙️</span><span>Global Settings</span>
                        </button>
                      )}
                      {canTab('organisation_details') && (
                        <button onClick={() => { handleTabChange('organisation_details'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'organisation_details' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🏢</span><span>Organisation Details</span>
                        </button>
                      )}
                      {canTab('staff') && (
                        <button onClick={() => { handleTabChange('staff'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'staff' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">👥</span><span>Staff Management</span>
                        </button>
                      )}
                      {canTab('social_media') && (
                        <button onClick={() => { handleTabChange('social_media'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'social_media' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🔗</span><span>Social Media</span>
                        </button>
                      )}
                      {canTab('correspondence_settings') && (
                        <button onClick={() => { handleTabChange('correspondence_settings'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'correspondence_settings' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                        <span className="text-base">✉️</span><span>Correspondence Settings</span>
                        </button>
                      )}
                      {canTab('section_visibility') && (
                        <button onClick={() => { handleTabChange('section_visibility'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'section_visibility' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                        <span className="text-base">👁️</span><span>Section Visibility</span>
                        </button>
                      )}
                      {canTab('package_visibility') && (
                        <button onClick={() => { handleTabChange('package_visibility'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'package_visibility' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                        <span className="text-base">📦</span><span>Package Visibility</span>
                        </button>
                      )}
                      {canTab('homepage_cards') && (
                        <button onClick={() => { handleTabChange('homepage_cards'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'homepage_cards' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                        <span className="text-base">🏠</span><span>Home Page Cards</span>
                        </button>
                      )}
                      {canTab('testimonials') && (
                        <button onClick={() => { handleTabChange('testimonials'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'testimonials' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">⭐</span><span>Testimonials</span>
                        </button>
                      )}
                      {canTab('gallery') && (
                        <button onClick={() => { handleTabChange('gallery'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'gallery' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                        <span className="text-base">🖼️</span><span>Gallery</span>
                        </button>
                      )}
                      {canTab('categories') && (
                        <button onClick={() => { handleTabChange('categories'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'categories' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🏷️</span><span>Categories</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Cooking & Baking Classes ── */}
              {canAnyTab('cooking_classes', 'cooking_class_customers', 'cooking_class_analytics', 'cooking_class_confirmation', 'event_registrations') && (
                <>
                  <button
                    onClick={() => setCookingClassesOpen(prev => !prev)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                      ['cooking_classes', 'cooking_class_customers', 'cooking_class_analytics', 'cooking_class_confirmation', 'event_registrations'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                    }`}
                  >
                    <span className="text-base">👨‍🍳</span>
                    <span className="flex-1">Class Bookings</span>
                    <span className="text-xs">{cookingClassesOpen ? '▲' : '▼'}</span>
                  </button>
                  {cookingClassesOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                      {/* ── Settings (sub-menu) ── */}
                      {canTab('cooking_classes') && (
                        <button
                          onClick={() => { handleTabChange('cooking_classes'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'cooking_classes' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">⚙️</span>
                          <span>Class Settings</span>
                        </button>
                      )}
                      {/* ── Class Customers (sub-menu) ── */}
                      {canTab('cooking_class_customers') && (
                        <button
                          onClick={() => { handleTabChange('cooking_class_customers'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'cooking_class_customers' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">🧑‍🤝‍🧑</span>
                          <span>Class Customers</span>
                        </button>
                      )}
                      {/* ── Event Registrations (sub-menu) ── */}
                      {canTab('event_registrations') && (
                        <button
                          onClick={() => { handleTabChange('event_registrations'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'event_registrations' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">📋</span>
                          <span>Class Registrations</span>
                        </button>
                      )}
                      {/* ── Cooking Class Confirmation (sub-menu) ── */}
                      {canTab('cooking_class_confirmation') && (
                        <button
                          onClick={() => { handleTabChange('cooking_class_confirmation'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'cooking_class_confirmation' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">✅</span>
                          <span>Cooking Class Confirmation</span>
                        </button>
                      )}
                      {/* ── Analytics (sub-menu) ── */}
                      {canTab('cooking_class_analytics') && (
                        <button
                          onClick={() => { handleTabChange('cooking_class_analytics'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'cooking_class_analytics' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">📊</span>
                          <span>Classes Analytics</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Event Management ── */}
              {canAnyTab('event_management', 'event_management_customers', 'event_management_registrations', 'event_management_analytics', 'event_booking_confirmation', 'media_events', 'event_booking_registrations') && (
                <>
                  <button
                    onClick={() => setEventManagementOpen(prev => !prev)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                      ['event_management', 'event_management_customers', 'event_management_registrations', 'event_management_analytics', 'media_events', 'event_booking_registrations'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                    }`}
                  >
                    <span className="text-base">🎪</span>
                    <span className="flex-1">Event Bookings</span>
                    <span className="text-xs">{eventManagementOpen ? '▲' : '▼'}</span>
                  </button>
                  {eventManagementOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                      {canTab('event_management') && (
                        <button
                          onClick={() => { handleTabChange('event_management'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'event_management' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">⚙️</span>
                          <span>Event Settings</span>
                        </button>
                      )}
                      {/* Events — moved from Customer Relations */}
                      {canTab('media_events') && (
                        <button onClick={() => { handleTabChange('media_events'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'media_events' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                          <span className="text-base">🎉</span><span>Events Marketing</span>
                        </button>
                      )}
                      {canTab('event_management_customers') && (
                        <button
                          onClick={() => { handleTabChange('event_management_customers'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'event_management_customers' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">🧑‍🤝‍🧑</span>
                          <span>Event Customers</span>
                        </button>
                      )}
                      {/* ── Event Registrations (sub-menu) ── */}
                      {canTab('event_booking_registrations') && (
                        <button
                          onClick={() => { handleTabChange('event_booking_registrations'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'event_booking_registrations' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">📋</span>
                          <span>Event Registrations</span>
                        </button>
                      )}
                      {canTab('event_booking_confirmation') && (
                        <button
                          onClick={() => { handleTabChange('event_booking_confirmation'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'event_booking_confirmation' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">✅</span>
                          <span>Event Booking Confirmation</span>
                        </button>
                      )}
                      {canTab('event_management_analytics') && (
                        <button
                          onClick={() => { handleTabChange('event_management_analytics'); }}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                            activeTab === 'event_management_analytics' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                          }`}
                        >
                          <span className="text-sm">📊</span>
                          <span>Events Analytics</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Weekly Menu ── */}
              {canTab('weekly_menu') && (
                <button onClick={() => { handleTabChange('weekly_menu'); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${activeTab === 'weekly_menu' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                  <span className="text-base">📅</span><span>Weekly Menu</span>
                </button>
              )}

              {/* ── Orders ── */}
              {canTab('orders') && (
                <button onClick={() => { handleTabChange('orders'); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${activeTab === 'orders' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                  <span className="text-base">📦</span><span>Order Management</span>
                </button>
              )}

              {/* ── Customer Order History ── */}
              {canTab('customer_order_history') && (
                <button onClick={() => { handleTabChange('customer_order_history'); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${activeTab === 'customer_order_history' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                  <span className="text-base">🔍</span><span>Customer Order History</span>
                </button>
              )}

              {/* ── Vouchers Information (collapsible) — includes Voucher Meal Status sub-item ── */}
              {(canAnyTab('vouchers', 'discount_vouchers') || canRole('super_admin', 'admin', 'staff')) && (
                <>
                  <button onClick={() => setVouchersMenuOpen(prev => !prev)} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${['vouchers', 'discount_vouchers'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                    <span className="text-base">🎟️</span><span className="flex-1">Vouchers Information</span><span className="text-xs">{vouchersMenuOpen ? '▲' : '▼'}</span>
                  </button>
                  {vouchersMenuOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                      {canRole('super_admin', 'admin', 'staff') && (
                        <button onClick={() => router.push('/staff/scanner')} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]">
                          <span className="text-base">📷</span><span>Voucher Meal Status</span>
                        </button>
                      )}
                      {canTab('vouchers') && (
                        <button onClick={() => { handleTabChange('vouchers'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'vouchers' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🍽️</span><span>Meal Vouchers</span>
                        </button>
                      )}
                      {canTab('discount_vouchers') && (
                        <button onClick={() => { handleTabChange('discount_vouchers'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'discount_vouchers' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🏷️</span><span>Discount Vouchers</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Reports (collapsible) ── */}
              {canAnyTab('reporting', 'analytics') && (
                <>
                  <button onClick={() => setReportsMenuOpen(prev => !prev)} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${['reporting', 'analytics'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                    <span className="text-base">📊</span><span className="flex-1">Orders Report</span><span className="text-xs">{reportsMenuOpen ? '▲' : '▼'}</span>
                  </button>
                  {reportsMenuOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                      {canTab('reporting') && (
                        <button onClick={() => { handleTabChange('reporting'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'reporting' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">📋</span><span>Reports Dashboard</span>
                        </button>
                      )}
                      {canTab('analytics') && (
                        <button onClick={() => { handleTabChange('analytics'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'analytics' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">📈</span><span>Orders Analytics</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Customer Relations (collapsible) ── */}
              {canAnyTab('media', 'cooking_class_customers', 'payment_confirmation', 'products', 'collection_notification', 'bookings_credit', 'customer_registrations', 'failed_transactions') && (
                <>
                  <button onClick={() => setMediaMenuOpen(prev => !prev)} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${['media', 'cooking_class_customers', 'payment_confirmation', 'products', 'collection_notification', 'bookings_credit', 'customer_registrations', 'failed_transactions'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                    <span className="text-base">🗂️</span><span className="flex-1">Customer Relations</span><span className="text-xs">{mediaMenuOpen ? '▲' : '▼'}</span>
                  </button>
                  {mediaMenuOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                      {/* 1. Customer Onboarding */}
                      {canTab('cooking_class_customers') && (
                        <a href="https://forms.gle/uc61CVtHvX6nUAnr9" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]`}>
                          <span className="text-base">🧑‍🤝‍🧑</span><span>Customer Onboarding</span>
                        </a>
                      )}
                      {/* 2. Products & Pricing */}
                      {canTab('products') && (
                        <button onClick={() => { handleTabChange('products'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'products' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🛒</span><span>Products &amp; Pricing</span>
                        </button>
                      )}
                      {/* 3. Customer Registrations */}
                      {canTab('customer_registrations') && (
                        <button onClick={() => { handleTabChange('customer_registrations'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'customer_registrations' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">📋</span><span>Customer Registrations</span>
                        </button>
                      )}
                      {/* 4. Payment Confirmation */}
                      {canTab('payment_confirmation') && (
                        <button onClick={() => { handleTabChange('payment_confirmation'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'payment_confirmation' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">✅</span><span>Order Payment Confirmation</span>
                        </button>
                      )}
                      {/* 5. Collection Notification */}
                      {canTab('collection_notification') && (
                        <button onClick={() => { handleTabChange('collection_notification'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'collection_notification' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🔔</span><span>Order Collection Notification</span>
                        </button>
                      )}
                      {/* 6. Bookings Credit */}
                      {canTab('bookings_credit') && (
                        <button onClick={() => { handleTabChange('bookings_credit'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'bookings_credit' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">💳</span><span>Bookings Credit</span>
                        </button>
                      )}
                      {/* 7. Failed Transactions */}
                      {canTab('failed_transactions') && (
                        <button onClick={() => { handleTabChange('failed_transactions'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'failed_transactions' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">❌</span><span>Failed Transactions</span>
                        </button>
                      )}
                      {/* 8. Document Management */}
                      {canTab('media') && (
                        <button onClick={() => { handleTabChange('media'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'media' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">📄</span><span>Document Management</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Abandoned Carts ── */}
              {canTab('abandoned_carts') && (
                <button onClick={() => { handleTabChange('abandoned_carts'); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${activeTab === 'abandoned_carts' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                  <span className="text-base">🛒</span><span>Abandoned Carts</span>
                </button>
              )}

              {/* ── Guide (standalone help page) ── */}
              {canRole('super_admin', 'admin', 'staff') && (
                <button onClick={() => {
  const role = userProfile?.role;
  if (role === 'super_admin') router.push('/staff/guide');
  else if (role === 'admin') router.push('/staff/guide/admin');
  else router.push('/staff/guide/staff');
}} className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]">
                  <span className="text-base">📖</span><span>User Guide</span>
                </button>
              )}

              {/* ── Database Schema ── */}
              {canTab('database_schema') && (
                <button onClick={() => { handleTabChange('database_schema'); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${activeTab === 'database_schema' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                  <span className="text-base">🗄️</span><span>Database Schema</span>
                </button>
              )}

            </nav>
          </aside>

          <main className="flex-1 overflow-y-auto">

            {/* ── COOKING CLASSES TAB ── */}
            {activeTab === 'cooking_classes' && (
              <CookingClassSettings isSuperAdmin={userProfile?.role === 'super_admin'} readOnly={!can('cooking_classes', 'edit')} isAdminOrAbove={canRole('admin', 'super_admin')} />
            )}

            {/* ── COOKING CLASS CUSTOMERS TAB ── */}
            {activeTab === 'cooking_class_customers' && (
              <CookingClassCustomers isSuperAdmin={userProfile?.role === 'super_admin'} />
            )}

            {/* ── COOKING CLASS ANALYTICS TAB ── */}
            {activeTab === 'cooking_class_analytics' && (
              <CookingClassAnalytics />
            )}

            {/* ── COOKING CLASS CONFIRMATION TAB ── */}
            {activeTab === 'cooking_class_confirmation' && (
              <CookingClassConfirmation userRole={userProfile?.role || ''} />
            )}

            {/* ── EVENT REGISTRATIONS TAB ── */}
            {activeTab === 'event_registrations' && (
              <div className="p-6">
                <EventRegistrations isSuperAdmin={userProfile?.role === 'super_admin'} userRole={userProfile?.role || ''} />
              </div>
            )}

            {/* ── ORGANISATION DETAILS TAB ── */}
            {activeTab === 'organisation_details' && (
              <OrganisationDetails />
            )}

            {activeTab === 'products' && <ProductsTab can={(a) => can('products', a)} />}

            {activeTab === 'staff' && <StaffManagementTab can={(a) => can('staff', a)} />}

            {activeTab === 'social_media' && <SocialMediaTab />}

            {activeTab === 'correspondence_settings' && (
              <CorrespondenceSettings readOnly={!can('correspondence_settings', 'edit')} />
            )}

            {activeTab === 'section_visibility' && <SectionVisibilityTab />}

            {activeTab === 'package_visibility' && <PackageVisibilityTab />}

            {activeTab === 'homepage_cards' && <HomepageCardsTab can={(a) => can('homepage_cards', a)} />}

            {activeTab === 'vouchers' && <MealVouchersTab can={(a) => can('vouchers', a)} />}

            {activeTab === 'discount_vouchers' && <DiscountVouchersTab can={(a) => can('discount_vouchers', a)} />}

            {/* ── ORDER MANAGEMENT TAB ── */}
            {activeTab === 'orders' && (
              <OrderManagement userRole={userProfile?.role || ''} />
            )}

            {/* ── CUSTOMER ORDER HISTORY TAB ── */}
            {activeTab === 'customer_order_history' && (
              <CustomerOrderHistory />
            )}

            {activeTab === 'abandoned_carts' && (<AbandonedCarts />)}

            {activeTab === 'media_products' && (<MediaProducts canManage={can('media_products', 'edit')} />)}

            {activeTab === 'payment_confirmation' && (
              <PaymentConfirmation userRole={userProfile?.role || ''} />
            )}

            {activeTab === 'collection_notification' && (
              <CollectionNotification userRole={userProfile?.role || ''} />
            )}

            {activeTab === 'media_events' && (
              <EventManagement
                canCreate={can('media_events', 'create')}
                canDelete={can('media_events', 'delete')}
              />
            )}

            {activeTab === 'media' && (
              <GoogleDriveDocuments canManage={can('media', 'edit')} />
            )}

            {activeTab === 'testimonials' && <TestimonialsTab can={(a) => can('testimonials', a)} />}

            {activeTab === 'gallery' && <GalleryTab can={(a) => can('gallery', a)} />}

            {activeTab === 'categories' && <CategoriesTab can={(a) => can('categories', a)} />}

            {activeTab === 'weekly_menu' && <WeeklyMenuTab can={(a) => can('weekly_menu', a)} />}

            {activeTab === 'reporting' && <ReportingTab />}

            {activeTab === 'analytics' && <AnalyticsTab />}

            {activeTab === 'global_settings' && <GlobalSettings />}

            {/* ── EVENT MANAGEMENT TABS ── */}
            {activeTab === 'event_management' && (
              <EventManagementSettings isSuperAdmin={userProfile?.role === 'super_admin'} readOnly={!can('event_management', 'edit')} isAdminOrAbove={canRole('admin', 'super_admin')} />
            )}

            {activeTab === 'event_management_customers' && (
              <EventManagementCustomers isSuperAdmin={userProfile?.role === 'super_admin'} />
            )}

            {/* ── EVENT BOOKING REGISTRATIONS TAB ── */}
            {activeTab === 'event_booking_registrations' && (
              <div className="p-6">
                <EventBookingRegistrations
                  isSuperAdmin={userProfile?.role === 'super_admin'}
                  userRole={userProfile?.role || ''}
                />
              </div>
            )}

            {activeTab === 'event_management_registrations' && (
              <div className="p-6">
                <EventManagementRegistrations isSuperAdmin={userProfile?.role === 'super_admin'} />
              </div>
            )}

            {activeTab === 'event_management_analytics' && (
              <EventManagementAnalytics />
            )}

            {activeTab === 'event_booking_confirmation' && (
              <EventBookingConfirmation userRole={userProfile?.role || ''} />
            )}

            {/* ── BOOKINGS CREDIT TAB ── */}
            {activeTab === 'bookings_credit' && (
              <BookingsCredit />
            )}

            {/* ── FAILED TRANSACTIONS TAB ── */}
            {activeTab === 'failed_transactions' && (
              <FailedTransactions isSuperAdmin={userProfile?.role === 'super_admin'} />
            )}

            {/* ── CUSTOMER REGISTRATIONS TAB ── */}
            {activeTab === 'customer_registrations' && (
              <CustomerRegistrations isSuperAdmin={userProfile?.role === 'super_admin'} />
            )}

            {/* ── DATABASE SCHEMA TAB ── */}
            {activeTab === 'database_schema' && (
              <div className="p-6">
                <DatabaseSchema />
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}