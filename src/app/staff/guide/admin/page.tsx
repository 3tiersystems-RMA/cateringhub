'use client';

import AppLogo from '@/components/ui/AppLogo';
import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import AppImage from '@/components/ui/AppImage';

function exportGuideAsHTML() {
  const mainEl = document.getElementById('guide-main-content');
  if (!mainEl) return;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME} — Admin Guide</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #e9e0cf; color: #1A1612; padding: 0; }
    .page-header { background: #fff; border-bottom: 1px solid #DDD5C8; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
    .page-header h1 { font-size: 18px; font-weight: 700; color: #1A1612; }
    .page-header p { font-size: 12px; color: #8C8278; margin-top: 2px; }
    .role-badge { display: inline-flex; align-items: center; gap: 6px; background: #2563eb22; color: #2563eb; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
    main { max-width: 900px; margin: 0 auto; padding: 40px 32px; }
    section { background: #fff; border-radius: 16px; border: 1px solid #DDD5C8; padding: 32px; margin-bottom: 24px; }
    h2 { font-size: 18px; font-weight: 700; color: #1A1612; margin-bottom: 16px; }
    h3 { font-size: 14px; font-weight: 600; color: #1A1612; margin-bottom: 12px; }
    p { font-size: 14px; color: #5C5347; line-height: 1.6; margin-bottom: 12px; }
    ul, ol { padding-left: 20px; margin-bottom: 16px; }
    li { font-size: 13px; color: #5C5347; line-height: 1.6; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #e9e0cf; padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 0.05em; }
    th:not(:first-child) { text-align: center; }
    td { padding: 10px 16px; border-bottom: 1px solid #EDE7DA; color: #3D3530; }
    td:not(:first-child) { text-align: center; }
    tr.group-row td { background: #F5F0E8; font-size: 11px; font-weight: 700; color: #8C8278; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 16px; }
    .check-yes { color: #16a34a; font-weight: 700; }
    .check-no { color: #DDD5C8; font-weight: 700; }
    .check-partial { color: #d97706; font-weight: 600; font-size: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border-radius: 12px; padding: 16px; border: 1px solid #EDE7DA; background: #FAFAF8; }
    .export-note { font-size: 11px; color: #8C8278; text-align: center; padding: 16px 32px 32px; }
    @media print { body { background: #fff; } }
  </style>
</head>
<body>
  <div class="page-header">
    <div>
      <h1>${APP_NAME} — Admin Guide</h1>
      <p>Exported on ${new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="role-badge">🛡️ Admin</div>
  </div>
  ${mainEl.innerHTML}
  <p class="export-note">${APP_NAME} Staff Portal — Confidential. For internal use only.</p>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP_NAME.replace(/\s+/g, '-')}-Admin-Guide.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminGuidePage() {
  return (
    <div className="min-h-screen bg-[#e9e0cf]">
      {/* Header */}
      <header className="bg-white border-b border-[#DDD5C8] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} iconName="FireIcon" text={APP_NAME} />
            <div className="h-5 w-px bg-[#DDD5C8]" />
            <span className="text-sm font-medium text-[#8C8278]">Admin Guide</span>
          </div>
          <div className="flex items-center gap-4">
            <AppImage
              src="/assets/images/Logo-Transparent-1772539392689.png"
              alt="Cardamom Kitchen Logo"
              width={80}
              height={40}
              className="object-contain h-10 w-auto"
            />
            <button
              onClick={exportGuideAsHTML}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              title="Export as HTML file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export HTML
            </button>
            <Link
              href="/staff/workspace"
              className="text-sm font-medium text-[#C4622D] hover:text-[#A04E22] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#e9e0cf]"
            >
              ← Back to Workspace
            </Link>
          </div>
        </div>
      </header>
      <main id="guide-main-content" className="max-w-4xl mx-auto px-4 md:px-8 py-10">
        {/* Title */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <span>🛡️</span> Admin Documentation
          </div>
          <h1 className="text-3xl font-bold text-[#1A1612] mb-3">Admin Role — User Guide</h1>
          <p className="text-[#5C5347] text-base leading-relaxed">
            This document outlines the responsibilities, capabilities, and step-by-step procedures for the
            <strong className="text-blue-700"> Admin</strong> role within the {APP_NAME} Staff Portal.
          </p>
        </div>

        {/* Section 1: Overview */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            Overview of the Admin Role
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-4">
            The <strong>Admin</strong> role has full access to all business and content management features of the {APP_NAME} Staff Portal.
            Admins can manage orders, products, menus, vouchers, media, events, cooking classes, reports, confirmations, and more — but cannot manage staff accounts, social media settings, or the database schema.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="text-2xl mb-2">👑</div>
              <h3 className="font-semibold text-purple-800 text-sm mb-1">Super Admin</h3>
              <p className="text-xs text-purple-700">Everything — staff management, social media, database schema, system settings, plus all Admin &amp; Staff capabilities.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 ring-2 ring-blue-400">
              <div className="text-2xl mb-2">🛡️</div>
              <h3 className="font-semibold text-blue-800 text-sm mb-1">Admin ← You are here</h3>
              <p className="text-xs text-blue-700">All business &amp; content management (products, menu, vouchers, media, events, cooking classes, reporting, confirmations, organisation details) plus everything Staff can do. No staff management, social media, or database schema.</p>
            </div>
            <div className="bg-[#e9e0cf] border border-[#DDD5C8] rounded-xl p-4">
              <div className="text-2xl mb-2">👤</div>
              <h3 className="font-semibold text-[#5C5347] text-sm mb-1">Staff</h3>
              <p className="text-xs text-[#8C8278]">Daily operations only: Orders, Customer Order History, Meal Voucher Scanner, Weekly Menu, Documents, Cooking Classes, Events &amp; Event Management (view only).</p>
            </div>
          </div>
        </section>

        {/* Section 2: What Admins Can Do */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            What Admins Can Do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: '📦', title: 'Order Management', desc: 'View all orders, update payment status and fulfilment status. Cannot delete orders.' },
              { icon: '📋', title: 'Customer Order History', desc: 'Look up any customer\'s full order history by email or phone.' },
              { icon: '🎟️', title: 'Meal Voucher Scanner', desc: 'Redeem meal vouchers for customers at the point of service.' },
              { icon: '📅', title: 'Weekly Menu', desc: 'Add, edit, close, and delete weekly menu entries.' },
              { icon: '🛍️', title: 'Products & Pricing', desc: 'Full CRUD on products, pricing, categories, and package visibility.' },
              { icon: '🖼️', title: 'Media Management', desc: 'Upload and manage product images, event photos, and documents.' },
              { icon: '🎉', title: 'Events (Media Library)', desc: 'Create, edit, and manage events in the media library.' },
              { icon: '🍳', title: 'Cooking & Baking Classes', desc: 'Full access to class settings, customers, event registrations, analytics, and confirmation emails.' },
              { icon: '📆', title: 'Event Management', desc: 'Full access to event management settings, customers, registrations, analytics, and booking confirmation emails.' },
              { icon: '👤', title: 'Customer Registrations', desc: 'View all customer registrations across the platform.' },
              { icon: '💳', title: 'Bookings Credit', desc: 'Manage and issue booking credits to customers.' },
              { icon: '❌', title: 'Failed Transactions', desc: 'View and manage failed payment transactions.' },
              { icon: '🏷️', title: 'Discount Vouchers', desc: 'Create and manage discount voucher codes.' },
              { icon: '🛒', title: 'Abandoned Carts', desc: 'View and manage abandoned cart reminders.' },
              { icon: '📊', title: 'Reports & Analytics', desc: 'Access all reports dashboards and analytics views.' },
              { icon: '🏠', title: 'Homepage & Gallery', desc: 'Manage homepage cards, gallery images, and testimonials.' },
              { icon: '👁️', title: 'Section & Package Visibility', desc: 'Control which sections and packages are visible on the public website.' },
              { icon: '⚙️', title: 'Global Settings', desc: 'Manage global system settings such as delivery options and payment configuration.' },
              { icon: '✅', title: 'Payment Confirmation Settings', desc: 'Configure payment confirmation notification settings.' },
              { icon: '🔔', title: 'Collection Notification Settings', desc: 'Configure collection notification settings for order pickups.' },
              { icon: '📧', title: 'Correspondence Settings', desc: 'View correspondence settings (read-only — editing reserved for Super Admin).' },
              { icon: '🏢', title: 'Organisation Details', desc: 'View and edit organisation details, banking information, and contacts.' },
            ]?.map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 bg-[#FAFAF8] rounded-xl border border-[#EDE7DA]">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-[#1A1612]">{title}</p>
                  <p className="text-xs text-[#8C8278] leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Role Permissions Matrix */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            Role Permissions Matrix
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#e9e0cf]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider rounded-tl-xl">Feature / Tab</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Staff</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-blue-600 uppercase tracking-wider">Admin</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider rounded-tr-xl">Super Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE7DA]">
                {([
                  { group: 'Operations' },
                  { feature: 'Order Management — view orders', staff: true, admin: true, superAdmin: true },
                  { feature: 'Order Management — update fulfilment status', staff: true, admin: true, superAdmin: true },
                  { feature: 'Order Management — update payment status', staff: false, admin: true, superAdmin: true },
                  { feature: 'Delete Orders', staff: false, admin: false, superAdmin: true },
                  { feature: 'Customer Order History (lookup)', staff: true, admin: true, superAdmin: true },
                  { feature: 'Meal Voucher Scanner (redeem meals)', staff: true, admin: true, superAdmin: true },
                  { feature: 'Weekly Menu (add, edit, close & delete)', staff: true, admin: true, superAdmin: true },
                  { group: 'Products & Media' },
                  { feature: 'Products & Menu Pricing', staff: 'Edit', admin: true, superAdmin: true },
                  { feature: 'Media → Products', staff: 'Edit', admin: true, superAdmin: true },
                  { feature: 'Events (Media Library)', staff: 'Edit', admin: true, superAdmin: true },
                  { group: 'Documents' },
                  { feature: 'View Documents', staff: true, admin: true, superAdmin: true },
                  { feature: 'Add / Edit / Remove Documents', staff: false, admin: true, superAdmin: true },
                  { group: 'Cooking & Baking Classes' },
                  { feature: 'Class Settings', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Class Customers', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Class Analytics', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Class Confirmation Emails', staff: false, admin: true, superAdmin: true },
                  { group: 'Event Management' },
                  { feature: 'Event Management — Settings & Overview', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Event Management — Customers', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Event Management — Registrations', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Event Management — Analytics', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Event Booking Registrations', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Event Booking Confirmation Emails', staff: false, admin: true, superAdmin: true },
                  { feature: 'Event Registrations (legacy)', staff: 'View', admin: true, superAdmin: true },
                  { group: 'Customer Relations' },
                  { feature: 'Customer Registrations', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Bookings Credit', staff: false, admin: true, superAdmin: true },
                  { feature: 'Failed Transactions', staff: false, admin: true, superAdmin: true },
                  { group: 'Business & Content' },
                  { feature: 'Categories', staff: false, admin: true, superAdmin: true },
                  { feature: 'Gallery, Homepage Cards & Testimonials', staff: false, admin: true, superAdmin: true },
                  { feature: 'Discount Vouchers', staff: false, admin: true, superAdmin: true },
                  { feature: 'Abandoned Carts', staff: false, admin: true, superAdmin: true },
                  { feature: 'Reports Dashboard & Analytics', staff: false, admin: true, superAdmin: true },
                  { feature: 'Package & Section Visibility', staff: false, admin: true, superAdmin: true },
                  { group: 'Settings & Notifications' },
                  { feature: 'Global Settings', staff: false, admin: true, superAdmin: true },
                  { feature: 'Organisation Details', staff: false, admin: true, superAdmin: true },
                  { feature: 'Payment Confirmation Settings', staff: false, admin: true, superAdmin: true },
                  { feature: 'Collection Notification Settings', staff: false, admin: true, superAdmin: true },
                  { feature: 'Correspondence Settings (view)', staff: false, admin: 'View', superAdmin: true },
                  { feature: 'Correspondence Settings (edit)', staff: false, admin: false, superAdmin: true },
                  { group: 'Super Admin Only' },
                  { feature: 'Social Media Settings', staff: false, admin: false, superAdmin: true },
                  { feature: 'Staff Management (invite, edit, deactivate)', staff: false, admin: false, superAdmin: true },
                  { feature: 'Database Schema', staff: false, admin: false, superAdmin: true },
                ] as ({ group: string } | { group?: undefined; feature: string; staff: boolean | string; admin: boolean | string; superAdmin: boolean })[])?.map((row, idx) => {
                  if ('group' in row && row.group) {
                    return (
                      <tr key={`group-${idx}`} className="bg-[#F5F0E8]">
                        <td colSpan={4} className="px-4 py-2 text-xs font-bold text-[#8C8278] uppercase tracking-wider">{row.group}</td>
                      </tr>
                    );
                  }
                  const { feature, staff, admin, superAdmin } = row as { feature: string; staff: boolean | string; admin: boolean | string; superAdmin: boolean };
                  const cell = (val: boolean | string, isAdmin = false) => {
                    if (typeof val === 'string') {
                      return <span className="text-amber-600 font-semibold text-xs">{val}</span>;
                    }
                    if (val) {
                      return <span className={`${isAdmin ? 'text-blue-600' : 'text-green-600'} font-bold`}>✓</span>;
                    }
                    return <span className="text-[#DDD5C8] font-bold">—</span>;
                  };
                  return (
                    <tr key={feature} className="hover:bg-[#FAFAF8]">
                      <td className="px-4 py-3 text-[#3D3530] font-medium">{feature}</td>
                      <td className="px-4 py-3 text-center">{cell(staff)}</td>
                      <td className="px-4 py-3 text-center bg-blue-50/30">{cell(admin, true)}</td>
                      <td className="px-4 py-3 text-center">{cell(superAdmin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8C8278]">
            <span className="flex items-center gap-1.5"><span className="text-green-600 font-bold">✓</span> Full access</span>
            <span className="flex items-center gap-1.5"><span className="text-amber-600 font-semibold">Edit</span> View &amp; edit only (cannot add or delete)</span>
            <span className="flex items-center gap-1.5"><span className="text-amber-600 font-semibold">View</span> Read-only</span>
            <span className="flex items-center gap-1.5"><span className="text-[#DDD5C8] font-bold">—</span> No access</span>
          </div>
        </section>

        {/* Section 4: Managing Orders */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">4</span>
            Managing Orders
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-5">
            As Admin, you have full control over order payment and fulfilment statuses.
          </p>
          <h3 className="font-semibold text-[#1A1612] text-sm mb-3">Payment Statuses</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {['Awaiting Payment', 'Awaiting Confirmation', 'Paid', 'Unpaid', 'Refunded', 'Pending', 'Failed', 'Discounted'].map(s => (
              <span key={s} className="text-xs px-3 py-1 rounded-full bg-[#F5EFE8] border border-[#DDD5C8] text-[#5C5347] font-medium">{s}</span>
            ))}
          </div>
          <h3 className="font-semibold text-[#1A1612] text-sm mb-3">Fulfilment Statuses</h3>
          <div className="flex flex-wrap gap-2 mb-5">
            {['New', 'Confirmed', 'Preparing', 'Ready', 'Collected', 'Delivered', 'Cancelled'].map(s => (
              <span key={s} className="text-xs px-3 py-1 rounded-full bg-[#F5EFE8] border border-[#DDD5C8] text-[#5C5347] font-medium">{s}</span>
            ))}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">💡 Awaiting Confirmation</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              When PayFast returns a successful payment notification, the order is automatically set to <strong>Awaiting Confirmation</strong>.
              Review the order and update the payment status to <strong>Paid</strong> once you have verified the payment in your PayFast dashboard.
            </p>
          </div>
        </section>

        {/* Section 5: Security */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">5</span>
            Security Best Practices
          </h2>
          <ul className="space-y-3">
            {[
              { icon: '🔐', title: 'Use a strong password', desc: 'Your Admin account should use a unique, strong password (12+ characters, mixed case, numbers, symbols).' },
              { icon: '🚪', title: 'Log out when done', desc: 'Always log out of the Staff Portal when you are finished, especially on shared devices.' },
              { icon: '📧', title: 'Keep your email secure', desc: 'Your login email is the key to your account. Enable two-factor authentication on your email provider.' },
              { icon: '📋', title: 'Report suspicious activity', desc: 'If you notice unexpected changes to orders, products, or settings, report them to the Super Admin immediately.' },
            ]?.map(({ icon, title, desc }) => (
              <li key={title} className="flex gap-3">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-[#1A1612]">{title}</p>
                  <p className="text-xs text-[#8C8278] leading-relaxed mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-blue-800 mb-1">{APP_NAME} Staff Portal — Admin Guide</p>
          <p className="text-xs text-blue-600">For technical support or to request elevated permissions, contact your Super Admin.</p>
          <Link
            href="/staff/workspace"
            className="inline-block mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Return to Workspace
          </Link>
        </div>
      </main>
    </div>
  );
}
