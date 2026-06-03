'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';


import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';



import CookingClassSettings from '@/app/staff/workspace/components/CookingClassSettings';
import CookingClassCustomers from '@/app/staff/workspace/components/CookingClassCustomers';
import CookingClassAnalytics from '@/app/staff/workspace/components/CookingClassAnalytics';
import EventRegistrations from '@/app/staff/workspace/components/EventRegistrations';
import OrganisationDetails from '@/app/staff/workspace/components/OrganisationDetails';
import CorrespondenceSettings from '@/app/staff/workspace/components/CorrespondenceSettings';
import GoogleDriveDocuments from '@/app/staff/workspace/components/GoogleDriveDocuments';
import EventManagement from '@/app/staff/workspace/components/EventManagement';
import { calculateOrderTotal, isFulfillmentStatusLocked } from '@/lib/order-totals';




type BucketType = 'product-images' | 'event-photos' | 'document-management';
type WorkspaceTab = 'products' | 'media' | 'media_events' | 'media_products' | 'orders' | 'staff' | 'homepage_cards' | 'categories' | 'weekly_menu' | 'vouchers' | 'discount_vouchers' | 'testimonials' | 'reporting' | 'analytics' | 'social_media' | 'gallery' | 'section_visibility' | 'customer_order_history' | 'correspondence_settings' | 'abandoned_carts' | 'package_visibility' | 'cooking_classes' | 'cooking_class_customers' | 'cooking_class_analytics' | 'event_registrations' | 'organisation_details';

type ProductCategory = string;
type StaffRole = 'admin' | 'staff' | 'super_admin';

// ─── Role-based access control (single source of truth) ──────────────────────
// Tiered model: staff ⊂ admin ⊂ super_admin.
//   • staff       → daily operations only (orders, lookups, scanner, docs)
//   • admin       → operations + all business & content management
//   • super_admin → everything, incl. staff accounts & system settings
// Tab VISIBILITY — which roles can open each tab. Action-level permissions
// (view/edit/create/delete/…) are handled separately by canDo() below, so a role
// can be granted a tab in "view only" or "view + edit" mode per the client matrix.
const TAB_ACCESS: Record<WorkspaceTab, StaffRole[]> = {
  // Operational — all roles
  orders: ['super_admin', 'admin', 'staff'],            // staff: view + status update
  customer_order_history: ['super_admin', 'admin', 'staff'], // staff: read-only
  media: ['super_admin', 'admin', 'staff'],             // Document Mgmt — staff: view only
  weekly_menu: ['super_admin', 'admin', 'staff'],       // staff: full CRUD
  products: ['super_admin', 'admin', 'staff'],          // staff: view + edit only
  media_products: ['super_admin', 'admin', 'staff'],    // staff: view + edit only
  vouchers: ['super_admin', 'admin', 'staff'],          // Meal Vouchers — staff: view + redeem
  media_events: ['super_admin', 'admin', 'staff'],      // Events — staff: view + edit
  cooking_classes: ['super_admin', 'admin', 'staff'],   // staff: view only
  cooking_class_customers: ['super_admin', 'admin', 'staff'], // staff: view only
  cooking_class_analytics: ['super_admin', 'admin', 'staff'], // staff: view only
  event_registrations: ['super_admin', 'admin', 'staff'], // staff: view only
  // Business & content — admin and above
  categories: ['super_admin', 'admin'],
  discount_vouchers: ['super_admin', 'admin'],
  abandoned_carts: ['super_admin', 'admin'],
  reporting: ['super_admin', 'admin'],
  analytics: ['super_admin', 'admin'],
  homepage_cards: ['super_admin', 'admin'],
  gallery: ['super_admin', 'admin'],
  testimonials: ['super_admin', 'admin'],
  package_visibility: ['super_admin', 'admin'],
  section_visibility: ['super_admin', 'admin'],         // admin: full
  correspondence_settings: ['super_admin', 'admin'],    // admin: view only (enforced in canDo)
  // System & sensitive — super_admin only
  staff: ['super_admin'],
  social_media: ['super_admin'],
  organisation_details: ['super_admin', 'admin'],
};

// Action-level permission model. super_admin = everything; admin = full CRUD on
// every accessible tab EXCEPT correspondence settings (view only); staff = the
// per-tab actions defined below (any accessible tab not listed = view only).
type PermAction = 'view' | 'create' | 'edit' | 'delete' | 'status' | 'redeem';

const STAFF_TAB_ACTIONS: Partial<Record<WorkspaceTab, PermAction[]>> = {
  orders: ['view', 'status'],
  customer_order_history: ['view'],
  media: ['view'],
  weekly_menu: ['view', 'create', 'edit', 'delete'],
  products: ['view', 'edit'],
  media_products: ['view', 'edit'],
  vouchers: ['view', 'redeem'],
  media_events: ['view', 'edit'],
  cooking_classes: ['view'],
  cooking_class_customers: ['view'],
  cooking_class_analytics: ['view'],
  event_registrations: ['view'],
};

function roleCanAccessTab(role: string | undefined | null, tab: WorkspaceTab): boolean {
  if (!role) return false;
  return TAB_ACCESS[tab]?.includes(role as StaffRole) ?? false;
}

// Single source of truth for "can this role perform <action> on <tab>?"
function canDo(role: string | undefined | null, tab: WorkspaceTab, action: PermAction): boolean {
  if (!roleCanAccessTab(role, tab)) return false;
  if (role === 'super_admin') return true;
  if (role === 'admin') {
    if (tab === 'correspondence_settings') return action === 'view';
    return true;
  }
  if (role === 'staff') {
    return (STAFF_TAB_ACTIONS[tab] ?? ['view']).includes(action);
  }
  return false;
}

// Where each role lands when they open the workspace (must be a tab they can access).
const DEFAULT_TAB_BY_ROLE: Record<StaffRole, WorkspaceTab> = {
  super_admin: 'products',
  admin: 'products',
  staff: 'orders',
};

// ─── Orders types ─────────────────────────────────────────────────────────────
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'awaiting_payment' | 'refunded';
type FulfillmentStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  category?: string;
  package_type?: string;
}

interface Order {
  id: string;
  m_payment_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  event_date: string | null;
  delivery_address: string;
  notes: string;
  created_at: string;
  updated_at: string;
  delivered_date?: string | null;
  last_reminder_sent_at?: string | null;
}

interface OrderUpdateState {
  fulfillmentSaving: boolean;
  paymentSaving: boolean;
  fulfillmentSuccess: boolean;
  paymentSuccess: boolean;
  fulfillmentError: string;
  paymentError: string;
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  awaiting_payment: 'Awaiting Payment',
  refunded: 'Refunded',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  awaiting_payment: 'bg-blue-100 text-blue-700 border-blue-200',
  refunded: 'bg-gray-100 text-gray-600 border-gray-200',
};

const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const FULFILLMENT_STATUS_COLORS: Record<FulfillmentStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmed: 'bg-purple-100 text-purple-700 border-purple-200',
  preparing: 'bg-orange-100 text-orange-700 border-orange-200',
  ready: 'bg-teal-100 text-teal-700 border-teal-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};

const FULFILLMENT_OPTIONS: FulfillmentStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
const PAYMENT_OPTIONS: PaymentStatus[] = ['awaiting_payment', 'paid', 'refunded', 'pending', 'failed'];

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: { size?: number; mimetype?: string };
  signedUrl?: string;
}

interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  unit: string;
  image_path: string | null;
  description: string;
  tags: string[];
  badge: string | null;
  min_order: number | null;
  available: boolean;
  featured: boolean;
  sort_order: number;
  package_type: string;
  image_fit?: string;
  old_price?: number | null;
  saving_percent?: number | null;
  imageUrl?: string;
  attribute1?: string | null;
  attribute2?: string | null;
  attribute3?: string | null;
  long_description?: string | null;
  visual_type?: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

interface HomepageCard {
  id: string;
  card_type: 'todays_special' | 'next_booking' | 'customer_review' | 'announcement';
  title: string;
  subtitle: string | null;
  description: string | null;
  price: number | null;
  price_unit: string | null;
  badge_label: string | null;
  product_link: string | null;
  event_date: string | null;
  guest_count: number | null;
  prep_percentage: number | null;
  reviewer_name: string | null;
  reviewer_event: string | null;
  rating: number | null;
  is_visible: boolean;
  display_order: number;
  image_path: string | null;
  image_url: string | null;
}

interface WeeklyMenuEntry {
  id: string;
  meal_date: string;
  day_name: string;
  meal_name: string | null;
  description: string | null;
  price: number | null;
  is_closed: boolean;
  closed_reason: string | null;
  created_at: string;
}

interface WeeklyMenuItemForm {
  meal_date: string;
  day_name: string;
  meal_name: string;
  description: string;
  price: string;
  is_closed: boolean;
  closed_reason: string;
}

interface Voucher {
  id: string;
  voucher_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_meals: number;
  meals_remaining: number;
  status: 'active' | 'redeemed' | 'expired' | 'unpaid' | 'paid';
  purchased_at: string;
  notes: string | null;
  package_type: string | null;
}

interface DiscountVoucher {
  id: string;
  dv_code: string;
  dv_amount: number;
  status: 'Active' | 'Inactive';
  expiry_date: string;
  times_used: number;
  created_at: string;
}

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  avatar_url: string | null;
  rating: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

interface TestimonialForm {
  quote: string;
  name: string;
  role: string;
  avatar_url: string;
  rating: number;
  is_active: boolean;
  display_order: string;
}

interface VoucherRedemption {
  id: string;
  voucher_code: string;
  order_id: string;
  meals_used: number;
  redeemed_at: string;
  notes: string | null;
  customer_name?: string;
  customer_email?: string;
  meals_remaining_before?: number;
  meals_remaining_after?: number;
  products_ordered?: Array<{ id: string; name: string; quantity: number; category: string; price: number }>;
}

interface ProductsOrderedRow {
  orderId: string;
  productName: string;
  productType: string;
  item: string;
  mealVoucher: string | null;
  discountVoucher: string | null;
  orderedDate: string;
  orderedRaw: string;
  deliveredDt: string;
  deliveredRaw: string;
  clientName: string;
  clientEmail: string;
}

interface PackageMealsOrderedRow {
  orderId: string;
  productName: string;
  productType: string;
  item: string;
  packagePurchased: string;
  mealVoucher: string | null;
  discountVoucher: string | null;
  orderedDate: string;
  orderedRaw: string;
  deliveredDt: string;
  deliveredRaw: string;
  clientName: string;
  clientEmail: string;
}

interface DiscountVouchersReportRow {
  dvCode: string;
  dvAmount: number;
  expiryDate: string;
  productName: string;
  productType: string;
  item: string;
  orderedDate: string;
  orderedRaw: string;
  deliveredDt: string;
  deliveredRaw: string;
  clientName: string;
  clientEmail: string;
}

interface DeliveredOrdersRow {
  orderId: string;
  productName: string;
  productType: string;
  item: string;
  packagePurchased: string;
  mealVoucher: string | null;
  discountVoucher: string | null;
  orderedDate: string;
  orderedRaw: string;
  deliveredDt: string;
  deliveredRaw: string;
  leadTime: string;
  clientEmail: string;
}

interface AbandonedCart {
  id: string;
  guest_token: string;
  items: Array<{ product: { id: string; name: string; price: number; category: string }; quantity: number }>;
  customer_email: string | null;
  customer_name: string | null;
  last_activity_at: string;
  reminder_sent_at: string | null;
  created_at: string;
}

const CARD_TYPE_LABELS: Record<HomepageCard['card_type'], string> = {
  todays_special: "Today's Special",
  next_booking: 'Next Booking',
  customer_review: 'Customer Review',
  announcement: 'Announcement',
};

const CARD_TYPE_ICONS: Record<HomepageCard['card_type'], string> = {
  todays_special: '🍽️',
  next_booking: '📅',
  customer_review: '⭐',
  announcement: '📢',
};

const emptyForm = {
  name: '',
  category: 'Catering Packages' as ProductCategory,
  price: '',
  unit: 'per serving',
  description: '',
  tags: '',
  badge: '',
  min_order: '',
  available: true,
  featured: false,
  sort_order: 0,
  package_type: 'none',
  image_fit: 'fill',
  old_price: '',
  saving_percent: '',
  attribute1: '',
  attribute2: '',
  attribute3: '',
  long_description: '',
  visual_type: '',
};

const emptyInviteForm = {
  full_name: '',
  email: '',
  phone_number: '',
  role: 'staff' as StaffRole,
};

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

