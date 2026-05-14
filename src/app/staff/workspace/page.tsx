'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';


import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,  } from 'recharts';
import GoogleDriveDocuments from '@/app/staff/workspace/components/GoogleDriveDocuments';
import EventManagement from '@/app/staff/workspace/components/EventManagement';



type BucketType = 'product-images' | 'event-photos' | 'document-management';
type WorkspaceTab = 'products' | 'media' | 'media_events' | 'media_products' | 'orders' | 'staff' | 'homepage_cards' | 'categories' | 'weekly_menu' | 'vouchers' | 'discount_vouchers' | 'testimonials' | 'reporting' | 'analytics' | 'social_media' | 'gallery';

type ProductCategory = string;
type StaffRole = 'admin' | 'staff' | 'super_admin';

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
  imageUrl?: string;
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
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

interface HomepageCard {
  id: string;
  card_type: 'todays_special' | 'next_booking' | 'customer_review';
  title: string;
  subtitle: string | null;
  description: string | null;
  price: number | null;
  price_unit: string | null;
  badge_label: string | null;
  event_date: string | null;
  guest_count: number | null;
  prep_percentage: number | null;
  reviewer_name: string | null;
  reviewer_event: string | null;
  rating: number | null;
  is_visible: boolean;
  display_order: number;
  image_path: string | null;
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
  status: 'redeemed' | 'expired' | 'unpaid' | 'paid';
  purchased_at: string;
  notes: string | null;
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

const CARD_TYPE_LABELS: Record<HomepageCard['card_type'], string> = {
  todays_special: "Today's Special",
  next_booking: 'Next Booking',
  customer_review: 'Customer Review',
};

const CARD_TYPE_ICONS: Record<HomepageCard['card_type'], string> = {
  todays_special: '🍽️',
  next_booking: '📅',
  customer_review: '⭐',
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
    staff: { label: 'Staff', className: 'bg-[#F5F0E8] text-[#5C5347] border border-[#DDD5C8]' },
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
          <div className="bg-[#F5F0E8] border border-[#DDD5C8] rounded-xl px-6 py-3 text-center">
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
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
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
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [sendingResetId, setSendingResetId] = useState<string | null>(null);
  const [resetMessages, setResetMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});
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
  const [dvForm, setDvForm] = useState({ dv_code: '', dv_type: 'Discount' as 'Discount' | 'Gift', dv_amount: '', status: 'Active\' as \'Active\' | \'Inactive', expiry_date: '' });
  const [dvFormError, setDvFormError] = useState('');
  const [dvFormSuccess, setDvFormSuccess] = useState('');
  const [savingDv, setSavingDv] = useState(false);
  const [dvSearchQuery, setDvSearchQuery] = useState('');
  const [dvFilterExpired, setDvFilterExpired] = useState<'all' | 'active' | 'expired'>('all');
  const [generatingQrId, setGeneratingQrId] = useState<string | null>(null);
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
  const [showGalleryForm, setShowGalleryForm] = useState(false);
  const [editingGalleryImage, setEditingGalleryImage] = useState<{ id: string; title: string; description: string | null; image_path: string; sort_order: number; is_visible: boolean; imageUrl?: string } | null>(null);
  const [galleryForm, setGalleryForm] = useState({ title: '', description: '', sort_order: '0', is_visible: true });
  const [galleryFormError, setGalleryFormError] = useState('');
  const [galleryFormSuccess, setGalleryFormSuccess] = useState('');
  const [savingGallery, setSavingGallery] = useState(false);
  const [galleryImageFile, setGalleryImageFile] = useState<File | null>(null);
  const [galleryImagePreview, setGalleryImagePreview] = useState<string | null>(null);
  const [uploadingGalleryImage, setUploadingGalleryImage] = useState(false);
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
  // Reporting state
  const [reportingView, setReportingView] = useState<'cards' | 'products_ordered' | 'package_meals_ordered' | 'discount_vouchers_report'>('cards');
  const [productsOrderedRows, setProductsOrderedRows] = useState<ProductsOrderedRow[]>([]);
  const [productsOrderedLoading, setProductsOrderedLoading] = useState(false);
  const [packageMealsRows, setPackageMealsRows] = useState<PackageMealsOrderedRow[]>([]);
  const [packageMealsLoading, setPackageMealsLoading] = useState(false);
  const [discountVouchersReportRows, setDiscountVouchersReportRows] = useState<DiscountVouchersReportRow[]>([]);
  const [discountVouchersReportLoading, setDiscountVouchersReportLoading] = useState(false);
  // Date range filter state for each report
  const [productsOrderedDateFrom, setProductsOrderedDateFrom] = useState('');
  const [productsOrderedDateTo, setProductsOrderedDateTo] = useState('');
  const [packageMealsDateFrom, setPackageMealsDateFrom] = useState('');
  const [packageMealsDateTo, setPackageMealsDateTo] = useState('');
  const [discountVouchersDateFrom, setDiscountVouchersDateFrom] = useState('');
  const [discountVouchersDateTo, setDiscountVouchersDateTo] = useState('');
  // Sort state for each report table
  type SortDir = 'asc' | 'desc';
  const [productsOrderedSort, setProductsOrderedSort] = useState<{ col: string; dir: SortDir }>({ col: '', dir: 'asc' });
  const [packageMealsSort, setPackageMealsSort] = useState<{ col: string; dir: SortDir }>({ col: '', dir: 'asc' });
  const [discountVouchersSort, setDiscountVouchersSort] = useState<{ col: string; dir: SortDir }>({ col: '', dir: 'asc' });
  const [reportingSearchQuery, setReportingSearchQuery] = useState('');
  // Media library state
  const [mediaFiles, setMediaFiles] = useState<StorageFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [activeBucket, setActiveBucket] = useState<BucketType>('product-images');
  const [uploadingMedia, setUploadingMedia] = useState(false);

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
    const headers = ['Product', 'Type', 'Item', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Client', 'eMail'];
    const pdfRows = rows.map(r => [
      r.productName,
      r.productType,
      r.item,
      r.mealVoucher || '',
      r.discountVoucher || '',
      r.orderedDate,
      r.deliveredDt,
      r.clientName,
      r.clientEmail,
    ]);
    printReportPDF('Products Ordered', headers, pdfRows);
  };

