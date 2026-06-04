import AppLogo from '@/components/ui/AppLogo';
import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import AppImage from '@/components/ui/AppImage';

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
            <Link
              href="/staff/workspace"
              className="text-sm font-medium text-[#C4622D] hover:text-[#A04E22] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#e9e0cf]"
            >
              ← Back to Workspace
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 md:px-8 py-10">
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
            Admins can manage orders, products, menus, vouchers, media, reports, and more — but cannot manage staff accounts or system-level settings.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="text-2xl mb-2">👑</div>
              <h3 className="font-semibold text-purple-800 text-sm mb-1">Super Admin</h3>
              <p className="text-xs text-purple-700">Everything — staff management and system settings, plus all Admin and Staff capabilities.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 ring-2 ring-blue-400">
              <div className="text-2xl mb-2">🛡️</div>
              <h3 className="font-semibold text-blue-800 text-sm mb-1">Admin ← You are here</h3>
              <p className="text-xs text-blue-700">All business &amp; content management plus everything Staff can do. No staff management or system settings.</p>
            </div>
            <div className="bg-[#e9e0cf] border border-[#DDD5C8] rounded-xl p-4">
              <div className="text-2xl mb-2">👤</div>
              <h3 className="font-semibold text-[#5C5347] text-sm mb-1">Staff</h3>
              <p className="text-xs text-[#8C8278]">Daily operations only: Orders, Customer Order History, Meal Voucher Scanner, Weekly Menu, and viewing Documents &amp; Cooking Classes.</p>
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
              { icon: '🎉', title: 'Events', desc: 'Create, edit, and manage events in the media library.' },
              { icon: '🍳', title: 'Cooking & Baking Classes', desc: 'Full access to class settings, customers, event registrations, and analytics.' },
              { icon: '🏷️', title: 'Discount Vouchers', desc: 'Create and manage discount voucher codes.' },
              { icon: '🛒', title: 'Abandoned Carts', desc: 'View and manage abandoned cart reminders.' },
              { icon: '📊', title: 'Reports & Analytics', desc: 'Access all reports dashboards and analytics views.' },
              { icon: '🏠', title: 'Homepage & Gallery', desc: 'Manage homepage cards, gallery images, and testimonials.' },
              { icon: '👁️', title: 'Section Visibility', desc: 'Control which sections are visible on the public website.' },
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider rounded-tl-xl">Feature</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Staff</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-blue-600 uppercase tracking-wider">Admin</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider rounded-tr-xl">Super Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE7DA]">
                {([
                  { feature: 'Log in to Staff Portal', staff: true, admin: true, superAdmin: true },
                  { feature: 'Order Management — view orders', staff: true, admin: true, superAdmin: true },
                  { feature: 'Order Management — update fulfilment status', staff: true, admin: true, superAdmin: true },
                  { feature: 'Order Management — update payment status', staff: false, admin: true, superAdmin: true },
                  { feature: 'Delete Orders', staff: false, admin: false, superAdmin: true },
                  { feature: 'Customer Order History (lookup)', staff: true, admin: true, superAdmin: true },
                  { feature: 'Meal Voucher Scanner (redeem meals)', staff: true, admin: true, superAdmin: true },
                  { feature: 'View Documents', staff: true, admin: true, superAdmin: true },
                  { feature: 'Add / Edit / Remove Documents', staff: false, admin: true, superAdmin: true },
                  { feature: 'Weekly Menu (add, edit, close & delete)', staff: true, admin: true, superAdmin: true },
                  { feature: 'Products & Menu Pricing', staff: 'Edit', admin: true, superAdmin: true },
                  { feature: 'Media → Products', staff: 'Edit', admin: true, superAdmin: true },
                  { feature: 'Events (Media Library)', staff: 'Edit', admin: true, superAdmin: true },
                  { feature: 'Cooking & Baking Classes — Settings', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Cooking & Baking Classes — Class Customers', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Cooking & Baking Classes — Event Registrations', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Cooking & Baking Classes — Analytics', staff: 'View', admin: true, superAdmin: true },
                  { feature: 'Categories', staff: false, admin: true, superAdmin: true },
                  { feature: 'Gallery, Homepage Cards & Testimonials', staff: false, admin: true, superAdmin: true },
                  { feature: 'Discount Vouchers', staff: false, admin: true, superAdmin: true },
                  { feature: 'Abandoned Carts', staff: false, admin: true, superAdmin: true },
                  { feature: 'Reports Dashboard & Analytics', staff: false, admin: true, superAdmin: true },
                  { feature: 'Package & Section Visibility', staff: false, admin: true, superAdmin: true },
                  { feature: 'Correspondence Settings', staff: false, admin: 'View', superAdmin: true },
                  { feature: 'Organisation Details', staff: false, admin: true, superAdmin: true },
                  { feature: 'Social Media Settings', staff: false, admin: false, superAdmin: true },
                  { feature: 'Staff Management (invite, edit, deactivate)', staff: false, admin: false, superAdmin: true },
                ] as { feature: string; staff: boolean | string; admin: boolean | string; superAdmin: boolean }[])?.map(({ feature, staff, admin, superAdmin }) => {
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

        {/* Section 4: Order Management */}
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
            {['Awaiting Payment', 'Awaiting Confirmation', 'Paid', 'Refunded', 'Pending', 'Failed'].map(s => (
              <span key={s} className="text-xs px-3 py-1 rounded-full bg-[#F5EFE8] border border-[#DDD5C8] text-[#5C5347] font-medium">{s}</span>
            ))}
          </div>
          <h3 className="font-semibold text-[#1A1612] text-sm mb-3">Fulfilment Statuses</h3>
          <div className="flex flex-wrap gap-2 mb-5">
            {['New', 'Confirmed', 'Preparing', 'Ready', 'Delivered', 'Cancelled'].map(s => (
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
