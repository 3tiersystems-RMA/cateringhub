import AppLogo from '@/components/ui/AppLogo';
import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import AppImage from '@/components/ui/AppImage';

export default function SuperAdminGuidePage() {
  return (
    <div className="min-h-screen bg-[#e9e0cf]">
      {/* Header */}
      <header className="bg-white border-b border-[#DDD5C8] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} iconName="FireIcon" text={APP_NAME} />
            <div className="h-5 w-px bg-[#DDD5C8]" />
            <span className="text-sm font-medium text-[#8C8278]">Super Admin Guide</span>
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
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <span>👑</span> Super Admin Documentation
          </div>
          <h1 className="text-3xl font-bold text-[#1A1612] mb-3">Super Admin Role — User Guide</h1>
          <p className="text-[#5C5347] text-base leading-relaxed">
            This document outlines the responsibilities, capabilities, and step-by-step procedures for the
            <strong className="text-purple-700"> Super Admin</strong> role within the {APP_NAME} Staff Portal.
          </p>
        </div>

        {/* Section 1: Overview */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            Overview of the Super Admin Role
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-4">
            The <strong>Super Admin</strong> is the highest-privilege role in the {APP_NAME} Staff Portal.
            This role is designed for the business owner or a designated senior manager who is responsible
            for controlling who has access to the staff workspace.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 ring-2 ring-purple-400">
              <div className="text-2xl mb-2">👑</div>
              <h3 className="font-semibold text-purple-800 text-sm mb-1">Super Admin ← You are here</h3>
              <p className="text-xs text-purple-700">Everything — staff management, social media, database schema, system settings, plus all Admin &amp; Staff capabilities.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-2xl mb-2">🛡️</div>
              <h3 className="font-semibold text-blue-800 text-sm mb-1">Admin</h3>
              <p className="text-xs text-blue-700">All business &amp; content management (products, menu, vouchers, media, events, cooking classes, reporting, confirmations, organisation details) plus everything Staff can do. No staff management, social media, or database schema.</p>
            </div>
            <div className="bg-[#e9e0cf] border border-[#DDD5C8] rounded-xl p-4">
              <div className="text-2xl mb-2">👤</div>
              <h3 className="font-semibold text-[#5C5347] text-sm mb-1">Staff</h3>
              <p className="text-xs text-[#8C8278]">Daily operations: Orders, Customer Order History, Meal Voucher Scanner, Weekly Menu, Documents, Cooking Classes, Events &amp; Event Management (view only) — plus edit-only access to Products, Media Products and Events. No add/delete on catalog items, and no settings.</p>
            </div>
          </div>
        </section>

        {/* Section 2: Granting Access */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            Granting Access to Staff Members
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-5">
            As Super Admin, you can invite new staff members to the portal. Each invited member receives
            an email with a secure link to set up their account.
          </p>

          <h3 className="font-semibold text-[#1A1612] text-sm mb-3">Step-by-Step: Inviting a Staff Member</h3>
          <ol className="space-y-3 mb-6">
            {[
              { step: '1', text: 'Log in to the Staff Portal at /staff/login with your Super Admin credentials.' },
              { step: '2', text: 'In the Staff Workspace sidebar, open the 👥 Staff Management tab (visible only to Super Admin).' },
              { step: '3', text: 'Click the + Invite Staff button below the staff list.' },
              { step: '4', text: 'Fill in the form: Full Name, Email, and select a Role (Staff or Admin).' },
              { step: '5', text: 'Click Send Invite. The person receives an email with a secure sign-in link.' },
              { step: '6', text: 'Once they open the link and set their password, they can log in and access the workspace for their role.' },
            ]?.map(({ step, text }) => (
              <li key={step} className="flex gap-3">
                <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{step}</span>
                <p className="text-sm text-[#5C5347] leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>

          <div className="bg-[#e9e0cf] border border-[#DDD5C8] rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-[#3D3530] mb-1">🔁 Promote an Existing User</p>
            <p className="text-xs text-[#5C5347] leading-relaxed">
              If someone already has an account, use the <strong>Promote Existing User</strong> button (next to
              Invite Staff) to grant them a Staff or Admin role instead of sending a fresh invitation.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">📧 About Invitation Emails</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              Invitations are sent via Supabase Auth as a secure sign-in link. The link is valid for a
              limited time — if it expires, simply send a new invitation. Double-check the email address
              before sending. Only Staff and Admin roles can be invited; Super Admin is assigned separately
              (see section 6).
            </p>
          </div>
        </section>

        {/* Section 3: Role Permissions Matrix */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            Role Permissions Matrix
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#e9e0cf]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider rounded-tl-xl">Feature / Tab</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Staff</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Admin</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-purple-600 uppercase tracking-wider rounded-tr-xl">Super Admin</th>
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
                  const cell = (val: boolean | string, isSuper = false) => {
                    if (typeof val === 'string') {
                      return <span className="text-amber-600 font-semibold text-xs">{val}</span>;
                    }
                    if (val) {
                      return <span className={`${isSuper ? 'text-purple-600' : 'text-green-600'} font-bold`}>✓</span>;
                    }
                    return <span className="text-[#DDD5C8] font-bold">—</span>;
                  };
                  return (
                    <tr key={feature} className="hover:bg-[#FAFAF8]">
                      <td className="px-4 py-3 text-[#3D3530] font-medium">{feature}</td>
                      <td className="px-4 py-3 text-center">{cell(staff)}</td>
                      <td className="px-4 py-3 text-center">{cell(admin)}</td>
                      <td className="px-4 py-3 text-center">{cell(superAdmin, true)}</td>
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

        {/* Section 4: Deactivating Staff Access */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">4</span>
            Deactivating Staff Access
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-5">
            If a staff member leaves the business, or their access needs to be revoked, you can deactivate
            their account. Deactivated (Inactive) staff cannot log in and will see a clear message.
          </p>

          <h3 className="font-semibold text-[#1A1612] text-sm mb-3">Step-by-Step: Deactivating a Staff Member</h3>
          <ol className="space-y-3 mb-5">
            {[
              { step: '1', text: 'Go to Staff Workspace → 👥 Staff Management tab.' },
              { step: '2', text: 'Find the staff member in the list.' },
              { step: '3', text: 'Click the Deactivate link next to their name.' },
              { step: '4', text: 'Their status badge changes from Active (green) to Inactive (red) immediately.' },
              { step: '5', text: 'The next time they attempt to log in, they will see: "Account suspended — Contact your Admin".' },
            ]?.map(({ step, text }) => (
              <li key={step} className="flex gap-3">
                <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{step}</span>
                <p className="text-sm text-[#5C5347] leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Important Notes</p>
            <ul className="text-xs text-amber-700 leading-relaxed space-y-1">
              <li>• Deactivation is immediate — the member is blocked on their next login or action.</li>
              <li>• Deactivation does not delete the account or any data — it only blocks login.</li>
              <li>• An account must be deactivated before it can be deleted; the system blocks deleting an Active member.</li>
              <li>• Use the Reset PW link to send a member a password-reset email if they are locked out.</li>
            </ul>
          </div>
        </section>

        {/* Section 5: Reactivating Staff */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">5</span>
            Reactivating Staff
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-5">
            If a deactivated staff member needs to regain access (e.g., they return to the business),
            you can reactivate their account at any time.
          </p>

          <ol className="space-y-3">
            {[
              { step: '1', text: 'Go to Staff Workspace → 👥 Staff Management tab.' },
              { step: '2', text: 'Find the staff member showing a red Inactive badge.' },
              { step: '3', text: 'Click the Activate link next to their name.' },
              { step: '4', text: 'Their status changes back to Active immediately.' },
              { step: '5', text: 'They can now log in again using their existing credentials.' },
            ]?.map(({ step, text }) => (
              <li key={step} className="flex gap-3">
                <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{step}</span>
                <p className="text-sm text-[#5C5347] leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Section 6: Setting Up Super Admin */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">6</span>
            Setting Up the Super Admin Account
          </h2>
          <p className="text-[#5C5347] text-sm leading-relaxed mb-5">
            The Super Admin role must be assigned directly in the Supabase database. This is a one-time
            setup performed by the system administrator.
          </p>

          <div className="bg-[#1A1612] rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-[#C4622D] mb-2">Supabase SQL Editor — Run this query:</p>
            <pre className="text-xs text-green-400 font-mono leading-relaxed overflow-x-auto">{`UPDATE public.user_profiles
SET role = 'super_admin'
WHERE email = 'your-email@example.com';`}</pre>
          </div>

          <div className="bg-[#e9e0cf] border border-[#DDD5C8] rounded-xl p-4">
            <p className="text-sm font-semibold text-[#3D3530] mb-1">📋 Steps to assign Super Admin:</p>
            <ol className="text-xs text-[#5C5347] space-y-1.5 leading-relaxed">
              <li>1. Log in to your Supabase project dashboard.</li>
              <li>2. Navigate to <strong>SQL Editor</strong> → <strong>New Query</strong>.</li>
              <li>3. Paste the SQL above, replacing the email with the Super Admin&apos;s email.</li>
              <li>4. Click <strong>Run</strong>. The role is updated immediately.</li>
              <li>5. The user must log out and log back in for the new role to take effect.</li>
            </ol>
          </div>
        </section>

        {/* Section 7: Super Admin Exclusive Features */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">7</span>
            Super Admin Exclusive Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: '👥', title: 'Staff Management', desc: 'Invite, promote, edit, deactivate, reactivate, reset passwords, and delete staff accounts. Only Super Admin can manage who has access to the portal.' },
              { icon: '📱', title: 'Social Media Settings', desc: 'Manage the social media links displayed on the public website (Facebook, Instagram, WhatsApp, etc.).' },
              { icon: '🗄️', title: 'Database Schema', desc: 'View the complete database schema for all tables, with search and category filters. Download as SQL or JSON for documentation or backup purposes.' },
              { icon: '✉️', title: 'Correspondence Settings (Full Edit)', desc: 'Full read and write access to all correspondence settings including email templates, banking details, and notification preferences. Admins can only view.' },
            ]?.map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-purple-900">{title}</p>
                  <p className="text-xs text-purple-700 leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 8: Security Best Practices */}
        <section className="bg-white rounded-2xl border border-[#DDD5C8] p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#1A1612] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">8</span>
            Security Best Practices
          </h2>
          <ul className="space-y-3">
            {[
              { icon: '🔐', title: 'Use a strong password', desc: 'Your Super Admin account should use a unique, strong password (12+ characters, mixed case, numbers, symbols).' },
              { icon: '👁️', title: 'Regularly review staff access', desc: 'Periodically review the Staff Management list and deactivate accounts for staff who are no longer active.' },
              { icon: '📧', title: 'Verify email addresses', desc: 'Always double-check email addresses before sending invitations to prevent unauthorized access.' },
              { icon: '🚫', title: 'Limit Super Admin accounts', desc: 'Only one or two trusted individuals should hold the Super Admin role. More access points increase security risk.' },
              { icon: '📋', title: 'Audit access regularly', desc: 'Review who has Admin vs Staff roles and ensure permissions match current job responsibilities.' },
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
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-purple-800 mb-1">{APP_NAME} Staff Portal — Super Admin Guide</p>
          <p className="text-xs text-purple-600">For technical support, contact your system administrator.</p>
          <Link
            href="/staff/workspace"
            className="inline-block mt-4 bg-purple-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors"
          >
            Return to Workspace
          </Link>
        </div>
      </main>
    </div>
  );
}