  const downloadPackageMealsPDF = (rows: PackageMealsOrderedRow[]) => {
    const headers = ['Product', 'Type', 'Item', 'Package', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Client', 'eMail'];
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

  const downloadDiscountVouchersPDF = (rows: DiscountVouchersReportRow[]) => {
    const headers = ['Discount Voucher', 'Amount', 'Expiry Date', 'Product Name', 'Type', 'Item', 'Ordered', 'Delivered', 'Client', 'eMail'];
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
      await loadCategoryNames();
      await loadPackageTypes();
      await loadProducts();
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

  // ─── Load functions ───────────────────────────────────────────────────────────
  const loadCategoryNames = async () => {
    const { data } = await supabase.from('categories').select('name').eq('active', true).order('sort_order');
    if (data) setCategoryNames(data.map((c: any) => c.name));
  };

  const loadPackageTypes = async () => {
    const { data } = await supabase.from('products').select('package_type').not('package_type', 'is', null);
    if (data) {
      const unique = Array.from(new Set(data.map((p: any) => p.package_type).filter(Boolean)));
      setPackageTypes(['none', ...unique]);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('sort_order');
    if (!error && data) {
      const withUrls = await Promise.all(data.map(async (p: Product) => {
        if (p.image_path) {
          const { data: urlData } = await supabase.storage.from('product-images').createSignedUrl(p.image_path, 3600);
          return { ...p, imageUrl: urlData?.signedUrl };
        }
        return p;
      }));
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
      ({ error: saveError } = await supabase.from('gallery_images').update(payload).eq('id', editingGalleryImage.id));
    } else {
      ({ error: saveError } = await supabase.from('gallery_images').insert(payload));
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
        await supabase.from('gallery_images').delete().eq('id', img.id);
        await loadGallery();
      },
    });
  };

  const handleToggleGalleryImageVisible = async (img: typeof galleryImages[0]) => {
    await supabase.from('gallery_images').update({ is_visible: !img.is_visible }).eq('id', img.id);
    await loadGallery();
  };

  const loadWsOrders = async () => {
    setWsOrdersLoading(true);
    setWsOrdersError('');
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { setWsOrdersError(error.message); }
    else { setWsOrders(data || []); }
    setWsOrdersLoading(false);
  };

  const loadReporting = async () => {
    setProductsOrderedLoading(true);
    setPackageMealsLoading(true);
    setDiscountVouchersReportLoading(true);
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
          const isPackage = item.category?.toLowerCase().includes('package') || false;
          if (isPackage) {
            packageRows.push({
              orderId: order.id,
              productName: item.name,
              productType: item.category || '',
              item: `${item.quantity}x ${item.name}`,
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
      }

      setProductsOrderedRows(productsRows);
      setPackageMealsRows(packageRows);
      setDiscountVouchersReportRows(dvReportRows);
    } catch (err) {
      console.error('Reporting load error:', err);
    } finally {
      setProductsOrderedLoading(false);
      setPackageMealsLoading(false);
      setDiscountVouchersReportLoading(false);
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

      (orders || []).forEach(o => {
        const label = bucketFn(new Date(o.created_at));
        if (orderMap[label] !== undefined) { orderMap[label].orders += 1; orderMap[label].revenue += Number(o.total) || 0; }
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
      const totalRevenue = (orders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const paidOrders = (orders || []).filter(o => o.payment_status === 'paid' || o.payment_status === 'discounted').length;
      const deliveredOrders = (orders || []).filter(o => o.fulfillment_status === 'delivered').length;
      const totalMealRedemptions = (redemptions || []).length;
      const totalDvUsed = (dvOrders || []).length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

      setSummaryMetrics([
        { label: 'Total Orders', value: String(totalOrders), sub: `${paidOrders} paid`, icon: '📋' },
        { label: 'Total Revenue', value: `R${totalRevenue.toFixed(2)}`, sub: `Avg R${avgOrderValue.toFixed(2)}/order`, icon: '💰' },
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
    const { error } = await supabase.from('orders').update({ payment_status: newStatus }).eq('id', orderId);
    if (error) {
      setWsOrderUpdateField(orderId, 'paymentError', error.message);
    } else {
      setWsOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: newStatus } : o));
      setWsOrderUpdateField(orderId, 'paymentSuccess', true);
      setTimeout(() => setWsOrderUpdateField(orderId, 'paymentSuccess', false), 2000);
    }
    setWsOrderUpdateField(orderId, 'paymentSaving', false);
  };

  const handleWsFulfillmentUpdate = async (orderId: string, newStatus: FulfillmentStatus) => {
    setWsOrderUpdateField(orderId, 'fulfillmentSaving', true);
    const updateData: any = { fulfillment_status: newStatus };
    if (newStatus === 'delivered') updateData.delivered_date = new Date().toISOString();
    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    if (error) {
      setWsOrderUpdateField(orderId, 'fulfillmentError', error.message);
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
    const { error } = await supabase.from('orders').delete().eq('id', deleteOrderId);
    if (!error) {
      setWsOrders(prev => prev.filter(o => o.id !== deleteOrderId));
    } else {
      setWsOrdersError('Failed to delete order: ' + error.message);
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
    if (!form.price || isNaN(Number(form.price))) { showProductFormError('Valid price is required.'); return; }
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
    const payload = {
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price),
      unit: form.unit,
      description: form.description,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      badge: form.badge || null,
      min_order: form.min_order ? Number(form.min_order) : null,
      available: form.available,
      featured: form.featured,
      sort_order: form.sort_order,
      package_type: form.package_type,
      image_path,
      image_fit: form.image_fit || 'fill',
    };
    let saveError: any = null;
    if (editingProduct) {
      ({ error: saveError } = await supabase.from('products').update(payload).eq('id', editingProduct.id));
    } else {
      ({ error: saveError } = await supabase.from('products').insert(payload));
    }
    if (saveError) { showProductFormError(saveError.message); }
    else {
      setFormSuccess(editingProduct ? 'Product updated!' : 'Product added!');
      setShowForm(false);
      setShowEditModal(false);
      await loadProducts();
    }
    setSaving(false);
  };

  const handleDeleteProduct = (product: Product) => {
    setDeleteModal({
      open: true,
      title: 'Delete Product',
      message: `Are you sure you want to delete "${product.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        await supabase.from('products').delete().eq('id', product.id);
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
    const slug = categoryForm.slug.trim() || categoryForm.name.toLowerCase().replace(/\s+/g, '-');
    const payload = { name: categoryForm.name.trim(), slug, active: categoryForm.active, sort_order: Number(categoryForm.sort_order) };
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
      await loadCategories();
      await loadCategoryNames();
    }
    setSavingCategory(false);
  };

  const handleDeleteCategory = (cat: Category) => {
    setDeleteModal({
      open: true,
      title: 'Delete Category',
      message: `Delete category "${cat.name}"?`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        setDeletingCategoryId(cat.id);
        await supabase.from('product_categories').delete().eq('id', cat.id);
        setDeletingCategoryId(null);
        await loadCategories();
      },
    });
  };

  // ─── Staff CRUD ───────────────────────────────────────────────────────────────
  const handleInviteStaff = async () => {
    if (!inviteForm.email.trim() || !inviteForm.full_name.trim()) {
      showInviteError('Name and email are required.');
      return;
    }
    setInviting(true);
    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });
    const json = await res.json();
    if (!res.ok) { showInviteError(json.error || 'Invite failed'); }
    else {
      setInviteSuccess('Invitation sent!');
      setInviteForm(emptyInviteForm);
      await loadStaff();
    }
    setInviting(false);
  };

  const handleToggleStaffActive = async (member: StaffMember) => {
    setTogglingStaffId(member.id);
    await supabase.from('user_profiles').update({ is_active: !member.is_active }).eq('id', member.id);
    await loadStaff();
    setTogglingStaffId(null);
  };

  const handleResetPassword = async (member: StaffMember) => {
    setSendingResetId(member.id);
    setResetMessages(prev => ({ ...prev, [member.id]: { type: 'success', text: '' } }));
    try {
      const res = await fetch('/api/staff/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, email: member.email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResetMessages(prev => ({ ...prev, [member.id]: { type: 'error', text: json.error || 'Failed to send reset email.' } }));
      } else {
        setResetMessages(prev => ({ ...prev, [member.id]: { type: 'success', text: `Reset email sent to ${member.email}` } }));
      }
    } catch {
      setResetMessages(prev => ({ ...prev, [member.id]: { type: 'error', text: 'Network error. Please try again.' } }));
    } finally {
      setSendingResetId(null);
    }
  };

  // ─── Homepage Cards CRUD ──────────────────────────────────────────────────────
  const openEditCardForm = (card: HomepageCard) => {
    setEditingCard(card);
    setCardForm({ ...card });
    setCardFormError('');
    setCardFormSuccess('');
    setCardImageFile(null);
    setCardImagePreview(null);
  };

  const handleSaveCard = async () => {
    if (!editingCard) return;
    setSavingCard(true);
    let image_path = cardForm.image_path ?? editingCard.image_path ?? null;
    if (cardImageFile) {
      setUploadingCardImage(true);
      const ext = cardImageFile.name.split('.').pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('homepage-card-images').upload(path, cardImageFile);
      if (uploadErr) { showCardFormError(uploadErr.message); setSavingCard(false); setUploadingCardImage(false); return; }
      image_path = path;
      setUploadingCardImage(false);
    }
    const { error } = await supabase.from('homepage_cards').update({ ...cardForm, image_path }).eq('id', editingCard.id);
    if (error) { showCardFormError(error.message); }
    else {
      setCardFormSuccess('Card updated!');
      setEditingCard(null);
      setCardImageFile(null);
      setCardImagePreview(null);
      await loadHomepageCards();
    }
    setSavingCard(false);
  };

  const handleToggleCardVisibility = async (card: HomepageCard) => {
    setTogglingCardId(card.id);
    await supabase.from('homepage_cards').update({ is_visible: !card.is_visible }).eq('id', card.id);
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
      price: entry.price ? String(entry.price) : '',
      is_closed: entry.is_closed,
      closed_reason: entry.closed_reason || '',
    });
    setWeeklyMenuFormError('');
    setWeeklyMenuFormSuccess('');
    setShowWeeklyMenuForm(true);
  };

  const handleSaveWeeklyMenuEntry = async () => {
    if (!weeklyMenuForm.meal_name.trim() && !weeklyMenuForm.is_closed) {
      showWeeklyMenuFormError('Meal name is required unless marking as closed.');
      return;
    }
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
      ({ error: saveError } = await supabase.from('weekly_menu').update(payload).eq('id', editingWeeklyEntry.id));
    } else {
      ({ error: saveError } = await supabase.from('weekly_menu').insert(payload));
    }
    if (saveError) { showWeeklyMenuFormError(saveError.message); }
    else {
      setWeeklyMenuFormSuccess(editingWeeklyEntry ? 'Entry updated!' : 'Entry added!');
      setShowWeeklyMenuForm(false);
      await loadWeeklyMenu();
    }
    setSavingWeeklyEntry(false);
  };

  const handleDeleteWeeklyEntry = (entry: WeeklyMenuEntry) => {
    setDeleteModal({
      open: true,
      title: 'Delete Menu Entry',
      message: `Delete "${entry.meal_name || entry.day_name}" entry?`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        setDeletingWeeklyEntryId(entry.id);
        await supabase.from('weekly_menu').delete().eq('id', entry.id);
        setDeletingWeeklyEntryId(null);
        await loadWeeklyMenu();
      },
    });
  };

  // ─── Voucher CRUD ─────────────────────────────────────────────────────────────
  const handleIssueVoucher = async () => {
    if (!issueVoucherForm.customer_name.trim() || !issueVoucherForm.customer_email.trim() || !issueVoucherForm.total_meals) {
      showIssueVoucherError('Name, email, and total meals are required.');
      return;
    }
    setIssuingVoucher(true);
    const code = 'MV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('vouchers').insert({
      voucher_code: code,
      customer_name: issueVoucherForm.customer_name.trim(),
      customer_email: issueVoucherForm.customer_email.trim(),
      customer_phone: issueVoucherForm.customer_phone.trim(),
      total_meals: Number(issueVoucherForm.total_meals),
      meals_remaining: Number(issueVoucherForm.total_meals),
      status: 'unpaid',
      notes: issueVoucherForm.notes.trim() || null,
    });
    if (error) { showIssueVoucherError(error.message); }
    else {
      setIssueVoucherSuccess(`Voucher ${code} issued!`);
      setIssueVoucherForm({ customer_name: '', customer_email: '', customer_phone: '', total_meals: '', notes: '' });
      await loadVouchers();
    }
    setIssuingVoucher(false);
  };

  const handleMarkVoucherPaid = async (voucher: Voucher) => {
    setMarkingVoucherPaidId(voucher.id);
    setLoadingMarkingPaid(true);
    const { error } = await supabase.from('vouchers').update({ status: 'paid' }).eq('id', voucher.id);
    if (!error) await loadVouchers();
    setLoadingMarkingPaid(false);
    setMarkingVoucherPaidId(null);
  };

  // ─── Discount Voucher CRUD ────────────────────────────────────────────────────
  const openAddDvForm = () => {
    setEditingDv(null);
    setDvForm({ dv_code: '', dv_type: 'Discount', dv_amount: '', status: 'Active' as 'Active' | 'Inactive', expiry_date: '' });
    setDvFormError('');
    setDvFormSuccess('');
    setShowDvForm(true);
  };

  const openEditDvForm = (dv: DiscountVoucher) => {
    setEditingDv(dv);
    setDvForm({ dv_code: dv.dv_code, dv_type: dv.dv_code.startsWith('GV-') ? 'Gift' : 'Discount', dv_amount: String(dv.dv_amount), status: dv.status, expiry_date: dv.expiry_date?.split('T')[0] || '' });
    setDvFormError('');
    setDvFormSuccess('');
    setShowDvForm(true);
  };

  const handleSaveDv = async () => {
    if (!dvForm.dv_amount || !dvForm.expiry_date) {
      setDvFormError('Amount and expiry date are required.');
      return;
    }
    setSavingDv(true);
    const payload = { dv_code: dvForm.dv_code.trim().toUpperCase(), dv_amount: Number(dvForm.dv_amount), status: dvForm.status, expiry_date: dvForm.expiry_date };
    let saveError: any = null;
    if (editingDv) {
      ({ error: saveError } = await supabase.from('discount_vouchers').update(payload).eq('id', editingDv.id));
    } else {
      ({ error: saveError } = await supabase.from('discount_vouchers').insert({ ...payload, times_used: 0 }));
    }
    if (saveError) { setDvFormError(saveError.message); }
    else {
      setDvFormSuccess(editingDv ? 'Voucher updated!' : 'Voucher created!');
      setShowDvForm(false);
      await loadDiscountVouchers();
    }
    setSavingDv(false);
  };

  const handleGenerateDvQr = async (dv: DiscountVoucher) => {
    setGeneratingQrId(dv.id);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(dv.dv_code)}`;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `${dv.dv_code}-qr.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setGeneratingQrId(null);
  };

  // ─── Testimonial CRUD ─────────────────────────────────────────────────────────
  const openAddTestimonialForm = () => {
    setEditingTestimonial(null);
    setTestimonialForm({ quote: '', name: '', role: '', avatar_url: '', rating: 5, is_active: true, display_order: '0' });
    setTestimonialFormError('');
    setTestimonialFormSuccess('');
    setShowTestimonialForm(true);
  };

  const openEditTestimonialForm = (t: Testimonial) => {
    setEditingTestimonial(t);
    setTestimonialForm({
      quote: t.quote, name: t.name, role: t.role, avatar_url: t.avatar_url || '',
      rating: t.rating, is_active: t.is_active, display_order: String(t.display_order),
    });
    setTestimonialFormError('');
    setTestimonialFormSuccess('');
    setShowTestimonialForm(true);
  };

  const handleSaveTestimonial = async () => {
    if (!testimonialForm.quote.trim() || !testimonialForm.name.trim()) {
      setTestimonialFormError('Quote and name are required.');
      return;
    }
    setSavingTestimonial(true);
    const payload = {
      quote: testimonialForm.quote.trim(),
      name: testimonialForm.name.trim(),
      role: testimonialForm.role.trim(),
      avatar_url: testimonialForm.avatar_url.trim() || null,
      rating: testimonialForm.rating,
      is_active: testimonialForm.is_active,
      display_order: Number(testimonialForm.display_order),
    };
    let saveError: any = null;
    if (editingTestimonial) {
      ({ error: saveError } = await supabase.from('testimonials').update(payload).eq('id', editingTestimonial.id));
    } else {
      ({ error: saveError } = await supabase.from('testimonials').insert(payload));
    }
    if (saveError) { setTestimonialFormError(saveError.message); }
    else {
      setTestimonialFormSuccess(editingTestimonial ? 'Testimonial updated!' : 'Testimonial added!');
      setShowTestimonialForm(false);
      await loadTestimonials();
    }
    setSavingTestimonial(false);
  };

  const handleDeleteTestimonial = (t: Testimonial) => {
    setDeleteModal({
      open: true,
      title: 'Delete Testimonial',
      message: `Delete testimonial from "${t.name}"?`,
      onConfirm: async () => {
        setDeleteModal(prev => ({ ...prev, open: false }));
        await supabase.from('testimonials').delete().eq('id', t.id);
        await loadTestimonials();
      },
    });
  };

  // ─── Filtered data ────────────────────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const matchesSearch = !productSearchQuery || p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearchQuery.toLowerCase());
    const matchesCategory = staffProductCategory === 'All' || p.category === staffProductCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredStaff = staffMembers.filter(s =>
    !staffSearchQuery || s.full_name?.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(staffSearchQuery.toLowerCase())
  );

  const filteredCards = homepageCards.filter(c =>
    !homepageCardSearchQuery || c.title.toLowerCase().includes(homepageCardSearchQuery.toLowerCase())
  );

  const filteredVouchers = vouchers.filter(v =>
    !vouchersSearchQuery ||
    v.voucher_code.toLowerCase().includes(vouchersSearchQuery.toLowerCase()) ||
    v.customer_name.toLowerCase().includes(vouchersSearchQuery.toLowerCase()) ||
    v.customer_email.toLowerCase().includes(vouchersSearchQuery.toLowerCase())
  );

  const filteredDiscountVouchers = discountVouchers.filter(dv => {
    const isExpired = dv.expiry_date ? new Date(dv.expiry_date) < new Date(new Date().toDateString()) : false;
    if (dvFilterExpired === 'active' && isExpired) return false;
    if (dvFilterExpired === 'expired' && !isExpired) return false;
    return !dvSearchQuery || dv.dv_code.toLowerCase().includes(dvSearchQuery.toLowerCase());
  });

  const filteredTestimonials = testimonials.filter(t =>
    !testimonialSearchQuery ||
    t.name.toLowerCase().includes(testimonialSearchQuery.toLowerCase()) ||
    t.quote.toLowerCase().includes(testimonialSearchQuery.toLowerCase())
  );

  const filteredProductsOrderedRows = (() => {
    const q = reportingSearchQuery.toLowerCase();
    const fromTs = productsOrderedDateFrom ? new Date(productsOrderedDateFrom).getTime() : null;
    const toTs = productsOrderedDateTo ? new Date(productsOrderedDateTo + 'T23:59:59').getTime() : null;
    let rows = productsOrderedRows.filter(r => {
      if (q && !r.productName.toLowerCase().includes(q) && !r.clientName.toLowerCase().includes(q) && !r.clientEmail.toLowerCase().includes(q)) return false;
      if (fromTs !== null || toTs !== null) {
        const rowTs = r.orderedRaw ? new Date(r.orderedRaw).getTime() : null;
        if (rowTs === null) return false;
        if (fromTs !== null && rowTs < fromTs) return false;
        if (toTs !== null && rowTs > toTs) return false;
      }
      return true;
    });
    if (productsOrderedSort.col) {
      rows = [...rows].sort((a, b) => {
        let av = '', bv = '';
        if (productsOrderedSort.col === 'Product') { av = a.productName; bv = b.productName; }
        else if (productsOrderedSort.col === 'Ordered') { av = a.orderedRaw; bv = b.orderedRaw; }
        else if (productsOrderedSort.col === 'Delivered') { av = a.deliveredRaw; bv = b.deliveredRaw; }
        else if (productsOrderedSort.col === 'Client') { av = a.clientName; bv = b.clientName; }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return productsOrderedSort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  })();

  const filteredPackageMealsRows = (() => {
    const q = reportingSearchQuery.toLowerCase();
    const fromTs = packageMealsDateFrom ? new Date(packageMealsDateFrom).getTime() : null;
    const toTs = packageMealsDateTo ? new Date(packageMealsDateTo + 'T23:59:59').getTime() : null;
    let rows = packageMealsRows.filter(r => {
      if (q && !r.productName.toLowerCase().includes(q) && !r.clientName.toLowerCase().includes(q)) return false;
      if (fromTs !== null || toTs !== null) {
        const rowTs = r.orderedRaw ? new Date(r.orderedRaw).getTime() : null;
        if (rowTs === null) return false;
        if (fromTs !== null && rowTs < fromTs) return false;
        if (toTs !== null && rowTs > toTs) return false;
      }
      return true;
    });
    if (packageMealsSort.col) {
      rows = [...rows].sort((a, b) => {
        let av = '', bv = '';
        if (packageMealsSort.col === 'Product') { av = a.productName; bv = b.productName; }
        else if (packageMealsSort.col === 'Ordered') { av = a.orderedRaw; bv = b.orderedRaw; }
        else if (packageMealsSort.col === 'Delivered') { av = a.deliveredRaw; bv = b.deliveredRaw; }
        else if (packageMealsSort.col === 'Client') { av = a.clientName; bv = b.clientName; }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return packageMealsSort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  })();

  const filteredDiscountVouchersReportRows = (() => {
    const q = reportingSearchQuery.toLowerCase();
    const fromTs = discountVouchersDateFrom ? new Date(discountVouchersDateFrom).getTime() : null;
    const toTs = discountVouchersDateTo ? new Date(discountVouchersDateTo + 'T23:59:59').getTime() : null;
    let rows = discountVouchersReportRows.filter(r => {
      if (q && !r.dvCode.toLowerCase().includes(q) && !r.clientName.toLowerCase().includes(q)) return false;
      if (fromTs !== null || toTs !== null) {
        const rowTs = r.orderedRaw ? new Date(r.orderedRaw).getTime() : null;
        if (rowTs === null) return false;
        if (fromTs !== null && rowTs < fromTs) return false;
        if (toTs !== null && rowTs > toTs) return false;
      }
      return true;
    });
    if (discountVouchersSort.col) {
      rows = [...rows].sort((a, b) => {
        let av = '', bv = '';
        if (discountVouchersSort.col === 'Product') { av = a.productName; bv = b.productName; }
        else if (discountVouchersSort.col === 'Ordered') { av = a.orderedRaw; bv = b.orderedRaw; }
        else if (discountVouchersSort.col === 'Delivered') { av = a.deliveredRaw; bv = b.deliveredRaw; }
        else if (discountVouchersSort.col === 'Client') { av = a.clientName; bv = b.clientName; }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return discountVouchersSort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  })();

  // ─── Tab change handler ───────────────────────────────────────────────────────
  const handleTabChange = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    if (tab === 'staff') loadStaff();
    if (tab === 'homepage_cards') loadHomepageCards();
    if (tab === 'categories') loadCategories();
    if (tab === 'weekly_menu') loadWeeklyMenu();
    if (tab === 'vouchers') loadVouchers();
    if (tab === 'discount_vouchers') loadDiscountVouchers();
    if (tab === 'testimonials') loadTestimonials();
    if (tab === 'social_media') loadSocialLinks();
    if (tab === 'orders') loadWsOrders();
    if (tab === 'reporting') loadReporting();
    if (tab === 'analytics') loadAnalytics(analyticsPeriod);
    if (tab === 'gallery') loadGallery();
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
      {showInactivityWarning && (
        <InactivityWarningModal
          countdown={inactivityCountdown}
          onStayLoggedIn={resetInactivityTimer}
          onLogOut={handleLogout}
        />
      )}

      <div className="h-screen bg-[#F5F0E8] overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-[#DDD5C8] px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <AppLogo className="h-8 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-[#1A1612]">Staff Workspace</h1>
              {userProfile && (
                <p className="text-xs text-[#8C8278] mt-0.5">
                  {userProfile.full_name} · <RoleBadge role={userProfile.role} />
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/homepage')}
              className="text-sm text-[#5C5347] hover:text-[#C4622D] transition-colors"
            >
              View Site
            </button>
            <button
              onClick={handleLogout}
              className="text-sm bg-[#F5F0E8] border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors"
            >
              Log Out
            </button>
          </div>
        </header>

        <div className="flex h-[calc(100vh-73px)] overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-[#DDD5C8] h-full overflow-y-auto flex-shrink-0">
            <nav className="py-4 space-y-0.5">

              {/* ── Site Content (collapsible) ── */}
              <button
                onClick={() => setSiteContentOpen(prev => !prev)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  ['staff', 'homepage_cards', 'testimonials', 'social_media'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span className="text-base">📁</span>
                <span className="flex-1">Site Content</span>
                <span className="text-xs">{siteContentOpen ? '▲' : '▼'}</span>
              </button>
              {siteContentOpen && (
                <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                  {(userProfile?.role === 'super_admin' || userProfile?.role === 'admin') && (
                  <button
                    onClick={() => { handleTabChange('staff'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'staff' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">👥</span>
                    <span>Staff Management</span>
                  </button>
                  )}
                  <button
                    onClick={() => { handleTabChange('homepage_cards'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'homepage_cards' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">🏠</span>
                    <span>Home Page Cards</span>
                  </button>
                  <button
                    onClick={() => { handleTabChange('gallery'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'gallery' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">🖼️</span>
                    <span>Gallery</span>
                  </button>
                  {userProfile?.role === 'super_admin' && (
                    <button
                      onClick={() => { handleTabChange('testimonials'); }}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                        activeTab === 'testimonials' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                      }`}
                    >
                      <span className="text-base">⭐</span>
                      <span>Testimonials</span>
                    </button>
                  )}
                  {userProfile?.role === 'super_admin' && (
                    <button
                      onClick={() => { handleTabChange('social_media'); }}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                        activeTab === 'social_media' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                      }`}
                    >
                      <span className="text-base">🔗</span>
                      <span>Social Media</span>
                    </button>
                  )}
                </div>
              )}

              {/* ── Products & Pricing ── */}
              <button
                onClick={() => { handleTabChange('products'); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'products' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span className="text-base">🛒</span>
                <span>Products &amp; Pricing</span>
              </button>

              {/* ── Weekly Menu ── */}
              <button
                onClick={() => { handleTabChange('weekly_menu'); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'weekly_menu' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span className="text-base">📅</span>
                <span>Weekly Menu</span>
              </button>

              {/* ── ORDERS TAB */}
              <button
                onClick={() => { handleTabChange('orders'); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'orders' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span className="text-base">📦</span>
                <span>Orders</span>
              </button>

              {/* ── Vouchers (collapsible) ── */}
              <button
                onClick={() => setVouchersMenuOpen(prev => !prev)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  ['vouchers', 'discount_vouchers'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span className="text-base">🎟️</span>
                <span className="flex-1">Vouchers</span>
                <span className="text-xs">{vouchersMenuOpen ? '▲' : '▼'}</span>
              </button>
              {vouchersMenuOpen && (
                <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                  <button
                    onClick={() => { handleTabChange('vouchers'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'vouchers' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">🍽️</span>
                    <span>Meal Vouchers</span>
                  </button>
                  <button
                    onClick={() => { handleTabChange('discount_vouchers'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'discount_vouchers' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">🏷️</span>
                    <span>Discount Vouchers</span>
                  </button>
                </div>
              )}

              {/* ── Reports and Analytics (collapsible) ── */}
              <button
                onClick={() => setReportsMenuOpen(prev => !prev)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  ['reporting', 'analytics'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span className="text-base">📁</span>
                <span className="flex-1">Reports and Analytics</span>
                <span className="text-xs">{reportsMenuOpen ? '▲' : '▼'}</span>
              </button>
              {reportsMenuOpen && (
                <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                  <button
                    onClick={() => { handleTabChange('reporting'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'reporting' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">📊</span>
                    <span>Reports Dashboard</span>
                  </button>
                  <button
                    onClick={() => { handleTabChange('analytics'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'analytics' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">📈</span>
                    <span>Analytics</span>
                  </button>
                </div>
              )}

              {/* ── Customer Relations ── */}
              <button
                onClick={() => setMediaMenuOpen(prev => !prev)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  ['media', 'media_events', 'media_products'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span className="text-base">📄</span>
                <span className="flex-1">Customer Relations</span>
                <span className="text-xs">{mediaMenuOpen ? '▲' : '▼'}</span>
              </button>
              {mediaMenuOpen && (
                <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
                  <button
                    onClick={() => { handleTabChange('media_products'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'media_products' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">🛍️</span>
                    <span>Add Products</span>
                  </button>
                  <button
                    onClick={() => { handleTabChange('media_events'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'media_events' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">🗓️</span>
                    <span>Event Management</span>
                  </button>
                  <button
                    onClick={() => { handleTabChange('media'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'media' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">📁</span>
                    <span>Document Management</span>
                  </button>
                  <a
                    href="https://forms.gle/x572WQzUhJtvCn4i9"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]"
                  >
                    <span className="text-base">🤝</span>
                    <span>Customer Onboarding</span>
                    <span className="text-xs text-[#8C8278]">↗</span>
                  </a>
                </div>
              )}

            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 h-full overflow-y-auto">

            {/* ── PRODUCTS TAB ── */}
            {activeTab === 'products' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Products &amp; Pricing</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{products.length} products</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search products…"
                      value={productSearchQuery}
                      onChange={e => setProductSearchQuery(e.target.value)}
                      className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                    />
                    <button
                      onClick={openAddForm}
                      className="bg-[#C4622D] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                    >
                      + Add Product
                    </button>
                  </div>
                </div>

                {/* ── Category Filter Tabs ── */}
                {!showForm && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {(() => {
                      const desiredOrder = ['All', 'Packaged Meals', 'Voucher Meals', 'Frozen Meals', 'Prepared Meals', 'À La Carte'];
                      const available = ['All', ...categoryNames];
                      const displayCats = desiredOrder.filter(c => available.includes(c));
                      const getCatCount = (cat: string) =>
                        cat === 'All' ? products.length : products.filter(p => p.category === cat).length;
                      return displayCats.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setStaffProductCategory(cat)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                            staffProductCategory === cat
                              ? 'bg-[#C4622D] text-white shadow-sm'
                              : 'bg-white border border-[#DDD5C8] text-[#5C5347] hover:border-[#C4622D]/40 hover:text-[#C4622D]'
                          }`}
                        >
                          {cat}
                          <span className={`ml-1.5 text-xs ${staffProductCategory === cat ? 'text-white/70' : 'text-[#B5ADA5]'}`}>
                            ({getCatCount(cat)})
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                )}

                {showForm && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                    <h3 className="text-base font-bold text-[#1A1612] mb-4">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Name *</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Category</label>
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                          <option value="">-- Select Category --</option>
                          {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price (R) *</label>
                        <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Unit</label>
                        <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Tags (comma-separated)</label>
                        <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Badge</label>
                        <input value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Min Order</label>
                        <input type="number" value={form.min_order} onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sort Order</label>
                        <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Package Type</label>
                        <select value={form.package_type} onChange={e => setForm(f => ({ ...f, package_type: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                          {packageTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-[#5C5347] cursor-pointer">
                          <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="rounded" />
                          Available
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[#5C5347] cursor-pointer">
                          <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" />
                          Featured
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Product Image</label>
                        <input
                          ref={productImageRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPendingImageFile(file);
                              setPendingImagePreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        {pendingImagePreview && (
                          <img src={pendingImagePreview} alt="Preview" className={`w-full h-32 rounded-xl mb-2 border border-[#DDD5C8] bg-[#EDE7DA] ${form.image_fit === 'fit' ? 'object-contain' : 'object-cover'}`} />
                        )}
                        <button
                          type="button"
                          onClick={() => productImageRef.current?.click()}
                          className="text-sm text-[#C4622D] border border-[#C4622D] rounded-xl px-3 py-1.5 hover:bg-[#FDF6EE] transition-colors"
                        >
                          {pendingImagePreview ? 'Change Image' : 'Upload Image'}
                        </button>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-[#8C8278]">Display:</span>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, image_fit: 'fill' }))}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.image_fit !== 'fit' ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'bg-white text-[#5C5347] border-[#DDD5C8] hover:bg-[#F5F0E8]'}`}
                          >
                            Fill
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, image_fit: 'fit' }))}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.image_fit === 'fit' ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'bg-white text-[#5C5347] border-[#DDD5C8] hover:bg-[#F5F0E8]'}`}
                          >
                            Fit
                          </button>
                        </div>
                      </div>
                    </div>
                    {formError && <p className="text-red-600 text-sm mt-3">{formError}</p>}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={handleSaveProduct}
                        disabled={saving || uploadingImage}
                        className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Update Product'}
                      </button>
                      <button
                        onClick={() => { setShowForm(false); setEditingProduct(null); }}
                        className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Edit Product Modal ── */}
                {showEditModal && editingProduct && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-[#1A1612]">Edit Product</h3>
                        <button
                          onClick={() => { setShowEditModal(false); setEditingProduct(null); }}
                          className="text-[#8C8278] hover:text-[#1A1612] transition-colors text-xl font-bold leading-none"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Name *</label>
                          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Category</label>
                          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                            <option value="">-- Select Category --</option>
                            {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price (R) *</label>
                          <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Unit</label>
                          <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Tags (comma-separated)</label>
                          <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Badge</label>
                          <input value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Min Order</label>
                          <input type="number" value={form.min_order} onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sort Order</label>
                          <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Package Type</label>
                          <select value={form.package_type} onChange={e => setForm(f => ({ ...f, package_type: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                            {packageTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-[#5C5347] cursor-pointer">
                            <input type="checkbox" checked={form.available} onChange={e => setForm(f => ({ ...f, available: e.target.checked }))} className="rounded" />
                            Available
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#5C5347] cursor-pointer">
                            <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" />
                            Featured
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Product Image</label>
                          <input
                            ref={productImageRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setPendingImageFile(file);
                                setPendingImagePreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                          {pendingImagePreview && (
                            <img src={pendingImagePreview} alt="Preview" className={`w-full h-32 rounded-xl mb-2 border border-[#DDD5C8] bg-[#EDE7DA] ${form.image_fit === 'fit' ? 'object-contain' : 'object-cover'}`} />
                          )}
                          <button
                            type="button"
                            onClick={() => productImageRef.current?.click()}
                            className="text-sm text-[#C4622D] border border-[#C4622D] rounded-xl px-3 py-1.5 hover:bg-[#FDF6EE] transition-colors"
                          >
                            {pendingImagePreview ? 'Change Image' : 'Upload Image'}
                          </button>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-[#8C8278]">Display:</span>
                            <button
                              type="button"
                              onClick={() => setForm(f => ({ ...f, image_fit: 'fill' }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.image_fit !== 'fit' ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'bg-white text-[#5C5347] border-[#DDD5C8] hover:bg-[#F5F0E8]'}`}
                            >
                              Fill
                            </button>
                            <button
                              type="button"
                              onClick={() => setForm(f => ({ ...f, image_fit: 'fit' }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.image_fit === 'fit' ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'bg-white text-[#5C5347] border-[#DDD5C8] hover:bg-[#F5F0E8]'}`}
                            >
                              Fit
                            </button>
                          </div>
                        </div>
                      </div>
                      {formError && <p className="text-red-600 text-sm mt-3">{formError}</p>}
                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={handleSaveProduct}
                          disabled={saving || uploadingImage}
                          className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Update Product'}
                        </button>
                        <button
                          onClick={() => { setShowEditModal(false); setEditingProduct(null); }}
                          className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {productsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredProducts.map(product => (
                      <div key={product.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded-xl border border-[#DDD5C8]" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-[#F5F0E8] border border-[#DDD5C8] flex items-center justify-center text-lg">🍽️</div>
                          )}
                          <div>
                            <p className="font-semibold text-[#1A1612] text-sm">{product.name}</p>
                            <p className="text-xs text-[#8C8278] mt-0.5">{product.category} · {formatCurrency(product.price)} {product.unit}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${product.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {product.available ? 'Available' : 'Unavailable'}
                              </span>
                              {product.featured && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Featured</span>}
                              {product.badge && <span className="text-xs bg-[#FDF6EE] text-[#C4622D] border border-[#EDE7DA] px-2 py-0.5 rounded-full">{product.badge}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditForm(product)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">Edit</button>
                          <button onClick={() => handleDeleteProduct(product)} className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">Delete</button>
                        </div>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="text-center py-16 text-[#8C8278]">
                        <p className="text-lg font-medium">No products found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── STAFF TAB ── */}
            {activeTab === 'staff' && (userProfile?.role === 'super_admin' || userProfile?.role === 'admin') && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Staff Management</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{staffMembers.length} members</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Search staff…"
                    value={staffSearchQuery}
                    onChange={e => setStaffSearchQuery(e.target.value)}
                    className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                  />
                </div>

                {/* Invite form */}
                <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                  <h3 className="text-base font-bold text-[#1A1612] mb-4">Invite Staff Member</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Full Name *</label>
                      <input value={inviteForm.full_name} onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Email *</label>
                      <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Phone Number</label>
                      <input type="tel" value={inviteForm.phone_number} onChange={e => setInviteForm(f => ({ ...f, phone_number: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="+27..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Role</label>
                      <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as StaffRole }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  {inviteSuccess && <p className="text-sm text-green-600 mt-3">{inviteSuccess}</p>}
                  <button
                    onClick={handleInviteStaff}
                    disabled={inviting}
                    className="mt-4 bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                  >
                    {inviting ? 'Sending…' : 'Send Invite'}
                  </button>
                </div>

                {staffLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : staffMembers.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]">
                    <p className="text-lg font-medium">No staff members found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staffMembers.map(member => (
                      <div key={member.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-[#1A1612] text-sm">{member.full_name}</p>
                          <p className="text-xs text-[#8C8278] mt-0.5">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <RoleBadge role={member.role} />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {member.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        {member.role !== 'super_admin' && (() => {
                          const isSelf = userProfile?.id === member.id;
                          const canDeactivate = userProfile?.role === 'super_admin' || !isSelf;
                          return (
                            <button
                              onClick={() => canDeactivate && handleToggleStaffActive(member)}
                              disabled={togglingStaffId === member.id || !canDeactivate}
                              title={!canDeactivate ? 'Only Super Admin can deactivate this account' : undefined}
                              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors disabled:opacity-50 ${
                                !canDeactivate
                                  ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                                  : member.is_active
                                    ? 'border-red-200 text-red-600 hover:bg-red-50' :'border-green-200 text-green-600 hover:bg-green-50'
                              }`}
                            >
                              {member.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          );
                        })()}
                        {userProfile?.role === 'super_admin' && (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              onClick={() => handleResetPassword(member)}
                              disabled={sendingResetId === member.id}
                              className="text-xs px-3 py-1.5 rounded-xl border border-[#C4622D] text-[#C4622D] hover:bg-[#FDF6EE] font-semibold transition-colors disabled:opacity-50"
                            >
                              {sendingResetId === member.id ? 'Sending…' : 'Reset Password'}
                            </button>
                            {resetMessages[member.id]?.text && (
                              <span className={`text-xs ${resetMessages[member.id].type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                                {resetMessages[member.id].text}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredStaff.length === 0 && (
                      <div className="text-center py-16 text-[#8C8278]">
                        <p className="text-lg font-medium">No staff members found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── HOMEPAGE CARDS TAB ── */}
            {activeTab === 'homepage_cards' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Home Page Cards</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">Manage the cards displayed on the homepage</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Search cards…"
                    value={homepageCardSearchQuery}
                    onChange={e => setHomepageCardSearchQuery(e.target.value)}
                    className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                  />
                </div>

                {editingCard && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                    <h3 className="text-base font-bold text-[#1A1612] mb-4">Edit Card: {CARD_TYPE_ICONS[editingCard.card_type]} {CARD_TYPE_LABELS[editingCard.card_type]}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Title</label>
                        <input value={cardForm.title || ''} onChange={e => setCardForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Subtitle</label>
                        <input value={cardForm.subtitle || ''} onChange={e => setCardForm(f => ({ ...f, subtitle: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                        <textarea value={cardForm.description || ''} onChange={e => setCardForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      {editingCard.card_type === 'todays_special' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price</label>
                            <input type="number" value={cardForm.price || ''} onChange={e => setCardForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Badge Label</label>
                            <input value={cardForm.badge_label || ''} onChange={e => setCardForm(f => ({ ...f, badge_label: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-[#5C5347] mb-2">Card Image</label>
                            <input
                              ref={cardImageRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setCardImageFile(file);
                                  const reader = new FileReader();
                                  reader.onload = ev => setCardImagePreview(ev.target?.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <div className="flex items-center gap-4">
                              {(cardImagePreview || cardForm.image_path) && (
                                <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#DDD5C8] flex-shrink-0">
                                  <img
                                    src={cardImagePreview || ''}
                                    alt="Today's Special preview"
                                    className="w-full h-full object-cover"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                  {!cardImagePreview && cardForm.image_path && (
                                    <div className="w-full h-full bg-[#F5F0E8] flex items-center justify-center text-xs text-[#8C8278]">Image set</div>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => cardImageRef.current?.click()}
                                  className="text-sm text-[#C4622D] border border-[#C4622D] rounded-xl px-3 py-1.5 hover:bg-[#FDF6EE] transition-colors"
                                >
                                  {cardForm.image_path || cardImagePreview ? 'Change Image' : 'Upload Image'}
                                </button>
                                {(cardForm.image_path || cardImagePreview) && (
                                  <button
                                    type="button"
                                    onClick={() => { setCardImageFile(null); setCardImagePreview(null); setCardForm(f => ({ ...f, image_path: null })); }}
                                    className="text-xs text-red-500 border border-red-200 rounded-xl px-3 py-1 hover:bg-red-50 transition-colors"
                                  >
                                    Remove Image
                                  </button>
                                )}
                              </div>
                            </div>
                            {cardImageFile && <p className="text-xs text-[#8C8278] mt-1">{cardImageFile.name}</p>}
                            {!cardImagePreview && cardForm.image_path && (
                              <p className="text-xs text-[#8C8278] mt-1">Current image stored — upload a new one to replace it.</p>
                            )}
                          </div>
                        </>
                      )}
                      {editingCard.card_type === 'next_booking' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Event Date</label>
                            <input type="date" value={cardForm.event_date?.split('T')[0] || ''} onChange={e => setCardForm(f => ({ ...f, event_date: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Guest Count</label>
                            <input type="number" value={cardForm.guest_count || ''} onChange={e => setCardForm(f => ({ ...f, guest_count: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                        </>
                      )}
                      {editingCard.card_type === 'customer_review' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Reviewer Name</label>
                            <input value={cardForm.reviewer_name || ''} onChange={e => setCardForm(f => ({ ...f, reviewer_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#5C5347] mb-1">Rating (1-5)</label>
                            <input type="number" min={1} max={5} value={cardForm.rating || 5} onChange={e => setCardForm(f => ({ ...f, rating: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                          </div>
                        </>
                      )}
                    </div>
                    {cardFormSuccess && <p className="text-sm text-green-600 mt-3">{cardFormSuccess}</p>}
                    <div className="flex items-center gap-3 mt-4">
                      <button onClick={handleSaveCard} disabled={savingCard || uploadingCardImage} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                        {uploadingCardImage ? 'Uploading…' : savingCard ? 'Saving…' : 'Save Card'}
                      </button>
                      <button onClick={() => { setEditingCard(null); setCardImageFile(null); setCardImagePreview(null); }} className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                    </div>
                  </div>
                )}

                {cardsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredCards.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]">
                    <p className="text-lg font-medium">No cards found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCards.map(card => (
                      <div key={card.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{CARD_TYPE_ICONS[card.card_type]}</span>
                            <p className="font-semibold text-[#1A1612] text-sm">{card.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${card.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {card.is_visible ? 'Visible' : 'Hidden'}
                            </span>
                          </div>
                          <p className="text-xs text-[#8C8278] mt-0.5">{CARD_TYPE_LABELS[card.card_type]}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleCardVisibility(card)}
                            disabled={togglingCardId === card.id}
                            className="text-xs border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-xl hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
                          >
                            {card.is_visible ? 'Hide' : 'Show'}
                          </button>
                          <button onClick={() => openEditCardForm(card)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">Edit</button>
                        </div>
                      </div>
                    ))}
                    {filteredCards.length === 0 && (
                      <div className="text-center py-16 text-[#8C8278]">
                        <p className="text-lg font-medium">No cards found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── TESTIMONIALS TAB ── */}
            {activeTab === 'testimonials' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Testimonials</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{testimonials.length} testimonials</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search testimonials…"
                      value={testimonialSearchQuery}
                      onChange={e => setTestimonialSearchQuery(e.target.value)}
                      className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                    />
                    <button onClick={openAddTestimonialForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">
                      + Add Testimonial
                    </button>
                  </div>
                </div>

                {showTestimonialForm && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                    <h3 className="text-base font-bold text-[#1A1612] mb-4">{editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Quote *</label>
                        <textarea value={testimonialForm.quote} onChange={e => setTestimonialForm(f => ({ ...f, quote: e.target.value }))} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Name *</label>
                        <input value={testimonialForm.name} onChange={e => setTestimonialForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Role/Title</label>
                        <input value={testimonialForm.role} onChange={e => setTestimonialForm(f => ({ ...f, role: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Avatar URL</label>
                        <input value={testimonialForm.avatar_url} onChange={e => setTestimonialForm(f => ({ ...f, avatar_url: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Rating (1-5)</label>
                        <input type="number" min={1} max={5} value={testimonialForm.rating} onChange={e => setTestimonialForm(f => ({ ...f, rating: Number(e.target.value) }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Display Order</label>
                        <input type="number" value={testimonialForm.display_order} onChange={e => setTestimonialForm(f => ({ ...f, display_order: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-[#5C5347] cursor-pointer">
                          <input type="checkbox" checked={testimonialForm.is_active} onChange={e => setTestimonialForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                          Active
                        </label>
                      </div>
                    </div>
                    {testimonialFormError && <p className="text-sm text-red-600 mt-3">{testimonialFormError}</p>}
                    {testimonialFormSuccess && <p className="text-sm text-green-600 mt-3">{testimonialFormSuccess}</p>}
                    <div className="flex items-center gap-3 mt-4">
                      <button onClick={handleSaveTestimonial} disabled={savingTestimonial} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                        {savingTestimonial ? 'Saving…' : editingTestimonial ? 'Update' : 'Add Testimonial'}
                      </button>
                      <button onClick={() => setShowTestimonialForm(false)} className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                    </div>
                  </div>
                )}

                {testimonialsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredTestimonials.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]">
                    <p className="text-lg font-medium">No testimonials found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTestimonials.map(t => (
                      <div key={t.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {t.avatar_url ? (
                            <img src={t.avatar_url} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-[#DDD5C8]" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#F5F0E8] border border-[#DDD5C8] flex items-center justify-center text-lg">👤</div>
                          )}
                          <div>
                            <p className="font-semibold text-[#1A1612] text-sm">{t.name}</p>
                            <p className="text-xs text-[#8C8278]">{t.role}</p>
                            <p className="text-xs text-[#B5ADA5] mt-0.5 line-clamp-1">{t.quote}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {t.is_active ? 'Active' : 'Hidden'}
                          </span>
                          <button onClick={() => openEditTestimonialForm(t)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">Edit</button>
                          <button onClick={() => handleDeleteTestimonial(t)} className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">Delete</button>
                        </div>
                      </div>
                    ))}
                    {filteredTestimonials.length === 0 && (
                      <div className="text-center py-16 text-[#8C8278]">
                        <p className="text-lg font-medium">No testimonials found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── WEEKLY MENU TAB ── */}
            {activeTab === 'weekly_menu' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Weekly Menu</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">Manage the weekly meal schedule</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setWeekOffset(w => w - 1)} className="text-sm border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-xl hover:bg-[#F5F0E8] transition-colors">← Prev</button>
                    <button onClick={() => setWeekOffset(0)} className="text-sm border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-xl hover:bg-[#F5F0E8] transition-colors">This Week</button>
                    <button onClick={() => setWeekOffset(w => w + 1)} className="text-sm border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-xl hover:bg-[#F5F0E8] transition-colors">Next →</button>
                  </div>
                </div>

                {showWeeklyMenuForm && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                    <h3 className="text-base font-bold text-[#1A1612] mb-4">{editingWeeklyEntry ? 'Edit Menu Entry' : `Add Entry for ${weeklyMenuForm.day_name}`}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Meal Name</label>
                        <input value={weeklyMenuForm.meal_name} onChange={e => setWeeklyMenuForm(f => ({ ...f, meal_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Price (R)</label>
                        <input type="number" value={weeklyMenuForm.price} onChange={e => setWeeklyMenuForm(f => ({ ...f, price: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                        <textarea value={weeklyMenuForm.description} onChange={e => setWeeklyMenuForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-[#5C5347] cursor-pointer">
                          <input type="checkbox" checked={weeklyMenuForm.is_closed} onChange={e => setWeeklyMenuForm(f => ({ ...f, is_closed: e.target.checked }))} className="rounded" />
                          Mark as Closed
                        </label>
                      </div>
                      {weeklyMenuForm.is_closed && (
                        <div>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Closed Reason</label>
                          <input value={weeklyMenuForm.closed_reason} onChange={e => setWeeklyMenuForm(f => ({ ...f, closed_reason: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <button onClick={handleSaveWeeklyMenuEntry} disabled={savingWeeklyEntry} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                        {savingWeeklyEntry ? 'Saving…' : editingWeeklyEntry ? 'Update Entry' : 'Add Entry'}
                      </button>
                      <button onClick={() => setShowWeeklyMenuForm(false)} className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                    </div>
                  </div>
                )}

                {weeklyMenuLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getWeekDays().map(day => {
                      const entries = weeklyMenuEntries.filter(e => e.meal_date === day.date);
                      return (
                        <div key={day.date} className="bg-white rounded-2xl border border-[#EDE7DA] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-semibold text-[#1A1612] text-sm">{day.dayName}</p>
                              <p className="text-xs text-[#8C8278]">{day.shortDate}</p>
                            </div>
                            <button
                              onClick={() => openAddWeeklyMenuForm(day.date, day.dayName)}
                              className="text-xs text-[#C4622D] hover:underline"
                            >
                              + Add
                            </button>
                          </div>
                          {entries.length === 0 ? (
                            <p className="text-xs text-[#B5ADA5] italic">No entries for this day</p>
                          ) : (
                            <div className="space-y-2">
                              {entries.map(entry => (
                                <div key={entry.id} className="flex items-center justify-between bg-[#F5F0E8] rounded-xl px-3 py-2">
                                  <div>
                                    {entry.is_closed ? (
                                      <p className="text-sm font-medium text-red-600">🔒 Closed{entry.closed_reason ? ` — ${entry.closed_reason}` : ''}</p>
                                    ) : (
                                      <>
                                        <p className="text-sm font-medium text-[#1A1612]">{entry.meal_name}</p>
                                        {entry.description && <p className="text-xs text-[#8C8278]">{entry.description}</p>}
                                        {entry.price && <p className="text-xs font-semibold text-[#C4622D]">{formatCurrency(entry.price)}</p>}
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => openEditWeeklyMenuForm(entry)} className="text-xs text-[#C4622D] hover:underline">Edit</button>
                                    <button onClick={() => handleDeleteWeeklyEntry(entry)} disabled={deletingWeeklyEntryId === entry.id} className="text-xs text-red-600 hover:underline disabled:opacity-50">Delete</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── ORDERS TAB */}
            {activeTab === 'orders' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Orders</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{wsOrders.length} orders</p>
                  </div>
                  <button
                    onClick={loadWsOrders}
                    className="text-sm border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors"
                  >
                    ↻ Refresh
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-5">
                  <input
                    type="text"
                    placeholder="Search orders…"
                    value={wsOrderSearch}
                    onChange={e => setWsOrderSearch(e.target.value)}
                    className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white min-w-[200px]"
                  />
                  <select
                    value={wsFilterPayment}
                    onChange={e => setWsFilterPayment(e.target.value)}
                    className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                  >
                    <option value="all">All Payments</option>
                    {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
                  </select>
                  <select
                    value={wsFilterFulfillment}
                    onChange={e => setWsFilterFulfillment(e.target.value)}
                    className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                  >
                    <option value="all">All Fulfillment</option>
                    {FULFILLMENT_OPTIONS.map(s => <option key={s} value={s}>{FULFILLMENT_STATUS_LABELS[s]}</option>)}
                  </select>
                </div>

                {wsOrdersLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : wsOrdersError ? (
                  <div className="text-center py-16 text-red-500">
                    <p className="text-sm">{wsOrdersError}</p>
                  </div>
                ) : wsFilteredOrders.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]">
                    <p className="text-lg font-medium">No orders found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wsFilteredOrders.map(order => {
                      const expanded = wsExpandedOrderId === order.id;
                      const updateState = getWsOrderUpdateState(order.id);
                      return (
                        <div key={order.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                          <button
                            onClick={() => setWsExpandedOrderId(expanded ? null : order.id)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF5EE] transition-colors text-left"
                          >
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="font-semibold text-[#1A1612] text-sm">{order.customer_name}</p>
                                <p className="text-xs text-[#8C8278] mt-0.5">{order.customer_email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>
                                {PAYMENT_STATUS_LABELS[order.payment_status]}
                              </span>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${FULFILLMENT_STATUS_COLORS[order.fulfillment_status]}`}>
                                {FULFILLMENT_STATUS_LABELS[order.fulfillment_status]}
                              </span>
                              <span className="text-sm font-bold text-[#C4622D]">{formatCurrency(order.total)}</span>
                              <svg className={`w-4 h-4 text-[#8C8278] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          {expanded && (
                            <div className="border-t border-[#EDE7DA] px-5 py-4 space-y-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <p className="text-[#8C8278] mb-0.5">Order ID</p>
                                  <p className="font-mono text-[#1A1612] font-semibold text-xs">{order.id.slice(0, 8)}…</p>
                                </div>
                                <div>
                                  <p className="text-[#8C8278] mb-0.5">Phone</p>
                                  <p className="font-semibold text-[#1A1612]">{order.customer_phone || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-[#8C8278] mb-0.5">Ordered</p>
                                  <p className="font-semibold text-[#1A1612]">{formatDate(order.created_at)}</p>
                                </div>
                                <div>
                                  <p className="text-[#8C8278] mb-0.5">Event Date</p>
                                  <p className="font-semibold text-[#1A1612]">{formatDate(order.event_date)}</p>
                                </div>
                                {order.delivery_address && (
                                  <div className="col-span-2">
                                    <p className="text-[#8C8278] mb-0.5">Delivery Address</p>
                                    <p className="font-semibold text-[#1A1612]">{order.delivery_address}</p>
                                  </div>
                                )}
                                {order.notes && (
                                  <div className="col-span-2">
                                    <p className="text-[#8C8278] mb-0.5">Notes</p>
                                    <p className="font-semibold text-[#1A1612]">{order.notes}</p>
                                  </div>
                                )}
                              </div>

                              {/* Items */}
                              <div>
                                <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Items</p>
                                <div className="space-y-1">
                                  {(order.items || []).map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[#F0EBE3] last:border-0">
                                      <span className="text-[#1A1612]">{item.quantity}× {item.name}</span>
                                      <span className="font-semibold text-[#1A1612]">{formatCurrency(item.price * item.quantity)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between text-xs pt-1 font-bold text-[#1A1612]">
                                    <span>Total</span>
                                    <span>{formatCurrency(order.total)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Status updates */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-semibold text-[#5C5347] mb-2">Update Fulfillment</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {FULFILLMENT_OPTIONS.map(s => (
                                      <button
                                        key={s}
                                        onClick={() => handleWsFulfillmentUpdate(order.id, s)}
                                        disabled={updateState.fulfillmentSaving || order.fulfillment_status === s}
                                        className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors disabled:opacity-50 ${
                                          order.fulfillment_status === s
                                            ? FULFILLMENT_STATUS_COLORS[s] + 'cursor-default' :'border-[#DDD5C8] text-[#5C5347] hover:bg-[#F5F0E8]'
                                        }`}
                                      >
                                        {FULFILLMENT_STATUS_LABELS[s]}
                                      </button>
                                    ))}
                                  </div>
                                  {updateState.fulfillmentSuccess && <p className="text-xs text-green-600 mt-1">✓ Updated</p>}
                                  {updateState.fulfillmentError && <p className="text-xs text-red-500 mt-1">{updateState.fulfillmentError}</p>}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-[#5C5347] mb-2">Update Payment</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {PAYMENT_OPTIONS.map(s => (
                                      <button
                                        key={s}
                                        onClick={() => handleWsPaymentUpdate(order.id, s)}
                                        disabled={updateState.paymentSaving || order.payment_status === s}
                                        className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors disabled:opacity-50 ${
                                          order.payment_status === s
                                            ? PAYMENT_STATUS_COLORS[s] + 'cursor-default' :'border-[#DDD5C8] text-[#5C5347] hover:bg-[#F5F0E8]'
                                        }`}
                                      >
                                        {PAYMENT_STATUS_LABELS[s]}
                                      </button>
                                    ))}
                                  </div>
                                  {updateState.paymentSuccess && <p className="text-xs text-green-600 mt-1">✓ Updated</p>}
                                  {updateState.paymentError && <p className="text-xs text-red-500 mt-1">{updateState.paymentError}</p>}
                                </div>
                              </div>

                              {/* Delete Order — Super Admin only */}
                              {userProfile?.role === 'super_admin' && (
                                <div className="flex justify-end pt-2 border-t border-[#F0EBE3]">
                                  <button
                                    onClick={() => setDeleteOrderId(order.id)}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-black text-white bg-black hover:bg-gray-800 font-semibold transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Order
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── MEAL VOUCHERS TAB */}
            {activeTab === 'vouchers' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Meal Vouchers</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{vouchers.length} vouchers</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search vouchers…"
                      value={vouchersSearchQuery}
                      onChange={e => setVouchersSearchQuery(e.target.value)}
                      className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                    />
                    <button onClick={loadVouchers} className="text-sm border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">↻ Refresh</button>
                  </div>
                </div>

                {/* Issue Voucher Form */}
                <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                  <h3 className="text-base font-bold text-[#1A1612] mb-4">Issue New Meal Voucher</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Customer Name *</label>
                      <input value={issueVoucherForm.customer_name} onChange={e => setIssueVoucherForm(f => ({ ...f, customer_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Customer Email *</label>
                      <input type="email" value={issueVoucherForm.customer_email} onChange={e => setIssueVoucherForm(f => ({ ...f, customer_email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Phone</label>
                      <input value={issueVoucherForm.customer_phone} onChange={e => setIssueVoucherForm(f => ({ ...f, customer_phone: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Total Meals *</label>
                      <input type="number" value={issueVoucherForm.total_meals} onChange={e => setIssueVoucherForm(f => ({ ...f, total_meals: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Notes</label>
                      <textarea value={issueVoucherForm.notes} onChange={e => setIssueVoucherForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                  </div>
                  {issueVoucherSuccess && <p className="text-sm text-green-600 mt-3">{issueVoucherSuccess}</p>}
                  <button
                    onClick={async () => {
                      if (!issueVoucherForm.customer_name.trim() || !issueVoucherForm.customer_email.trim() || !issueVoucherForm.total_meals) {
                        showIssueVoucherError('Name, email, and total meals are required.');
                        return;
                      }
                      setIssuingVoucher(true);
                      const code = 'MV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                      const { error } = await supabase.from('vouchers').insert({
                        voucher_code: code,
                        customer_name: issueVoucherForm.customer_name.trim(),
                        customer_email: issueVoucherForm.customer_email.trim(),
                        customer_phone: issueVoucherForm.customer_phone.trim(),
                        total_meals: Number(issueVoucherForm.total_meals),
                        meals_remaining: Number(issueVoucherForm.total_meals),
                        status: 'unpaid',
                        notes: issueVoucherForm.notes.trim() || null,
                      });
                      if (error) { showIssueVoucherError(error.message); }
                      else {
                        setIssueVoucherSuccess(`Voucher ${code} issued!`);
                        setIssueVoucherForm({ customer_name: '', customer_email: '', customer_phone: '', total_meals: '', notes: '' });
                        await loadVouchers();
                      }
                      setIssuingVoucher(false);
                    }}
                    disabled={issuingVoucher}
                    className="mt-4 bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                  >
                    {issuingVoucher ? 'Issuing…' : 'Issue Voucher'}
                  </button>
                </div>

                {vouchersLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredVouchers.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]">
                    <p className="text-lg font-medium">No vouchers found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredVouchers.map(v => {
                      const isSelected = selectedVoucher?.id === v.id;
                      return (
                        <div key={v.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                          <button
                            onClick={() => {
                              if (isSelected) { setSelectedVoucher(null); setVoucherRedemptions([]); }
                              else {
                                setSelectedVoucher(v);
                                setRedemptionsLoading(true);
                                supabase.from('voucher_redemptions').select('*').eq('voucher_code', v.voucher_code).order('redeemed_at', { ascending: false })
                                  .then(({ data }) => { setVoucherRedemptions(data || []); setRedemptionsLoading(false); });
                              }
                            }}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF5EE] transition-colors text-left"
                          >
                            <div>
                              <p className="font-semibold text-[#1A1612] text-sm">{v.customer_name}</p>
                              <p className="text-xs text-[#8C8278] mt-0.5">{v.customer_email}</p>
                              <p className="text-xs font-mono text-[#C4622D] mt-0.5">{v.voucher_code}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-bold text-[#1A1612]">{v.meals_remaining}/{v.total_meals} meals</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                  v.status === 'paid' ? 'bg-green-100 text-green-700' :
                                  v.status === 'redeemed' ? 'bg-blue-100 text-blue-700' :
                                  v.status === 'expired'? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'
                                }`}>{v.status}</span>
                              </div>
                              <svg className={`w-4 h-4 text-[#8C8278] transition-transform ${isSelected ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          {isSelected && (
                            <div className="border-t border-[#EDE7DA] px-5 py-4 space-y-4">
                              <div className="flex items-center gap-3 flex-wrap">
                                {v.status === 'unpaid' && (
                                  <button
                                    onClick={async () => {
                                      setMarkingVoucherPaidId(v.id);
                                      setLoadingMarkingPaid(true);
                                      await supabase.from('vouchers').update({ status: 'paid' }).eq('id', v.id);
                                      await loadVouchers();
                                      setSelectedVoucher(prev => prev ? { ...prev, status: 'paid' } : null);
                                      setLoadingMarkingPaid(false);
                                      setMarkingVoucherPaidId(null);
                                    }}
                                    disabled={loadingMarkingPaid && markingVoucherPaidId === v.id}
                                    className="text-xs bg-green-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                                  >
                                    {loadingMarkingPaid && markingVoucherPaidId === v.id ? 'Marking…' : 'Mark as Paid'}
                                  </button>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-3">Redemption History</p>
                                {redemptionsLoading ? (
                                  <div className="flex items-center justify-center py-6">
                                    <div className="w-6 h-6 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                                  </div>
                                ) : voucherRedemptions.length === 0 ? (
                                  <p className="text-xs text-[#B5ADA5] italic">No redemptions yet</p>
                                ) : (
                                  <div className="space-y-2">
                                    {voucherRedemptions.map((r, i) => (
                                      <RedemptionAuditRow key={r.id} redemption={r} index={i + 1} />
                                    ))}
                                  </div>
                                )}
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

            {/* ── DISCOUNT VOUCHERS TAB */}
            {activeTab === 'discount_vouchers' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Discount Vouchers</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{discountVouchers.length} vouchers</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search discount vouchers…"
                      value={dvSearchQuery}
                      onChange={e => setDvSearchQuery(e.target.value)}
                      className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                    />
                    <div className="flex items-center gap-1 bg-[#F5EFE7] rounded-xl p-1">
                      <button
                        onClick={() => setDvFilterExpired('all')}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${dvFilterExpired === 'all' ? 'bg-white text-[#C4622D] shadow-sm' : 'text-[#8C8278] hover:text-[#1A1612]'}`}
                      >All</button>
                      <button
                        onClick={() => setDvFilterExpired('active')}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${dvFilterExpired === 'active' ? 'bg-white text-green-700 shadow-sm' : 'text-[#8C8278] hover:text-[#1A1612]'}`}
                      >Active</button>
                      <button
                        onClick={() => setDvFilterExpired('expired')}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${dvFilterExpired === 'expired' ? 'bg-white text-red-600 shadow-sm' : 'text-[#8C8278] hover:text-[#1A1612]'}`}
                      >Expired</button>
                    </div>
                    <button
                      onClick={() => { setEditingDv(null); setDvForm({ dv_code: '', dv_type: 'Discount', dv_amount: '', status: 'Active', expiry_date: '' }); setDvFormError(''); setDvFormSuccess(''); setShowDvForm(true); }}
                      className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
                    >
                      + Add Voucher
                    </button>
                  </div>
                </div>

                {showDvForm && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                    <h3 className="text-base font-bold text-[#1A1612] mb-4">{editingDv ? 'Edit Discount Voucher' : 'Add Discount Voucher'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Voucher Type *</label>
                        <select value={dvForm.dv_type} onChange={e => setDvForm(f => ({ ...f, dv_type: e.target.value as 'Discount' | 'Gift', dv_code: '' }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                          <option value="Discount">Discount</option>
                          <option value="Gift">Gift</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Amount (R) *</label>
                        <input type="number" value={dvForm.dv_amount} onChange={e => setDvForm(f => ({ ...f, dv_amount: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Status</label>
                        <select value={dvForm.status} onChange={e => setDvForm(f => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Expiry Date *</label>
                        <input type="date" value={dvForm.expiry_date} onChange={e => setDvForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                      </div>
                      {dvForm.dv_code && (
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1">Generated Voucher Code</label>
                          <div className="w-full border border-[#C4622D] rounded-xl px-3 py-2 text-sm bg-[#FDF8F3] text-[#C4622D] font-mono font-bold tracking-wider">{dvForm.dv_code}</div>
                        </div>
                      )}
                    </div>
                    {dvFormError && <p className="text-sm text-red-600 mt-3">{dvFormError}</p>}
                    {dvFormSuccess && <p className="text-sm text-green-600 mt-3">{dvFormSuccess}</p>}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={async () => {
                          if (!dvForm.dv_amount || !dvForm.expiry_date) { setDvFormError('Amount and expiry date are required.'); return; }
                          setSavingDv(true);
                          const year = new Date().getFullYear();
                          const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
                          const prefix = dvForm.dv_type === 'Gift' ? 'GV' : 'DV';
                          const generatedCode = editingDv ? dvForm.dv_code : `${prefix}-${year}-${randomPart}`;
                          const payload = { dv_code: generatedCode, dv_amount: Number(dvForm.dv_amount), status: dvForm.status, expiry_date: dvForm.expiry_date };
                          let inlineError: any = null;
                          if (editingDv) {
                            ({ error: inlineError } = await supabase.from('discount_vouchers').update(payload).eq('id', editingDv.id));
                          } else {
                            ({ error: inlineError } = await supabase.from('discount_vouchers').insert({ ...payload, times_used: 0 }));
                          }
                          if (inlineError) { setDvFormError(inlineError.message); setSavingDv(false); return; }
                          setDvForm(f => ({ ...f, dv_code: generatedCode }));
                          setDvFormSuccess(editingDv ? 'Voucher updated!' : `Voucher created! Code: ${generatedCode}`);
                          setShowDvForm(false);
                          await loadDiscountVouchers();
                          setSavingDv(false);
                        }}
                        disabled={savingDv}
                        className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                      >
                        {savingDv ? 'Saving…' : editingDv ? 'Update' : 'Create Voucher'}
                      </button>
                      <button onClick={() => setShowDvForm(false)} className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                    </div>
                  </div>
                )}

                {dvLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredDiscountVouchers.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]">
                    <p className="text-lg font-medium">No discount vouchers found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDiscountVouchers.map(dv => {
                      const isExpiredDv = dv.expiry_date ? new Date(dv.expiry_date) < new Date(new Date().toDateString()) : false;
                      return (
                      <div key={dv.id} className={`bg-white rounded-2xl border p-4 flex items-center justify-between ${isExpiredDv ? 'border-red-200 bg-red-50/30' : 'border-[#EDE7DA]'}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#1A1612] text-sm font-mono">{dv.dv_code}</p>
                            {isExpiredDv && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600 border border-red-200">Expired</span>
                            )}
                          </div>
                          <p className="text-xs text-[#8C8278] mt-0.5">R{Number(dv.dv_amount).toFixed(2)} · Expires {formatDate(dv.expiry_date)} · Used {dv.times_used ?? 0}×</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${!isExpiredDv && dv.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {isExpiredDv ? 'Inactive' : dv.status}
                          </span>
                          <button
                            onClick={() => { setEditingDv(dv); setDvForm({ dv_code: dv.dv_code, dv_type: dv.dv_code.startsWith('GV-') ? 'Gift' : 'Discount', dv_amount: String(dv.dv_amount), status: dv.status, expiry_date: dv.expiry_date?.split('T')[0] || '' }); setDvFormError(''); setDvFormSuccess(''); setShowDvForm(true); }}
                            className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteModal({ open: true, title: 'Delete Discount Voucher', message: `Delete voucher "${dv.dv_code}"?`, onConfirm: async () => { setDeleteModal(prev => ({ ...prev, open: false })); await supabase.from('discount_vouchers').delete().eq('id', dv.id); await loadDiscountVouchers(); } })}
                            className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── REPORTING TAB */}
            {activeTab === 'reporting' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Reports Dashboard</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">Detailed order and voucher reports</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Search reports…"
                      value={reportingSearchQuery}
                      onChange={e => setReportingSearchQuery(e.target.value)}
                      className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                    />
                    <button onClick={loadReporting} className="text-sm border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">↻ Refresh</button>
                  </div>
                </div>

                {/* Report sub-tabs */}
                <div className="flex gap-2 mb-6 flex-wrap">
                  {([
                    { key: 'products_ordered', label: 'Products Ordered' },
                    { key: 'package_meals_ordered', label: 'Package Meals' },
                    { key: 'discount_vouchers_report', label: 'Discount Vouchers' },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setReportingView(tab.key)}
                      className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-colors ${
                        reportingView === tab.key
                          ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'bg-black text-white border-black hover:bg-gray-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Products Ordered */}
                {reportingView === 'products_ordered' && (
                  <div>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-sm font-semibold text-[#1A1612]">Products Ordered ({filteredProductsOrderedRows.length})</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" value={productsOrderedDateFrom} onChange={e => setProductsOrderedDateFrom(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C4622D] bg-white" />
                        <span className="text-xs text-[#8C8278]">to</span>
                        <input type="date" value={productsOrderedDateTo} onChange={e => setProductsOrderedDateTo(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C4622D] bg-white" />
                        <button onClick={() => downloadProductsOrderedPDF(filteredProductsOrderedRows)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">⬇ PDF</button>
                      </div>
                    </div>
                    {productsOrderedLoading ? (
                      <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-[#EDE7DA]">
                        <table className="w-full text-xs">
                          <thead className="bg-[#F5F0E8]">
                            <tr>
                              {['Product', 'Type', 'Item', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Client', 'Email'].map(h => {
                                const sortable = ['Product', 'Ordered', 'Delivered', 'Client'].includes(h);
                                const isActive = productsOrderedSort.col === h;
                                return (
                                  <th key={h} onClick={sortable ? () => setProductsOrderedSort(prev => ({ col: h, dir: prev.col === h && prev.dir === 'asc' ? 'desc' : 'asc' })) : undefined} className={`px-3 py-2.5 text-left font-semibold text-[#5C5347] whitespace-nowrap${sortable ? ' cursor-pointer select-none hover:text-[#C4622D]' : ''}`}>
                                    {h}{sortable && <span className="ml-1 text-[10px]">{isActive ? (productsOrderedSort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProductsOrderedRows.length === 0 ? (
                              <tr><td colSpan={9} className="text-center py-8 text-[#8C8278]">No data</td></tr>
                            ) : filteredProductsOrderedRows.map((r, i) => (
                              <tr key={i} className="border-t border-[#F0EBE3] hover:bg-[#FAF5EE]">
                                <td className="px-3 py-2 font-medium text-[#1A1612]">{r.productName}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.productType}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.item}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.mealVoucher || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.discountVoucher || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347] whitespace-nowrap">{r.orderedDate}</td>
                                <td className="px-3 py-2 text-[#5C5347] whitespace-nowrap">{r.deliveredDt || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.clientName}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.clientEmail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Package Meals Ordered */}
                {reportingView === 'package_meals_ordered' && (
                  <div>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-sm font-semibold text-[#1A1612]">Package Meals Ordered ({filteredPackageMealsRows.length})</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" value={packageMealsDateFrom} onChange={e => setPackageMealsDateFrom(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C4622D] bg-white" />
                        <span className="text-xs text-[#8C8278]">to</span>
                        <input type="date" value={packageMealsDateTo} onChange={e => setPackageMealsDateTo(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C4622D] bg-white" />
                        <button onClick={() => downloadPackageMealsPDF(filteredPackageMealsRows)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">⬇ PDF</button>
                      </div>
                    </div>
                    {packageMealsLoading ? (
                      <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-[#EDE7DA]">
                        <table className="w-full text-xs">
                          <thead className="bg-[#F5F0E8]">
                            <tr>
                              {['Product', 'Type', 'Item', 'Package', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Client', 'Email'].map(h => {
                                const sortable = ['Product', 'Ordered', 'Delivered', 'Client'].includes(h);
                                const isActive = packageMealsSort.col === h;
                                return (
                                  <th key={h} onClick={sortable ? () => setPackageMealsSort(prev => ({ col: h, dir: prev.col === h && prev.dir === 'asc' ? 'desc' : 'asc' })) : undefined} className={`px-3 py-2.5 text-left font-semibold text-[#5C5347] whitespace-nowrap${sortable ? ' cursor-pointer select-none hover:text-[#C4622D]' : ''}`}>
                                    {h}{sortable && <span className="ml-1 text-[10px]">{isActive ? (packageMealsSort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPackageMealsRows.length === 0 ? (
                              <tr><td colSpan={10} className="text-center py-8 text-[#8C8278]">No data</td></tr>
                            ) : filteredPackageMealsRows.map((r, i) => (
                              <tr key={i} className="border-t border-[#F0EBE3] hover:bg-[#FAF5EE]">
                                <td className="px-3 py-2 font-medium text-[#1A1612]">{r.productName}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.productType}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.item}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.packagePurchased}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.mealVoucher || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.discountVoucher || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347] whitespace-nowrap">{r.orderedDate}</td>
                                <td className="px-3 py-2 text-[#5C5347] whitespace-nowrap">{r.deliveredDt || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.clientName}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.clientEmail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Discount Vouchers Report */}
                {reportingView === 'discount_vouchers_report' && (
                  <div>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-sm font-semibold text-[#1A1612]">Discount Vouchers ({filteredDiscountVouchersReportRows.length})</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" value={discountVouchersDateFrom} onChange={e => setDiscountVouchersDateFrom(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C4622D] bg-white" />
                        <span className="text-xs text-[#8C8278]">to</span>
                        <input type="date" value={discountVouchersDateTo} onChange={e => setDiscountVouchersDateTo(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#C4622D] bg-white" />
                        <button onClick={() => downloadDiscountVouchersPDF(filteredDiscountVouchersReportRows)} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">⬇ PDF</button>
                      </div>
                    </div>
                    {discountVouchersReportLoading ? (
                      <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-[#EDE7DA]">
                        <table className="w-full text-xs">
                          <thead className="bg-[#F5F0E8]">
                            <tr>
                              {['Code', 'Amount', 'Expiry', 'Product', 'Type', 'Item', 'Ordered', 'Delivered', 'Client', 'Email'].map(h => {
                                const sortable = ['Product', 'Ordered', 'Delivered', 'Client'].includes(h);
                                const isActive = discountVouchersSort.col === h;
                                return (
                                  <th key={h} onClick={sortable ? () => setDiscountVouchersSort(prev => ({ col: h, dir: prev.col === h && prev.dir === 'asc' ? 'desc' : 'asc' })) : undefined} className={`px-3 py-2.5 text-left font-semibold text-[#5C5347] whitespace-nowrap${sortable ? ' cursor-pointer select-none hover:text-[#C4622D]' : ''}`}>
                                    {h}{sortable && <span className="ml-1 text-[10px]">{isActive ? (discountVouchersSort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDiscountVouchersReportRows.length === 0 ? (
                              <tr><td colSpan={10} className="text-center py-8 text-[#8C8278]">No data</td></tr>
                            ) : filteredDiscountVouchersReportRows.map((r, i) => (
                              <tr key={i} className="border-t border-[#F0EBE3] hover:bg-[#FAF5EE]">
                                <td className="px-3 py-2 font-mono font-semibold text-[#C4622D]">{r.dvCode}</td>
                                <td className="px-3 py-2 text-[#1A1612]">R{r.dvAmount.toFixed(2)}</td>
                                <td className="px-3 py-2 text-[#5C5347] whitespace-nowrap">{r.expiryDate}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.productName || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.productType}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.item}</td>
                                <td className="px-3 py-2 text-[#5C5347] whitespace-nowrap">{r.orderedDate}</td>
                                <td className="px-3 py-2 text-[#5C5347] whitespace-nowrap">{r.deliveredDt || '—'}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.clientName}</td>
                                <td className="px-3 py-2 text-[#5C5347]">{r.clientEmail}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Analytics</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">Performance overview and trends</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(['7d', '30d', '90d', '12m'] as AnalyticsPeriod[]).map(p => (
                      <button
                        key={p}
                        onClick={() => { setAnalyticsPeriod(p); loadAnalytics(p); }}
                        className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-colors ${
                          analyticsPeriod === p ? 'bg-[#C4622D] text-white border-[#C4622D]' : 'border-[#DDD5C8] text-[#5C5347] hover:bg-[#F5F0E8]'
                        }`}
                      >
                        {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : p === '90d' ? 'Last 90 Days' : 'Last 12 Months'}
                      </button>
                    ))}
                    <button
                      onClick={() => loadAnalytics(analyticsPeriod)}
                      className="text-xs border border-[#DDD5C8] text-[#5C5347] px-3 py-1.5 rounded-xl hover:bg-[#F5F0E8] transition-colors"
                    >
                      ↻ Refresh
                    </button>
                  </div>
                </div>

                {analyticsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : analyticsError ? (
                  <div className="text-center py-16 text-red-500">
                    <p className="text-sm">{analyticsError}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {summaryMetrics.map((m, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-[#EDE7DA] p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{m.icon}</span>
                            <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wide">{m.label}</p>
                          </div>
                          <p className="text-2xl font-bold text-[#1A1612]">{m.value}</p>
                          {m.sub && <p className="text-xs text-[#8C8278] mt-0.5">{m.sub}</p>}
                        </div>
                      ))}
                    </div>

                    {/* Order Trends Chart */}
                    <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                      <h3 className="text-sm font-bold text-[#1A1612] mb-4">Order Trends</h3>
                      {orderTrend.length === 0 ? (
                        <p className="text-xs text-[#8C8278] text-center py-8">No order data for this period</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={orderTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <RechartsTooltip content={<AnalyticsTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="orders" name="Orders" stroke="#C4622D" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Revenue Chart */}
                    <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                      <h3 className="text-sm font-bold text-[#1A1612] mb-4">Revenue</h3>
                      {orderTrend.length === 0 ? (
                        <p className="text-xs text-[#8C8278] text-center py-8">No revenue data for this period</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={orderTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#8C8278' }} tickFormatter={(v) => `R${v}`} />
                            <RechartsTooltip content={<AnalyticsTooltip />} />
                            <Bar dataKey="revenue" name="Revenue" fill="#C4622D" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Voucher Usage Chart */}
                    <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                      <h3 className="text-sm font-bold text-[#1A1612] mb-4">Voucher Usage</h3>
                      {voucherUsage.length === 0 ? (
                        <p className="text-xs text-[#8C8278] text-center py-8">No voucher data for this period</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={voucherUsage} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#8C8278' }} />
                            <RechartsTooltip content={<AnalyticsTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="mealVouchers" name="Meal Vouchers" fill="#C4622D" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="discountVouchers" name="Discount Vouchers" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Fulfillment Breakdown */}
                    {fulfillmentMetrics.length > 0 && (
                      <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                        <h3 className="text-sm font-bold text-[#1A1612] mb-4">Fulfillment Breakdown</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {fulfillmentMetrics.map((m, i) => (
                            <div key={i} className="flex items-center gap-3 bg-[#F5F0E8] rounded-xl px-3 py-2.5">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                              <div>
                                <p className="text-xs font-semibold text-[#1A1612]">{m.count}</p>
                                <p className="text-xs text-[#8C8278]">{m.status}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SOCIAL LINKS TAB */}
            {activeTab === 'social_media' && userProfile?.role === 'super_admin' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Social Media Links</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Update the URLs for each social media icon displayed in the footer</p>
                </div>

                {socialLinksLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 max-w-xl">
                    <div className="space-y-4">
                      {socialLinks.filter(s => s.platform !== 'pinterest').map(s => (
                        <div key={s.platform}>
                          <label className="block text-xs font-semibold text-[#5C5347] mb-1 capitalize">
                            {s.platform === 'twitter' ? 'X / Twitter' : s.platform === 'custom' ? 'Site Favicon Link' : s.platform} URL
                          </label>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-[#DDD5C8]${s.platform !== 'custom' ? ' bg-black' : ''}`}>
                              {s.platform === 'facebook' && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
                                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                              )}
                              {s.platform === 'twitter' && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
                                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                              )}
                              {s.platform === 'instagram' && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                                  <circle cx="12" cy="12" r="4"/>
                                  <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
                                </svg>
                              )}
                              {s.platform === 'custom' && (
                                <img src="/favicon.ico" alt="Site favicon" className="w-4 h-4 object-contain" />
                              )}
                            </div>
                            <input
                              type="url"
                              value={socialLinksForm[s.platform] || ''}
                              onChange={e => setSocialLinksForm(prev => ({ ...prev, [s.platform]: e.target.value }))}
                              placeholder={`https://...`}
                              className="flex-1 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 focus:border-[#C4622D]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {socialLinksError && (
                      <p className="text-red-600 text-xs mt-3">{socialLinksError}</p>
                    )}
                    {socialLinksSuccess && (
                      <p className="text-green-600 text-xs mt-3">Social links saved!</p>
                    )}
                    <div className="mt-5 flex justify-end">
                      <button
                        onClick={handleSaveSocialLinks}
                        disabled={socialLinksSaving}
                        className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                      >
                        {socialLinksSaving ? 'Saving…' : 'Save Links'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── GALLERY TAB ── */}
            {activeTab === 'gallery' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Gallery</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">Manage homepage gallery images</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Section visibility toggle */}
                    <div className="flex items-center gap-2 bg-white border border-[#DDD5C8] rounded-xl px-4 py-2">
                      <span className="text-xs font-semibold text-[#5C5347]">Show Gallery on Homepage</span>
                      <button
                        onClick={() => handleToggleGallerySectionVisible(!gallerySectionVisible)}
                        disabled={gallerySettingsSaving}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${gallerySectionVisible ? 'bg-[#C4622D]' : 'bg-[#DDD5C8]'}`}
                        aria-label="Toggle gallery visibility"
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${gallerySectionVisible ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <button
                      onClick={openAddGalleryForm}
                      className="bg-[#C4622D] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#A04E22] transition-colors"
                    >
                      + Add Image
                    </button>
                  </div>
                </div>

                {/* Add / Edit Form */}
                {showGalleryForm && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-[#1A1612]">{editingGalleryImage ? 'Edit Gallery Image' : 'Add Gallery Image'}</h3>
                      <button onClick={() => { setShowGalleryForm(false); setEditingGalleryImage(null); }} className="text-[#8C8278] hover:text-[#1A1612] text-xl font-bold leading-none">×</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Title *</label>
                        <input
                          value={galleryForm.title}
                          onChange={e => setGalleryForm(f => ({ ...f, title: e.target.value }))}
                          className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                          placeholder="e.g. Wedding Banquet Setup"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Sort Order</label>
                        <input
                          type="number"
                          value={galleryForm.sort_order}
                          onChange={e => setGalleryForm(f => ({ ...f, sort_order: e.target.value }))}
                          className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Description</label>
                        <textarea
                          value={galleryForm.description}
                          onChange={e => setGalleryForm(f => ({ ...f, description: e.target.value }))}
                          rows={3}
                          className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                          placeholder="Describe what is shown in this image…"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Image {!editingGalleryImage && '*'}</label>
                        <input
                          ref={galleryImageRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setGalleryImageFile(file);
                              setGalleryImagePreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        {galleryImagePreview && (
                          <img src={galleryImagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl mb-2 border border-[#DDD5C8]" />
                        )}
                        <button
                          type="button"
                          onClick={() => galleryImageRef.current?.click()}
                          className="text-sm text-[#C4622D] border border-[#C4622D] rounded-xl px-3 py-1.5 hover:bg-[#FDF6EE] transition-colors"
                        >
                          {galleryImagePreview ? 'Change Image' : 'Upload Image'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                        <label className="flex items-center gap-2 text-sm text-[#5C5347] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={galleryForm.is_visible}
                            onChange={e => setGalleryForm(f => ({ ...f, is_visible: e.target.checked }))}
                            className="rounded"
                          />
                          Visible on homepage
                        </label>
                      </div>
                    </div>
                    {galleryFormError && <p className="text-red-600 text-sm mt-3">{galleryFormError}</p>}
                    {galleryFormSuccess && <p className="text-green-600 text-sm mt-3">{galleryFormSuccess}</p>}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={handleSaveGalleryImage}
                        disabled={savingGallery || uploadingGalleryImage}
                        className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                      >
                        {savingGallery ? 'Saving…' : editingGalleryImage ? 'Update Image' : 'Add Image'}
                      </button>
                      <button
                        onClick={() => { setShowGalleryForm(false); setEditingGalleryImage(null); }}
                        className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {galleryLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : galleryImages.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]">
                    <span className="text-4xl">🖼️</span>
                    <p className="text-lg font-medium mt-3">No gallery images yet</p>
                    <p className="text-sm mt-1">Add your first image to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {galleryImages.map(img => (
                      <div key={img.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                        <div className="relative h-44 bg-[#F5F0E8]">
                          {img.imageUrl ? (
                            <img src={img.imageUrl} alt={img.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">🖼️</div>
                          )}
                          <div className="absolute top-2 right-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${img.is_visible ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {img.is_visible ? 'Visible' : 'Hidden'}
                            </span>
                          </div>
                        </div>
                        <div className="p-4">
                          <p className="font-semibold text-[#1A1612] text-sm truncate">{img.title}</p>
                          {img.description && <p className="text-xs text-[#8C8278] mt-1 line-clamp-2">{img.description}</p>}
                          <p className="text-xs text-[#B5ADA5] mt-1 font-mono">Sort: {img.sort_order}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => openEditGalleryForm(img)}
                              className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleGalleryImageVisible(img)}
                              className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${img.is_visible ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                            >
                              {img.is_visible ? 'Hide' : 'Show'}
                            </button>
                            <button
                              onClick={() => handleDeleteGalleryImage(img)}
                              className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── DOCUMENT MANAGEMENT TAB ── */}
            {activeTab === 'media' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Document Management</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Manage and view documents from Google Drive</p>
                </div>
                <GoogleDriveDocuments isSuperAdmin={userProfile?.role === 'super_admin' || user?.email === 'admin@cardamomkitchen.co.za'} />
              </div>
            )}

            {/* ── ADD EVENTS TAB ── */}
            {activeTab === 'media_events' && (
              <EventManagement />
            )}

            {/* ── MEDIA PRODUCTS TAB ── */}
            {activeTab === 'media_products' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Add Products</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Manage products available in the store</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center">
                  <span className="text-4xl">🛍️</span>
                  <p className="text-[#8C8278] mt-3 text-sm">Switch to the Products tab to manage your product catalog.</p>
                  <button
                    onClick={() => handleTabChange('products')}
                    className="mt-4 bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors"
                  >
                    Go to Products
                  </button>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}
