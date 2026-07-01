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
  <title>${APP_NAME} — Staff Guide</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #e9e0cf; color: #1A1612; padding: 0; }
    .page-header { background: #fff; border-bottom: 1px solid #DDD5C8; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
    .page-header h1 { font-size: 18px; font-weight: 700; color: #1A1612; }
    .page-header p { font-size: 12px; color: #8C8278; margin-top: 2px; }
    .role-badge { display: inline-flex; align-items: center; gap: 6px; background: #C4622D22; color: #C4622D; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
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
      <h1>${APP_NAME} — Staff Guide</h1>
      <p>Exported on ${new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="role-badge">👤 Staff</div>
  </div>
  ${mainEl.innerHTML}
  <p class="export-note">${APP_NAME} Staff Portal — Confidential. For internal use only.</p>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP_NAME.replace(/\s+/g, '-')}-Staff-Guide.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function StaffGuidePage() {
  return (
    <div className="min-h-screen bg-[#e9e0cf]">
      {/* Header */}
      <header className="bg-white border-b border-[#DDD5C8] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} iconName="FireIcon" text={APP_NAME} />
            <div className="h-5 w-px bg-[#DDD5C8]" />
            <span className="text-sm font-medium text-[#8C8278]">Staff Guide</span>
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
              className="text-sm font-medium text-white bg-[#C4622D] hover:bg-[#A04E22] transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1.5"
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
          <div className="inline-flex items-center gap-2 bg-[#e9e0cf] text-[#5C5347] text-xs font-semibold px-3 py-1.5 rounded-full mb-4 border border-[#DDD5C8]">
            <span>👤</span> Staff Documentation
          </div>
          <h1 className="text-3xl font-bold text-[#1A1612] mb-3">Staff Role — User Guide</h1>
          <p className="text-[#5C5347] text-base leading-relaxed">
            This document outlines the responsibilities, capabilities, and step-by-step procedures for the
            <strong className="text-[#C4622D]"> Staff</strong> role within the {APP_NAME} Staff Portal.
          </p>
        </div>

        {/* Section 1: Overview */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-[#e9e0cf] text-[#5C5347] rounded-full flex items-center justify-center text-sm font-bold border border-[#DDD5C8]">1</span>
            Overview of the Staff Role
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-4">
            The <strong>Staff</strong> role is designed for day-to-day operational tasks. Staff members can manage orders,
            look up customer history, redeem meal vouchers, manage the weekly menu, view documents, cooking class information,
            and view event management data. Content management, reporting, and settings features are reserved for Admin and Super Admin roles.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="text-2xl mb-2">👑</div>
              <h3 className="font-semibold text-purple-800 text-sm mb-1">Super Admin</h3>
              <p className="text-xs text-purple-700">Everything — staff management, social media, database schema, system settings, plus all Admin &amp; Staff capabilities.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-2xl mb-2">🛡️</div>
              <h3 className="font-semibold text-blue-800 text-sm mb-1">Admin</h3>
              <p className="text-xs text-blue-700">All business &amp; content management plus everything Staff can do. No staff management, social media, or database schema.</p>
            </div>
            <div className="bg-[#e9e0cf] border border-[#C4B8A8] rounded-xl p-4 ring-2 ring-[#C4622D]">
              <div className="text-2xl mb-2">👤</div>
              <h3 className="font-semibold text-[#5C5347] text-sm mb-1">Staff ← You are here</h3>
              <p className="text-xs text-[#8C8278]">Daily operations: Orders, Customer Order History, Meal Voucher Scanner, Weekly Menu, Documents, Cooking Classes, Events &amp; Event Management (view only).</p>
            </div>
          </div>
        </section>

        {/* Section 2: What Staff Can Do */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-[#e9e0cf] text-[#5C5347] rounded-full flex items-center justify-center text-sm font-bold border border-[#DDD5C8]">2</span>
            What Staff Can Do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: '📦', title: 'Order Management', desc: 'View all orders and update fulfilment status (New → Confirmed → Preparing → Ready → Collected/Delivered). Cannot update payment status or delete orders.' },
              { icon: '📋', title: 'Customer Order History', desc: 'Look up any customer\'s full order history by email or phone number. Read-only.' },
              { icon: '🎟️', title: 'Meal Voucher Scanner', desc: 'Redeem meal vouchers for customers at the point of service using the scanner.' },
              { icon: '📅', title: 'Weekly Menu', desc: 'Add, edit, close, and delete weekly menu entries. Full CRUD access.' },
              { icon: '🛍️', title: 'Products', desc: 'View and edit product details and pricing. Cannot add new products or delete existing ones.' },
              { icon: '🖼️', title: 'Media → Products', desc: 'View and edit product images. Cannot upload new images or delete existing ones.' },
              { icon: '🎉', title: 'Events (Media Library)', desc: 'View and edit events. Cannot create new events or delete existing ones.' },
              { icon: '📄', title: 'Document Management', desc: 'View documents only. Cannot add, edit, or remove documents.' },
              { icon: '🍳', title: 'Cooking & Baking Classes', desc: 'View class settings, customer registrations, event registrations, and analytics. Read-only.' },
              { icon: '📆', title: 'Event Management', desc: 'View event management settings, customers, registrations, and analytics. Also view event booking registrations. Read-only.' },
              { icon: '👤', title: 'Customer Registrations', desc: 'View customer registrations. Read-only.' },
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
            <span className="w-7 h-7 bg-[#e9e0cf] text-[#5C5347] rounded-full flex items-center justify-center text-sm font-bold border border-[#DDD5C8]">3</span>
            Role Permissions Matrix
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#e9e0cf]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider rounded-tl-xl">Feature / Tab</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#C4622D] uppercase tracking-wider">Staff</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Admin</th>
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
                  { group: 'Business & Content (Admin+)' },
                  { feature: 'Categories', staff: false, admin: true, superAdmin: true },
                  { feature: 'Gallery, Homepage Cards & Testimonials', staff: false, admin: true, superAdmin: true },
                  { feature: 'Discount Vouchers', staff: false, admin: true, superAdmin: true },
                  { feature: 'Abandoned Carts', staff: false, admin: true, superAdmin: true },
                  { feature: 'Reports Dashboard & Analytics', staff: false, admin: true, superAdmin: true },
                  { feature: 'Package & Section Visibility', staff: false, admin: true, superAdmin: true },
                  { group: 'Settings & Notifications (Admin+)' },
                  { feature: 'Global Settings', staff: false, admin: true, superAdmin: true },
                  { feature: 'Organisation Details', staff: false, admin: true, superAdmin: true },
                  { feature: 'Payment Confirmation Settings', staff: false, admin: true, superAdmin: true },
                  { feature: 'Collection Notification Settings', staff: false, admin: true, superAdmin: true },
                  { feature: 'Correspondence Settings', staff: false, admin: 'View', superAdmin: true },
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
                  const cell = (val: boolean | string, isStaff = false) => {
                    if (typeof val === 'string') {
                      return <span className="text-amber-600 font-semibold text-xs">{val}</span>;
                    }
                    if (val) {
                      return <span className={`${isStaff ? 'text-[#C4622D]' : 'text-green-600'} font-bold`}>✓</span>;
                    }
                    return <span className="text-[#DDD5C8] font-bold">—</span>;
                  };
                  return (
                    <tr key={feature} className="hover:bg-[#FAFAF8]">
                      <td className="px-4 py-3 text-[#3D3530] font-medium">{feature}</td>
                      <td className="px-4 py-3 text-center bg-[#FDF6EE]/50">{cell(staff, true)}</td>
                      <td className="px-4 py-3 text-center">{cell(admin)}</td>
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

        {/* Section 4: Order Fulfilment Workflow */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-[#e9e0cf] text-[#5C5347] rounded-full flex items-center justify-center text-sm font-bold border border-[#DDD5C8]">4</span>
            Order Fulfilment Workflow
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-5">
            As Staff, you can update the fulfilment status of orders as they progress through preparation and delivery.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {['New', '→', 'Confirmed', '→', 'Preparing', '→', 'Ready', '→', 'Collected / Delivered'].map((s, i) => (
              s === '→'
                ? <span key={i} className="text-[#8C8278] font-bold">→</span>
                : <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-[#F5EFE8] border border-[#DDD5C8] text-[#5C5347] font-semibold">{s}</span>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Important</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Once an order is set to <strong>Delivered</strong>, <strong>Collected</strong>, or <strong>Cancelled</strong>, the fulfilment status is locked and cannot be changed.
              Contact your Admin or Super Admin if a correction is needed.
            </p>
          </div>
        </section>

        {/* Section 5: Security */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-[#e9e0cf] text-[#5C5347] rounded-full flex items-center justify-center text-sm font-bold border border-[#DDD5C8]">5</span>
            Security Best Practices
          </h2>
          <ul className="space-y-3">
            {[
              { icon: '🔐', title: 'Use a strong password', desc: 'Your Staff account should use a unique, strong password (12+ characters, mixed case, numbers, symbols).' },
              { icon: '🚪', title: 'Log out when done', desc: 'Always log out of the Staff Portal when you are finished, especially on shared devices.' },
              { icon: '🚫', title: 'Do not share your credentials', desc: 'Never share your login details with anyone. Each staff member should have their own account.' },
              { icon: '📋', title: 'Report suspicious activity', desc: 'If you notice unexpected changes to orders or data, report them to your Admin or Super Admin immediately.' },
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
        <div className="bg-[#e9e0cf] border border-[#DDD5C8] rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-[#3D3530] mb-1">{APP_NAME} Staff Portal — Staff Guide</p>
          <p className="text-xs text-[#5C5347]">For access issues or to request additional permissions, contact your Admin or Super Admin.</p>
          <Link
            href="/staff/workspace"
            className="inline-block mt-4 bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
          >
            Return to Workspace
          </Link>
        </div>
      </main>
    </div>
  );
}