function RedemptionAuditRow({ redemption, index }: { redemption: VoucherRedemption; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasProducts = redemption.products_ordered && redemption.products_ordered.length > 0;
  const hasAuditData = redemption.meals_remaining_before !== undefined && redemption.meals_remaining_after !== undefined;

  return (
    <div className="border border-[#DDD5C8] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#F5F0E8] hover:bg-[#EDE7DA] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-[#C4622D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index}
          </span>
          <div>
            <p className="text-xs font-semibold text-[#1A1612]">
              Order: <span className="font-mono text-[#C4622D]">{redemption.order_id || '—'}</span>
            </p>
            <p className="text-xs text-[#8C8278]">{new Date(redemption.redeemed_at).toLocaleDateString('en-ZA', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-[#C4622D]">-{redemption.meals_used} meal{redemption.meals_used !== 1 ? 's' : ''}</p>
            {hasAuditData && (
              <p className="text-xs text-[#8C8278]">{redemption.meals_remaining_before} → {redemption.meals_remaining_after} remaining</p>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-[#8C8278] transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4 bg-white space-y-3 border-t border-[#DDD5C8]">
          {(redemption.customer_name || redemption.customer_email) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {redemption.customer_name && (
                <div>
                  <p className="text-[#8C8278] mb-0.5">Customer</p>
                  <p className="font-semibold text-[#1A1612]">{redemption.customer_name}</p>
                </div>
              )}
              {redemption.customer_email && (
                <div>
                  <p className="text-[#8C8278] mb-0.5">Email</p>
                  <p className="font-semibold text-[#1A1612] break-all">{redemption.customer_email}</p>
                </div>
              )}
            </div>
          )}

          {hasAuditData && (
            <div className="bg-[#F5F0E8] rounded-lg px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-[#8C8278]">Balance before</span>
              <span className="font-bold text-[#1A1612]">{redemption.meals_remaining_before} meals</span>
              <svg className="w-4 h-4 text-[#C4622D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <span className="font-bold text-green-700">{redemption.meals_remaining_after} meals</span>
              <span className="text-[#8C8278]">Balance after</span>
            </div>
          )}

          {hasProducts && (
            <div>
              <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Products Ordered</p>
              <div className="space-y-1">
                {redemption.products_ordered!.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[#F0EBE3] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#EDE7DA] text-[#5C5347] text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {p.quantity}
                      </span>
                      <span className="text-[#1A1612] font-medium">{p.name}</span>
                      <span className="text-[#B5ADA5]">· {p.category}</span>
                    </div>
                    <span className="font-semibold text-[#1A1612]">R{(p.price * p.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {redemption.notes && (
            <p className="text-xs text-[#8C8278] italic">{redemption.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Analytics types & helpers ────────────────────────────────────────────────
type AnalyticsPeriod = '7d' | '30d' | '90d' | '12m';

interface OrderTrendPoint { label: string; orders: number; revenue: number; }
interface FulfillmentMetric { status: string; count: number; color: string; }
interface VoucherUsagePoint { label: string; mealVouchers: number; discountVouchers: number; }
interface SummaryMetric { label: string; value: string; sub?: string; icon: string; }

function getAnalyticsPeriodRange(period: AnalyticsPeriod): { from: Date; to: Date; bucketFn: (d: Date) => string } {
  const to = new Date();
  const from = new Date();
  if (period === '7d') {
    from.setDate(to.getDate() - 6);
    return { from, to, bucketFn: (d) => d.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit' }) };
  }
  if (period === '30d') {
    from.setDate(to.getDate() - 29);
    return { from, to, bucketFn: (d) => d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) };
  }
  if (period === '90d') {
    from.setDate(to.getDate() - 89);
    return { from, to, bucketFn: (d) => { const w = new Date(d); w.setDate(d.getDate() - d.getDay()); return w.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }); } };
  }
  from.setMonth(to.getMonth() - 11); from.setDate(1);
  return { from, to, bucketFn: (d) => d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }) };
}

function buildAnalyticsBuckets(period: AnalyticsPeriod, bucketFn: (d: Date) => string): string[] {
  const buckets: string[] = [];
  const seen = new Set<string>();
  const to = new Date(); const from = new Date();
  if (period === '7d') from.setDate(to.getDate() - 6);
  else if (period === '30d') from.setDate(to.getDate() - 29);
  else if (period === '90d') from.setDate(to.getDate() - 89);
  else { from.setMonth(to.getMonth() - 11); from.setDate(1); }
  const cur = new Date(from);
  while (cur <= to) { const label = bucketFn(new Date(cur)); if (!seen.has(label)) { seen.add(label); buckets.push(label); } cur.setDate(cur.getDate() + 1); }
  return buckets;
}

const ANALYTICS_FULFILLMENT_COLORS: Record<string, string> = { new: '#3B82F6', confirmed: '#8B5CF6', preparing: '#F97316', ready: '#14B8A6', delivered: '#22C55E', cancelled: '#EF4444' };
const ANALYTICS_FULFILLMENT_LABELS: Record<string, string> = { new: 'New', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', delivered: 'Delivered', cancelled: 'Cancelled' };

function AnalyticsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#DDD5C8] rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-[#1A1612] mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name === 'Revenue' ? `R${Number(p.value).toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  );
}
// ─── End Analytics helpers ────────────────────────────────────────────────────

export default function StaffWorkspacePage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productImageRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<StaffMember | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('products');
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [siteContentOpen, setSiteContentOpen] = useState(false);
  const [vouchersMenuOpen, setVouchersMenuOpen] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [cookingClassesOpen, setCookingClassesOpen] = useState(false);

  // ── Package Visibility state ──────────────────────────────────────────────
  const [packageVisibility, setPackageVisibility] = useState<{ id: string; package_name: string; is_visible: boolean }[]>([]);
  const [packageVisibilityLoading, setPackageVisibilityLoading] = useState(false);
  const [packageVisibilitySaving, setPackageVisibilitySaving] = useState<Record<string, boolean>>({});
  // ── End Package Visibility state ──────────────────────────────────────────

  // ── Analytics state ──────────────────────────────────────────────────────
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('30d');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [orderTrend, setOrderTrend] = useState<OrderTrendPoint[]>([]);
  const [voucherUsage, setVoucherUsage] = useState<VoucherUsagePoint[]>([]);
  const [fulfillmentMetrics, setFulfillmentMetrics] = useState<FulfillmentMetric[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetric[]>([]);
  // ── End Analytics state ──────────────────────────────────────────────────

  // Inactivity timer
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(120);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Global error modal
  const [globalError, setGlobalError] = useState('');
  const [globalErrorTitle, setGlobalErrorTitle] = useState('');

  // Delete confirm modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [packageTypes, setPackageTypes] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [staffProductCategory, setStaffProductCategory] = useState<string>('All');
  const [oldPriceErrorModal, setOldPriceErrorModal] = useState(false);
  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', active: true, sort_order: '0' });
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryFormSuccess, setCategoryFormSuccess] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  // Staff management state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sendingResetId, setSendingResetId] = useState<string | null>(null);
  const [resetMessages, setResetMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<StaffMember | null>(null);
  const [deleteActiveMember, setDeleteActiveMember] = useState<StaffMember | null>(null);
  const [editMenuOpenId, setEditMenuOpenId] = useState<string | null>(null);
  // Edit modal state
  const [editModalMember, setEditModalMember] = useState<StaffMember | null>(null);
  const [editModalForm, setEditModalForm] = useState({ full_name: '', phone: '', role: 'staff' as StaffRole });
  const [editModalSaving, setEditModalSaving] = useState(false);
  const [editModalError, setEditModalError] = useState('');
  // Promote existing user state
  const [promoteForm, setPromoteForm] = useState({ email: '', full_name: '', phone_number: '', role: 'staff' as StaffRole });
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState('');
  const [promoteSuccess, setPromoteSuccess] = useState('');
  const [promoteOpen, setPromoteOpen] = useState(false);
  // Homepage cards state
  const [homepageCards, setHomepageCards] = useState<HomepageCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [editingCard, setEditingCard] = useState<HomepageCard | null>(null);
  const [cardForm, setCardForm] = useState<Partial<HomepageCard>>({});
  const [cardFormError, setCardFormError] = useState('');
  const [cardFormSuccess, setCardFormSuccess] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [togglingCardId, setTogglingCardId] = useState<string | null>(null);
  const [homepageCardSearchQuery, setHomepageCardSearchQuery] = useState('');
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardImagePreview, setCardImagePreview] = useState<string | null>(null);
  const [uploadingCardImage, setUploadingCardImage] = useState(false);
  const cardImageRef = useRef<HTMLInputElement>(null);
  // Ticker Banner state
  const [tickerBannerText, setTickerBannerText] = useState('Now Accepting 2027 Bookings');
  const [tickerBannerVisible, setTickerBannerVisible] = useState(false);
  const [tickerBannerLoading, setTickerBannerLoading] = useState(false);
  const [tickerBannerSaving, setTickerBannerSaving] = useState(false);
  const [tickerBannerSuccess, setTickerBannerSuccess] = useState('');
  const [tickerBannerEditing, setTickerBannerEditing] = useState(false);
  // Weekly Menu state
  const [weeklyMenuEntries, setWeeklyMenuEntries] = useState<WeeklyMenuEntry[]>([]);
  const [weeklyMenuLoading, setWeeklyMenuLoading] = useState(false);
  const [showWeeklyMenuForm, setShowWeeklyMenuForm] = useState(false);
  const [editingWeeklyEntry, setEditingWeeklyEntry] = useState<WeeklyMenuEntry | null>(null);
  const [weeklyMenuForm, setWeeklyMenuForm] = useState<WeeklyMenuItemForm>({
    meal_date: '', day_name: '', meal_name: '', description: '', price: '', is_closed: false, closed_reason: '',
  });
  const [weeklyMenuFormError, setWeeklyMenuFormError] = useState('');
  const [weeklyMenuFormSuccess, setWeeklyMenuFormSuccess] = useState('');
  const [savingWeeklyEntry, setSavingWeeklyEntry] = useState(false);
  const [deletingWeeklyEntryId, setDeletingWeeklyEntryId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [closingDayDate, setClosingDayDate] = useState<string | null>(null);
  const [savingClosedDay, setSavingClosedDay] = useState(false);
  // Vouchers state
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [voucherRedemptions, setVoucherRedemptions] = useState<VoucherRedemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [issueVoucherForm, setIssueVoucherForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '', total_meals: '', notes: '',
  });
  const [issueVoucherError, setIssueVoucherError] = useState('');
  const [issueVoucherSuccess, setIssueVoucherSuccess] = useState('');
  const [issuingVoucher, setIssuingVoucher] = useState(false);
  const [vouchersSearchQuery, setVouchersSearchQuery] = useState('');
  const [markingVoucherPaidId, setMarkingVoucherPaidId] = useState<string | null>(null);
  const [loadingMarkingPaid, setLoadingMarkingPaid] = useState(false);
  // Discount Vouchers state
  const [discountVouchers, setDiscountVouchers] = useState<DiscountVoucher[]>([]);
  const [dvLoading, setDvLoading] = useState(false);
  const [showDvForm, setShowDvForm] = useState(false);
  const [editingDv, setEditingDv] = useState<DiscountVoucher | null>(null);
  const [dvForm, setDvForm] = useState({ dv_code: '', dv_type: 'Discount' as 'Discount' | 'Gift', dv_amount: '', status: 'Active\' as \'Active\' | \'Inactive', expiry_date: '', created_at: '' });
  const [dvFormError, setDvFormError] = useState('');
  const [dvFormSuccess, setDvFormSuccess] = useState('');
  const [savingDv, setSavingDv] = useState(false);
  const [dvSearchQuery, setDvSearchQuery] = useState('');
  const [dvFilterExpired, setDvFilterExpired] = useState<'all' | 'active' | 'expired'>('all');
  const [generatingQrId, setGeneratingQrId] = useState<string | null>(null);
  // Meal Vouchers management state
  const [mvLoading, setMvLoading] = useState(false);
  const [showMvForm, setShowMvForm] = useState(false);
  const [editingMv, setEditingMv] = useState<Voucher | null>(null);
  const [mvForm, setMvForm] = useState({ voucher_code: '', customer_name: '', customer_email: '', customer_phone: '', total_meals: '', meals_remaining: '', status: 'unpaid' as Voucher['status'], notes: '', package_type: 'none' as string, purchased_at: '' });
  const [mvFormError, setMvFormError] = useState('');
  const [mvFormSuccess, setMvFormSuccess] = useState('');
  const [savingMv, setSavingMv] = useState(false);
  const [mvSearchQuery, setMvSearchQuery] = useState('');
  const [showMvEditModal, setShowMvEditModal] = useState(false);
  const [mvOrderItems, setMvOrderItems] = useState<Array<{ name: string; quantity: number; category: string; price: number }>>([]);
  const [mvOrderItemsLoading, setMvOrderItemsLoading] = useState(false);
  const [mvFilterStatus, setMvFilterStatus] = useState<'all' | 'active' | 'unpaid' | 'paid' | 'redeemed' | 'expired'>('all');
  // Testimonials state
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<TestimonialForm>({
    quote: '', name: '', role: '', avatar_url: '', rating: 5, is_active: true, display_order: '0',
  });
  const [testimonialFormError, setTestimonialFormError] = useState('');
  const [testimonialFormSuccess, setTestimonialFormSuccess] = useState('');
  const [savingTestimonial, setSavingTestimonial] = useState(false);
  const [testimonialSearchQuery, setTestimonialSearchQuery] = useState('');
  // Social Links state
  const [socialLinks, setSocialLinks] = useState<{ id: string; platform: string; url: string; display_order: number }[]>([]);
  const [socialLinksLoading, setSocialLinksLoading] = useState(false);
  const [socialLinksSaving, setSocialLinksSaving] = useState(false);
  const [socialLinksError, setSocialLinksError] = useState('');
  const [socialLinksSuccess, setSocialLinksSuccess] = useState('');
  const [socialLinksForm, setSocialLinksForm] = useState<Record<string, string>>({});
  // Gallery state
  const [galleryImages, setGalleryImages] = useState<{ id: string; title: string; description: string | null; image_path: string; sort_order: number; is_visible: boolean; imageUrl?: string }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [gallerySectionVisible, setGallerySectionVisible] = useState(true);
  const [gallerySettingsId, setGallerySettingsId] = useState<string | null>(null);
  const [gallerySettingsSaving, setGallerySettingsSaving] = useState(false);
  // Homepage section visibility state
  const [homepageSections, setHomepageSections] = useState<{ id: string; section_key: string; section_label: string; is_visible: boolean }[]>([]);
  const [homepageSectionsSaving, setHomepageSectionsSaving] = useState<Record<string, boolean>>({});
  const [homepageSectionsLoading, setHomepageSectionsLoading] = useState(false);
  const [showGalleryForm, setShowGalleryForm] = useState(false);
  const [editingGalleryImage, setEditingGalleryImage] = useState<{ id: string; title: string; description: string | null; image_path: string; sort_order: number; is_visible: boolean; imageUrl?: string } | null>(null);
  const [galleryForm, setGalleryForm] = useState({ title: '', description: '', sort_order: '0', is_visible: true });
  const [galleryFormError, setGalleryFormError] = useState('');
  const [galleryFormSuccess, setGalleryFormSuccess] = useState('');
  const [savingGallery, setSavingGallery] = useState(false);
  const [galleryImageFile, setGalleryImageFile] = useState<File | null>(null);
  const [galleryImagePreview, setGalleryImagePreview] = useState<string | null>(null);
  const [uploadingGalleryImage, setUploadingGalleryImage] = useState(false);
  const [togglingGalleryId, setTogglingGalleryId] = useState<string | null>(null);
  const galleryImageRef = useRef<HTMLInputElement>(null);
  // Orders tab state
  const [wsOrders, setWsOrders] = useState<Order[]>([]);
  const [wsOrdersLoading, setWsOrdersLoading] = useState(false);
  const [wsOrdersError, setWsOrdersError] = useState('');
  const [wsExpandedOrderId, setWsExpandedOrderId] = useState<string | null>(null);
  const [wsOrderUpdateStates, setWsOrderUpdateStates] = useState<Record<string, OrderUpdateState>>({});
  const [wsOrderSearch, setWsOrderSearch] = useState('');
  const [wsFilterPayment, setWsFilterPayment] = useState<string>('all');
  const [wsFilterFulfillment, setWsFilterFulfillment] = useState<string>('all');
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  // Order Management Dashboard state
  const [wsRealtimeConnected, setWsRealtimeConnected] = useState(false);
  const [wsNewOrderAlert, setWsNewOrderAlert] = useState<string | null>(null);
  const [wsReminderSending, setWsReminderSending] = useState<Record<string, boolean>>({});
  const [wsReminderResult, setWsReminderResult] = useState<Record<string, 'sent' | 'error'>>({});
  const [wsSendingAllReminders, setWsSendingAllReminders] = useState(false);
  const [wsAllReminderResult, setWsAllReminderResult] = useState<{ sent: number; total: number } | null>(null);
  const [wsVoucherPriceMap, setWsVoucherPriceMap] = useState<Record<string, number>>({});
  // ── Abandoned Carts state ──────────────────────────────────────────────────
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [abandonedCartsLoading, setAbandonedCartsLoading] = useState(false);
  const [abandonedCartsError, setAbandonedCartsError] = useState('');
  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const [reminderPaused, setReminderPaused] = useState('');
  const [reminderResult, setReminderResult] = useState<{ processed: number; results: Array<{ token: string; status: string; email?: string }> } | null>(null);
  const [abandonedCartsOpen, setAbandonedCartsOpen] = useState(false);
  const [deletingCartId, setDeletingCartId] = useState<string | null>(null);
  const [cartToDelete, setCartToDelete] = useState<AbandonedCart | null>(null);
  // ── End Abandoned Carts state ──────────────────────────────────────────────
  // ── Customer Order History state ──────────────────────────────────────────
  const [cohLookupInput, setCohLookupInput] = useState('');
  const [cohLookupLoading, setCohLookupLoading] = useState(false);
  const [cohLookupError, setCohLookupError] = useState('');
  const [cohProfile, setCohProfile] = useState<{ customer_name: string; customer_email: string; customer_phone: string; first_order_date: string } | null>(null);
  const [cohOrders, setCohOrders] = useState<Order[]>([]);
  const [cohExpandedOrderId, setCohExpandedOrderId] = useState<string | null>(null);
  // ── End Customer Order History state ─────────────────────────────────────
  // Reporting state
  const [reportingView, setReportingView] = useState<'cards' | 'products_ordered' | 'package_meals_ordered' | 'frozen_meals_ordered' | 'discount_vouchers_report' | 'delivered_orders'>('cards');
  const [productsOrderedRows, setProductsOrderedRows] = useState<ProductsOrderedRow[]>([]);
  const [productsOrderedLoading, setProductsOrderedLoading] = useState(false);
  const [packageMealsRows, setPackageMealsRows] = useState<PackageMealsOrderedRow[]>([]);
  const [packageMealsLoading, setPackageMealsLoading] = useState(false);
  const [frozenMealsRows, setFrozenMealsRows] = useState<PackageMealsOrderedRow[]>([]);
  const [frozenMealsLoading, setFrozenMealsLoading] = useState(false);
  const [discountVouchersReportRows, setDiscountVouchersReportRows] = useState<DiscountVouchersReportRow[]>([]);
  const [discountVouchersReportLoading, setDiscountVouchersReportLoading] = useState(false);
  const [deliveredOrdersRows, setDeliveredOrdersRows] = useState<DeliveredOrdersRow[]>([]);
  const [deliveredOrdersLoading, setDeliveredOrdersLoading] = useState(false);
  // Date range filter state for each report
  const [productsOrderedDateFrom, setProductsOrderedDateFrom] = useState('');
  const [productsOrderedDateTo, setProductsOrderedDateTo] = useState('');
  const [packageMealsDateFrom, setPackageMealsDateFrom] = useState('');
  const [packageMealsDateTo, setPackageMealsDateTo] = useState('');
  const [frozenMealsDateFrom, setFrozenMealsDateFrom] = useState('');
  const [frozenMealsDateTo, setFrozenMealsDateTo] = useState('');
  const [discountVouchersDateFrom, setDiscountVouchersDateFrom] = useState('');
  const [discountVouchersDateTo, setDiscountVouchersDateTo] = useState('');
  const [deliveredOrdersDateFrom, setDeliveredOrdersDateFrom] = useState('');
  const [deliveredOrdersDateTo, setDeliveredOrdersDateTo] = useState('');
  // Sort state for each report table
  type SortDir = 'asc' | 'desc';
  const [productsOrderedSort, setProductsOrderedSort] = useState<{ col: string; dir: SortDir }>({ col: '', dir: 'asc' });
  const [packageMealsSort, setPackageMealsSort] = useState<{ col: string; dir: SortDir }>({ col: '', dir: 'asc' });
  const [frozenMealsSort, setFrozenMealsSort] = useState<{ col: string; dir: SortDir }>({ col: '', dir: 'asc' });
  const [discountVouchersSort, setDiscountVouchersSort] = useState<{ col: string; dir: SortDir }>({ col: '', dir: 'asc' });
  const [deliveredOrdersSort, setDeliveredOrdersSort] = useState<{ col: string; dir: SortDir }>({ col: '', dir: 'asc' });
  const [reportingSearchQuery, setReportingSearchQuery] = useState('');
  // Media library state
  const [mediaFiles, setMediaFiles] = useState<StorageFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [activeBucket, setActiveBucket] = useState<BucketType>('product-images');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Visual types state
  const [visualTypes, setVisualTypes] = useState<string[]>([]);

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const formatCurrency = (val: number | null | undefined) =>
    val != null ? `R${Number(val).toFixed(2)}` : '—';

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateDMY = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Formats reminder date as "Day dd/mm/yyyy" e.g. "Thur 21/05/2026"
  const formatReminderDate = (dateStr: string | null | undefined, paymentStatus: string): string => {
    if (paymentStatus === 'paid') return 'N/A - Paid';
    if (!dateStr) return 'No reminder sent';
    try {
      const d = new Date(dateStr);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
      const dayName = dayNames[d.getDay()];
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${dayName} ${day}/${month}/${year}`;
    } catch {
      return 'No reminder sent';
    }
  };

  const showGlobalError = (msg: string, title = 'Error') => {
    setGlobalError(msg);
    setGlobalErrorTitle(title);
  };

  const showProductFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Product Error'); };
  const showCategoryFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Category Error'); };
  const showInviteError = (msg: string) => { if (msg) showGlobalError(msg, 'Invite Error'); };
  const showCardFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Homepage Card Error'); };
  const showWeeklyMenuFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Weekly Menu Error'); };
  const showIssueVoucherError = (msg: string) => { if (msg) showGlobalError(msg, 'Voucher Error'); };
  const showUploadError = (msg: string) => { if (msg) showGlobalError(msg, 'Upload Error'); };

  // ─── PDF Download helpers ──────────────────────────────────────────────────
  const printReportPDF = (title: string, headers: string[], rows: string[][]) => {
    const tableRows = rows.map(r =>
      `<tr>${r.map(c => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:11px;">${c || '—'}</td>`).join('')}</tr>`
    ).join('');
    const html = `<html><head><title>${title}</title><style>body{font-family:sans-serif;padding:20px;}table{border-collapse:collapse;width:100%;}th{background:#C4622D;color:#fff;padding:8px 10px;font-size:12px;text-align:left;}tr:nth-child(even){background:#f9f5f0;}</style></head><body><h2 style="color:#C4622D;">${title}</h2><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const downloadProductsOrderedPDF = (rows: ProductsOrderedRow[]) => {
    let headers = ['Product', 'Type', 'Item', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Client', 'eMail'];
    const pdfRows = rows.map(r => [
      r.productName,
      r.productType,
      r.item,
      r.mealVoucher || '',
      r.discountVoucher || '',
      r.orderedDate,
      r.clientName,
      r.clientEmail,
    ]);
    printReportPDF('Products Ordered', headers, pdfRows);
  };

  const downloadPackageMealsPDF = (rows: PackageMealsOrderedRow[]) => {
    let headers = ['Product', 'Type', 'Item', 'Package', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Client', 'eMail'];
    const pdfRows = rows.map(r => [
      r.productName,
      r.productType,
      r.item,
      r.packagePurchased,
      r.mealVoucher || '',
      r.discountVoucher || '',
      r.orderedDate,
      r.deliveredDt,
      r.clientName,
      r.clientEmail,
    ]);
    printReportPDF('Package Meals Ordered', headers, pdfRows);
  };

  const downloadFrozenMealsPDF = (rows: PackageMealsOrderedRow[]) => {
    let headers = ['Product', 'Type', 'Item', 'Package', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Client', 'eMail'];
    const pdfRows = rows.map(r => [
      r.productName,
      r.productType,
      r.item,
      r.packagePurchased,
      r.mealVoucher || '',
      r.discountVoucher || '',
      r.orderedDate,
      r.deliveredDt,
      r.clientName,
      r.clientEmail,
    ]);
    printReportPDF('Frozen Meals Ordered', headers, pdfRows);
  };

  const downloadDiscountVouchersPDF = (rows: DiscountVouchersReportRow[]) => {
    let headers = ['Discount Voucher', 'Amount', 'Expiry Date', 'Product Name', 'Type', 'Item', 'Ordered', 'Delivered', 'Client', 'eMail'];
    const pdfRows = rows.map(r => [
      r.dvCode,
      `R${r.dvAmount.toFixed(2)}`,
      r.expiryDate,
      r.productName,
      r.productType,
      r.item,
      r.orderedDate,
      r.deliveredDt,
      r.clientName,
      r.clientEmail,
    ]);
    printReportPDF('Discount Vouchers', headers, pdfRows);
  };

  const downloadDeliveredOrdersPDF = (rows: DeliveredOrdersRow[]) => {
    let headers = ['Product', 'Type', 'Item', 'Package', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Lead Time', 'Email'];
    const pdfRows = rows.map(r => [
      r.productName,
      r.productType,
      r.item,
      r.packagePurchased,
      r.mealVoucher || '',
      r.discountVoucher || '',
      r.orderedDate,
      r.deliveredDt,
      r.leadTime,
      r.clientEmail,
    ]);
    printReportPDF('Delivered Orders', headers, pdfRows);
  };

  // ─── Inactivity timer ─────────────────────────────────────────────────────────
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
      await loadCategoryNames();
      await loadPackageTypes();
      await loadProducts();
      await loadVisualTypes();
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

  // ─── Orders realtime subscription ────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'orders') return;
    // Initial load whenever the Orders tab becomes active — covers both clicking the
    // tab AND landing on it by default (e.g. staff, whose default tab is Orders).
    loadWsOrders();
    const channel = supabase
      .channel('ws-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const newOrder = payload.new as Order;
        setWsOrders(prev => {
          if (prev.some(o => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
        setWsNewOrderAlert(`New order from ${newOrder.customer_name || 'a customer'}!`);
        setTimeout(() => setWsNewOrderAlert(null), 5000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const updated = payload.new as Order;
        setWsOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
      })
      .subscribe(status => setWsRealtimeConnected(status === 'SUBSCRIBED'));
    return () => { supabase.removeChannel(channel); setWsRealtimeConnected(false); };
  }, [activeTab]);

  // ─── Load functions ───────────────────────────────────────────────────────────
  const loadCategoryNames = async () => {
    const { data } = await supabase.from('categories').select('name').eq('active', true).order('sort_order');
    if (data) setCategoryNames(data.map((c: any) => c.name));
  };

  const loadPackageTypes = async () => {
    const { data } = await supabase.from('products').select('package_type').not('package_type', 'is', null);
    if (data) {
      const unique = Array.from(new Set(data.map((p: any) => p.package_type).filter(Boolean)));
      const allTypes = Array.from(new Set(['none', 'package-6', 'package-12', 'package-24', 'wellness-range', ...unique]));
      setPackageTypes(allTypes);
    } else {
      setPackageTypes(['none', 'package-6', 'package-12', 'package-24', 'wellness-range']);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('sort_order');
    if (!error && data) {
      const withUrls = data.map((p: Product) => {
        if (p.image_path) {
          if (p.image_path.startsWith('/')) {
            return { ...p, imageUrl: p.image_path };
          }
          // product-images is a public bucket — use a direct public URL (a signed
          // URL 400s here and is unnecessary). Matches the customer /products page.
          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(p.image_path);
          return { ...p, imageUrl: urlData?.publicUrl };
        }
        return p;
      });
      setProducts(withUrls);
    }
    setProductsLoading(false);
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    const { data } = await supabase.from('product_categories').select('*').order('sort_order');
    if (data) setCategories(data);
    setCategoriesLoading(false);
  };

  const loadVisualTypes = async () => {
    const { data } = await supabase.from('visual_types').select('name').order('name');
    if (data) setVisualTypes(data.map((r: { name: string }) => r.name));
  };

  const loadStaff = async () => {
    setStaffLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    if (data) setStaffMembers(data.filter(m => m.role !== 'super_admin'));
    setStaffLoading(false);
  };

  const loadHomepageCards = async () => {
    setCardsLoading(true);
    const { data } = await supabase.from('homepage_cards').select('*').order('display_order');
    if (data) setHomepageCards(data);
    setCardsLoading(false);
  };

  const loadTickerBanner = async () => {
    setTickerBannerLoading(true);
    const { data } = await supabase
      .from('homepage_section_settings')
      .select('is_visible, banner_text')
      .eq('section_key', 'ticker_banner')
      .single();
    if (data) {
      setTickerBannerVisible(data.is_visible);
      if (data.banner_text) setTickerBannerText(data.banner_text);
    }
    setTickerBannerLoading(false);
  };

  const handleSaveTickerBanner = async () => {
    setTickerBannerSaving(true);
    await supabase
      .from('homepage_section_settings')
      .update({ banner_text: tickerBannerText })
      .eq('section_key', 'ticker_banner');
    setTickerBannerSuccess('Banner text saved!');
    setTickerBannerSaving(false);
    setTimeout(() => setTickerBannerSuccess(''), 3000);
  };

  const handleToggleTickerBanner = async () => {
    const newVisible = !tickerBannerVisible;
    setTickerBannerLoading(true);
    await supabase
      .from('homepage_section_settings')
      .update({ is_visible: newVisible })
      .eq('section_key', 'ticker_banner');
    await loadTickerBanner();
  };

  const loadWeeklyMenu = async () => {
    setWeeklyMenuLoading(true);
    const monday = getMondayOfWeek(weekOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const from = monday.toISOString().split('T')[0];
    const to = sunday.toISOString().split('T')[0];
    const { data } = await supabase
      .from('weekly_menu')
      .select('*')
      .gte('meal_date', from)
      .lte('meal_date', to)
      .order('meal_date');
    if (data) setWeeklyMenuEntries(data);
    setWeeklyMenuLoading(false);
  };

  const loadVouchers = async () => {
    setVouchersLoading(true);
    const { data } = await supabase.from('vouchers').select('*').order('purchased_at', { ascending: false });
    if (data) setVouchers(data);
    setVouchersLoading(false);
  };

  const loadMealVouchers = async () => {
    setMvLoading(true);
    const { data } = await supabase.from('vouchers').select('*').order('purchased_at', { ascending: false });
    if (data) setVouchers(data);
    setMvLoading(false);
  };

  const fetchVoucherOrderItems = async (voucherCode: string) => {
    setMvOrderItemsLoading(true);
    setMvOrderItems([]);
    try {
      // Orders are linked to vouchers via m_payment_id matching the voucher_code
      const { data: orderData } = await supabase
        .from('orders')
        .select('items')
        .eq('m_payment_id', voucherCode)
        .limit(1)
        .maybeSingle();
      if (orderData?.items && Array.isArray(orderData.items)) {
        setMvOrderItems(orderData.items.map((it: any) => ({
          name: it.name || '',
          quantity: Number(it.quantity) || 1,
          category: it.category || '',
          price: Number(it.price) || 0,
        })));
      }
    } catch {
      // silently ignore — order items are read-only info
    } finally {
      setMvOrderItemsLoading(false);
    }
  };

  const loadDiscountVouchers = async () => {
    setDvLoading(true);
    const { data } = await supabase.from('discount_vouchers').select('*').order('created_at', { ascending: false });
    if (data) setDiscountVouchers(data);
    setDvLoading(false);
  };

  const loadTestimonials = async () => {
    setTestimonialsLoading(true);
    const { data } = await supabase.from('testimonials').select('*').order('display_order');
    if (data) setTestimonials(data);
    setTestimonialsLoading(false);
  };

  const loadSocialLinks = async () => {
    setSocialLinksLoading(true);
    const { data } = await supabase.from('social_links').select('*').order('display_order');
    if (data) {
      setSocialLinks(data);
      const form: Record<string, string> = {};
      data.forEach((s: { platform: string; url: string }) => { form[s.platform] = s.url; });
      setSocialLinksForm(form);
    }
    setSocialLinksLoading(false);
  };

  const loadGallery = async () => {
    setGalleryLoading(true);
    // Load settings
    const { data: settings } = await supabase.from('gallery_settings').select('*').limit(1).single();
    if (settings) {
      setGallerySectionVisible(settings.section_visible);
      setGallerySettingsId(settings.id);
    }
    // Load images
    const { data } = await supabase.from('gallery_images').select('*').order('sort_order');
    if (data) {
      const withUrls = await Promise.all(data.map(async (img: any) => {
        const { data: urlData } = await supabase.storage.from('gallery-images').createSignedUrl(img.image_path, 3600);
        return { ...img, imageUrl: urlData?.signedUrl };
      }));
      setGalleryImages(withUrls);
    }
    setGalleryLoading(false);
  };

  const loadHomepageSections = async () => {
    setHomepageSectionsLoading(true);
    const { data: sectionData } = await supabase.from('homepage_section_settings').select('*').order('section_key');
    if (sectionData) {
      const sectionOrder: Record<string, number> = { hero_badge: 0, what_we_do: 1, customer_favourites: 2, the_process: 3, testimonials: 4 };
      const sorted = [...sectionData]
        .filter(s => s.section_key !== 'ticker_banner')
        .sort((a, b) => (sectionOrder[a.section_key] ?? 99) - (sectionOrder[b.section_key] ?? 99));
      setHomepageSections(sorted);
    }
    setHomepageSectionsLoading(false);
  };

  const handleToggleGallerySectionVisible = async (visible: boolean) => {
    setGallerySettingsSaving(true);
    if (gallerySettingsId) {
      await supabase.from('gallery_settings').update({ section_visible: visible, updated_at: new Date().toISOString() }).eq('id', gallerySettingsId);
    } else {
      const { data } = await supabase.from('gallery_settings').insert({ section_visible: visible }).select().single();
      if (data) setGallerySettingsId(data.id);
    }
    setGallerySectionVisible(visible);
    setGallerySettingsSaving(false);
  };

  const handleToggleHomepageSection = async (sectionKey: string, visible: boolean) => {
    setHomepageSectionsSaving(prev => ({ ...prev, [sectionKey]: true }));
    await supabase
      .from('homepage_section_settings')
      .update({ is_visible: visible, updated_at: new Date().toISOString() })
      .eq('section_key', sectionKey);
    setHomepageSections(prev =>
      prev.map(s => s.section_key === sectionKey ? { ...s, is_visible: visible } : s)
    );
    setHomepageSectionsSaving(prev => ({ ...prev, [sectionKey]: false }));
  };

  const openAddGalleryForm = () => {
    setEditingGalleryImage(null);
    setGalleryForm({ title: '', description: '', sort_order: '0', is_visible: true });
    setGalleryImageFile(null);
    setGalleryImagePreview(null);
    setGalleryFormError('');
    setGalleryFormSuccess('');
    setShowGalleryForm(true);
  };

  const openEditGalleryForm = (img: typeof galleryImages[0]) => {
    setEditingGalleryImage(img);
    setGalleryForm({ title: img.title, description: img.description || '', sort_order: String(img.sort_order), is_visible: img.is_visible });
    setGalleryImageFile(null);
    setGalleryImagePreview(img.imageUrl || null);
    setGalleryFormError('');
    setGalleryFormSuccess('');
    setShowGalleryForm(true);
  };

  const handleSaveGalleryImage = async () => {
    if (!galleryForm.title.trim()) { setGalleryFormError('Title is required.'); return; }
    if (!editingGalleryImage && !galleryImageFile) { setGalleryFormError('Please upload an image.'); return; }
    setSavingGallery(true);
    let image_path = editingGalleryImage?.image_path || '';
    if (galleryImageFile) {
      setUploadingGalleryImage(true);
      const ext = galleryImageFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('gallery-images').upload(path, galleryImageFile);
      if (uploadErr) { setGalleryFormError(uploadErr.message); setSavingGallery(false); setUploadingGalleryImage(false); return; }
      image_path = path;
      setUploadingGalleryImage(false);
    }
    const payload = {
      title: galleryForm.title.trim(),
      description: galleryForm.description.trim() || null,
      image_path,
      sort_order: Number(galleryForm.sort_order),
      is_visible: galleryForm.is_visible,
      updated_at: new Date().toISOString(),
    };
    let saveError: any = null;
    if (editingGalleryImage) {
      const { data: upd, error } = await supabase.from('gallery_images').update(payload).eq('id', editingGalleryImage.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit gallery images.' };
    } else {
      const { data: ins, error } = await supabase.from('gallery_images').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the image. Please try again.' };
    }
    if (saveError) { setGalleryFormError(saveError.message); }
    else {
      setGalleryFormSuccess(editingGalleryImage ? 'Image updated!' : 'Image added!');
      setShowGalleryForm(false);
      setEditingGalleryImage(null);
      await loadGallery();
    }
    setSavingGallery(false);
  };

  const handleDeleteGalleryImage = (img: typeof galleryImages[0]) => {
    setDeleteModal({
      open: true,
      title: 'Delete Gallery Image',
      message: `Delete "${img.title}" from the gallery? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data, error } = await supabase.from('gallery_images').delete().eq('id', img.id).select('id');
        if (error || !data || data.length === 0) {
          showGlobalError('Could not delete the image — you may not have permission, or it was already removed.', 'Gallery Error');
        } else if (img.image_path) {
          // Remove the underlying file so we don't leave orphaned objects in storage.await supabase.storage.from('gallery-images').remove([img.image_path]);
        }
        await loadGallery();
      },
    });
  };

  const handleToggleGalleryImageVisible = async (img: typeof galleryImages[0]) => {
    setTogglingGalleryId(img.id);
    const { data, error } = await supabase.from('gallery_images').update({ is_visible: !img.is_visible }).eq('id', img.id).select('id');
    if (error || !data || data.length === 0) {
      showGlobalError('Could not update image visibility — please try again.', 'Gallery Error');
    }
    await loadGallery();
    setTogglingGalleryId(null);
  };

  const VOUCHER_PACKAGE_PRICES_WS: Record<string, number> = {
    'package-6': 690,'package-10': 1350,'package-12': 1320,'package-24': 2520,
  };

  const loadWsOrders = async () => {
    setWsOrdersLoading(true);
    setWsOrdersError('');
    const { data, error } = await supabase
      .from('orders').select('*') // includes subtotal, delivery_fee, notes, total for calculateOrderTotal
      .order('created_at', { ascending: false });
    if (error) { setWsOrdersError(error.message); }
    else {
      const orders = data || [];
      setWsOrders(orders);
      // Build voucher price map
      const voucherCodes: string[] = [];
      orders.forEach((o: Order) => {
        if (o.notes) {
          const match = o.notes.match(/Voucher:\s*([A-Z0-9-]+)/i);
          if (match) voucherCodes.push(match[1].replace(/\.$/, ''));
        }
      });
      if (voucherCodes.length > 0) {
        const { data: vData } = await supabase
          .from('vouchers')
          .select('voucher_code, package_type')
          .in('voucher_code', voucherCodes);
        if (vData) {
          const priceMap: Record<string, number> = {};
          vData.forEach((v: { voucher_code: string; package_type: string }) => {
            const price = VOUCHER_PACKAGE_PRICES_WS[v.package_type];
            if (price !== undefined) priceMap[v.voucher_code] = price;
          });
          setWsVoucherPriceMap(priceMap);
        }
      }
    }
    setWsOrdersLoading(false);
  };

  // ── Load Abandoned Carts ───────────────────────────────────────────────────
  const loadAbandonedCarts = async () => {
    setAbandonedCartsLoading(true);
    setAbandonedCartsError('');
    const { data, error } = await supabase
      .from('guest_carts')
      .select('*')
      .order('last_activity_at', { ascending: false });
    if (error) {
      setAbandonedCartsError(error.message);
    } else {
      setAbandonedCarts((data || []) as AbandonedCart[]);
    }
    setAbandonedCartsLoading(false);
  };

  const handleTriggerReminders = async () => {
    setTriggeringReminders(true);
    setReminderResult(null);
    setAbandonedCartsError('');
    setReminderPaused('');
    try {
      const res = await fetch('/api/abandoned-cart/trigger', { method: 'POST' });
      const data = await res.json();
      // The reminder pipeline can be intentionally paused (503 + message). Treat
      // that as an informational state, not a hard error.
      if (res.status === 503 || (data && data.message && !data.processed)) {
        setReminderPaused(data.message || 'Abandoned cart reminders are currently paused.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to trigger reminders');
      setReminderResult(data);
      await loadAbandonedCarts();
    } catch (err: any) {
      setAbandonedCartsError(err?.message || 'Failed to trigger reminders');
    } finally {
      setTriggeringReminders(false);
    }
  };
  // ── End Load Abandoned Carts ───────────────────────────────────────────────

  // ── Package Visibility ─────────────────────────────────────────────────────
  const loadPackageVisibility = async () => {
    setPackageVisibilityLoading(true);
    const { data } = await supabase
      .from('package_visibility')
      .select('*')
      .order('package_name');
    if (data) setPackageVisibility(data);
    setPackageVisibilityLoading(false);
  };

  const handleTogglePackageVisibility = async (id: string, newValue: boolean) => {
    setPackageVisibilitySaving(prev => ({ ...prev, [id]: true }));
    // .select() confirms the write actually applied; a 0-row/error result means it was
    // blocked, so we surface an error and reload instead of leaving the UI out of sync.
    const { data, error } = await supabase
      .from('package_visibility')
      .update({ is_visible: newValue, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    if (error || !data || data.length === 0) {
      showGlobalError('Could not update package visibility — please try again.', 'Package Visibility Error');
      await loadPackageVisibility();
    } else {
      setPackageVisibility(prev =>
        prev.map(p => p.id === id ? { ...p, is_visible: newValue } : p)
      );
    }
    setPackageVisibilitySaving(prev => ({ ...prev, [id]: false }));
  };
  // ── End Package Visibility ─────────────────────────────────────────────────

  const handleDeleteAbandonedCart = async () => {
    if (!cartToDelete) return;
    const target = cartToDelete;
    setDeletingCartId(target.id);
    setCartToDelete(null);
    setAbandonedCartsError('');
    const { data, error } = await supabase
      .from('guest_carts')
      .delete()
      .eq('id', target.id)
      .select('id');
    if (error || !data || data.length === 0) {
      setAbandonedCartsError(error?.message || 'Delete was blocked — you may not have permission to delete carts.');
      await loadAbandonedCarts();
    } else {
      setAbandonedCarts(prev => prev.filter(c => c.id !== target.id));
    }
    setDeletingCartId(null);
  };

  const handleWsSendReminder = async (orderId: string) => {
    setWsReminderSending(prev => ({ ...prev, [orderId]: true }));
    setWsReminderResult(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    try {
      const res = await fetch('/api/send-payment-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const resData = await res.json();
      if (!res.ok || resData.error) {
        setWsReminderResult(prev => ({ ...prev, [orderId]: 'error' }));
      } else {
        setWsReminderResult(prev => ({ ...prev, [orderId]: 'sent' }));
        setTimeout(() => setWsReminderResult(prev => { const n = { ...prev }; delete n[orderId]; return n; }), 4000);
      }
    } catch {
      setWsReminderResult(prev => ({ ...prev, [orderId]: 'error' }));
    } finally {
      setWsReminderSending(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleWsSendAllReminders = async () => {
    setWsSendingAllReminders(true);
    setWsAllReminderResult(null);
    try {
      const res = await fetch('/api/send-payment-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const resData = await res.json();
      const outstandingCount = wsOrders.filter(o => o.payment_status === 'awaiting_payment').length;
      setWsAllReminderResult({ sent: resData.sent ?? 0, total: outstandingCount });
      setTimeout(() => setWsAllReminderResult(null), 5000);
    } catch {
      setWsAllReminderResult({ sent: 0, total: 0 });
    } finally {
      setWsSendingAllReminders(false);
    }
  };

  const loadReporting = async () => {
    setProductsOrderedLoading(true);
    setPackageMealsLoading(true);
    setFrozenMealsLoading(true);
    setDiscountVouchersReportLoading(true);
    setDeliveredOrdersLoading(true);
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, customer_name, customer_email, items, created_at, delivered_date, m_payment_id, payment_status')
        .order('created_at', { ascending: false });

      const { data: dvData } = await supabase.from('discount_vouchers').select('dv_code, dv_amount, expiry_date, status, times_used, created_at');
      const dvMap: Record<string, { amount: number; expiry: string }> = {};
      (dvData || []).forEach((dv: any) => { dvMap[dv.dv_code] = { amount: dv.dv_amount, expiry: dv.expiry_date }; });

      const productsRows: ProductsOrderedRow[] = [];
      const packageRows: PackageMealsOrderedRow[] = [];
      const frozenRows: PackageMealsOrderedRow[] = [];
      const deliveredRows: DeliveredOrdersRow[] = [];
      const dvReportRows: DiscountVouchersReportRow[] = (dvData || []).map((dv: any) => ({
        dvCode: dv.dv_code,
        dvAmount: Number(dv.dv_amount),
        expiryDate: formatDate(dv.expiry_date),
        productName: '',
        productType: dv.status || '',
        item: `Used ${dv.times_used ?? 0} time(s)`,
        orderedDate: formatDate(dv.created_at),
        orderedRaw: dv.created_at,
        deliveredDt: '',
        deliveredRaw: '',
        clientName: dv.status || '',
        clientEmail: '',
      }));

      for (const order of (ordersData || [])) {
        const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
        const orderedDate = formatDate(order.created_at);
        const deliveredDt = formatDate(order.delivered_date);
        const mealVoucher = order.m_payment_id || null;
        const discountVoucher = null;

        for (const item of items) {
          const isPackage = item.category?.toLowerCase().includes('package') || item.category?.toLowerCase().includes('voucher') || (item.package_type && item.package_type !== 'none') || false;
          const isFrozen = item.category?.toLowerCase().includes('frozen') || false;
          if (isPackage) {
            // Expand each unit into its own individual row
            const qty = Number(item.quantity) || 1;
            const isPackageType = item.package_type && item.package_type.toLowerCase().includes('package');
            for (let qi = 0; qi < qty; qi++) {
              packageRows.push({
                orderId: order.id,
                productName: item.name,
                productType: isPackageType ? (item.package_type || item.category || '') : (item.category || ''),
                item: item.name,
                packagePurchased: isPackageType ? (item.unit || item.category || '') : (item.category || ''),
                mealVoucher,
                discountVoucher,
                orderedDate,
                orderedRaw: order.created_at || '',
                deliveredDt,
                deliveredRaw: order.delivered_date || '',
                clientName: order.customer_name,
                clientEmail: order.customer_email,
              });
            }
          } else if (isFrozen) {
            const qty = Number(item.quantity) || 1;
            for (let qi = 0; qi < qty; qi++) {
              frozenRows.push({
                orderId: order.id,
                productName: item.name,
                productType: item.category || '',
                item: item.name,
                packagePurchased: item.category || '',
                mealVoucher,
                discountVoucher,
                orderedDate,
                orderedRaw: order.created_at || '',
                deliveredDt,
                deliveredRaw: order.delivered_date || '',
                clientName: order.customer_name,
                clientEmail: order.customer_email,
              });
            }
          } else {
            productsRows.push({
              orderId: order.id,
              productName: item.name,
              productType: item.category || '',
              item: `${item.quantity}x ${item.name}`,
              mealVoucher,
              discountVoucher,
              orderedDate,
              orderedRaw: order.created_at || '',
              deliveredDt,
              deliveredRaw: order.delivered_date || '',
              clientName: order.customer_name,
              clientEmail: order.customer_email,
            });
          }
        }

        // Populate delivered orders: only orders that have a delivered_date
        if (order.delivered_date) {
          const orderedMs = order.created_at ? new Date(order.created_at).getTime() : null;
          const deliveredMs = new Date(order.delivered_date).getTime();
          let leadTime = '—';
          if (orderedMs !== null && !isNaN(deliveredMs) && !isNaN(orderedMs)) {
            const diffDays = Math.round((deliveredMs - orderedMs) / (1000 * 60 * 60 * 24));
            leadTime = diffDays === 0 ? 'Same day' : diffDays === 1 ? '1 day' : `${diffDays} days`;
          }
          const items2: OrderItem[] = Array.isArray(order.items) ? order.items : [];
          for (const item of items2) {
            const isPackageType = item.package_type && item.package_type.toLowerCase().includes('package');
            const qty = Number(item.quantity) || 1;
            for (let qi = 0; qi < qty; qi++) {
              deliveredRows.push({
                orderId: order.id,
                productName: item.name,
                productType: isPackageType ? (item.package_type || item.category || '') : (item.category || ''),
                item: item.name,
                packagePurchased: isPackageType ? (item.unit || item.category || '') : (item.category || ''),
                mealVoucher,
                discountVoucher,
                orderedDate,
                orderedRaw: order.created_at || '',
                deliveredDt,
                deliveredRaw: order.delivered_date || '',
                leadTime,
                clientEmail: order.customer_email,
              });
            }
          }
        }
      }

      setProductsOrderedRows(productsRows);
      setPackageMealsRows(packageRows);
      setFrozenMealsRows(frozenRows);
      setDiscountVouchersReportRows(dvReportRows);
      setDeliveredOrdersRows(deliveredRows);

      // Auto-open the first report that has data so the table is visible immediately
      // (instead of leaving the user on an empty overview panel).
      setReportingView(prev => {
        if (prev !== 'cards') return prev;
        if (productsRows.length) return 'products_ordered';
        if (packageRows.length) return 'package_meals_ordered';
        if (frozenRows.length) return 'frozen_meals_ordered';
        if (dvReportRows.length) return 'discount_vouchers_report';
        if (deliveredRows.length) return 'delivered_orders';
        return prev;
      });
    } catch (err) {
      console.error('Reporting load error:', err);
    } finally {
      setProductsOrderedLoading(false);
      setPackageMealsLoading(false);
      setFrozenMealsLoading(false);
      setDiscountVouchersReportLoading(false);
      setDeliveredOrdersLoading(false);
    }
  };

  // ─── Analytics loader ─────────────────────────────────────────────────────────
  const loadAnalytics = useCallback(async (p: AnalyticsPeriod) => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const { from, to, bucketFn } = getAnalyticsPeriodRange(p);
      const fromISO = from.toISOString();
      const toISO = to.toISOString();

      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, total, payment_status, fulfillment_status, created_at')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: true });
      if (ordersErr) throw ordersErr;

      const { data: redemptions, error: redemptionsErr } = await supabase
        .from('voucher_redemptions')
        .select('id, redeemed_at')
        .gte('redeemed_at', fromISO)
        .lte('redeemed_at', toISO);
      if (redemptionsErr) throw redemptionsErr;

      const { data: dvOrders, error: dvErr } = await supabase
        .from('orders')
        .select('id, created_at, payment_status')
        .eq('payment_status', 'discounted')
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      if (dvErr) throw dvErr;

      const buckets = buildAnalyticsBuckets(p, bucketFn);
      const orderMap: Record<string, { orders: number; revenue: number }> = {};
      const voucherMap: Record<string, { mealVouchers: number; discountVouchers: number }> = {};
      buckets.forEach(b => { orderMap[b] = { orders: 0, revenue: 0 }; voucherMap[b] = { mealVouchers: 0, discountVouchers: 0 }; });

      const isPaid = (o: any) => o.payment_status === 'paid' || o.payment_status === 'discounted';
      (orders || []).forEach(o => {
        const label = bucketFn(new Date(o.created_at));
        if (orderMap[label] !== undefined) {
          orderMap[label].orders += 1;
          // Revenue is only realised from paid/discounted orders, matching the system flow.
          if (isPaid(o)) orderMap[label].revenue += calculateOrderTotal(o);
        }
      });
      (redemptions || []).forEach(r => {
        const label = bucketFn(new Date(r.redeemed_at));
        if (voucherMap[label] !== undefined) voucherMap[label].mealVouchers += 1;
      });
      (dvOrders || []).forEach(o => {
        const label = bucketFn(new Date(o.created_at));
        if (voucherMap[label] !== undefined) voucherMap[label].discountVouchers += 1;
      });

      setOrderTrend(buckets.map(b => ({ label: b, ...orderMap[b] })));
      setVoucherUsage(buckets.map(b => ({ label: b, ...voucherMap[b] })));

      const fulfillmentCount: Record<string, number> = {};
      (orders || []).forEach(o => { fulfillmentCount[o.fulfillment_status] = (fulfillmentCount[o.fulfillment_status] || 0) + 1; });
      const fulfillmentOrder = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
      setFulfillmentMetrics(
        fulfillmentOrder.filter(s => fulfillmentCount[s] !== undefined).map(s => ({
          status: ANALYTICS_FULFILLMENT_LABELS[s] || s,
          count: fulfillmentCount[s],
          color: ANALYTICS_FULFILLMENT_COLORS[s] || '#8C8278',
        }))
      );

      const totalOrders = (orders || []).length;
      const paidOrders = (orders || []).filter(isPaid).length;
      const totalRevenue = (orders || []).filter(isPaid).reduce((sum, o) => sum + calculateOrderTotal(o), 0);
      const deliveredOrders = (orders || []).filter(o => o.fulfillment_status === 'delivered').length;
      const totalMealRedemptions = (redemptions || []).length;
      const totalDvUsed = (dvOrders || []).length;
      const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;
      const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

      setSummaryMetrics([
        { label: 'Total Orders', value: String(totalOrders), sub: `${paidOrders} paid`, icon: '📋' },
        { label: 'Total Revenue', value: `R${totalRevenue.toFixed(2)}`, sub: paidOrders > 0 ? `Avg R${avgOrderValue.toFixed(2)}/paid order` : 'From paid orders', icon: '💰' },
        { label: 'Meal Vouchers Used', value: String(totalMealRedemptions), sub: 'Redemptions', icon: '🎟️' },
        { label: 'Discount Vouchers', value: String(totalDvUsed), sub: 'Orders with discount', icon: '🏷️' },
        { label: 'Delivered Orders', value: String(deliveredOrders), sub: `${fulfillmentRate}% fulfillment rate`, icon: '✅' },
        { label: 'Cancelled Orders', value: String(fulfillmentCount['cancelled'] || 0), sub: 'In period', icon: '❌' },
      ]);
    } catch (err: any) {
      setAnalyticsError(err?.message || 'Failed to load analytics data');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);
  // ─── End Analytics loader ─────────────────────────────────────────────────────

  // ─── Weekly menu helpers ───────────────────────────────────────────────────────
  const getMondayOfWeek = (offset = 0) => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff + offset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    if (activeTab === 'weekly_menu') loadWeeklyMenu();
  }, [weekOffset, activeTab]);

  const getWeekDays = () => {
    const monday = getMondayOfWeek(weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        date: toLocalDateStr(d),
        dayName: d.toLocaleDateString('en-ZA', { weekday: 'long' }),
        shortDate: d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
      };
    });
  };

  // ─── Order update helpers ─────────────────────────────────────────────────────
  const getWsOrderUpdateState = (orderId: string): OrderUpdateState =>
    wsOrderUpdateStates[orderId] || {
      fulfillmentSaving: false, paymentSaving: false,
      fulfillmentSuccess: false, paymentSuccess: false,
      fulfillmentError: '', paymentError: '',
    };

  const setWsOrderUpdateField = (orderId: string, field: keyof OrderUpdateState, value: any) => {
    setWsOrderUpdateStates(prev => ({
      ...prev,
      [orderId]: { ...getWsOrderUpdateState(orderId), [field]: value },
    }));
  };

  const handleWsPaymentUpdate = async (orderId: string, newStatus: PaymentStatus) => {
    setWsOrderUpdateField(orderId, 'paymentSaving', true);
    // .select() confirms a row was actually updated. RLS-blocked updates return no
    // error but 0 rows — without this the UI would lie and the value would revert on reload.
    const { data, error } = await supabase
      .from('orders')
      .update({ payment_status: newStatus })
      .eq('id', orderId)
      .select('id');
    if (error) {
      setWsOrderUpdateField(orderId, 'paymentError', error.message);
    } else if (!data || data.length === 0) {
      setWsOrderUpdateField(orderId, 'paymentError', 'Update blocked — you may not have permission to change this order.');
    } else {
      setWsOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: newStatus } : o));
      setWsOrderUpdateField(orderId, 'paymentSuccess', true);
      setTimeout(() => setWsOrderUpdateField(orderId, 'paymentSuccess', false), 2000);
    }
    setWsOrderUpdateField(orderId, 'paymentSaving', false);
  };

  const handleWsFulfillmentUpdate = async (orderId: string, newStatus: FulfillmentStatus) => {
    const existing = wsOrders.find((o) => o.id === orderId);
    if (existing && isFulfillmentStatusLocked(existing.fulfillment_status)) return;
    setWsOrderUpdateField(orderId, 'fulfillmentSaving', true);
    const updateData: any = { fulfillment_status: newStatus };
    if (newStatus === 'delivered') updateData.delivered_date = new Date().toISOString();
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select('id');
    if (error) {
      setWsOrderUpdateField(orderId, 'fulfillmentError', error.message);
    } else if (!data || data.length === 0) {
      setWsOrderUpdateField(orderId, 'fulfillmentError', 'Update blocked — you may not have permission to change this order.');
    } else {
      setWsOrders(prev => prev.map(o => o.id === orderId ? { ...o, fulfillment_status: newStatus } : o));
      setWsOrderUpdateField(orderId, 'fulfillmentSuccess', true);
      setTimeout(() => setWsOrderUpdateField(orderId, 'fulfillmentSuccess', false), 2000);
    }
    setWsOrderUpdateField(orderId, 'fulfillmentSaving', false);
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;
    setDeletingOrder(true);
    // .select() returns the deleted rows. RLS only allows super_admin to delete; for
    // anyone else the delete returns no error but 0 rows — detect that and surface it
    // instead of optimistically removing a row that still exists in the database.
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('id', deleteOrderId)
      .select('id');
    if (error) {
      setWsOrdersError('Failed to delete order: ' + error.message);
    } else if (!data || data.length === 0) {
      setWsOrdersError('Order was not deleted — only a Super Admin can delete orders.');
    } else {
      setWsOrders(prev => prev.filter(o => o.id !== deleteOrderId));
    }
    setDeletingOrder(false);
    setDeleteOrderId(null);
  };

  const wsFilteredOrders = wsOrders.filter(o => {
    const q = wsOrderSearch.toLowerCase();
    const matchesSearch = !q ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_email?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q);
    const matchesPayment = wsFilterPayment === 'all' || o.payment_status === wsFilterPayment;
    const matchesFulfillment = wsFilterFulfillment === 'all' || o.fulfillment_status === wsFilterFulfillment;
    return matchesSearch && matchesPayment && matchesFulfillment;
  });

  // ─── Product CRUD ─────────────────────────────────────────────────────────────
  const openAddForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setPendingImageFile(null);
    setPendingImagePreview(null);
    setFormError('');
    setFormSuccess('');
    loadCategoryNames();
    setShowForm(true);
  };

  const openEditForm = async (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      unit: product.unit,
      description: product.description || '',
      tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
      badge: product.badge || '',
      min_order: product.min_order != null ? String(product.min_order) : '',
      available: product.available,
      featured: product.featured,
      sort_order: product.sort_order,
      package_type: product.package_type || 'none',
      image_fit: product.image_fit || 'fill',
      old_price: product.old_price != null ? String(product.old_price) : '',
      saving_percent: product.saving_percent != null ? String(product.saving_percent) : '',
      attribute1: product.attribute1 || '',
      attribute2: product.attribute2 || '',
      attribute3: product.attribute3 || '',
      long_description: product.long_description || '',
      visual_type: product.visual_type || '',
    });
    setPendingImageFile(null);
    setPendingImagePreview(product.imageUrl || null);
    setFormError('');
    setFormSuccess('');
    await loadCategoryNames();
    setShowEditModal(true);
  };

  const handleSaveProduct = async () => {
    if (!form.name.trim()) { showProductFormError('Product name is required.'); return; }
    const isPackageType = form.package_type && form.package_type.toLowerCase().includes('package');
    if (!isPackageType && (!form.price || isNaN(Number(form.price)))) { showProductFormError('Valid price is required.'); return; }
    if (form.old_price && Number(form.old_price) <= Number(form.price)) {
      setOldPriceErrorModal(true);
      return;
    }
    setSaving(true);
    let image_path = editingProduct?.image_path || null;
    if (pendingImageFile) {
      setUploadingImage(true);
      const ext = pendingImageFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, pendingImageFile);
      if (uploadErr) { showProductFormError(uploadErr.message); setSaving(false); setUploadingImage(false); return; }
      image_path = path;
      setUploadingImage(false);
    }
    const tags = form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    const payload: any = {
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price) || 0,
      unit: form.unit,
      description: form.description.trim(),
      tags,
      badge: form.badge.trim() || null,
      min_order: form.min_order ? Number(form.min_order) : null,
      available: form.available,
      featured: form.featured,
      sort_order: Number(form.sort_order) || 0,
      package_type: form.package_type || 'none',
      image_fit: form.image_fit || 'fill',
      old_price: form.old_price ? Number(form.old_price) : null,
      saving_percent: form.saving_percent ? Number(form.saving_percent) : null,
      attribute1: form.attribute1?.trim() || null,
      attribute2: form.attribute2?.trim() || null,
      attribute3: form.attribute3?.trim() || null,
      long_description: form.long_description?.trim() || null,
      visual_type: form.visual_type?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (image_path) payload.image_path = image_path;
    let saveError: any = null;
    if (editingProduct) {
      // .select() confirms a row was actually updated — a 0-row result means the write
      // was blocked (e.g. by RLS) and would otherwise look like a false success.
      const { data: upd, error } = await supabase.from('products').update(payload).eq('id', editingProduct.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit products.' };
    } else {
      const { data: ins, error } = await supabase.from('products').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not create the product. Please try again.' };
    }
    if (saveError) { showProductFormError(saveError.message); }
    else {
      setFormSuccess(editingProduct ? 'Product updated!' : 'Product added!');
      setShowForm(false);
      setShowEditModal(false);
      setEditingProduct(null);
      await loadProducts();
    }
    setSaving(false);
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteModal({
      open: true,
      title: 'Delete Product',
      message: `Delete "${product.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data, error } = await supabase.from('products').delete().eq('id', product.id).select('id');
        if (error || !data || data.length === 0) {
          showProductFormError('Could not delete the product — you may not have permission, or it was already removed.');
        }
        await loadProducts();
      },
    });
  };

  // ─── Category CRUD ────────────────────────────────────────────────────────────
  const openAddCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', slug: '', active: true, sort_order: '0' });
    setCategoryFormError('');
    setCategoryFormSuccess('');
    setShowCategoryForm(true);
  };

  const openEditCategoryForm = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, slug: cat.slug, active: cat.active, sort_order: String(cat.sort_order) });
    setCategoryFormError('');
    setCategoryFormSuccess('');
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) { showCategoryFormError('Category name is required.'); return; }
    setSavingCategory(true);
    const payload = {
      name: categoryForm.name.trim(),
      slug: categoryForm.slug.trim() || categoryForm.name.toLowerCase().replace(/\s+/g, '-'),
      active: categoryForm.active,
      sort_order: Number(categoryForm.sort_order) || 0,
    };
    let saveError: any = null;
    if (editingCategory) {
      ({ error: saveError } = await supabase.from('product_categories').update(payload).eq('id', editingCategory.id));
    } else {
      ({ error: saveError } = await supabase.from('product_categories').insert(payload));
    }
    if (saveError) { showCategoryFormError(saveError.message); }
    else {
      setCategoryFormSuccess(editingCategory ? 'Category updated!' : 'Category added!');
      setShowCategoryForm(false);
      setEditingCategory(null);
      await loadCategories();
      await loadCategoryNames();
    }
    setSavingCategory(false);
  };

  const handleDeleteCategory = (cat: Category) => {
    setDeleteModal({
      open: true,
      title: 'Delete Category',
      message: `Delete "${cat.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        await supabase.from('product_categories').delete().eq('id', cat.id);
        await loadCategories();
      },
    });
  };

  // ─── Staff CRUD ───────────────────────────────────────────────────────────────
  const handleInviteStaff = async () => {
    if (!inviteForm.full_name.trim() || !inviteForm.email.trim()) { showInviteError('Name and email are required.'); return; }
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite staff');
      setInviteSuccess('Staff member invited!');
      setInviteForm(emptyInviteForm);
      setInviteOpen(false);
      await loadStaff();
    } catch (err: any) {
      showInviteError(err?.message || 'Failed to invite staff');
    } finally {
      setInviting(false);
    }
  };

  const handlePromoteUser = async () => {
    if (!promoteForm.email.trim() || !promoteForm.full_name.trim()) { setPromoteError('Email and name are required.'); return; }
    setPromoting(true);
    setPromoteError('');
    setPromoteSuccess('');
    try {
      const res = await fetch('/api/staff/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promoteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to promote user');
      setPromoteSuccess('User promoted to staff!');
      setPromoteForm({ email: '', full_name: '', phone_number: '', role: 'staff' });
      setPromoteOpen(false);
      await loadStaff();
    } catch (err: any) {
      setPromoteError(err?.message || 'Failed to promote user');
    } finally {
      setPromoting(false);
    }
  };

  const handleToggleStaffActive = async (member: StaffMember) => {
    setTogglingStaffId(member.id);
    await supabase.from('user_profiles').update({ is_active: !member.is_active }).eq('id', member.id);
    await loadStaff();
    setTogglingStaffId(null);
  };

  const handleSendPasswordReset = async (member: StaffMember) => {
    setSendingResetId(member.id);
    try {
      const res = await fetch('/api/staff/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: member.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reset');
      setResetMessages(prev => ({ ...prev, [member.id]: { type: 'success', text: 'Reset email sent!' } }));
    } catch (err: any) {
      setResetMessages(prev => ({ ...prev, [member.id]: { type: 'error', text: err?.message || 'Failed' } }));
    } finally {
      setSendingResetId(null);
      setTimeout(() => setResetMessages(prev => { const n = { ...prev }; delete n[member.id]; return n; }), 4000);
    }
  };

  const handleDeleteStaff = (member: StaffMember) => {
    if (member.is_active) { setDeleteActiveMember(member); return; }
    setDeleteConfirmMember(member);
  };

  const confirmDeleteStaff = async () => {
    if (!deleteConfirmMember) return;
    setDeletingStaffId(deleteConfirmMember.id);
    await supabase.from('user_profiles').delete().eq('id', deleteConfirmMember.id);
    setDeleteConfirmMember(null);
    setDeletingStaffId(null);
    await loadStaff();
  };

  const handleSaveEditModal = async () => {
    if (!editModalMember) return;
    if (!editModalForm.full_name.trim()) { setEditModalError('Name is required.'); return; }
    setEditModalSaving(true);
    setEditModalError('');
    const { error } = await supabase.from('user_profiles').update({
      full_name: editModalForm.full_name.trim(),
      phone: editModalForm.phone.trim() || '',
      role: editModalForm.role,
    }).eq('id', editModalMember.id);
    if (error) { setEditModalError(error.message); }
    else { setEditModalMember(null); await loadStaff(); }
    setEditModalSaving(false);
  };

  // ─── Homepage Cards CRUD ──────────────────────────────────────────────────────
  const openEditCard = (card: HomepageCard) => {
    setEditingCard(card);
    setCardForm({ ...card });
    setCardFormError('');
    setCardFormSuccess('');
    setCardImageFile(null);
    setCardImagePreview(card.image_url || null);
  };

  const handleSaveCard = async () => {
    if (!editingCard) return;
    setSavingCard(true);
    setCardFormError('');
    let image_url = cardForm.image_url || null;
    let image_path = editingCard.image_path || null;
    if (cardImageFile) {
      setUploadingCardImage(true);
      const ext = cardImageFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('homepage-card-images').upload(path, cardImageFile);
      if (uploadErr) { setCardFormError(uploadErr.message); setSavingCard(false); setUploadingCardImage(false); return; }
      image_path = path;
      const { data: urlData } = supabase.storage.from('homepage-card-images').getPublicUrl(path);
      image_url = urlData?.publicUrl || null;
      setUploadingCardImage(false);
    }
    const { data: upd, error } = await supabase.from('homepage_cards').update({
      ...cardForm,
      image_url,
      image_path,
      updated_at: new Date().toISOString(),
    }).eq('id', editingCard.id).select('id');
    if (error) { setCardFormError(error.message); }
    else if (!upd || upd.length === 0) { setCardFormError('Update was blocked — you may not have permission to edit homepage cards.'); }
    else { setCardFormSuccess('Card updated!'); setEditingCard(null); await loadHomepageCards(); }
    setSavingCard(false);
  };

  const handleToggleCardVisible = async (card: HomepageCard) => {
    setTogglingCardId(card.id);
    const { data, error } = await supabase.from('homepage_cards').update({ is_visible: !card.is_visible }).eq('id', card.id).select('id');
    if (error || !data || data.length === 0) {
      showGlobalError('Could not update card visibility — please try again.', 'Homepage Card Error');
    }
    await loadHomepageCards();
    setTogglingCardId(null);
  };

  // ─── Weekly Menu CRUD ─────────────────────────────────────────────────────────
  const openAddWeeklyMenuForm = (date: string, dayName: string) => {
    setEditingWeeklyEntry(null);
    setWeeklyMenuForm({ meal_date: date, day_name: dayName, meal_name: '', description: '', price: '', is_closed: false, closed_reason: '' });
    setWeeklyMenuFormError('');
    setWeeklyMenuFormSuccess('');
    setShowWeeklyMenuForm(true);
  };

  const openEditWeeklyMenuForm = (entry: WeeklyMenuEntry) => {
    setEditingWeeklyEntry(entry);
    setWeeklyMenuForm({
      meal_date: entry.meal_date,
      day_name: entry.day_name,
      meal_name: entry.meal_name || '',
      description: entry.description || '',
      price: entry.price != null ? String(entry.price) : '',
      is_closed: entry.is_closed,
      closed_reason: entry.closed_reason || '',
    });
    setWeeklyMenuFormError('');
    setWeeklyMenuFormSuccess('');
    setShowWeeklyMenuForm(true);
  };

  const handleSaveWeeklyEntry = async () => {
    if (!weeklyMenuForm.is_closed && !weeklyMenuForm.meal_name.trim()) { showWeeklyMenuFormError('Meal name is required.'); return; }
    setSavingWeeklyEntry(true);
    const payload = {
      meal_date: weeklyMenuForm.meal_date,
      day_name: weeklyMenuForm.day_name,
      meal_name: weeklyMenuForm.meal_name.trim() || null,
      description: weeklyMenuForm.description.trim() || null,
      price: weeklyMenuForm.price ? Number(weeklyMenuForm.price) : null,
      is_closed: weeklyMenuForm.is_closed,
      closed_reason: weeklyMenuForm.closed_reason.trim() || null,
    };
    let saveError: any = null;
    if (editingWeeklyEntry) {
      const { data: upd, error } = await supabase.from('weekly_menu').update(payload).eq('id', editingWeeklyEntry.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit the weekly menu.' };
    } else {
      const { data: ins, error } = await supabase.from('weekly_menu').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the menu entry. Please try again.' };
    }
    if (saveError) { showWeeklyMenuFormError(saveError.message); }
    else {
      setWeeklyMenuFormSuccess(editingWeeklyEntry ? 'Entry updated!' : 'Entry added!');
      setShowWeeklyMenuForm(false);
      setEditingWeeklyEntry(null);
      await loadWeeklyMenu();
    }
    setSavingWeeklyEntry(false);
  };

  const handleDeleteWeeklyEntry = (entry: WeeklyMenuEntry) => {
    setDeleteModal({
      open: true,
      title: 'Delete Menu Entry',
      message: `Delete "${entry.meal_name || entry.day_name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data, error } = await supabase.from('weekly_menu').delete().eq('id', entry.id).select('id');
        if (error || !data || data.length === 0) {
          showGlobalError(error?.message || 'Delete was blocked — you may not have permission to edit the weekly menu.', 'Weekly Menu Error');
        }
        await loadWeeklyMenu();
      },
    });
  };

  const handleCloseDay = async (date: string, dayName: string) => {
    setClosingDayDate(date);
    setSavingClosedDay(true);
    const existing = weeklyMenuEntries.find(e => e.meal_date === date);
    let err: any = null;
    if (existing) {
      const { data, error } = await supabase.from('weekly_menu').update({ is_closed: true, meal_name: null, description: null }).eq('id', existing.id).select('id');
      err = error || (!data || data.length === 0 ? { message: 'blocked' } : null);
    } else {
      const { data, error } = await supabase.from('weekly_menu').insert({ meal_date: date, day_name: dayName, is_closed: true }).select('id');
      err = error || (!data || data.length === 0 ? { message: 'blocked' } : null);
    }
    if (err) showGlobalError('Could not mark the day as closed — you may not have permission.', 'Weekly Menu Error');
    await loadWeeklyMenu();
    setSavingClosedDay(false);
    setClosingDayDate(null);
  };

  const handleReopenDay = async (entry: WeeklyMenuEntry) => {
    setClosingDayDate(entry.meal_date);
    setSavingClosedDay(true);
    const { data, error } = await supabase.from('weekly_menu').update({ is_closed: false, closed_reason: null }).eq('id', entry.id).select('id');
    if (error || !data || data.length === 0) {
      showGlobalError('Could not reopen the day — you may not have permission.', 'Weekly Menu Error');
    }
    await loadWeeklyMenu();
    setSavingClosedDay(false);
    setClosingDayDate(null);
  };

  // ─── Voucher helpers ──────────────────────────────────────────────────────────
  const handleIssueVoucher = async () => {
    if (!issueVoucherForm.customer_name.trim() || !issueVoucherForm.customer_email.trim() || !issueVoucherForm.total_meals) {
      showIssueVoucherError('Name, email, and meal count are required.');
      return;
    }
    setIssuingVoucher(true);
    const code = `MV-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from('vouchers').insert({
      voucher_code: code,
      customer_name: issueVoucherForm.customer_name.trim(),
      customer_email: issueVoucherForm.customer_email.trim(),
      customer_phone: issueVoucherForm.customer_phone.trim() || null,
      total_meals: Number(issueVoucherForm.total_meals),
      meals_remaining: Number(issueVoucherForm.total_meals),
      status: 'unpaid',
      notes: issueVoucherForm.notes.trim() || null,
    });
    if (error) { showIssueVoucherError(error.message); }
    else {
      setIssueVoucherSuccess('Voucher issued!');
      setIssueVoucherForm({ customer_name: '', customer_email: '', customer_phone: '', total_meals: '', notes: '' });
      await loadVouchers();
    }
    setIssuingVoucher(false);
  };

  const handleMarkVoucherPaid = async (voucher: Voucher) => {
    setMarkingVoucherPaidId(voucher.id);
    setLoadingMarkingPaid(true);
    await supabase.from('vouchers').update({ status: 'paid' }).eq('id', voucher.id);
    await loadVouchers();
    setMarkingVoucherPaidId(null);
    setLoadingMarkingPaid(false);
  };

  const handleDeleteVoucher = (voucher: Voucher) => {
    setDeleteModal({
      open: true,
      title: 'Delete Voucher',
      message: `Delete voucher ${voucher.voucher_code}? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data: del, error } = await supabase.from('vouchers').delete().eq('id', voucher.id).select('id');
        if (error || !del || del.length === 0) {
          showGlobalError(error?.message || 'Delete was blocked — you may not have permission to delete vouchers.');
        }
        await loadVouchers();
      },
    });
  };

  const handleSaveMv = async () => {
    if (!mvForm.voucher_code.trim() || !mvForm.customer_name.trim() || !mvForm.customer_email.trim()) {
      setMvFormError('Code, name, and email are required.');
      return;
    }
    setSavingMv(true);
    const payload: any = {
      voucher_code: mvForm.voucher_code.trim(),
      customer_name: mvForm.customer_name.trim(),
      customer_email: mvForm.customer_email.trim(),
      customer_phone: mvForm.customer_phone.trim() || null,
      total_meals: Number(mvForm.total_meals) || 0,
      meals_remaining: Number(mvForm.meals_remaining) || 0,
      status: mvForm.status,
      notes: mvForm.notes.trim() || null,
      package_type: mvForm.package_type || 'none',
      purchased_at: mvForm.purchased_at || new Date().toISOString(),
    };
    let saveError: any = null;
    if (editingMv) {
      const { data: upd, error } = await supabase.from('vouchers').update(payload).eq('id', editingMv.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit vouchers.' };
    } else {
      const { data: ins, error } = await supabase.from('vouchers').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the voucher. Please try again.' };
    }
    if (saveError) {
      setMvFormError(/duplicate|unique/i.test(saveError.message || '') ? 'That voucher code already exists. Use a unique code.' : saveError.message);
    } else {
      setMvFormSuccess(editingMv ? 'Voucher updated!' : 'Voucher added!');
      setShowMvForm(false);
      setShowMvEditModal(false);
      setEditingMv(null);
      await loadMealVouchers();
    }
    setSavingMv(false);
  };

  const handleSaveDv = async () => {
    setDvFormError(''); setDvFormSuccess('');
    if (!dvForm.dv_code.trim() || !dvForm.dv_amount) { setDvFormError('Code and amount are required.'); return; }
    if (Number(dvForm.dv_amount) <= 0) { setDvFormError('Amount must be greater than zero.'); return; }
    if (!dvForm.expiry_date) { setDvFormError('Expiry date is required.'); return; }
    setSavingDv(true);
    const payload: any = {
      dv_code: dvForm.dv_code.trim().toUpperCase(),
      dv_amount: Number(dvForm.dv_amount),
      status: dvForm.status,
      expiry_date: dvForm.expiry_date,
    };
    let saveError: any = null;
    if (editingDv) {
      const { data: upd, error } = await supabase.from('discount_vouchers').update(payload).eq('id', editingDv.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit vouchers.' };
    } else {
      const { data: ins, error } = await supabase.from('discount_vouchers').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the voucher. Please try again.' };
    }
    if (saveError) {
      setDvFormError(/duplicate|unique/i.test(saveError.message || '') ? 'That voucher code already exists. Use a unique code.' : saveError.message);
    } else {
      setDvFormSuccess(editingDv ? 'Voucher updated!' : 'Voucher added!');
      setShowDvForm(false);
      setEditingDv(null);
      await loadDiscountVouchers();
    }
    setSavingDv(false);
  };

  const handleDeleteDv = (dv: DiscountVoucher) => {
    setDeleteModal({
      open: true,
      title: 'Delete Discount Voucher',
      message: `Delete voucher ${dv.dv_code}? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        const { data: del, error } = await supabase.from('discount_vouchers').delete().eq('id', dv.id).select('id');
        if (error || !del || del.length === 0) {
          showGlobalError(error?.message || 'Delete was blocked — you may not have permission to delete vouchers.');
        }
        await loadDiscountVouchers();
      },
    });
  };

  const handleSaveTestimonial = async () => {
    if (!testimonialForm.quote.trim() || !testimonialForm.name.trim()) { setTestimonialFormError('Quote and name are required.'); return; }
    setSavingTestimonial(true);
    const payload = {
      quote: testimonialForm.quote.trim(),
      name: testimonialForm.name.trim(),
      role: testimonialForm.role.trim(),
      avatar_url: testimonialForm.avatar_url.trim() || null,
      rating: Number(testimonialForm.rating),
      is_active: testimonialForm.is_active,
      display_order: Number(testimonialForm.display_order) || 0,
    };
    let saveError: any = null;
    if (editingTestimonial) {
      const { data: upd, error } = await supabase.from('testimonials').update(payload).eq('id', editingTestimonial.id).select('id');
      saveError = error;
      if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked — you may not have permission to edit testimonials.' };
    } else {
      const { data: ins, error } = await supabase.from('testimonials').insert(payload).select('id');
      saveError = error;
      if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add the testimonial. Please try again.' };
    }
    if (saveError) { setTestimonialFormError(saveError.message); }
    else {
      setTestimonialFormSuccess(editingTestimonial ? 'Testimonial updated!' : 'Testimonial added!');
      setShowTestimonialForm(false);
      setEditingTestimonial(null);
      await loadTestimonials();
    }
    setSavingTestimonial(false);
  };

  const handleDeleteTestimonial = (t: Testimonial) => {
    setDeleteModal({
      open: true,
      title: 'Delete Testimonial',
      message: `Delete testimonial from "${t.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        await supabase.from('testimonials').delete().eq('id', t.id);
        await loadTestimonials();
      },
    });
  };

  const handleSaveSocialLinks = async () => {
    setSocialLinksSaving(true);
    setSocialLinksError('');
    setSocialLinksSuccess('');
    try {
      for (const s of socialLinks) {
        await supabase.from('social_links').update({ url: socialLinksForm[s.platform] || '' }).eq('id', s.id);
      }
      setSocialLinksSuccess('Social links saved!');
    } catch (err: any) {
      setSocialLinksError(err?.message || 'Failed to save social links.');
    } finally {
      setSocialLinksSaving(false);
    }
  };

  // ─── Customer Order History ───────────────────────────────────────────────────
  const handleCohLookup = async () => {
    if (!cohLookupInput.trim()) return;
    setCohLookupLoading(true);
    setCohLookupError('');
    setCohProfile(null);
    setCohOrders([]);
    try {
      // The API is a POST endpoint expecting { identifier }. Parse defensively so an
      // empty/non-JSON body (e.g. a 405/500) never throws "Unexpected end of JSON input".
      const res = await fetch('/api/customer-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cohLookupInput.trim() }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || `Lookup failed (${res.status})`);
      setCohProfile(data.profile);
      setCohOrders(data.orders || []);
    } catch (err: any) {
      setCohLookupError(err?.message || 'Lookup failed');
    } finally {
      setCohLookupLoading(false);
    }
  };

  // ─── Tab change handler ───────────────────────────────────────────────────────
  const handleTabChange = (tab: WorkspaceTab) => {
    // Defense-in-depth: ignore navigation to tabs the current role can't access.
    if (!roleCanAccessTab(userProfile?.role, tab)) return;
    setActiveTab(tab);
    if (tab === 'staff') loadStaff();
    if (tab === 'homepage_cards') { loadHomepageCards(); loadTickerBanner(); }
    if (tab === 'categories') loadCategories();
    if (tab === 'weekly_menu') loadWeeklyMenu();
    if (tab === 'vouchers') loadMealVouchers();
    if (tab === 'discount_vouchers') loadDiscountVouchers();
    if (tab === 'testimonials') loadTestimonials();
    if (tab === 'social_media') loadSocialLinks();
    // Orders are loaded by the Orders realtime effect (fires on activeTab change),
    // which also covers landing on Orders by default — avoids a double fetch here.
    if (tab === 'reporting') loadReporting();
    if (tab === 'analytics') loadAnalytics(analyticsPeriod);
    if (tab === 'gallery') loadGallery();
    if (tab === 'section_visibility') loadHomepageSections();
    if (tab === 'abandoned_carts') loadAbandonedCarts();
    if (tab === 'package_visibility') loadPackageVisibility();
    if (tab === 'media_products') { loadProducts(); loadCategoryNames(); }
    if (tab === 'customer_order_history') {
      setCohLookupInput('');
      setCohLookupError('');
      setCohProfile(null);
      setCohOrders([]);
      setCohExpandedOrderId(null);
    }
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
      <VoucherErrorModal
        isOpen={!!globalError}
        title={globalErrorTitle || 'Error'}
        message={globalError}
        onClose={() => { setGlobalError(''); setGlobalErrorTitle(''); }}
      />
      <DeleteConfirmModal
        isOpen={!!deleteOrderId}
        productName=""
        message={`Are you sure you want to permanently delete this order? This action cannot be undone.`}
        onConfirm={handleDeleteOrder}
        onCancel={() => setDeleteOrderId(null)}
      />
      <DeleteConfirmModal
        isOpen={deleteModal.open}
        productName=""
        title={deleteModal.title}
        message={deleteModal.message}
        confirmLabel={deleteModal.confirmLabel}
        onConfirm={deleteModal.onConfirm}
        onCancel={() => setDeleteModal(prev => ({ ...prev, open: false }))}
      />
      <DeleteConfirmModal
        isOpen={!!cartToDelete}
        productName=""
        title="Delete Abandoned Cart"
        message={`Are you sure you want to permanently delete this abandoned cart${cartToDelete?.customer_name ? ` for ${cartToDelete.customer_name}` : ''}? This action cannot be undone.`}
        onConfirm={handleDeleteAbandonedCart}
        onCancel={() => setCartToDelete(null)}
      />

      {deleteActiveMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-[#1A1612] mb-2">Cannot Delete Active Staff</h3>
            <p className="text-sm text-[#5C4F3D] mb-5">First deactivate a Staff member before deletion</p>
            <div className="flex justify-end">
              <button onClick={() => setDeleteActiveMember(null)} className="px-4 py-2 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A8501F] transition-colors">OK</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-[#1A1612] mb-2">Delete Staff Member</h3>
            <p className="text-sm text-[#5C4F3D] mb-1">Are you sure you want to permanently delete <span className="font-semibold">{deleteConfirmMember.full_name}</span>?</p>
            <p className="text-xs text-red-500 mb-5">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmMember(null)} className="px-4 py-2 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C4F3D] hover:bg-[#F5F0E8] transition-colors">Cancel</button>
              <button onClick={confirmDeleteStaff} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {editModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-base font-bold text-[#1A1612] mb-5">Edit Staff Member</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Email</label>
                <input type="email" value={editModalMember.email} readOnly className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm bg-[#FAF5EE] text-[#8C8278] cursor-not-allowed focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Full Name *</label>
                <input type="text" value={editModalForm.full_name} onChange={e => setEditModalForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Phone Number</label>
                <input type="tel" value={editModalForm.phone} onChange={e => setEditModalForm(f => ({ ...f, phone: e.target.value }))} placeholder="+27..." className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5C5347] mb-1">Role</label>
                <select value={editModalForm.role} onChange={e => setEditModalForm(f => ({ ...f, role: e.target.value as StaffRole }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {editModalError && <p className="text-sm text-red-600 mt-3">{editModalError}</p>}
            <div className="flex items-center gap-3 mt-5">
              <button onClick={handleSaveEditModal} disabled={editModalSaving} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{editModalSaving ? 'Saving…' : 'Save Changes'}</button>
              <button type="button" onClick={() => setEditModalMember(null)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

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
              {canAnyTab('staff', 'homepage_cards', 'gallery', 'section_visibility', 'correspondence_settings', 'package_visibility', 'testimonials', 'social_media', 'organisation_details') && (
                <>
                  <button
                    onClick={() => setSiteContentOpen(prev => !prev)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                      ['staff', 'homepage_cards', 'testimonials', 'social_media', 'gallery', 'section_visibility', 'correspondence_settings', 'package_visibility', 'organisation_details'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                    }`}
                  >
                    <span className="text-base">📁</span>
                    <span className="flex-1">Site Content</span>
                    <span className="text-xs">{siteContentOpen ? '▲' : '▼'}</span>
                  </button>
                  {siteContentOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
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
                    </div>
                  )}
                </>
              )}

              {/* ── Cooking & Baking Classes ── */}
              {canAnyTab('cooking_classes', 'cooking_class_customers', 'cooking_class_analytics', 'event_registrations') && (
                <>
                  <button
                    onClick={() => setCookingClassesOpen(prev => !prev)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                      ['cooking_classes', 'cooking_class_customers', 'cooking_class_analytics', 'event_registrations'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                    }`}
                  >
                    <span className="text-base">👨‍🍳</span>
                    <span className="flex-1">Cooking &amp; Baking Classes</span>
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
                          <span>Settings</span>
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
                          <span>Event Registrations</span>
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
                          <span>Analytics</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Products & Pricing ── */}
              {canTab('products') && (
                <button onClick={() => { handleTabChange('products'); }} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${activeTab === 'products' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                  <span className="text-base">🛒</span><span>Products &amp; Pricing</span>
                </button>
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

              {/* ── Scanner (standalone page) ── */}
              {canRole('super_admin', 'admin', 'staff') && (
                <button onClick={() => router.push('/staff/scanner')} className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]">
                  <span className="text-base">📷</span><span>Voucher Meal Status</span>
                </button>
              )}

              {/* ── Vouchers (collapsible) ── */}
              {canAnyTab('vouchers', 'discount_vouchers') && (
                <>
                  <button onClick={() => setVouchersMenuOpen(prev => !prev)} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${['vouchers', 'discount_vouchers'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                    <span className="text-base">🎟️</span><span className="flex-1">Vouchers</span><span className="text-xs">{vouchersMenuOpen ? '▲' : '▼'}</span>
                  </button>
                  {vouchersMenuOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
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
                    <span className="text-base">📊</span><span className="flex-1">Reports</span><span className="text-xs">{reportsMenuOpen ? '▲' : '▼'}</span>
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
                          <span className="text-base">📈</span><span>Analytics</span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Media Library (collapsible) ── */}
              {canAnyTab('media', 'media_events', 'cooking_class_customers') && (
                <>
                  <button onClick={() => setMediaMenuOpen(prev => !prev)} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${['media', 'media_events', 'media_products', 'cooking_class_customers'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'}`}>
                    <span className="text-base">🗂️</span><span className="flex-1">Customer Relations</span><span className="text-xs">{mediaMenuOpen ? '▲' : '▼'}</span>
                  </button>
                  {mediaMenuOpen && (
                    <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                      {canTab('cooking_class_customers') && (
                        <a href="https://forms.gle/uc61CVtHvX6nUAnr9" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]`}>
                          <span className="text-base">🧑‍🤝‍🧑</span><span>Customer Onboarding</span>
                        </a>
                      )}
                      {canTab('media') && (
                        <button onClick={() => { handleTabChange('media'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'media' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">📄</span><span>Document Management</span>
                        </button>
                      )}
                      {canTab('media_events') && (
                        <button onClick={() => { handleTabChange('media_events'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'media_events' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🎉</span><span>Events</span>
                        </button>
                      )}
                      {canTab('media_products') && (
                        <button onClick={() => { handleTabChange('media_products'); }} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${activeTab === 'media_products' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'}`}>
                          <span className="text-base">🛍️</span><span>Products</span>
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
                <button onClick={() => router.push('/staff/guide')} className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]">
                  <span className="text-base">📖</span><span>User Guide</span>
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

            {/* ── EVENT REGISTRATIONS TAB ── */}
            {activeTab === 'event_registrations' && (
              <div className="p-6">
                <EventRegistrations isSuperAdmin={userProfile?.role === 'super_admin'} />
              </div>
            )}

            {/* ── ORGANISATION DETAILS TAB ── */}
            {activeTab === 'organisation_details' && (
              <OrganisationDetails />
            )}

            {/* ── CORRESPONDENCE SETTINGS TAB ── */}
            {activeTab === 'correspondence_settings' && (
              <CorrespondenceSettings readOnly={!canDo(userProfile?.role, 'correspondence_settings', 'edit')} />
            )}

            {/* ── SOCIAL MEDIA TAB ── */}
            {activeTab === 'social_media' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Social Media Links</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Manage your social media presence</p>
                </div>
                {socialLinksLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 max-w-xl">
                    <div className="space-y-4">
                      {socialLinks.map(link => (
                        <div key={link.id}>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1 capitalize">{link.platform}</label>
                          <input
                            type="url"
                            value={socialLinksForm[link.platform] ?? link.url}
                            onChange={e => setSocialLinksForm(f => ({ ...f, [link.platform]: e.target.value }))}
                            placeholder={`https://...`}
                            className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                          />
                        </div>
                      ))}
                    </div>
                    {socialLinksError && <p className="text-sm text-red-600 mt-3">{socialLinksError}</p>}
                    {socialLinksSuccess && <p className="text-sm text-green-600 mt-3">{socialLinksSuccess}</p>}
                    <div className="mt-5">
                      <button
                        onClick={handleSaveSocialLinks}
                        disabled={socialLinksSaving}
                        className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                      >
                        {socialLinksSaving ? 'Saving…' : 'Save Links'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION VISIBILITY TAB ── */}
            {activeTab === 'section_visibility' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Section Visibility</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Show or hide homepage sections</p>
                </div>
                {homepageSectionsLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden max-w-xl">
                    {homepageSections.map((section, idx) => (
                      <div key={section.id} className={`flex items-center justify-between px-5 py-4 ${idx !== homepageSections.length - 1 ? 'border-b border-[#F0EBE3]' : ''}`}>
                        <span className="text-sm font-medium text-[#1A1612]">{section.section_label}</span>
                        <button
                          onClick={() => handleToggleHomepageSection(section.section_key, !section.is_visible)}
                          disabled={!!homepageSectionsSaving[section.section_key]}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${section.is_visible ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${section.is_visible ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    ))}
                    {homepageSections.length === 0 && (
                      <div className="p-8 text-center text-sm text-[#8C8278]">No sections found.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── PACKAGE VISIBILITY TAB ── */}
            {activeTab === 'package_visibility' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Package Visibility</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Control which packages are visible to customers</p>
                </div>
                {packageVisibilityLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden max-w-xl">
                    {packageVisibility.map((pkg, idx) => (
                      <div key={pkg.id} className={`flex items-center justify-between px-5 py-4 ${idx !== packageVisibility.length - 1 ? 'border-b border-[#F0EBE3]' : ''}`}>
                        <span className="text-sm font-medium text-[#1A1612]">{pkg.package_name}</span>
                        <button
                          onClick={() => handleTogglePackageVisibility(pkg.id, !pkg.is_visible)}
                          disabled={!!packageVisibilitySaving[pkg.id]}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${pkg.is_visible ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pkg.is_visible ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    ))}
                    {packageVisibility.length === 0 && (
                      <div className="p-8 text-center text-sm text-[#8C8278]">No packages found.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── HOMEPAGE CARDS TAB ── */}
            {activeTab === 'homepage_cards' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Home Page Cards</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{homepageCards.length} cards</p>
                  </div>
                  <div className="relative">
                    <input type="text" placeholder="Search cards…" value={homepageCardSearchQuery} onChange={e => setHomepageCardSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                    {homepageCardSearchQuery && (
                      <button type="button" onClick={() => setHomepageCardSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B5ADA5] hover:text-[#5C5347] transition-colors" aria-label="Clear search">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bookings Banner */}
                <div className="mb-6 bg-white rounded-2xl border border-[#EDE7DA] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#1A1612]">Bookings Banner</h3>
                        <p className="text-xs text-[#8C8278] mt-0.5">Scrolling announcement bar at the top of the homepage</p>
                        <p className="text-xs text-[#8C8278] mt-0.5">{tickerBannerText}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {tickerBannerLoading ? (
                        <div className="w-4 h-4 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <button
                          onClick={async () => {
                            setTickerBannerSaving(true);
                            await supabase.from('homepage_section_settings').update({ is_visible: !tickerBannerVisible }).eq('section_key', 'ticker_banner');
                            setTickerBannerVisible(v => !v);
                            setTickerBannerSaving(false);
                          }}
                          disabled={tickerBannerSaving}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${tickerBannerVisible ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tickerBannerVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      )}
                      <button onClick={() => setTickerBannerEditing(true)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                    </div>
                  </div>
                  {tickerBannerEditing && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#EDE7DA]">
                      <input
                        type="text"
                        value={tickerBannerText}
                        onChange={e => setTickerBannerText(e.target.value)}
                        className="flex-1 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                      />
                      <button onClick={handleSaveTickerBanner} disabled={tickerBannerSaving} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                        {tickerBannerSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setTickerBannerEditing(false)} className="border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                      {tickerBannerSuccess && <span className="text-xs text-green-600">{tickerBannerSuccess}</span>}
                    </div>
                  )}
                </div>

                {cardsLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {homepageCards.filter(c => !homepageCardSearchQuery || c.title.toLowerCase().includes(homepageCardSearchQuery.toLowerCase())).map(card => (
                      <div key={card.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="text-2xl flex-shrink-0">{CARD_TYPE_ICONS[card.card_type]}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-[#1A1612]">{card.title}</p>
                                <span className="text-xs bg-[#F5F0E8] text-[#5C5347] px-2 py-0.5 rounded-full">{CARD_TYPE_LABELS[card.card_type]}</span>
                              </div>
                              {card.subtitle && <p className="text-xs text-[#8C8278] mt-0.5">{card.subtitle}</p>}
                              {card.description && <p className="text-xs text-[#8C8278] mt-0.5 line-clamp-2">{card.description}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                              onClick={() => handleToggleCardVisible(card)}
                              disabled={togglingCardId === card.id}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${card.is_visible ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${card.is_visible ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            {can('homepage_cards', 'edit') && (
                              <button onClick={() => openEditCard(card)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Edit Card Modal */}
                {editingCard && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                      <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                        <h3 className="text-base font-bold text-[#1A1612]">Edit Card — {CARD_TYPE_LABELS[editingCard.card_type]}</h3>
                        <button onClick={() => setEditingCard(null)} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Title *</label>
                          <input type="text" value={cardForm.title ?? ''} onChange={e => setCardForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Subtitle</label>
                          <input type="text" value={cardForm.subtitle ?? ''} onChange={e => setCardForm(f => ({ ...f, subtitle: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                          <textarea value={cardForm.description ?? ''} onChange={e => setCardForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" />
                        </div>
                        {editingCard.card_type === 'todays_special' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price (R)</label>
                              <input type="number" value={cardForm.price ?? ''} onChange={e => setCardForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price Unit</label>
                              <input type="text" value={cardForm.price_unit ?? ''} onChange={e => setCardForm(f => ({ ...f, price_unit: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                            </div>
                          </div>
                        )}
                        {editingCard.card_type === 'customer_review' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Reviewer Name</label>
                              <input type="text" value={cardForm.reviewer_name ?? ''} onChange={e => setCardForm(f => ({ ...f, reviewer_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-[#5C5347] mb-1">Reviewer Event</label>
                              <input type="text" value={cardForm.reviewer_event ?? ''} onChange={e => setCardForm(f => ({ ...f, reviewer_event: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Badge Label</label>
                          <input type="text" value={cardForm.badge_label ?? ''} onChange={e => setCardForm(f => ({ ...f, badge_label: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Card Image</label>
                          {cardImagePreview && (
                            <img src={cardImagePreview} alt="Card preview" className="w-24 h-24 object-cover rounded-xl mb-2" />
                          )}
                          <input ref={cardImageRef} type="file" accept="image/*" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setCardImageFile(file);
                            const reader = new FileReader();
                            reader.onload = ev => setCardImagePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }} className="text-sm text-[#5C5347]" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="card-visible" checked={cardForm.is_visible ?? true} onChange={e => setCardForm(f => ({ ...f, is_visible: e.target.checked }))} className="rounded" />
                          <label htmlFor="card-visible" className="text-sm text-[#5C5347]">Visible</label>
                        </div>
                        {cardFormError && <p className="text-sm text-red-600">{cardFormError}</p>}
                        {cardFormSuccess && <p className="text-sm text-green-600">{cardFormSuccess}</p>}
                      </div>
                      <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                        <button onClick={handleSaveCard} disabled={savingCard} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                          {savingCard ? (uploadingCardImage ? 'Uploading…' : 'Saving…') : 'Save Changes'}
                        </button>
                        <button onClick={() => setEditingCard(null)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TESTIMONIALS TAB ── */}
            {activeTab === 'testimonials' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Testimonials</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{testimonials.length} testimonials</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input type="text" placeholder="Search testimonials…" value={testimonialSearchQuery} onChange={e => setTestimonialSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                      {testimonialSearchQuery && (
                        <button type="button" onClick={() => setTestimonialSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B5ADA5] hover:text-[#5C5347] transition-colors" aria-label="Clear search">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
                        </button>
                      )}
                    </div>
                    {can('testimonials', 'create') && (
                      <button onClick={() => { setEditingTestimonial(null); setTestimonialForm({ quote: '', name: '', role: '', avatar_url: '', rating: 5, is_active: true, display_order: '0' }); setTestimonialFormError(''); setTestimonialFormSuccess(''); setShowTestimonialForm(true); }} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Add Testimonial</button>
                    )}
                  </div>
                </div>
                {testimonialsLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {testimonials.filter(t => !testimonialSearchQuery || t.name.toLowerCase().includes(testimonialSearchQuery.toLowerCase()) || t.quote.toLowerCase().includes(testimonialSearchQuery.toLowerCase())).map(t => (
                      <div key={t.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-semibold text-[#1A1612]">{t.name}</p>
                              {t.role && <span className="text-xs text-[#8C8278]">— {t.role}</span>}
                              <span className="text-xs text-amber-500">{'★'.repeat(t.rating)}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{t.is_active ? 'Active' : 'Hidden'}</span>
                            </div>
                            <p className="text-sm text-[#5C5347] line-clamp-3 italic">"{t.quote}"</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {can('testimonials', 'edit') && (
                              <button onClick={() => { setEditingTestimonial(t); setTestimonialForm({ quote: t.quote, name: t.name, role: t.role, avatar_url: t.avatar_url || '', rating: t.rating, is_active: t.is_active, display_order: String(t.display_order) }); setTestimonialFormError(''); setTestimonialFormSuccess(''); setShowTestimonialForm(true); }} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                            )}
                            {can('testimonials', 'delete') && (
                              <button onClick={() => handleDeleteTestimonial(t)} className="text-xs text-red-500 border border-red-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-50 transition-colors">Delete</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {testimonials.length === 0 && (
                      <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No testimonials yet.</p></div>
                    )}
                  </div>
                )}

                {/* Add/Edit Testimonial Modal */}
                {showTestimonialForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                      <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                        <h3 className="text-base font-bold text-[#1A1612]">{editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
                        <button onClick={() => setShowTestimonialForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Quote *</label>
                          <textarea value={testimonialForm.quote} onChange={e => setTestimonialForm(f => ({ ...f, quote: e.target.value }))} rows={4} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" placeholder="Customer testimonial…" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Name *</label>
                            <input type="text" value={testimonialForm.name} onChange={e => setTestimonialForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Role / Event</label>
                            <input type="text" value={testimonialForm.role} onChange={e => setTestimonialForm(f => ({ ...f, role: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. Wedding Client" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Rating (1–5)</label>
                            <input type="number" min={1} max={5} value={testimonialForm.rating} onChange={e => setTestimonialForm(f => ({ ...f, rating: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Display Order</label>
                            <input type="number" value={testimonialForm.display_order} onChange={e => setTestimonialForm(f => ({ ...f, display_order: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Avatar URL</label>
                          <input type="url" value={testimonialForm.avatar_url} onChange={e => setTestimonialForm(f => ({ ...f, avatar_url: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="https://…" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="t-active" checked={testimonialForm.is_active} onChange={e => setTestimonialForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                          <label htmlFor="t-active" className="text-sm text-[#5C5347]">Active (visible on site)</label>
                        </div>
                        {testimonialFormError && <p className="text-sm text-red-600">{testimonialFormError}</p>}
                        {testimonialFormSuccess && <p className="text-sm text-green-600">{testimonialFormSuccess}</p>}
                      </div>
                      <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                        <button onClick={handleSaveTestimonial} disabled={savingTestimonial} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                          {savingTestimonial ? 'Saving…' : (editingTestimonial ? 'Save Changes' : 'Add Testimonial')}
                        </button>
                        <button onClick={() => setShowTestimonialForm(false)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── GALLERY TAB ── */}
            {activeTab === 'gallery' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Gallery</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{galleryImages.length} images</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#5C5347]">Gallery Section</span>
                      <button
                        onClick={() => handleToggleGallerySectionVisible(!gallerySectionVisible)}
                        disabled={gallerySettingsSaving}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${gallerySectionVisible ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gallerySectionVisible ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    {can('gallery', 'create') && (
                      <button onClick={() => { setEditingGalleryImage(null); setGalleryForm({ title: '', description: '', sort_order: '0', is_visible: true }); setGalleryFormError(''); setGalleryFormSuccess(''); setGalleryImageFile(null); setGalleryImagePreview(null); setShowGalleryForm(true); }} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Add Image</button>
                    )}
                  </div>
                </div>
                {galleryLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {galleryImages.map(img => (
                      <div key={img.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                        {img.imageUrl ? (
                          <img src={img.imageUrl} alt={img.title} className="w-full h-40 object-cover" />
                        ) : (
                          <div className="w-full h-40 bg-[#F5F0E8] flex items-center justify-center"><span className="text-3xl">🖼️</span></div>
                        )}
                        <div className="p-3">
                          <p className="text-sm font-semibold text-[#1A1612] truncate">{img.title}</p>
                          {img.description && <p className="text-xs text-[#8C8278] mt-0.5 line-clamp-2">{img.description}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => handleToggleGalleryImageVisible(img)}
                              disabled={togglingGalleryId === img.id}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${img.is_visible ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'}`}
                            >
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${img.is_visible ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                            <div className="flex gap-1">
                              {can('gallery', 'edit') && (
                                <button onClick={() => { setEditingGalleryImage(img); setGalleryForm({ title: img.title, description: img.description || '', sort_order: String(img.sort_order), is_visible: img.is_visible }); setGalleryFormError(''); setGalleryFormSuccess(''); setGalleryImageFile(null); setGalleryImagePreview(img.imageUrl || null); setShowGalleryForm(true); }} className="text-xs text-[#C4622D] border border-[#C4622D] px-2 py-1 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                              )}
                              {can('gallery', 'delete') && (
                                <button onClick={() => handleDeleteGalleryImage(img)} className="text-xs text-red-500 border border-red-300 px-2 py-1 rounded-lg font-semibold hover:bg-red-50 transition-colors">Del</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {galleryImages.length === 0 && (
                      <div className="col-span-full bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No gallery images yet.</p></div>
                    )}
                  </div>
                )}

                {/* Add/Edit Gallery Image Modal */}
                {showGalleryForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                      <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                        <h3 className="text-base font-bold text-[#1A1612]">{editingGalleryImage ? 'Edit Image' : 'Add Gallery Image'}</h3>
                        <button onClick={() => setShowGalleryForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Title *</label>
                          <input type="text" value={galleryForm.title} onChange={e => setGalleryForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                          <textarea value={galleryForm.description} onChange={e => setGalleryForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sort Order</label>
                          <input type="number" value={galleryForm.sort_order} onChange={e => setGalleryForm(f => ({ ...f, sort_order: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Image {editingGalleryImage ? '(leave empty to keep current)' : '*'}</label>
                          {galleryImagePreview && (
                            <img src={galleryImagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl mb-2" />
                          )}
                          <input ref={galleryImageRef} type="file" accept="image/*" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setGalleryImageFile(file);
                            const reader = new FileReader();
                            reader.onload = ev => setGalleryImagePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }} className="text-sm text-[#5C5347]" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="g-visible" checked={galleryForm.is_visible} onChange={e => setGalleryForm(f => ({ ...f, is_visible: e.target.checked }))} className="rounded" />
                          <label htmlFor="g-visible" className="text-sm text-[#5C5347]">Visible</label>
                        </div>
                        {galleryFormError && <p className="text-sm text-red-600">{galleryFormError}</p>}
                        {galleryFormSuccess && <p className="text-sm text-green-600">{galleryFormSuccess}</p>}
                      </div>
                      <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                        <button onClick={handleSaveGalleryImage} disabled={savingGallery} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                          {savingGallery ? (uploadingGalleryImage ? 'Uploading…' : 'Saving…') : (editingGalleryImage ? 'Save Changes' : 'Add Image')}
                        </button>
                        <button onClick={() => setShowGalleryForm(false)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PRODUCTS TAB ── */}
            {activeTab === 'products' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Products &amp; Pricing</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{products.length} products</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input type="text" placeholder="Search products…" value={productSearchQuery} onChange={e => setProductSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                      {productSearchQuery && (
                        <button type="button" onClick={() => setProductSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B5ADA5] hover:text-[#5C5347] transition-colors" aria-label="Clear search">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
                        </button>
                      )}
                    </div>
                    {can('products', 'create') && (
                      <button onClick={openAddForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Add Product</button>
                    )}
                  </div>
                </div>

                {/* Category Filter Buttons */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {(['All', ...categoryNames]).map((cat) => {
                    const count = cat === 'All' ? products.length : products.filter(p => p.category === cat).length;
                    if (cat !== 'All' && count === 0) return null;
                    return (
                      <button
                        key={cat}
                        onClick={() => setStaffProductCategory(cat)}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                          staffProductCategory === cat
                            ? 'bg-[#C4622D] text-white shadow-sm'
                            : 'bg-white border border-[#DDD5C8] text-[#5C5347] hover:border-[#C4622D]/40 hover:text-[#C4622D]'
                        }`}
                      >
                        {cat}
                        <span className={`ml-2 text-xs ${staffProductCategory === cat ? 'text-white/70' : 'text-[#B5ADA5]'}`}>
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {productsLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[#F5F0E8] border-b border-[#EDE7DA]">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Product</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Category</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Price</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Visual Type</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-[#5C5347] uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0EBE3]">
                          {products.filter(p => {
                            const matchesSearch = !productSearchQuery || p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || p.category.toLowerCase().includes(productSearchQuery.toLowerCase());
                            const matchesCategory = staffProductCategory === 'All' || p.category === staffProductCategory;
                            return matchesSearch && matchesCategory;
                          }).map(product => (
                            <tr key={product.id} className="hover:bg-[#FAF5EE] transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-[#F5F0E8] flex items-center justify-center flex-shrink-0"><span className="text-lg">🍽️</span></div>
                                  )}
                                  <div>
                                    <p className="font-medium text-[#1A1612]">{product.name}</p>
                                    {product.badge && <span className="text-xs bg-[#FDF6EE] text-[#C4622D] border border-[#F0D9C8] px-1.5 py-0.5 rounded-full">{product.badge}</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[#5C5347]">{product.category}</td>
                              <td className="px-4 py-3 font-semibold text-[#1A1612]">{product.price > 0 ? `R${product.price.toFixed(2)}` : '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {product.available ? 'Available' : 'Unavailable'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[#5C5347] text-sm">{product.visual_type || '—'}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {can('products', 'edit') && (
                                    <button onClick={() => openEditForm(product)} className="text-xs bg-[#C4622D] text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-[#A04E22] transition-colors">Edit</button>
                                  )}
                                  {can('products', 'delete') && (
                                    <button onClick={() => handleDeleteProduct(product)} className="text-xs bg-white text-red-600 border border-red-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-50 transition-colors">Delete</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Add/Edit Product Form Modal */}
                {(showForm || showEditModal) && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                      <div className="p-6 border-b border-[#EDE7DA] flex items-center justify-between">
                        <h3 className="text-base font-bold text-[#1A1612]">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
                        <button onClick={() => { setShowForm(false); setShowEditModal(false); setEditingProduct(null); }} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
                      </div>
                      <div className="p-6 grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Product Name *</label>
                          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Category</label>
                          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                            {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price (R)</label>
                          <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Unit</label>
                          <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Old Price (R) <span className="font-normal text-[#9C8E82]">(optional)</span></label>
                          <input
                            type="number"
                            value={form.old_price ?? ''}
                            onChange={e => {
                              const oldPriceVal = e.target.value;
                              const price = Number(form.price) || 0;
                              const oldPrice = Number(oldPriceVal);
                              const saving = oldPriceVal && oldPrice > price && price > 0
                                ? Math.round(((oldPrice - price) / oldPrice) * 100)
                                : '';
                              setForm(f => ({ ...f, old_price: oldPriceVal, saving_percent: saving === '' ? '' : String(saving) }));
                            }}
                            placeholder="e.g. 250"
                            className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Saving % <span className="font-normal text-[#9C8E82]">(auto-calculated)</span></label>
                          <input
                            type="text"
                            value={form.saving_percent ?? ''}
                            readOnly
                            placeholder="Auto-calculated"
                            className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm bg-[#F5F0EB] text-[#9C8E82] cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Package Type</label>
                          <select value={form.package_type} onChange={e => setForm(f => ({ ...f, package_type: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                            {packageTypes.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Long Description</label>
                          <textarea value={form.long_description ?? ''} onChange={e => setForm(f => ({ ...f, long_description: e.target.value }))} rows={4} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" placeholder="Detailed product description…" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Attribute 1</label>
                          <input type="text" value={form.attribute1 ?? ''} onChange={e => setForm(f => ({ ...f, attribute1: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. Gluten Free" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Attribute 2</label>
                          <input type="text" value={form.attribute2 ?? ''} onChange={e => setForm(f => ({ ...f, attribute2: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. Halaal" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Attribute 3</label>
                          <input type="text" value={form.attribute3 ?? ''} onChange={e => setForm(f => ({ ...f, attribute3: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. Vegan" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Visual Type</label>
                          <select value={form.visual_type ?? ''} onChange={e => setForm(f => ({ ...f, visual_type: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                            <option value="">— Select Visual Type —</option>
                            {visualTypes.map(vt => (
                              <option key={vt} value={vt}>{vt}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Badge</label>
                          <input type="text" value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sort Order</label>
                          <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Tags <span className="font-normal text-[#9C8E82]">(comma-separated)</span></label>
                          <input type="text" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. healthy, gluten-free, halaal" className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div className="col-span-2 flex items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="rounded" />
                            <span className="text-sm text-[#5C5347]">Available</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" />
                            <span className="text-sm text-[#5C5347]">Featured</span>
                          </label>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Product Image</label>
                          {pendingImagePreview && (
                            <img src={pendingImagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl mb-2" />
                          )}
                          <input ref={productImageRef} type="file" accept="image/*" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setPendingImageFile(file);
                            const reader = new FileReader();
                            reader.onload = ev => setPendingImagePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }} className="text-sm text-[#5C5347]" />
                        </div>
                      </div>
                      <div className="p-6 border-t border-[#EDE7DA] flex gap-3">
                        <button onClick={handleSaveProduct} disabled={saving} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                          {saving ? (uploadingImage ? 'Uploading…' : 'Saving…') : (editingProduct ? 'Save Changes' : 'Add Product')}
                        </button>
                        <button onClick={() => { setShowForm(false); setShowEditModal(false); setEditingProduct(null); }} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STAFF TAB ── */}
            {activeTab === 'staff' && (
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Staff Management</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{staffMembers.length} members</p>
                  </div>
                  <div className="relative">
                    <input type="text" placeholder="Search staff…" value={staffSearchQuery} onChange={e => setStaffSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                    {staffSearchQuery && (
                      <button type="button" onClick={() => setStaffSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B5ADA5] hover:text-[#5C5347] transition-colors" aria-label="Clear search">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                {/* Invite & Promote buttons — below search row */}
                <div className="mb-5 flex gap-3">
                  <button onClick={() => { setInviteOpen(o => !o); setPromoteOpen(false); }} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Invite Staff</button>
                  <button onClick={() => { setPromoteOpen(o => !o); setInviteOpen(false); }} className="border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#FAF5EE] transition-colors">Promote Existing User</button>
                </div>
                {/* Invite form */}
                {inviteOpen && (
                  <div className="mb-5 bg-white rounded-2xl border border-[#EDE7DA] p-5">
                    <h3 className="text-sm font-bold text-[#1A1612] mb-4">Invite New Staff Member</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Full Name *</label><input type="text" value={inviteForm.full_name} onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                      <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Email *</label><input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                      <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Role</label><select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as StaffRole }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
                    </div>
                    {inviteError && <p className="text-sm text-red-600 mt-2">{inviteError}</p>}
                    {inviteSuccess && <p className="text-sm text-green-600 mt-2">{inviteSuccess}</p>}
                    <div className="flex gap-3 mt-4">
                      <button onClick={handleInviteStaff} disabled={inviting} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{inviting ? 'Inviting…' : 'Send Invite'}</button>
                      <button onClick={() => setInviteOpen(false)} className="border border-[#DDD5C8] text-[#5C5347] px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
                {/* Promote form */}
                {promoteOpen && (
                  <div className="mb-5 bg-white rounded-2xl border border-[#EDE7DA] p-5">
                    <h3 className="text-sm font-bold text-[#1A1612] mb-4">Promote Existing User to Staff</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Email *</label><input type="email" value={promoteForm.email} onChange={e => setPromoteForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                      <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Full Name *</label><input type="text" value={promoteForm.full_name} onChange={e => setPromoteForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                      <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Phone</label><input type="text" value={promoteForm.phone_number} onChange={e => setPromoteForm(f => ({ ...f, phone_number: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                      <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Role</label><select value={promoteForm.role} onChange={e => setPromoteForm(f => ({ ...f, role: e.target.value as StaffRole }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
                    </div>
                    {promoteError && <p className="text-sm text-red-600 mt-2">{promoteError}</p>}
                    {promoteSuccess && <p className="text-sm text-green-600 mt-2">{promoteSuccess}</p>}
                    <div className="flex gap-3 mt-4">
                      <button onClick={handlePromoteUser} disabled={promoting} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{promoting ? 'Promoting…' : 'Promote User'}</button>
                      <button onClick={() => setPromoteOpen(false)} className="border border-[#DDD5C8] text-[#5C5347] px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
                {staffLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {staffMembers.filter(m => !staffSearchQuery || m.full_name.toLowerCase().includes(staffSearchQuery.toLowerCase()) || m.email.toLowerCase().includes(staffSearchQuery.toLowerCase())).map(member => (
                      <div key={member.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[#1A1612]">{member.full_name}</p>
                          <p className="text-xs text-[#8C8278]">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <RoleBadge role={member.role} />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{member.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <button
                            onClick={() => { setEditModalMember(member); setEditModalForm({ full_name: member.full_name, phone: member.phone || '', role: member.role }); setEditModalError(''); }}
                            className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors"
                          >Edit</button>
                          <button
                            onClick={() => handleToggleStaffActive(member)}
                            disabled={togglingStaffId === member.id}
                            className="text-xs text-green-600 border border-green-400 px-3 py-1.5 rounded-xl font-semibold hover:bg-green-50 transition-colors disabled:opacity-50"
                          >{member.is_active ? 'Deactivate' : 'Activate'}</button>
                          <button
                            onClick={() => handleSendPasswordReset(member)}
                            disabled={sendingResetId === member.id}
                            className="text-xs text-blue-600 border border-blue-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
                          >Reset Password</button>
                          <button
                            onClick={() => handleDeleteStaff(member)}
                            className="text-xs text-red-500 border border-red-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-50 transition-colors"
                          >Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ORDERS TAB ── */}
            {activeTab === 'orders' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Order Management</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">
                      {wsFilteredOrders.length === wsOrders.length
                        ? `${wsOrders.length} orders`
                        : `${wsFilteredOrders.length} of ${wsOrders.length} orders`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <input type="text" placeholder="Search orders…" value={wsOrderSearch} onChange={e => setWsOrderSearch(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                      {wsOrderSearch && (
                        <button type="button" onClick={() => setWsOrderSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#B5ADA5] hover:text-[#5C5347] transition-colors" aria-label="Clear search">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
                        </button>
                      )}
                    </div>
                    <select value={wsFilterPayment} onChange={e => setWsFilterPayment(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                      <option value="all">All Payments</option>
                      {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
                    </select>
                    <select value={wsFilterFulfillment} onChange={e => setWsFilterFulfillment(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                      <option value="all">All Fulfillment</option>
                      {FULFILLMENT_OPTIONS.map(s => <option key={s} value={s}>{FULFILLMENT_STATUS_LABELS[s]}</option>)}
                    </select>
                    <button onClick={loadWsOrders} className="text-sm border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">↻ Refresh</button>
                  </div>
                </div>
                {wsOrdersLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : wsOrdersError ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-sm text-red-600">{wsOrdersError}</p></div>
                ) : wsFilteredOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No orders found.</p></div>
                ) : (
                  <div className="space-y-3">
                    {wsFilteredOrders.map(order => {
                      const updateState = getWsOrderUpdateState(order.id);
                      const isExpanded = wsExpandedOrderId === order.id;
                      return (
                        <div key={order.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                          <button onClick={() => setWsExpandedOrderId(isExpanded ? null : order.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF5EE] transition-colors text-left">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="min-w-0">
                                <p className="font-semibold text-[#1A1612] truncate">{order.customer_name}</p>
                                <p className="text-xs text-[#8C8278]">{order.customer_email} · {formatDate(order.created_at)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>{PAYMENT_STATUS_LABELS[order.payment_status]}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${FULFILLMENT_STATUS_COLORS[order.fulfillment_status]}`}>{FULFILLMENT_STATUS_LABELS[order.fulfillment_status]}</span>
                              <span className="font-bold text-[#C4622D]">{formatCurrency(calculateOrderTotal(order))}</span>
                              <svg className={`w-4 h-4 text-[#8C8278] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-[#EDE7DA] px-5 py-5 bg-[#FDFAF6]">
                              {/* Super Admin Delete Button */}
                              {userProfile?.role === 'super_admin' && (
                                <div className="mb-4 flex justify-end">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteOrderId(order.id); }}
                                    disabled={deletingOrder}
                                    className="text-xs text-red-600 border border-red-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                                    </svg>
                                    Delete Order
                                  </button>
                                </div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {/* Customer Details */}
                                <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                                  <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" /></svg>
                                    Customer Details
                                  </h4>
                                  <div className="space-y-2">
                                    <div><p className="text-xs text-[#B5ADA5]">Name</p><p className="text-sm font-medium text-[#1A1612]">{order.customer_name || '—'}</p></div>
                                    <div><p className="text-xs text-[#B5ADA5]">Email</p><p className="text-sm text-[#1A1612] break-all">{order.customer_email || '—'}</p></div>
                                    <div><p className="text-xs text-[#B5ADA5]">Phone</p><p className="text-sm text-[#1A1612]">{order.customer_phone || '—'}</p></div>
                                    {order.event_date && <div><p className="text-xs text-[#B5ADA5]">Event Date</p><p className="text-sm text-[#1A1612]">{formatDate(order.event_date)}</p></div>}
                                    {order.delivered_date && <div><p className="text-xs text-[#B5ADA5]">Delivered Date</p><p className="text-sm font-medium text-green-700">{formatDate(order.delivered_date)}</p></div>}
                                    <div><p className="text-xs text-[#B5ADA5]">Delivery Address</p><p className="text-sm text-[#1A1612]">{order.delivery_address || '—'}</p></div>
                                    {order.notes && <div><p className="text-xs text-[#B5ADA5]">Notes</p><p className="text-sm text-[#1A1612]">{order.notes}</p></div>}
                                  </div>
                                </div>

                                {/* Items Ordered */}
                                <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                                  <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M6 5v1H4.667a1.75 1.75 0 0 0-1.743 1.598l-.826 9.14A1.75 1.75 0 0 0 3.84 18.5h12.32a1.75 1.75 0 0 0 1.742-1.762l-.826-9.14A1.75 1.75 0 0 0 15.333 6H14V5a4 4 0 0 0-8 0Zm4-2.5A2.5 2.5 0 0 0 7.5 5v1h5V5A2.5 2.5 0 0 0 10 2.5ZM7.5 10a2.5 2.5 0 0 0 5 0V8.75a.75.75 0 0 1 1.5 0V10a4 4 0 0 1-8 0V8.75a.75.75 0 0 1 1.5 0V10Z" clipRule="evenodd" /></svg>
                                    Items Ordered
                                  </h4>
                                  {(order.items || []).length > 0 ? (
                                    <div className="space-y-2">
                                      {(order.items || []).map((item, i) => (
                                        <div key={i} className="flex justify-between items-start gap-2">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[#1A1612] truncate">{item.name}</p>
                                            <p className="text-xs text-[#B5ADA5]">{item.unit} × {item.quantity}</p>
                                            {item.category && <span className="inline-block mt-0.5 text-[10px] font-medium text-[#C4622D] bg-[#FDF3ED] px-1.5 py-0.5 rounded-full">{item.category}</span>}
                                          </div>
                                          <span className="text-sm font-semibold text-[#1A1612] flex-shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-[#B5ADA5]">No item details available</p>
                                  )}
                                </div>

                                {/* Payment Summary */}
                                <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                                  <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M2.5 4A1.5 1.5 0 0 0 1 5.5v1h18v-1A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1V14.5A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5V8.5ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" /></svg>
                                    Payment Summary
                                  </h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Subtotal</span><span className="text-[#1A1612]">{formatCurrency(order.subtotal)}</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Delivery</span><span className="text-[#1A1612]">{formatCurrency(order.delivery_fee)}</span></div>
                                    <div className="flex justify-between text-sm font-bold border-t border-[#EDE7DA] pt-2 mt-1"><span className="text-[#1A1612]">Total</span><span className="text-[#C4622D]">{formatCurrency(calculateOrderTotal(order))}</span></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* ── WEEKLY MENU TAB ── */}
            {activeTab === 'weekly_menu' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Weekly Menu</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">Manage daily meal offerings</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setWeekOffset(w => w - 1)} className="border border-[#DDD5C8] text-[#5C5347] px-3 py-2 rounded-xl text-sm hover:bg-[#F5F0E8] transition-colors">← Prev</button>
                    <button onClick={() => setWeekOffset(0)} className="border border-[#DDD5C8] text-[#5C5347] px-3 py-2 rounded-xl text-sm hover:bg-[#F5F0E8] transition-colors">This Week</button>
                    <button onClick={() => setWeekOffset(w => w + 1)} className="border border-[#DDD5C8] text-[#5C5347] px-3 py-2 rounded-xl text-sm hover:bg-[#F5F0E8] transition-colors">Next →</button>
                    {can('weekly_menu', 'create') && (
                      <button onClick={() => { setEditingWeeklyEntry(null); setWeeklyMenuForm({ meal_date: '', day_name: '', meal_name: '', description: '', price: '', is_closed: false, closed_reason: '' }); setWeeklyMenuFormError(''); setWeeklyMenuFormSuccess(''); setShowWeeklyMenuForm(true); }} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Add Entry</button>
                    )}
                  </div>
                </div>
                {weeklyMenuLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {getWeekDays().map(day => {
                      const entry = weeklyMenuEntries.find(e => e.meal_date === day.date);
                      return (
                        <div key={day.date} className="bg-white rounded-2xl border border-[#EDE7DA] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-semibold text-[#1A1612] text-sm">{day.dayName}</p>
                              <p className="text-xs text-[#8C8278]">{day.shortDate}</p>
                            </div>
                            {entry?.is_closed && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Closed</span>}
                          </div>
                          {entry ? (
                            <div className="space-y-1">
                              {entry.is_closed ? (
                                <p className="text-sm text-[#8C8278] italic">{entry.closed_reason || 'Closed'}</p>
                              ) : (
                                <>
                                  <p className="text-sm font-medium text-[#1A1612]">{entry.meal_name || '—'}</p>
                                  {entry.description && <p className="text-xs text-[#8C8278] line-clamp-2">{entry.description}</p>}
                                  {entry.price != null && <p className="text-sm font-bold text-[#C4622D]">R{Number(entry.price).toFixed(2)}</p>}
                                </>
                              )}
                              <div className="flex gap-2 mt-3">
                                {can('weekly_menu', 'edit') && (
                                  <button onClick={() => { setEditingWeeklyEntry(entry); setWeeklyMenuForm({ meal_date: entry.meal_date, day_name: entry.day_name, meal_name: entry.meal_name || '', description: entry.description || '', price: entry.price != null ? String(entry.price) : '', is_closed: entry.is_closed, closed_reason: entry.closed_reason || '' }); setWeeklyMenuFormError(''); setWeeklyMenuFormSuccess(''); setShowWeeklyMenuForm(true); }} className="text-xs text-[#C4622D] border border-[#C4622D] px-2 py-1 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                                )}
                                {can('weekly_menu', 'delete') && (
                                  <button onClick={() => {
                                    setDeleteModal({ open: true, title: 'Delete Menu Entry', message: `Delete the entry for ${entry.day_name}?`, onConfirm: async () => { setDeleteModal(p => ({ ...p, open: false })); setDeletingWeeklyEntryId(entry.id); const { data, error } = await supabase.from('weekly_menu').delete().eq('id', entry.id).select('id'); if (error || !data || data.length === 0) showGlobalError(error?.message || 'Delete was blocked.', 'Weekly Menu Error'); await loadWeeklyMenu(); setDeletingWeeklyEntryId(null); } });
                                  }} className="text-xs text-red-500 border border-red-300 px-2 py-1 rounded-lg font-semibold hover:bg-red-50 transition-colors">Del</button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-xs text-[#B5ADA5] mb-2">No entry</p>
                              {can('weekly_menu', 'create') && (
                                <button onClick={() => { setEditingWeeklyEntry(null); setWeeklyMenuForm({ meal_date: day.date, day_name: day.dayName, meal_name: '', description: '', price: '', is_closed: false, closed_reason: '' }); setWeeklyMenuFormError(''); setWeeklyMenuFormSuccess(''); setShowWeeklyMenuForm(true); }} className="text-xs text-[#C4622D] border border-[#C4622D] px-2 py-1 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">+ Add</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Add/Edit Weekly Menu Form Modal */}
                {showWeeklyMenuForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                      <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                        <h3 className="text-base font-bold text-[#1A1612]">{editingWeeklyEntry ? 'Edit Menu Entry' : 'Add Menu Entry'}</h3>
                        <button onClick={() => setShowWeeklyMenuForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Date *</label><input type="date" value={weeklyMenuForm.meal_date} onChange={e => setWeeklyMenuForm(f => ({ ...f, meal_date: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                          <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Day Name *</label><input type="text" value={weeklyMenuForm.day_name} onChange={e => setWeeklyMenuForm(f => ({ ...f, day_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="wm-closed" checked={weeklyMenuForm.is_closed} onChange={e => setWeeklyMenuForm(f => ({ ...f, is_closed: e.target.checked }))} className="rounded" />
                          <label htmlFor="wm-closed" className="text-sm text-[#5C5347]">Mark as Closed</label>
                        </div>
                        {weeklyMenuForm.is_closed ? (
                          <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Reason</label><input type="text" value={weeklyMenuForm.closed_reason} onChange={e => setWeeklyMenuForm(f => ({ ...f, closed_reason: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                        ) : (
                          <>
                            <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Meal Name</label><input type="text" value={weeklyMenuForm.meal_name} onChange={e => setWeeklyMenuForm(f => ({ ...f, meal_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                            <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label><textarea value={weeklyMenuForm.description} onChange={e => setWeeklyMenuForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] resize-none" /></div>
                            <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Price (R)</label><input type="number" step="0.01" value={weeklyMenuForm.price} onChange={e => setWeeklyMenuForm(f => ({ ...f, price: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                          </>
                        )}
                        {weeklyMenuFormError && <p className="text-sm text-red-600">{weeklyMenuFormError}</p>}
                        {weeklyMenuFormSuccess && <p className="text-sm text-green-600">{weeklyMenuFormSuccess}</p>}
                      </div>
                      <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                        <button onClick={async () => {
                          setWeeklyMenuFormError(''); setWeeklyMenuFormSuccess('');
                          if (!weeklyMenuForm.meal_date || !weeklyMenuForm.day_name) { setWeeklyMenuFormError('Date and day name are required.'); return; }
                          setSavingWeeklyEntry(true);
                          const payload: any = { meal_date: weeklyMenuForm.meal_date, day_name: weeklyMenuForm.day_name, meal_name: weeklyMenuForm.meal_name || null, description: weeklyMenuForm.description || null, price: weeklyMenuForm.price ? Number(weeklyMenuForm.price) : null, is_closed: weeklyMenuForm.is_closed, closed_reason: weeklyMenuForm.closed_reason || null };
                          let saveError: any = null;
                          if (editingWeeklyEntry) {
                            const { data: upd, error } = await supabase.from('weekly_menu').update(payload).eq('id', editingWeeklyEntry.id).select('id');
                            saveError = error; if (!error && (!upd || upd.length === 0)) saveError = { message: 'Update was blocked.' };
                          } else {
                            const { data: ins, error } = await supabase.from('weekly_menu').insert(payload).select('id');
                            saveError = error; if (!error && (!ins || ins.length === 0)) saveError = { message: 'Could not add entry.' };
                          }
                          if (saveError) { setWeeklyMenuFormError(saveError.message); } else { setWeeklyMenuFormSuccess(editingWeeklyEntry ? 'Entry updated!' : 'Entry added!'); setShowWeeklyMenuForm(false); setEditingWeeklyEntry(null); await loadWeeklyMenu(); }
                          setSavingWeeklyEntry(false);
                        }} disabled={savingWeeklyEntry} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{savingWeeklyEntry ? 'Saving…' : (editingWeeklyEntry ? 'Save Changes' : 'Add Entry')}</button>
                        <button onClick={() => setShowWeeklyMenuForm(false)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CUSTOMER ORDER HISTORY TAB ── */}
            {activeTab === 'customer_order_history' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Customer Order History</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Look up a customer's full order history by name, email or phone</p>
                </div>
                <div className="flex gap-3 mb-6">
                  <input type="text" placeholder="Enter name, email or phone…" value={cohLookupInput} onChange={e => setCohLookupInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCohLookup()} className="flex-1 border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                  <button onClick={handleCohLookup} disabled={cohLookupLoading || !cohLookupInput.trim()} className="bg-[#C4622D] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{cohLookupLoading ? 'Searching…' : 'Search'}</button>
                </div>
                {cohLookupError && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"><p className="text-sm text-red-600">{cohLookupError}</p></div>}
                {cohProfile && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5 mb-5">
                    <h3 className="text-sm font-bold text-[#1A1612] mb-3">Customer Profile</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-xs text-[#8C8278]">Name</p><p className="font-medium text-[#1A1612]">{cohProfile.customer_name || '—'}</p></div>
                      <div><p className="text-xs text-[#8C8278]">Email</p><p className="font-medium text-[#1A1612] break-all">{cohProfile.customer_email || '—'}</p></div>
                      <div><p className="text-xs text-[#8C8278]">Phone</p><p className="font-medium text-[#1A1612]">{cohProfile.customer_phone || '—'}</p></div>
                      <div><p className="text-xs text-[#8C8278]">First Order</p><p className="font-medium text-[#1A1612]">{formatDate(cohProfile.first_order_date)}</p></div>
                    </div>
                  </div>
                )}
                {cohOrders.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[#5C5347] mb-3">{cohOrders.length} order{cohOrders.length !== 1 ? 's' : ''} found</p>
                    <div className="space-y-3">
                      {cohOrders.map(order => {
                        const isExpanded = cohExpandedOrderId === order.id;
                        return (
                          <div key={order.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                            <button onClick={() => setCohExpandedOrderId(isExpanded ? null : order.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF5EE] transition-colors text-left">
                              <div className="min-w-0">
                                <p className="font-semibold text-[#1A1612] truncate">{order.customer_name}</p>
                                <p className="text-xs text-[#8C8278]">{order.customer_email} · {formatDate(order.created_at)}</p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>{PAYMENT_STATUS_LABELS[order.payment_status]}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${FULFILLMENT_STATUS_COLORS[order.fulfillment_status]}`}>{FULFILLMENT_STATUS_LABELS[order.fulfillment_status]}</span>
                                <span className="font-bold text-[#C4622D]">{formatCurrency(calculateOrderTotal(order))}</span>
                                <svg className={`w-4 h-4 text-[#8C8278] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-[#EDE7DA] px-5 py-4 bg-[#FDFAF6] space-y-3">
                                {(order.items || []).length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-2">Items</p>
                                    <div className="space-y-1">
                                      {(order.items || []).map((item, i) => (
                                        <div key={i} className="flex justify-between text-sm"><span className="text-[#1A1612]">{item.quantity}× {item.name}</span><span className="font-medium text-[#1A1612]">{formatCurrency(item.price * item.quantity)}</span></div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm font-bold border-t border-[#EDE7DA] pt-2"><span>Total</span><span className="text-[#C4622D]">{formatCurrency(calculateOrderTotal(order))}</span></div>
                                {order.delivery_address && <p className="text-xs text-[#8C8278]">📍 {order.delivery_address}</p>}
                                {order.notes && <p className="text-xs text-[#8C8278]">📝 {order.notes}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {cohProfile && cohOrders.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No orders found for this customer.</p></div>
                )}
              </div>
            )}

            {/* ── MEAL VOUCHERS TAB ── */}
            {activeTab === 'vouchers' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Meal Vouchers</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{vouchers.length} vouchers</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="text" placeholder="Search vouchers…" value={mvSearchQuery} onChange={e => setMvSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                    {can('vouchers', 'create') && (
                      <button onClick={() => { setEditingMv(null); setMvForm({ voucher_code: '', customer_name: '', customer_email: '', customer_phone: '', total_meals: '', meals_remaining: '', status: 'unpaid', notes: '', package_type: 'none', purchased_at: '' }); setMvFormError(''); setMvFormSuccess(''); setShowMvForm(true); }} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Add Voucher</button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {(['all', 'active', 'unpaid', 'paid', 'redeemed', 'expired'] as const).map(s => (
                    <button key={s} onClick={() => setMvFilterStatus(s)} className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${mvFilterStatus === s ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'border-[#DDD5C8] text-[#5C5347] hover:bg-[#F5F0E8]'}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                  ))}
                </div>
                {mvLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {vouchers.filter(v => {
                      const q = mvSearchQuery.toLowerCase();
                      const matchSearch = !q || v.voucher_code.toLowerCase().includes(q) || v.customer_name.toLowerCase().includes(q) || v.customer_email.toLowerCase().includes(q);
                      const matchStatus = mvFilterStatus === 'all' || v.status === mvFilterStatus;
                      return matchSearch && matchStatus;
                    }).map(v => (
                      <div key={v.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-mono font-bold text-[#C4622D] text-sm">{v.voucher_code}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === 'active' ? 'bg-green-100 text-green-700' : v.status === 'unpaid' ? 'bg-red-100 text-red-700' : v.status === 'paid' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{v.status}</span>
                          </div>
                          <p className="text-sm font-medium text-[#1A1612]">{v.customer_name}</p>
                          <p className="text-xs text-[#8C8278]">{v.customer_email} · {v.meals_remaining}/{v.total_meals} meals remaining</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          {can('vouchers', 'edit') && (
                            <button onClick={() => { setEditingMv(v); setMvForm({ voucher_code: v.voucher_code, customer_name: v.customer_name, customer_email: v.customer_email, customer_phone: v.customer_phone || '', total_meals: String(v.total_meals), meals_remaining: String(v.meals_remaining), status: v.status, notes: v.notes || '', package_type: v.package_type || 'none', purchased_at: v.purchased_at || '' }); setMvFormError(''); setMvFormSuccess(''); setShowMvEditModal(true); }} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                          )}
                          {can('vouchers', 'delete') && (
                            <button onClick={() => handleDeleteVoucher(v)} className="text-xs text-red-500 border border-red-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-50 transition-colors">Delete</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {vouchers.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No vouchers found.</p></div>}
                  </div>
                )}
                {/* Add/Edit Meal Voucher Modal */}
                {(showMvForm || showMvEditModal) && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                      <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                        <h3 className="text-base font-bold text-[#1A1612]">{editingMv ? 'Edit Voucher' : 'Add Voucher'}</h3>
                        <button onClick={() => { setShowMvForm(false); setShowMvEditModal(false); }} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
                      </div>
                      <div className="p-5 space-y-3">
                        <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Voucher Code *</label><input type="text" value={mvForm.voucher_code} onChange={e => setMvForm(f => ({ ...f, voucher_code: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Customer Name *</label><input type="text" value={mvForm.customer_name} onChange={e => setMvForm(f => ({ ...f, customer_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                          <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Email *</label><input type="email" value={mvForm.customer_email} onChange={e => setMvForm(f => ({ ...f, customer_email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                          <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Total Meals</label><input type="number" value={mvForm.total_meals} onChange={e => setMvForm(f => ({ ...f, total_meals: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                          <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Meals Remaining</label><input type="number" value={mvForm.meals_remaining} onChange={e => setMvForm(f => ({ ...f, meals_remaining: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                        </div>
                        <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Status</label><select value={mvForm.status} onChange={e => setMvForm(f => ({ ...f, status: e.target.value as Voucher['status'] }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="active">Active</option><option value="redeemed">Redeemed</option><option value="expired">Expired</option></select></div>
                        {mvFormError && <p className="text-sm text-red-600">{mvFormError}</p>}
                        {mvFormSuccess && <p className="text-sm text-green-600">{mvFormSuccess}</p>}
                      </div>
                      <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                        <button onClick={handleSaveMv} disabled={savingMv} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{savingMv ? 'Saving…' : (editingMv ? 'Save Changes' : 'Add Voucher')}</button>
                        <button onClick={() => { setShowMvForm(false); setShowMvEditModal(false); }} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── DISCOUNT VOUCHERS TAB ── */}
            {activeTab === 'discount_vouchers' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Discount Vouchers</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{discountVouchers.length} vouchers</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="text" placeholder="Search vouchers…" value={dvSearchQuery} onChange={e => setDvSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                    {can('discount_vouchers', 'create') && (
                      <button onClick={() => { setEditingDv(null); setDvForm({ dv_code: '', dv_type: 'Discount', dv_amount: '', status: 'Active' as 'Active' | 'Inactive', expiry_date: '', created_at: '' }); setDvFormError(''); setDvFormSuccess(''); setShowDvForm(true); }} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">+ Add Voucher</button>
                    )}
                  </div>
                </div>
                {dvLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {discountVouchers.filter(dv => {
                      const q = dvSearchQuery.toLowerCase();
                      return !q || dv.dv_code.toLowerCase().includes(q);
                    }).map(dv => {
                      const isExpired = new Date(dv.expiry_date) < new Date();
                      return (
                        <div key={dv.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-mono font-bold text-[#C4622D] text-sm">{dv.dv_code}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dv.status === 'Active' && !isExpired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{isExpired ? 'Expired' : dv.status}</span>
                            </div>
                            <p className="text-sm text-[#1A1612]">R{Number(dv.dv_amount).toFixed(2)} discount · Expires {formatDate(dv.expiry_date)}</p>
                            <p className="text-xs text-[#8C8278]">Used {dv.times_used ?? 0} time(s)</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {can('discount_vouchers', 'edit') && (
                              <button onClick={() => { setEditingDv(dv); setDvForm({ dv_code: dv.dv_code, dv_type: 'Discount', dv_amount: String(dv.dv_amount), status: dv.status, expiry_date: dv.expiry_date, created_at: dv.created_at }); setDvFormError(''); setDvFormSuccess(''); setShowDvForm(true); }} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                            )}
                            {can('discount_vouchers', 'delete') && (
                              <button onClick={() => handleDeleteDv(dv)} className="text-xs text-red-500 border border-red-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-50 transition-colors">Delete</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {discountVouchers.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No discount vouchers found.</p></div>}
                  </div>
                )}
                {/* Add/Edit Discount Voucher Modal */}
                {showDvForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                      <div className="p-5 border-b border-[#EDE7DA] flex items-center justify-between">
                        <h3 className="text-base font-bold text-[#1A1612]">{editingDv ? 'Edit Discount Voucher' : 'Add Discount Voucher'}</h3>
                        <button onClick={() => setShowDvForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">✕</button>
                      </div>
                      <div className="p-5 space-y-3">
                        <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Voucher Code *</label><input type="text" value={dvForm.dv_code} onChange={e => setDvForm(f => ({ ...f, dv_code: e.target.value.toUpperCase() }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                        <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Discount Amount (R) *</label><input type="number" step="0.01" value={dvForm.dv_amount} onChange={e => setDvForm(f => ({ ...f, dv_amount: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                        <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Expiry Date *</label><input type="date" value={dvForm.expiry_date} onChange={e => setDvForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" /></div>
                        <div><label className="block text-xs font-semibold text-[#5C5347] mb-1">Status</label><select value={dvForm.status} onChange={e => setDvForm(f => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
                        {dvFormError && <p className="text-sm text-red-600">{dvFormError}</p>}
                        {dvFormSuccess && <p className="text-sm text-green-600">{dvFormSuccess}</p>}
                      </div>
                      <div className="p-5 border-t border-[#EDE7DA] flex gap-3">
                        <button onClick={handleSaveDv} disabled={savingDv} className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{savingDv ? 'Saving…' : (editingDv ? 'Save Changes' : 'Add Voucher')}</button>
                        <button onClick={() => setShowDvForm(false)} className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#DDD5C8] text-[#5C5347] hover:bg-[#FAF5EE] transition-colors">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── REPORTS DASHBOARD TAB ── */}
            {activeTab === 'reporting' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Reports Dashboard</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Order and voucher reports</p>
                </div>
                <div className="flex gap-2 mb-5 flex-wrap">
                  {([
                    { key: 'products_ordered', label: 'Products Ordered' },
                    { key: 'package_meals_ordered', label: 'Package Meals' },
                    { key: 'frozen_meals_ordered', label: 'Frozen Meals' },
                    { key: 'discount_vouchers_report', label: 'Discount Vouchers' },
                    { key: 'delivered_orders', label: 'Delivered Orders' },
                  ] as const).map(r => (
                    <button key={r.key} onClick={() => setReportingView(r.key)} className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${reportingView === r.key ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'border-[#DDD5C8] text-[#5C5347] hover:bg-[#F5F0E8]'}`}>{r.label}</button>
                  ))}
                  <button onClick={loadReporting} className="text-xs px-3 py-1.5 rounded-full font-medium border border-[#DDD5C8] text-[#5C5347] hover:bg-[#F5F0E8] transition-colors">↻ Refresh</button>
                </div>
                {(productsOrderedLoading || packageMealsLoading || frozenMealsLoading || discountVouchersReportLoading || deliveredOrdersLoading) ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                    {reportingView === 'products_ordered' && (
                      <div>
                        <div className="p-4 border-b border-[#EDE7DA] flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#1A1612]">Products Ordered ({productsOrderedRows.length} rows)</p>
                          <button onClick={() => downloadProductsOrderedPDF(productsOrderedRows)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">Print PDF</button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-[#F5F0E8]"><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Product</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Type</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Item</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Ordered</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Client</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Email</th></tr></thead>
                            <tbody>{productsOrderedRows.map((r, i) => <tr key={i} className="border-t border-[#F0EBE3]"><td className="px-4 py-2 text-[#1A1612]">{r.productName}</td><td className="px-4 py-2 text-[#5C5347]">{r.productType}</td><td className="px-4 py-2 text-[#5C5347]">{r.item}</td><td className="px-4 py-2 text-[#5C5347]">{r.orderedDate}</td><td className="px-4 py-2 text-[#1A1612]">{r.clientName}</td><td className="px-4 py-2 text-[#8C8278]">{r.clientEmail}</td></tr>)}</tbody>
                          </table>
                          {productsOrderedRows.length === 0 && <p className="text-center text-[#8C8278] text-sm py-8">No data available.</p>}
                        </div>
                      </div>
                    )}
                    {reportingView === 'package_meals_ordered' && (
                      <div>
                        <div className="p-4 border-b border-[#EDE7DA] flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#1A1612]">Package Meals Ordered ({packageMealsRows.length} rows)</p>
                          <button onClick={() => downloadPackageMealsPDF(packageMealsRows)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">Print PDF</button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-[#F5F0E8]"><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Product</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Type</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Package</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Ordered</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Delivered</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Client</th></tr></thead>
                            <tbody>{packageMealsRows.map((r, i) => <tr key={i} className="border-t border-[#F0EBE3]"><td className="px-4 py-2 text-[#1A1612]">{r.productName}</td><td className="px-4 py-2 text-[#5C5347]">{r.productType}</td><td className="px-4 py-2 text-[#5C5347]">{r.packagePurchased}</td><td className="px-4 py-2 text-[#5C5347]">{r.orderedDate}</td><td className="px-4 py-2 text-[#5C5347]">{r.deliveredDt}</td><td className="px-4 py-2 text-[#1A1612]">{r.clientName}</td></tr>)}</tbody>
                          </table>
                          {packageMealsRows.length === 0 && <p className="text-center text-[#8C8278] text-sm py-8">No data available.</p>}
                        </div>
                      </div>
                    )}
                    {reportingView === 'frozen_meals_ordered' && (
                      <div>
                        <div className="p-4 border-b border-[#EDE7DA] flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#1A1612]">Frozen Meals Ordered ({frozenMealsRows.length} rows)</p>
                          <button onClick={() => downloadFrozenMealsPDF(frozenMealsRows)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">Print PDF</button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-[#F5F0E8]"><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Product</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Type</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Ordered</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Delivered</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Client</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Email</th></tr></thead>
                            <tbody>{frozenMealsRows.map((r, i) => <tr key={i} className="border-t border-[#F0EBE3]"><td className="px-4 py-2 text-[#1A1612]">{r.productName}</td><td className="px-4 py-2 text-[#5C5347]">{r.productType}</td><td className="px-4 py-2 text-[#5C5347]">{r.orderedDate}</td><td className="px-4 py-2 text-[#5C5347]">{r.deliveredDt}</td><td className="px-4 py-2 text-[#1A1612]">{r.clientName}</td><td className="px-4 py-2 text-[#8C8278]">{r.clientEmail}</td></tr>)}</tbody>
                          </table>
                          {frozenMealsRows.length === 0 && <p className="text-center text-[#8C8278] text-sm py-8">No data available.</p>}
                        </div>
                      </div>
                    )}
                    {reportingView === 'discount_vouchers_report' && (
                      <div>
                        <div className="p-4 border-b border-[#EDE7DA] flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#1A1612]">Discount Vouchers ({discountVouchersReportRows.length} rows)</p>
                          <button onClick={() => downloadDiscountVouchersPDF(discountVouchersReportRows)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">Print PDF</button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-[#F5F0E8]"><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Code</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Amount</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Expiry</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Status</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Usage</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Created</th></tr></thead>
                            <tbody>{discountVouchersReportRows.map((r, i) => <tr key={i} className="border-t border-[#F0EBE3]"><td className="px-4 py-2 font-mono text-[#C4622D]">{r.dvCode}</td><td className="px-4 py-2 text-[#1A1612]">R{r.dvAmount.toFixed(2)}</td><td className="px-4 py-2 text-[#5C5347]">{r.expiryDate}</td><td className="px-4 py-2 text-[#5C5347]">{r.productType}</td><td className="px-4 py-2 text-[#5C5347]">{r.item}</td><td className="px-4 py-2 text-[#5C5347]">{r.orderedDate}</td></tr>)}</tbody>
                          </table>
                          {discountVouchersReportRows.length === 0 && <p className="text-center text-[#8C8278] text-sm py-8">No data available.</p>}
                        </div>
                      </div>
                    )}
                    {reportingView === 'delivered_orders' && (
                      <div>
                        <div className="p-4 border-b border-[#EDE7DA] flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#1A1612]">Delivered Orders ({deliveredOrdersRows.length} rows)</p>
                          <button onClick={() => downloadDeliveredOrdersPDF(deliveredOrdersRows)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#FDF6EE] transition-colors">Print PDF</button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-[#F5F0E8]"><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Product</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Type</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Ordered</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Delivered</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Lead Time</th><th className="text-left px-4 py-2 font-semibold text-[#5C5347]">Email</th></tr></thead>
                            <tbody>{deliveredOrdersRows.map((r, i) => <tr key={i} className="border-t border-[#F0EBE3]"><td className="px-4 py-2 text-[#1A1612]">{r.productName}</td><td className="px-4 py-2 text-[#5C5347]">{r.productType}</td><td className="px-4 py-2 text-[#5C5347]">{r.orderedDate}</td><td className="px-4 py-2 text-[#5C5347]">{r.deliveredDt}</td><td className="px-4 py-2 text-[#5C5347]">{r.leadTime}</td><td className="px-4 py-2 text-[#8C8278]">{r.clientEmail}</td></tr>)}</tbody>
                          </table>
                          {deliveredOrdersRows.length === 0 && <p className="text-center text-[#8C8278] text-sm py-8">No data available.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYTICS TAB ── */}
            {activeTab === 'analytics' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Analytics</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">Order trends and performance metrics</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['7d', '30d', '90d', '12m'] as AnalyticsPeriod[]).map(p => (
                      <button key={p} onClick={() => { setAnalyticsPeriod(p); loadAnalytics(p); }} className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${analyticsPeriod === p ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'border-[#DDD5C8] text-[#5C5347] hover:bg-[#F5F0E8]'}`}>{p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '12 Months'}</button>
                    ))}
                  </div>
                </div>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : analyticsError ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-sm text-red-600">{analyticsError}</p></div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {summaryMetrics.map((m, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 text-center">
                          <p className="text-2xl mb-1">{m.icon}</p>
                          <p className="text-lg font-bold text-[#1A1612]">{m.value}</p>
                          <p className="text-xs font-semibold text-[#5C5347]">{m.label}</p>
                          {m.sub && <p className="text-xs text-[#8C8278] mt-0.5">{m.sub}</p>}
                        </div>
                      ))}
                    </div>
                    {/* Order Trend Chart */}
                    {orderTrend.length > 0 && (
                      <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                        <h3 className="text-sm font-bold text-[#1A1612] mb-4">Order Trend</h3>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={orderTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <RechartsTooltip content={<AnalyticsTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="orders" stroke="#C4622D" strokeWidth={2} dot={false} name="Orders" />
                            <Line type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} dot={false} name="Revenue" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {/* Fulfillment Breakdown */}
                    {fulfillmentMetrics.length > 0 && (
                      <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                        <h3 className="text-sm font-bold text-[#1A1612] mb-4">Fulfillment Breakdown</h3>
                        <div className="flex flex-wrap gap-3">
                          {fulfillmentMetrics.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 bg-[#F5F0E8] rounded-xl px-3 py-2">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                              <span className="text-xs font-medium text-[#1A1612]">{m.status}</span>
                              <span className="text-xs font-bold text-[#C4622D]">{m.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Voucher Usage Chart */}
                    {voucherUsage.length > 0 && (
                      <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                        <h3 className="text-sm font-bold text-[#1A1612] mb-4">Voucher Usage</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={voucherUsage}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar dataKey="mealVouchers" fill="#C4622D" name="Meal Vouchers" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="discountVouchers" fill="#8B5CF6" name="Discount Vouchers" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── DOCUMENT MANAGEMENT TAB ── */}
            {activeTab === 'media' && (
              <GoogleDriveDocuments canManage={can('media', 'edit')} />
            )}

            {/* ── EVENTS TAB ── */}
            {activeTab === 'media_events' && (
              <div className="p-6">
                <EventManagement canCreate={can('media_events', 'create')} canDelete={can('media_events', 'delete')} />
              </div>
            )}

            {/* ── PRODUCTS (Customer Relations) TAB ── */}
            {activeTab === 'media_products' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Products</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{products.length} products</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="text" placeholder="Search products…" value={productSearchQuery} onChange={e => setProductSearchQuery(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white" />
                  </div>
                </div>
                {productsLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {products.filter(p => !productSearchQuery || p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || p.category.toLowerCase().includes(productSearchQuery.toLowerCase())).map(p => (
                      <div key={p.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center gap-4">
                        {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#1A1612] truncate">{p.name}</p>
                          <p className="text-xs text-[#8C8278]">{p.category} · {p.unit}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-bold text-[#C4622D] text-sm">{p.price > 0 ? `R${p.price.toFixed(2)}` : '—'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.available ? 'Available' : 'Unavailable'}</span>
                          {can('media_products', 'edit') && (
                            <button onClick={() => openEditForm(p)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl font-semibold hover:bg-[#FDF6EE] transition-colors">Edit</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {products.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No products found.</p></div>}
                  </div>
                )}
              </div>
            )}

            {/* ── ABANDONED CARTS TAB ── */}
            {activeTab === 'abandoned_carts' && (
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Abandoned Carts</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{abandonedCarts.length} carts</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={loadAbandonedCarts} className="text-sm border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">↻ Refresh</button>
                    {can('abandoned_carts', 'create') && (
                      <button onClick={handleTriggerReminders} disabled={triggeringReminders} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">{triggeringReminders ? 'Sending…' : 'Send Reminders'}</button>
                    )}
                  </div>
                </div>
                {abandonedCartsError && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"><p className="text-sm text-red-600">{abandonedCartsError}</p></div>}
                {reminderPaused && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4"><p className="text-sm text-amber-700">{reminderPaused}</p></div>}
                {reminderResult && <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4"><p className="text-sm text-green-700">Reminders sent: {reminderResult.processed} processed</p></div>}
                {abandonedCartsLoading ? (
                  <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {abandonedCarts.map(cart => (
                      <div key={cart.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1A1612]">{cart.customer_name || 'Anonymous'}</p>
                          <p className="text-xs text-[#8C8278]">{cart.customer_email || 'No email'} · Last active: {formatDate(cart.last_activity_at)}</p>
                          <p className="text-xs text-[#8C8278]">{(cart.items || []).length} item(s) · {cart.reminder_sent_at ? `Reminder sent ${formatDate(cart.reminder_sent_at)}` : 'No reminder sent'}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {can('abandoned_carts', 'delete') && (
                            <button onClick={() => setCartToDelete(cart)} disabled={deletingCartId === cart.id} className="text-xs text-red-500 border border-red-300 px-3 py-1.5 rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">Delete</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {abandonedCarts.length === 0 && <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center"><p className="text-[#8C8278] text-sm">No abandoned carts found.</p></div>}
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}