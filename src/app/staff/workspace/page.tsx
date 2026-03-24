'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import GoogleDriveDocuments from './components/GoogleDriveDocuments';
import EventManagement from './components/EventManagement';



type BucketType = 'product-images' | 'event-photos' | 'document-management';
type WorkspaceTab = 'products' | 'media' | 'media_events' | 'media_products' | 'orders' | 'staff' | 'homepage_cards' | 'categories' | 'weekly_menu' | 'vouchers' | 'discount_vouchers' | 'testimonials' | 'reporting' | 'analytics' | 'social_media';

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
  deliveredDt: string;
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
  deliveredDt: string;
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
  deliveredDt: string;
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
};

const emptyInviteForm = {
  full_name: '',
  email: '',
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
  const [dvForm, setDvForm] = useState({ dv_code: '', dv_amount: '', status: 'Active\' as \'Active\' | \'Inactive', expiry_date: '' });
  const [dvFormError, setDvFormError] = useState('');
  const [dvFormSuccess, setDvFormSuccess] = useState('');
  const [savingDv, setSavingDv] = useState(false);
  const [dvSearchQuery, setDvSearchQuery] = useState('');
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

  // Orders tab state
  const [wsOrders, setWsOrders] = useState<Order[]>([]);
  const [wsOrdersLoading, setWsOrdersLoading] = useState(false);
  const [wsOrdersError, setWsOrdersError] = useState('');
  const [wsExpandedOrderId, setWsExpandedOrderId] = useState<string | null>(null);
  const [wsOrderUpdateStates, setWsOrderUpdateStates] = useState<Record<string, OrderUpdateState>>({});
  const [wsOrderSearch, setWsOrderSearch] = useState('');
  const [wsFilterPayment, setWsFilterPayment] = useState<string>('all');
  const [wsFilterFulfillment, setWsFilterFulfillment] = useState<string>('all');

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

  const downloadProductsOrderedPDF = () => {
    const headers = ['Product', 'Type', 'Item', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Client', 'eMail'];
    const rows = productsOrderedRows.map(r => [
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
    printReportPDF('Products Ordered', headers, rows);
  };

  const downloadPackageMealsPDF = () => {
    const headers = ['Product', 'Type', 'Item', 'Package', 'Meal Voucher', 'Discount Voucher', 'Ordered', 'Delivered', 'Client', 'eMail'];
    const rows = packageMealsRows.map(r => [
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
    printReportPDF('Package Meals Ordered', headers, rows);
  };

  const downloadDiscountVouchersPDF = () => {
    const headers = ['Discount Voucher', 'Amount', 'Expiry Date', 'Product Name', 'Type', 'Item', 'Ordered', 'Delivered', 'Client', 'eMail'];
    const rows = discountVouchersReportRows.map(r => [
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
    printReportPDF('Discount Vouchers', headers, rows);
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
    if (data) setStaffMembers(data);
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

  const handleSaveSocialLinks = async () => {
    setSocialLinksSaving(true);
    setSocialLinksError('');
    setSocialLinksSuccess('');
    const updates = socialLinks.filter(s => s.platform !== 'pinterest').map(s => ({
      id: s.id,
      platform: s.platform,
      url: socialLinksForm[s.platform] || '#',
      display_order: s.display_order,
    }));
    const { error } = await supabase.from('social_links').upsert(updates, { onConflict: 'id' });
    if (error) setSocialLinksError(error.message);
    else { setSocialLinksSuccess('Social links updated successfully!'); await loadSocialLinks(); }
    setSocialLinksSaving(false);
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
        deliveredDt: '',
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
              deliveredDt,
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
              deliveredDt,
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
    };
    let error;
    if (editingProduct) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editingProduct.id));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }
    if (error) { showProductFormError(error.message); }
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
    let error;
    if (editingCategory) {
      ({ error } = await supabase.from('product_categories').update(payload).eq('id', editingCategory.id));
    } else {
      ({ error } = await supabase.from('product_categories').insert(payload));
    }
    if (error) { showCategoryFormError(error.message); }
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

  // ─── Homepage Cards CRUD ──────────────────────────────────────────────────────
  const openEditCardForm = (card: HomepageCard) => {
    setEditingCard(card);
    setCardForm({ ...card });
    setCardFormError('');
    setCardFormSuccess('');
  };

  const handleSaveCard = async () => {
    if (!editingCard) return;
    setSavingCard(true);
    const { error } = await supabase.from('homepage_cards').update(cardForm).eq('id', editingCard.id);
    if (error) { showCardFormError(error.message); }
    else {
      setCardFormSuccess('Card updated!');
      setEditingCard(null);
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
    let error;
    if (editingWeeklyEntry) {
      ({ error } = await supabase.from('weekly_menu').update(payload).eq('id', editingWeeklyEntry.id));
    } else {
      ({ error } = await supabase.from('weekly_menu').insert(payload));
    }
    if (error) { showWeeklyMenuFormError(error.message); }
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
    setDvForm({ dv_code: '', dv_amount: '', status: 'Active' as 'Active' | 'Inactive', expiry_date: '' });
    setDvFormError('');
    setDvFormSuccess('');
    setShowDvForm(true);
  };

  const openEditDvForm = (dv: DiscountVoucher) => {
    setEditingDv(dv);
    setDvForm({ dv_code: dv.dv_code, dv_amount: String(dv.dv_amount), status: dv.status, expiry_date: dv.expiry_date?.split('T')[0] || '' });
    setDvFormError('');
    setDvFormSuccess('');
    setShowDvForm(true);
  };

  const handleSaveDv = async () => {
    if (!dvForm.dv_code.trim() || !dvForm.dv_amount || !dvForm.expiry_date) {
      setDvFormError('Code, amount, and expiry date are required.');
      return;
    }
    setSavingDv(true);
    const payload = { dv_code: dvForm.dv_code.trim().toUpperCase(), dv_amount: Number(dvForm.dv_amount), status: dvForm.status, expiry_date: dvForm.expiry_date };
    let error;
    if (editingDv) {
      ({ error } = await supabase.from('discount_vouchers').update(payload).eq('id', editingDv.id));
    } else {
      ({ error } = await supabase.from('discount_vouchers').insert(payload));
    }
    if (error) { setDvFormError(error.message); }
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
    let error;
    if (editingTestimonial) {
      ({ error } = await supabase.from('testimonials').update(payload).eq('id', editingTestimonial.id));
    } else {
      ({ error } = await supabase.from('testimonials').insert(payload));
    }
    if (error) { setTestimonialFormError(error.message); }
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
  const filteredProducts = products.filter(p =>
    !productSearchQuery || p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

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

  const filteredDiscountVouchers = discountVouchers.filter(dv =>
    !dvSearchQuery ||
    dv.dv_code.toLowerCase().includes(dvSearchQuery.toLowerCase())
  );

  const filteredTestimonials = testimonials.filter(t =>
    !testimonialSearchQuery ||
    t.name.toLowerCase().includes(testimonialSearchQuery.toLowerCase()) ||
    t.quote.toLowerCase().includes(testimonialSearchQuery.toLowerCase())
  );

  const filteredProductsOrderedRows = productsOrderedRows.filter(r => {
    const q = reportingSearchQuery.toLowerCase();
    return !q || r.productName.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q) || r.clientEmail.toLowerCase().includes(q);
  });

  const filteredPackageMealsRows = packageMealsRows.filter(r => {
    const q = reportingSearchQuery.toLowerCase();
    return !q || r.productName.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
  });

  const filteredDiscountVouchersReportRows = discountVouchersReportRows.filter(r => {
    const q = reportingSearchQuery.toLowerCase();
    return !q || r.dvCode.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
  });

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
        isOpen={deleteModal.open}
        title={deleteModal.title}
        message={deleteModal.message}
        onConfirm={deleteModal.onConfirm}
        onCancel={() => setDeleteModal(prev => ({ ...prev, open: false }))}
      />
      {showInactivityWarning && (
        <InactivityWarningModal
          countdown={inactivityCountdown}
          onStayLoggedIn={resetInactivityTimer}
          onLogOut={handleLogout}
        />
      )}

      <div className="min-h-screen bg-[#F5F0E8]">
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
              className="text-sm bg-[#F5F0E8] border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl hover:bg-[#EDE7DA] transition-colors"
            >
              Log Out
            </button>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-[#DDD5C8] min-h-[calc(100vh-73px)] sticky top-[73px] flex-shrink-0">
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
                  <button
                    onClick={() => { handleTabChange('staff'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'staff' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">👥</span>
                    <span>Staff Management</span>
                  </button>
                  <button
                    onClick={() => { handleTabChange('homepage_cards'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'homepage_cards' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">🏠</span>
                    <span>Home Page Cards</span>
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

              {/* ── Orders ── */}
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

              {/* ── Media Library ── */}
              <button
                onClick={() => setMediaMenuOpen(prev => !prev)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  ['media', 'media_events', 'media_products'].includes(activeTab) ? 'text-[#C4622D]' : 'text-[#5C5347] hover:text-[#C4622D] hover:bg-[#FAF5EE]'
                }`}
              >
                <span className="text-base">📄</span>
                <span className="flex-1">Media Library</span>
                <span className="text-xs">{mediaMenuOpen ? '▲' : '▼'}</span>
              </button>
              {mediaMenuOpen && (
                <div className="pl-4 border-l-2 border-[#E8DDD0] ml-4">
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
                  <button
                    onClick={() => { handleTabChange('media_products'); }}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left w-full ${
                      activeTab === 'media_products' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                    }`}
                  >
                    <span className="text-base">🛍️</span>
                    <span>Add Products</span>
                  </button>
                </div>
              )}

            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">

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
                          <img src={pendingImagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl mb-2 border border-[#DDD5C8]" />
                        )}
                        <button
                          type="button"
                          onClick={() => productImageRef.current?.click()}
                          className="text-sm text-[#C4622D] border border-[#C4622D] rounded-xl px-3 py-1.5 hover:bg-[#FDF6EE] transition-colors"
                        >
                          {pendingImagePreview ? 'Change Image' : 'Upload Image'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={handleSaveProduct}
                        disabled={saving || uploadingImage}
                        className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : editingProduct ? 'Update Product' : 'Add Product'}
                      </button>
                      <button
                        onClick={() => setShowForm(false)}
                        className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit Product Modal */}
                {showEditModal && editingProduct && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-[#1A1612]">Edit Product</h3>
                        <button
                          onClick={() => { setShowEditModal(false); setEditingProduct(null); }}
                          className="text-[#5C5347] hover:text-[#1A1612] transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
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
                            <img src={pendingImagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl mb-2 border border-[#DDD5C8]" />
                          )}
                          <button
                            type="button"
                            onClick={() => productImageRef.current?.click()}
                            className="text-sm text-[#C4622D] border border-[#C4622D] rounded-xl px-3 py-1.5 hover:bg-[#FDF6EE] transition-colors"
                          >
                            {pendingImagePreview ? 'Change Image' : 'Upload Image'}
                          </button>
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
            {activeTab === 'staff' && (
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Full Name *</label>
                      <input value={inviteForm.full_name} onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Email *</label>
                      <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
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
                        {member.role !== 'super_admin' && (
                          <button
                            onClick={() => handleToggleStaffActive(member)}
                            disabled={togglingStaffId === member.id}
                            className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors disabled:opacity-50 ${
                              member.is_active
                                ? 'border-red-200 text-red-600 hover:bg-red-50' :'border-green-200 text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {member.is_active ? 'Deactivate' : 'Activate'}
                          </button>
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
                      <button onClick={handleSaveCard} disabled={savingCard} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                        {savingCard ? 'Saving…' : 'Save Card'}
                      </button>
                      <button onClick={() => setEditingCard(null)} className="text-sm text-[#5C5347] border border-[#DDD5C8] px-4 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">Cancel</button>
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
                              className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors"
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

            {/* ── SOCIAL LINKS TAB ── */}
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
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
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
                              onChange={e => setSocialLinksForm(f => ({ ...f, [s.platform]: e.target.value }))}
                              placeholder="https://..."
                              className="flex-1 border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {socialLinksError && <p className="text-sm text-red-600 mt-4">{socialLinksError}</p>}
                    {socialLinksSuccess && <p className="text-sm text-green-600 mt-4">{socialLinksSuccess}</p>}

                    <div className="mt-6">
                      <button
                        onClick={handleSaveSocialLinks}
                        disabled={socialLinksSaving}
                        className="bg-[#C4622D] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
                      >
                        {socialLinksSaving ? 'Saving…' : 'Save Social Links'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYTICS TAB ── */}
            {activeTab === 'analytics' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Analytics</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">View site analytics and performance data</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#EDE7DA] p-8 text-center">
                  <span className="text-4xl">📈</span>
                  <p className="text-[#8C8278] mt-3 text-sm">Analytics data will appear here.</p>
                </div>
              </div>
            )}

            {/* ── DOCUMENT MANAGEMENT TAB ── */}
            {activeTab === 'media' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Document Management</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Manage and view documents from Google Drive</p>
                </div>
                <GoogleDriveDocuments isSuperAdmin={userProfile?.role === 'super_admin'} />
              </div>
            )}

            {/* ── ADD PRODUCTS (MEDIA LIBRARY) TAB ── */}
            {activeTab === 'media_products' && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-[#1A1612]">Add Products</h2>
                  <p className="text-sm text-[#8C8278] mt-0.5">Manage and add products to the catalogue</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E8DDD0] p-6 text-center">
                  <span className="text-4xl">🛍️</span>
                  <p className="text-[#5C5347] mt-3 text-sm">Use the <strong>Products</strong> section in the main menu to add and manage products.</p>
                  <button
                    onClick={() => handleTabChange('products')}
                    className="mt-4 px-5 py-2 bg-[#C4622D] text-white text-sm font-medium rounded-lg hover:bg-[#A0522D] transition-colors"
                  >
                    Go to Products
                  </button>
                </div>
              </div>
            )}

            {/* ── ADD EVENTS TAB ── */}
            {activeTab === 'media_events' && (
              <EventManagement />
            )}

            {/* ── ORDERS TAB ── */}
            {activeTab === 'orders' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Orders</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{wsFilteredOrders.length} orders</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Search by customer name, email, or order ID..."
                      value={wsOrderSearch}
                      onChange={e => setWsOrderSearch(e.target.value)}
                      className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white min-w-[240px]"
                    />
                    <select value={wsFilterPayment} onChange={e => setWsFilterPayment(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                      <option value="all">All Payments</option>
                      {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
                    </select>
                    <select value={wsFilterFulfillment} onChange={e => setWsFilterFulfillment(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white">
                      <option value="all">All Fulfillment</option>
                      {FULFILLMENT_OPTIONS.map(s => <option key={s} value={s}>{FULFILLMENT_STATUS_LABELS[s]}</option>)}
                    </select>
                    <button onClick={loadWsOrders} className="text-sm border border-[#DDD5C8] text-[#5C5347] px-3 py-2 rounded-xl hover:bg-[#F5F0E8] transition-colors">Refresh</button>
                  </div>
                </div>

                {wsOrdersLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : wsOrdersError ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{wsOrdersError}</div>
                ) : wsFilteredOrders.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]">
                    <p className="text-lg font-medium">No orders found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wsFilteredOrders.map((order) => (
                      <div key={order.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:border-[#C4622D] hover:shadow-md transition-all group"
                          onClick={() => setWsExpandedOrderId(wsExpandedOrderId === order.id ? null : order.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#C4622D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {order.id.slice(0, 2)}
                            </span>
                            <div>
                              <p className="font-semibold text-[#1A1612] text-sm">{order.customer_name}</p>
                              <p className="text-xs text-[#8C8278] mt-0.5">{order.customer_email}</p>
                              <p className="text-xs text-[#B5ADA5] mt-0.5">{formatDate(order.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#C4622D]">{formatCurrency(order.total)}</p>
                              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold border ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>
                                {PAYMENT_STATUS_LABELS[order.payment_status]}
                              </span>
                            </div>
                            <svg
                              className={`w-4 h-4 text-[#8C8278] transition-transform ${wsExpandedOrderId === order.id ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {wsExpandedOrderId === order.id && (
                          <div className="px-4 pb-4 bg-[#FDFAF6] border-t border-[#EDE7DA]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                              <div className="bg-white rounded-2xl border border-[#DDD5C8] p-4">
                                <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3">Customer Details</h4>
                                <div className="space-y-2">
                                  <div><p className="text-sm text-[#1A1612]"><span className="font-medium text-[#8C8278]">Name:</span> {order.customer_name || '—'}</p></div>
                                  <div><p className="text-sm text-[#1A1612] break-all"><span className="font-medium text-[#8C8278]">Email:</span> {order.customer_email || '—'}</p></div>
                                  <div><p className="text-sm text-[#1A1612]"><span className="font-medium text-[#8C8278]">Phone:</span> {order.customer_phone || '—'}</p></div>
                                  {order.event_date && <div><p className="text-sm text-[#1A1612]"><span className="font-medium text-[#8C8278]">Event Date:</span> {formatDate(order.event_date)}</p></div>}
                                  {order.delivered_date && <div><p className="text-sm text-[#1A1612]"><span className="font-medium text-[#8C8278]">Delivered Date:</span> {formatDate(order.delivered_date)}</p></div>}
                                  {order.delivery_address && <div><p className="text-sm text-[#1A1612]"><span className="font-medium text-[#8C8278]">Delivery Address:</span> {order.delivery_address}</p></div>}
                                  {order.notes && <div><p className="text-sm text-[#1A1612]"><span className="font-medium text-[#8C8278]">Notes:</span> {order.notes}</p></div>}
                                </div>
                              </div>

                              <div className="bg-white rounded-2xl border border-[#DDD5C8] p-4">
                                <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3">Order Items</h4>
                                {Array.isArray(order.items) && order.items.length > 0 ? (
                                  <div className="space-y-2">
                                    {order.items.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between py-1 border-b border-[#F0EBE3] last:border-0">
                                        <div className="flex items-center gap-2">
                                          <span className="w-5 h-5 rounded-full bg-[#EDE7DA] text-[#5C5347] text-xs font-bold flex items-center justify-center flex-shrink-0">{item.quantity}</span>
                                          <span className="text-sm text-[#1A1612]">{item.name}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-[#1A1612]">R{(item.price * item.quantity).toFixed(2)}</span>
                                      </div>
                                    ))}
                                    <div className="pt-2 flex justify-between text-sm font-bold text-[#1A1612]">
                                      <span>Total</span>
                                      <span className="text-[#C4622D]">R{(order.total || 0).toFixed(2)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-[#B5ADA5]">No items</p>
                                )}
                              </div>

                              <div className="bg-white rounded-2xl border border-[#DDD5C8] p-4 md:col-span-2">
                                <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3">Update Status</h4>
                                <div className="flex flex-wrap gap-4" onClick={(e) => e.stopPropagation()}>
                                  <div>
                                    <p className="text-xs text-[#B5ADA5] mb-1">Payment Status</p>
                                    <select
                                      value={order.payment_status}
                                      onChange={(e) => handleWsPaymentUpdate(order.id, e.target.value as PaymentStatus)}
                                      disabled={getWsOrderUpdateState(order.id).paymentSaving}
                                      className={`text-xs font-semibold border rounded-full px-3 py-1.5 focus:outline-none cursor-pointer disabled:opacity-50 ${PAYMENT_STATUS_COLORS[order.payment_status]}`}
                                    >
                                      {PAYMENT_OPTIONS.map((s) => (
                                        <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>
                                      ))}
                                    </select>
                                    {getWsOrderUpdateState(order.id).paymentSuccess && (
                                      <span className="text-xs text-green-600 ml-2">✓ Saved</span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-xs text-[#B5ADA5] mb-1">Fulfillment Status</p>
                                    {order.fulfillment_status === 'delivered' && userProfile?.role !== 'super_admin' ? (
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold border rounded-full px-3 py-1.5 ${FULFILLMENT_STATUS_COLORS['delivered']}`}>Delivered</span>
                                        <span className="text-xs text-[#8C8278]" title="Only Super Admin can change a Delivered order's fulfillment status">🔒</span>
                                      </div>
                                    ) : (
                                      <select
                                        value={order.fulfillment_status}
                                        onChange={(e) => handleWsFulfillmentUpdate(order.id, e.target.value as FulfillmentStatus)}
                                        disabled={getWsOrderUpdateState(order.id).fulfillmentSaving}
                                        className={`text-xs font-semibold border rounded-full px-3 py-1.5 focus:outline-none cursor-pointer disabled:opacity-50 ${FULFILLMENT_STATUS_COLORS[order.fulfillment_status]}`}
                                      >
                                        {FULFILLMENT_OPTIONS.map((s) => (
                                          <option key={s} value={s}>{FULFILLMENT_STATUS_LABELS[s]}</option>
                                        ))}
                                      </select>
                                    )}
                                    {getWsOrderUpdateState(order.id).fulfillmentSuccess && (
                                      <span className="text-xs text-green-600 ml-2">✓ Saved</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── MEAL VOUCHERS TAB ── */}
            {activeTab === 'vouchers' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1612]">Meal Vouchers</h2>
                    <p className="text-sm text-[#8C8278] mt-0.5">{vouchers.length} vouchers</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Search vouchers…"
                    value={vouchersSearchQuery}
                    onChange={e => setVouchersSearchQuery(e.target.value)}
                    className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                  />
                </div>

                {/* Issue voucher form */}
                <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                  <h3 className="text-base font-bold text-[#1A1612] mb-4">Issue New Voucher</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Customer Name *</label>
                      <input value={issueVoucherForm.customer_name} onChange={e => setIssueVoucherForm(f => ({ ...f, customer_name: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#5C5347] mb-1">Email *</label>
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
                      <input value={issueVoucherForm.notes} onChange={e => setIssueVoucherForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" />
                    </div>
                  </div>
                  {issueVoucherSuccess && <p className="text-sm text-green-600 mt-3">{issueVoucherSuccess}</p>}
                  <button
                    onClick={handleIssueVoucher}
                    disabled={issuingVoucher}
                    className="mt-4 bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50"
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
                    {filteredVouchers.map((voucher) => (
                      <div key={voucher.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:border-[#C4622D] hover:shadow-md transition-all group"
                          onClick={() => setWsExpandedOrderId(wsExpandedOrderId === voucher.id ? null : voucher.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#C4622D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {voucher.id.slice(0, 2)}
                            </span>
                            <div>
                              <p className="font-semibold text-[#1A1612] text-sm">{voucher.voucher_code}</p>
                              <p className="text-xs text-[#8C8278] mt-0.5">{voucher.customer_name}</p>
                              <p className="text-xs text-[#8C8278] mt-0.5">{voucher.total_meals} meals · {voucher.meals_remaining} remaining</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${
                                voucher.status === 'paid' ? 'bg-green-100 text-green-700' :
                                voucher.status === 'unpaid' ? 'bg-amber-100 text-amber-700' :
                                voucher.status === 'redeemed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                              }`}>{voucher.status}</span>
                            </div>
                            <svg
                              className={`w-4 h-4 text-[#8C8278] transition-transform ${wsExpandedOrderId === voucher.id ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {wsExpandedOrderId === voucher.id && (
                          <div className="px-4 pb-4 bg-[#FDFAF6] border-t border-[#EDE7DA]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                              <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                                <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3">Customer Details</h4>
                                <div className="space-y-2">
                                  <div><p className="text-sm text-[#1A1612]"><span className="font-medium text-[#8C8278]">Name:</span> {voucher.customer_name || '—'}</p></div>
                                  <div><p className="text-sm text-[#1A1612] break-all"><span className="font-medium text-[#8C8278]">Email:</span> {voucher.customer_email || '—'}</p></div>
                                  <div><p className="text-sm text-[#1A1612]"><span className="font-medium text-[#8C8278]">Phone:</span> {voucher.customer_phone || '—'}</p></div>
                                </div>
                              </div>
                              <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                                <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3">Voucher Details</h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Code</span><span className="font-mono font-bold text-[#C4622D]">{voucher.voucher_code}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Total Meals</span><span className="font-medium text-[#1A1612]">{voucher.total_meals}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Remaining</span><span className="font-medium text-[#1A1612]">{voucher.meals_remaining}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Status</span><span className={`font-semibold ${voucher.status === 'paid' ? 'text-green-600' : voucher.status === 'unpaid' ? 'text-amber-600' : 'text-blue-600'}`}>{voucher.status}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Purchased</span><span className="font-medium text-[#1A1612]">{formatDate(voucher.purchased_at)}</span></div>
                                  {voucher.notes && <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Notes</span><span className="font-medium text-[#1A1612] text-right max-w-[160px]">{voucher.notes}</span></div>}
                                </div>
                              </div>
                            </div>
                            {voucher.status === 'unpaid' && (
                              <div className="mt-3 flex justify-end">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMarkVoucherPaid(voucher); }}
                                  disabled={loadingMarkingPaid && markingVoucherPaidId === voucher.id}
                                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                                >
                                  Mark as Paid
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── DISCOUNT VOUCHERS TAB ── */}
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
                    <button onClick={openAddDvForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors">
                      + Create Voucher
                    </button>
                  </div>
                </div>

                {showDvForm && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-6 mb-6">
                    <h3 className="text-base font-bold text-[#1A1612] mb-4">{editingDv ? 'Edit Discount Voucher' : 'Create Discount Voucher'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Voucher Code *</label>
                        <input value={dvForm.dv_code} onChange={e => setDvForm(f => ({ ...f, dv_code: e.target.value }))} className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D]" placeholder="e.g. SAVE20" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#5C5347] mb-1">Discount Amount (R) *</label>
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
                    </div>
                    {dvFormError && <p className="text-sm text-red-600 mt-3">{dvFormError}</p>}
                    {dvFormSuccess && <p className="text-sm text-green-600 mt-3">{dvFormSuccess}</p>}
                    <div className="flex items-center gap-3 mt-4">
                      <button onClick={handleSaveDv} disabled={savingDv} className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-50">
                        {savingDv ? 'Saving…' : editingDv ? 'Update Voucher' : 'Create Voucher'}
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
                    {filteredDiscountVouchers.map((dv) => (
                      <div key={dv.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:border-[#C4622D] hover:shadow-md transition-all group"
                          onClick={() => setWsExpandedOrderId(wsExpandedOrderId === dv.id ? null : dv.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#C4622D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {dv.id.slice(0, 2)}
                            </span>
                            <div>
                              <p className="font-semibold text-[#1A1612] text-sm">{dv.dv_code}</p>
                              <p className="text-xs text-[#8C8278] mt-0.5">R{(dv.dv_amount || 0).toFixed(2)} discount</p>
                              <p className="text-xs text-[#8C8278] mt-0.5">{dv.status === 'Active' ? 'Active' : 'Inactive'} · {formatDate(dv.expiry_date)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${dv.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{dv.status}</span>
                            <svg
                              className={`w-4 h-4 text-[#8C8278] transition-transform ${wsExpandedOrderId === dv.id ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {wsExpandedOrderId === dv.id && (
                          <div className="px-4 pb-4 bg-[#FDFAF6] border-t border-[#EDE7DA]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                              <div className="bg-white rounded-xl border border-[#DDD5C8] p-4">
                                <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider mb-3">Voucher Details</h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Code</span><span className="font-mono font-bold text-[#C4622D]">{dv.dv_code}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Discount Amount</span><span className="font-medium text-[#1A1612]">R{(dv.dv_amount || 0).toFixed(2)}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Status</span><span className={`font-semibold ${dv.status === 'Active' ? 'text-green-600' : 'text-gray-500'}`}>{dv.status}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Expiry Date</span><span className="font-medium text-[#1A1612]">{formatDate(dv.expiry_date)}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Times Used</span><span className="font-medium text-[#1A1612]">{dv.times_used ?? 0}</span></div>
                                  <div className="flex justify-between text-sm"><span className="text-[#8C8278]">Created</span><span className="font-medium text-[#1A1612]">{formatDate(dv.created_at)}</span></div>
                                </div>
                              </div>
                              <div className="bg-white rounded-xl border border-[#DDD5C8] p-4 flex flex-col gap-3">
                                <h4 className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Actions</h4>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditDvForm(dv); }}
                                  className="w-full flex items-center justify-center gap-2 bg-[#C4622D] hover:bg-[#A04E22] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                                >
                                  Edit Voucher
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleGenerateDvQr(dv); }}
                                  disabled={generatingQrId === dv.id}
                                  className="w-full flex items-center justify-center gap-2 border border-[#DDD5C8] hover:border-[#C4622D] text-[#5C5347] hover:text-[#C4622D] px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                  {generatingQrId === dv.id ? 'Generating…' : 'Download QR Code'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── REPORTING TAB ── */}
            {activeTab === 'reporting' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#1A1612]">Reports Dashboard</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search reports…"
                      value={reportingSearchQuery}
                      onChange={e => setReportingSearchQuery(e.target.value)}
                      className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#C4622D] bg-white"
                    />
                    {reportingView === 'products_ordered' && (
                      <button onClick={downloadProductsOrderedPDF} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">Download PDF</button>
                    )}
                    {reportingView === 'package_meals_ordered' && (
                      <button onClick={downloadPackageMealsPDF} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">Download PDF</button>
                    )}
                    {reportingView === 'discount_vouchers_report' && (
                      <button onClick={downloadDiscountVouchersPDF} className="text-xs text-[#C4622D] border border-[#C4622D] px-3 py-1.5 rounded-xl hover:bg-[#FDF6EE] transition-colors">Download PDF</button>
                    )}
                  </div>
                </div>

                {reportingView === 'cards' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    <button
                      onClick={() => setReportingView('products_ordered')}
                      className="bg-white rounded-2xl border border-[#EDE7DA] p-6 text-left hover:border-[#C4622D] hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">🛒</span>
                        <h3 className="text-base font-bold text-[#1A1612] group-hover:text-[#C4622D] transition-colors">Products Ordered</h3>
                      </div>
                      <p className="text-sm text-[#8C8278]">View all individual products ordered by customers, including meal and discount voucher usage.</p>
                      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#C4622D]">
                        <span>View report</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                    <button
                      onClick={() => setReportingView('package_meals_ordered')}
                      className="bg-white rounded-2xl border border-[#EDE7DA] p-6 text-left hover:border-[#C4622D] hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">🍱</span>
                        <h3 className="text-base font-bold text-[#1A1612] group-hover:text-[#C4622D] transition-colors">Package Meals Ordered</h3>
                      </div>
                      <p className="text-sm text-[#8C8278]">View all package meal orders, including package type purchased and meal voucher details.</p>
                      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#C4622D]">
                        <span>View report</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                    <button
                      onClick={() => setReportingView('discount_vouchers_report')}
                      className="bg-white rounded-2xl border border-[#EDE7DA] p-6 text-left hover:border-[#C4622D] hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">🏷️</span>
                        <h3 className="text-base font-bold text-[#1A1612] group-hover:text-[#C4622D] transition-colors">Discount Vouchers</h3>
                      </div>
                      <p className="text-sm text-[#8C8278]">View all orders where discount vouchers were applied, including voucher codes and amounts.</p>
                      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#C4622D]">
                        <span>View report</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  </div>
                ) : reportingView === 'products_ordered' ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setReportingView('cards')}
                      className="flex items-center gap-1.5 text-sm text-[#C4622D] font-medium hover:underline mb-4"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      Return to Dashboard
                    </button>
                    {productsOrderedLoading ? (
                      <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                    ) : filteredProductsOrderedRows.length === 0 ? (
                      <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium">No products ordered data found</p></div>
                    ) : (
                      filteredProductsOrderedRows.map((row, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-[#1A1612] text-sm">{row.productName}</p>
                            <p className="text-xs text-[#8C8278] mt-0.5">{row.productType} · {row.item}</p>
                            <p className="text-xs text-[#B5ADA5] mt-0.5">{row.clientName} · {row.orderedDate}</p>
                          </div>
                          <div className="text-right">
                            {row.mealVoucher && <p className="text-xs text-blue-600">MV: {row.mealVoucher}</p>}
                            {row.discountVoucher && <p className="text-xs text-green-600">DV: {row.discountVoucher}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : reportingView === 'package_meals_ordered' ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setReportingView('cards')}
                      className="flex items-center gap-1.5 text-sm text-[#C4622D] font-medium hover:underline mb-4"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      Return to Dashboard
                    </button>
                    {packageMealsLoading ? (
                      <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                    ) : filteredPackageMealsRows.length === 0 ? (
                      <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium">No package meals data found</p></div>
                    ) : (
                      filteredPackageMealsRows.map((row, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-[#1A1612] text-sm">{row.productName}</p>
                            <p className="text-xs text-[#8C8278] mt-0.5">{row.packagePurchased} · {row.item}</p>
                            <p className="text-xs text-[#B5ADA5] mt-0.5">{row.clientName} · {row.orderedDate}</p>
                          </div>
                          <div className="text-right">
                            {row.mealVoucher && <p className="text-xs text-blue-600">MV: {row.mealVoucher}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : reportingView === 'discount_vouchers_report' ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setReportingView('cards')}
                      className="flex items-center gap-1.5 text-sm text-[#C4622D] font-medium hover:underline mb-4"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      Return to Dashboard
                    </button>
                    {discountVouchersReportLoading ? (
                      <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" /></div>
                    ) : filteredDiscountVouchersReportRows.length === 0 ? (
                      <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium">No discount voucher report data found</p></div>
                    ) : (
                      filteredDiscountVouchersReportRows.map((row, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-[#1A1612] text-sm">{row.dvCode}</p>
                            <p className="text-xs text-[#8C8278] mt-0.5">R{row.dvAmount.toFixed(2)} · {row.expiryDate && new Date(row.expiryDate) < new Date() ? 'Expired' : 'Expires'} {row.expiryDate}</p>
                            <p className="text-xs text-[#B5ADA5] mt-0.5">Status: {row.productType} · {row.item} · Created {row.orderedDate}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}