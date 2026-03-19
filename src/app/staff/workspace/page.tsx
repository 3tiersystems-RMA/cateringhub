'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { APP_NAME } from "@/lib/constants";
import DeleteConfirmModal from '@/components/ui/DeleteConfirmModal';
import VoucherErrorModal from '@/components/ui/VoucherErrorModal';
import GoogleDriveDocuments from './components/GoogleDriveDocuments';

type BucketType = 'product-images' | 'event-photos' | 'document-management';
type WorkspaceTab = 'products' | 'media' | 'orders' | 'staff' | 'homepage_cards' | 'categories' | 'weekly_menu' | 'vouchers' | 'discount_vouchers' | 'testimonials' | 'reporting';

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
  payfast_transaction_id: string | null;
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

// NEW: form state for adding/editing a single menu item
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

// ─── Inactivity Warning Modal ─────────────────────────────────────────────────
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

// ─── Redemption Audit Row ─────────────────────────────────────────────────────
function RedemptionAuditRow({ redemption, index }: { redemption: VoucherRedemption; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasProducts = redemption.products_ordered && redemption.products_ordered.length > 0;
  const hasAuditData = redemption.meals_remaining_before !== undefined && redemption.meals_remaining_after !== undefined;

  return (
    <div className="border border-[#DDD5C8] rounded-xl overflow-hidden">
      {/* Row header — always visible, clickable */}
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

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 py-4 bg-white space-y-3 border-t border-[#DDD5C8]">
          {/* Customer info */}
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

          {/* Balance change */}
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

          {/* Products ordered */}
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

          {/* Notes */}
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

  // Media Library state
  const [activeBucket, setActiveBucket] = useState<BucketType>('product-images');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string>('');
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');

  // Media Library Picker state (for product form)
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerFiles, setMediaPickerFiles] = useState<StorageFile[]>([]);
  const [mediaPickerLoading, setMediaPickerLoading] = useState(false);
  const [selectedMediaPath, setSelectedMediaPath] = useState<string>('');

  // Dynamic categories from DB (for product form dropdowns)
  const [categories, setCategories] = useState<string[]>([]);

  // Dynamic package types from DB (for product form Package Type dropdown)
  const [packageTypes, setPackageTypes] = useState<{ value: string; label: string }[]>([
    { value: 'none', label: 'None — Regular product (no voucher required)' },
    { value: 'package-6', label: '6-Meal Package — Requires a 6-meal voucher' },
    { value: 'package-10', label: '10-Meal Package — Requires a 10-meal voucher' },
    { value: 'package-12', label: '12-Meal Package — Requires a 12-meal voucher' },
    { value: 'package-24', label: '24-Meal Package — Requires a 24-meal voucher' },
  ]);

  // Categories management state
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', sort_order: '' });
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryFormSuccess, setCategoryFormSuccess] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Staff management state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [staffActionId, setStaffActionId] = useState<string | null>(null);
  const [staffActionMsg, setStaffActionMsg] = useState('');
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [resetPasswordMsg, setResetPasswordMsg] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>('all');

  // Homepage cards state
  const [homepageCards, setHomepageCards] = useState<HomepageCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<HomepageCard | null>(null);
  const [cardForm, setCardForm] = useState<Partial<HomepageCard>>({});
  const [cardFormError, setCardFormError] = useState('');
  const [cardFormSuccess, setCardFormSuccess] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [togglingCardId, setTogglingCardId] = useState<string | null>(null);

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
  // Week navigator: offset in weeks from current week (0 = current, 1 = next, -1 = prev)
  const [weekOffset, setWeekOffset] = useState(0);
  // Track which day is being "closed" (for the close-day modal per day)
  const [closingDayDate, setClosingDayDate] = useState<string | null>(null);
  const [closingDayReason, setClosingDayReason] = useState('');
  const [savingClosedDay, setSavingClosedDay] = useState(false);

  // Vouchers state
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [voucherRedemptions, setVoucherRedemptions] = useState<VoucherRedemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [showIssueVoucherForm, setShowIssueVoucherForm] = useState(false);
  const [issueVoucherForm, setIssueVoucherForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    total_meals: '12',
    notes: '',
  });
  const [issueVoucherError, setIssueVoucherError] = useState('');
  const [issueVoucherSuccess, setIssueVoucherSuccess] = useState('');
  const [issuingVoucher, setIssuingVoucher] = useState(false);
  const [voucherSearchQuery, setVoucherSearchQuery] = useState('');
  const [markingVoucherPaidId, setMarkingVoucherPaidId] = useState<string | null>(null);
  const [loadingMarkingPaid, setLoadingMarkingPaid] = useState(false);

  // Discount Vouchers state
  const [discountVouchers, setDiscountVouchers] = useState<DiscountVoucher[]>([]);
  const [dvLoading, setDvLoading] = useState(false);
  const [showDvForm, setShowDvForm] = useState(false);
  const [editingDv, setEditingDv] = useState<DiscountVoucher | null>(null);
  const [dvForm, setDvForm] = useState({ dv_amount: '', expiry_date: '', status: 'Active\' as \'Active\' | \'Inactive' });
  const [dvFormError, setDvFormError] = useState('');
  const [dvFormSuccess, setDvFormSuccess] = useState('');
  const [savingDv, setSavingDv] = useState(false);
  const [dvSearchQuery, setDvSearchQuery] = useState('');
  const [generatingQrId, setGeneratingQrId] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Testimonials state
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<TestimonialForm>({
    quote: '', name: '', role: '', avatar_url: '', rating: 5, is_active: true, display_order: '0',
  });
  const [savingTestimonial, setSavingTestimonial] = useState(false);

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    productName: string;
    message?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    productName: '',
    message: '',
    onConfirm: () => {},
  });

  // ─── Orders tab state ────────────────────────────────────────────────────────
  const [wsOrders, setWsOrders] = useState<Order[]>([]);
  const [wsOrdersLoading, setWsOrdersLoading] = useState(false);
  const [wsOrdersError, setWsOrdersError] = useState('');
  const [wsExpandedOrderId, setWsExpandedOrderId] = useState<string | null>(null);
  const [wsOrderUpdateStates, setWsOrderUpdateStates] = useState<Record<string, OrderUpdateState>>({});
  const [wsOrderSearch, setWsOrderSearch] = useState('');
  const [wsFilterPayment, setWsFilterPayment] = useState<string>('all');
  const [wsFilterFulfillment, setWsFilterFulfillment] = useState<string>('all');

  // Reporting state
  const [reportingView, setReportingView] = useState<'cards' | 'products_ordered'>('cards');
  const [productsOrderedRows, setProductsOrderedRows] = useState<ProductsOrderedRow[]>([]);
  const [productsOrderedLoading, setProductsOrderedLoading] = useState(false);

  const openDeleteModal = (productName: string, onConfirm: () => void, message?: string) => {
    setDeleteModal({ isOpen: true, productName, onConfirm, message });
  };

  const closeDeleteModal = () => {
    setDeleteModal((prev) => ({ ...prev, isOpen: false }));
  };

  // ─── Global error modal ───────────────────────────────────────────────────────
  const [globalErrorModal, setGlobalErrorModal] = useState<{ open: boolean; message: string; title: string }>({ open: false, message: '', title: 'Error' });
  const showGlobalError = (message: string, title = 'Error') => setGlobalErrorModal({ open: true, message, title });
  const closeGlobalError = () => setGlobalErrorModal({ open: false, message: '', title: 'Error' });

  // Wrapped error setters that show modal instead of inline
  const showFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Product Error'); };
  const showCategoryFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Category Error'); };
  const showInviteError = (msg: string) => { if (msg) showGlobalError(msg, 'Invite Error'); };
  const showCardFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Homepage Card Error'); };
  const showWeeklyMenuFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Weekly Menu Error'); };
  const showIssueVoucherError = (msg: string) => { if (msg) showGlobalError(msg, 'Voucher Error'); };
  const showUploadError = (msg: string) => { if (msg) showGlobalError(msg, 'Upload Error'); };
  const showDvFormError = (msg: string) => { if (msg) showGlobalError(msg, 'Discount Voucher Error'); };

  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.replace('/staff/login');
        return;
      }
      setUser(currentUser);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      if (profile) setUserProfile(profile as StaffMember);

      await loadCategoryNames();
      await loadPackageTypes();
      await loadProducts();
    };
    init();
  }, []);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  const profileLoaded = userProfile !== null || user === null;
  const { showWarning, countdown, stayLoggedIn, logOutNow } = useInactivityTimer({
    enabled: profileLoaded && !isSuperAdmin && !!user,
  });

  // ─── Load category names for dropdowns ───────────────────────────────────────
  const loadCategoryNames = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('name')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (data && data.length > 0) {
        const names = data.map((c: any) => c.name as string);
        setCategories(names);
        setForm((prev) => ({ ...prev, category: names[0] }));
      } else {
        // Fallback to RPC
        const { data: catData } = await supabase.rpc('get_product_categories');
        if (catData && Array.isArray(catData) && catData.length > 0) {
          setCategories(catData as string[]);
          setForm((prev) => ({ ...prev, category: catData[0] as string }));
        }
      }
    } catch (err) {
      console.log('Error loading categories:', err);
    }
  };

  // ─── Load package types from DB ───────────────────────────────────────────────
  const loadPackageTypes = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('package_type')
        .neq('package_type', null);

      // Known base types always present
      const knownTypes: { value: string; label: string }[] = [
        { value: 'none', label: 'None — Regular product (no voucher required)' },
        { value: 'package-6', label: '6-Meal Package — Requires a 6-meal voucher' },
        { value: 'package-10', label: '10-Meal Package — Requires a 10-meal voucher' },
        { value: 'package-12', label: '12-Meal Package — Requires a 12-meal voucher' },
        { value: 'package-24', label: '24-Meal Package — Requires a 24-meal voucher' },
      ];

      if (data && data.length > 0) {
        // Collect distinct values from DB
        const dbValues = Array.from(new Set(data.map((r: any) => r.package_type as string)));

        // Merge: start with known types, then append any DB values not already covered
        const knownValues = new Set(knownTypes.map((t) => t.value));
        const extra = dbValues
          .filter((v) => v && !knownValues.has(v))
          .map((v) => {
            // Auto-generate a label for unknown types (e.g. "package-30" → "30-Meal Package")
            const match = v.match(/^package-(\d+)$/);
            const label = match
              ? `${match[1]}-Meal Package — Requires a ${match[1]}-meal voucher`
              : `${v} — Requires a matching voucher`;
            return { value: v, label };
          });

        setPackageTypes([...knownTypes, ...extra]);
      }
    } catch (err) {
      console.log('Error loading package types:', err);
    }
  };

  // ─── Categories CRUD ──────────────────────────────────────────────────────────
  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) {
        console.log('Load categories error:', error.message);
        setCategoriesList([]);
        return;
      }
      setCategoriesList((data || []) as Category[]);
    } catch (err) {
      console.log('Unexpected error loading categories:', err);
      setCategoriesList([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const openAddCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', sort_order: String(categoriesList.length + 1) });
    setCategoryFormError('');
    setCategoryFormSuccess('');
    setShowCategoryForm(true);
  };

  const openEditCategoryForm = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, sort_order: String(cat.sort_order) });
    setCategoryFormError('');
    setCategoryFormSuccess('');
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryFormError('');
    setCategoryFormSuccess('');

    if (!categoryForm.name.trim()) {
      showCategoryFormError('Category name is required.');
      return;
    }

    setSavingCategory(true);
    try {
      const slug = categoryForm.name.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      const payload = {
        name: categoryForm.name.trim(),
        slug,
        sort_order: categoryForm.sort_order ? Number(categoryForm.sort_order) : 0,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editingCategory.id);
        if (error) {
          showCategoryFormError(`Update failed: ${error.message}`);
          return;
        }
        setCategoryFormSuccess('Category updated successfully!');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({ ...payload, active: true });
        if (error) {
          showCategoryFormError(`Create failed: ${error.message}`);
          return;
        }
        setCategoryFormSuccess('Category created successfully!');
      }

      await loadCategories();
      await loadCategoryNames();
      setTimeout(() => {
        setShowCategoryForm(false);
        setCategoryFormSuccess('');
      }, 1200);
    } catch (err) {
      showCategoryFormError('An unexpected error occurred.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (cat: Category) => {
    setTogglingCategoryId(cat.id);
    const { error } = await supabase
      .from('categories')
      .update({ active: !cat.active })
      .eq('id', cat.id);
    if (!error) {
      setCategoriesList((prev) =>
        prev.map((c) => c.id === cat.id ? { ...c, active: !c.active } : c)
      );
      await loadCategoryNames();
    }
    setTogglingCategoryId(null);
  };

  const handleDeleteCategory = async (cat: Category) => {
    openDeleteModal(
      cat.name,
      async () => {
        closeDeleteModal();
        setDeletingCategoryId(cat.id);
        try {
          const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', cat.id);
          if (error) {
            console.log('Delete category error:', error.message);
            return;
          }
          setCategoriesList((prev) => prev.filter((c) => c.id !== cat.id));
          await loadCategoryNames();
        } catch (err) {
          console.log('Unexpected delete category error:', err);
        } finally {
          setDeletingCategoryId(null);
        }
      },
      `Are you sure you want to delete this product: ${cat.name}?`
    );
  };

  // ─── Weekly Menu CRUD ─────────────────────────────────────────────────────────

  // Helper: get Mon-Fri bounds for a given week offset
  const getWeekBoundsForOffset = (offset: number): { monday: Date; friday: Date; mondayStr: string; fridayStr: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { monday, friday, mondayStr: fmt(monday), fridayStr: fmt(friday) };
  };

  const getDayNameFromDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[d.getDay()] || '';
  };

  const loadWeeklyMenu = async (offset?: number) => {
    const effectiveOffset = offset !== undefined ? offset : weekOffset;
    setWeeklyMenuLoading(true);
    try {
      const { mondayStr, fridayStr } = getWeekBoundsForOffset(effectiveOffset);
      const { data, error } = await supabase
        .from('weekly_menu')
        .select('*')
        .gte('meal_date', mondayStr)
        .lte('meal_date', fridayStr)
        .order('meal_date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) {
        console.log('Load weekly menu error:', error.message);
        setWeeklyMenuEntries([]);
        return;
      }
      setWeeklyMenuEntries((data || []) as WeeklyMenuEntry[]);
    } catch (err) {
      console.log('Unexpected error loading weekly menu:', err);
      setWeeklyMenuEntries([]);
    } finally {
      setWeeklyMenuLoading(false);
    }
  };

  const openAddWeeklyMenuForm = (dateStr: string) => {
    const dayName = getDayNameFromDate(dateStr);
    setEditingWeeklyEntry(null);
    setWeeklyMenuForm({ meal_date: dateStr, day_name: dayName, meal_name: '', description: '', price: '', is_closed: false, closed_reason: '' });
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
      price: entry.price !== null ? String(entry.price) : '',
      is_closed: entry.is_closed,
      closed_reason: entry.closed_reason || '',
    });
    setWeeklyMenuFormError('');
    setWeeklyMenuFormSuccess('');
    setShowWeeklyMenuForm(true);
  };

  const handleSaveWeeklyEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setWeeklyMenuFormError('');
    setWeeklyMenuFormSuccess('');

    if (!weeklyMenuForm.meal_date) {
      showWeeklyMenuFormError('Date is required.');
      return;
    }
    if (!weeklyMenuForm.is_closed && !weeklyMenuForm.meal_name.trim()) {
      showWeeklyMenuFormError('Meal name is required unless the day is closed.');
      return;
    }
    if (!weeklyMenuForm.is_closed && (!weeklyMenuForm.price || isNaN(Number(weeklyMenuForm.price)) || Number(weeklyMenuForm.price) <= 0)) {
      showWeeklyMenuFormError('A valid price is required for menu items.');
      return;
    }

    setSavingWeeklyEntry(true);
    try {
      const dayName = getDayNameFromDate(weeklyMenuForm.meal_date);
      const payload = {
        meal_date: weeklyMenuForm.meal_date,
        day_name: dayName || weeklyMenuForm.day_name,
        meal_name: weeklyMenuForm.is_closed ? null : weeklyMenuForm.meal_name.trim() || null,
        description: weeklyMenuForm.is_closed ? null : weeklyMenuForm.description.trim() || null,
        price: weeklyMenuForm.is_closed ? null : (weeklyMenuForm.price ? Number(weeklyMenuForm.price) : null),
        is_closed: weeklyMenuForm.is_closed,
        closed_reason: weeklyMenuForm.is_closed ? weeklyMenuForm.closed_reason.trim() || null : null,
      };

      if (editingWeeklyEntry) {
        const { error } = await supabase
          .from('weekly_menu')
          .update(payload)
          .eq('id', editingWeeklyEntry.id);
        if (error) {
          showWeeklyMenuFormError(`Update failed: ${error.message}`);
          return;
        }
        setWeeklyMenuFormSuccess('Item updated successfully!');
      } else {
        const { error } = await supabase
          .from('weekly_menu')
          .insert(payload);
        if (error) {
          showWeeklyMenuFormError(`Create failed: ${error.message}`);
          return;
        }
        setWeeklyMenuFormSuccess('Item added successfully!');
      }

      await loadWeeklyMenu();
      setTimeout(() => {
        setShowWeeklyMenuForm(false);
        setWeeklyMenuFormSuccess('');
      }, 1000);
    } catch (err) {
      showWeeklyMenuFormError('An unexpected error occurred.');
    } finally {
      setSavingWeeklyEntry(false);
    }
  };

  const handleDeleteWeeklyEntry = async (entry: WeeklyMenuEntry) => {
    openDeleteModal(
      entry.meal_name || 'this entry',
      async () => {
        closeDeleteModal();
        setDeletingWeeklyEntryId(entry.id);
        try {
          const { error } = await supabase
            .from('weekly_menu')
            .delete()
            .eq('id', entry.id);
          if (error) {
            console.log('Delete weekly entry error:', error.message);
            return;
          }
          setWeeklyMenuEntries((prev) => prev.filter((e) => e.id !== entry.id));
        } catch (err) {
          console.log('Unexpected delete weekly entry error:', err);
        } finally {
          setDeletingWeeklyEntryId(null);
        }
      }
    );
  };

  // Mark an entire day as closed (removes existing items for that day and inserts a closed row)
  const handleMarkDayClosed = async (dateStr: string, reason: string) => {
    setSavingClosedDay(true);
    try {
      // Delete all existing entries for this date
      await supabase.from('weekly_menu').delete().eq('meal_date', dateStr);
      // Insert a single closed row
      const dayName = getDayNameFromDate(dateStr);
      const { error } = await supabase.from('weekly_menu').insert({
        meal_date: dateStr,
        day_name: dayName,
        meal_name: null,
        description: null,
        price: null,
        is_closed: true,
        closed_reason: reason.trim() || 'Closed for the day',
      });
      if (error) {
        console.log('Mark day closed error:', error.message);
        return;
      }
      await loadWeeklyMenu();
      setClosingDayDate(null);
      setClosingDayReason('');
    } catch (err) {
      console.log('Unexpected error marking day closed:', err);
    } finally {
      setSavingClosedDay(false);
    }
  };

  // Reopen a closed day (remove the closed row so items can be added)
  const handleReopenDay = async (dateStr: string) => {
    openDeleteModal(
      'closed day status',
      async () => {
        closeDeleteModal();
        try {
          await supabase.from('weekly_menu').delete().eq('meal_date', dateStr).eq('is_closed', true);
          await loadWeeklyMenu();
        } catch (err) {
          console.log('Unexpected error reopening day:', err);
        }
      },
      'Are you sure you want to remove the closed status for this day? You can then add menu items.'
    );
  };

  // ─── Staff Management ────────────────────────────────────────────────────────

  const loadStaffMembers = async () => {
    setStaffLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.log('Load staff error:', error.message);
        setStaffMembers([]);
        return;
      }
      setStaffMembers((data || []) as StaffMember[]);
    } catch (err) {
      console.log('Unexpected error loading staff:', err);
      setStaffMembers([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');

    if (!inviteForm.full_name.trim()) { showInviteError('Full name is required.'); return; }
    if (!inviteForm.email.trim()) { showInviteError('Email is required.'); return; }

    setInviting(true);
    try {
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          full_name: inviteForm.full_name.trim(),
          role: inviteForm.role,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        showInviteError(result.error || 'Failed to send invitation.');
        return;
      }

      setInviteSuccess(`Invitation sent to ${inviteForm.email}!`);
      setInviteForm(emptyInviteForm);
      await loadStaffMembers();
      setTimeout(() => {
        setShowInviteForm(false);
        setInviteSuccess('');
      }, 2000);
    } catch (err) {
      showInviteError('An unexpected error occurred.');
    } finally {
      setInviting(false);
    }
  };

  const handleSuspendStaff = async (member: StaffMember) => {
    if (member.id === user?.id) return;
    setStaffActionId(member.id);
    setStaffActionMsg('');
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', member.id);
      if (error) {
        setStaffActionMsg('Failed to suspend account.');
        return;
      }
      setStaffMembers((prev) =>
        prev.map((m) => m.id === member.id ? { ...m, is_active: false } : m)
      );
    } catch (err) {
      setStaffActionMsg('An unexpected error occurred.');
    } finally {
      setStaffActionId(null);
    }
  };

  const handleReinstateStaff = async (member: StaffMember) => {
    setStaffActionId(member.id);
    setStaffActionMsg('');
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: true })
        .eq('id', member.id);
      if (error) {
        setStaffActionMsg('Failed to reinstate account.');
        return;
      }
      setStaffMembers((prev) =>
        prev.map((m) => m.id === member.id ? { ...m, is_active: true } : m)
      );
    } catch (err) {
      setStaffActionMsg('An unexpected error occurred.');
    } finally {
      setStaffActionId(null);
    }
  };

  const handleResetPassword = async (member: StaffMember) => {
    if (member.id === user?.id) return;
    setResetPasswordId(member.id);
    setResetPasswordMsg('');
    setStaffActionMsg('');
    try {
      const response = await fetch('/api/staff/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, email: member.email }),
      });
      const result = await response.json();
      if (!response.ok) {
        setStaffActionMsg(result.error || 'Failed to send password reset email.');
        return;
      }
      setResetPasswordMsg(`Password reset email sent to ${member.email}`);
      setTimeout(() => setResetPasswordMsg(''), 5000);
    } catch (err) {
      setStaffActionMsg('An unexpected error occurred.');
    } finally {
      setResetPasswordId(null);
    }
  };

  // ─── Products ───────────────────────────────────────────────────────────────

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.log('Load products error:', error.message);
        setProducts([]);
        return;
      }

      const withUrls = await Promise.all(
        (data || []).map(async (p) => {
          let imageUrl = '';
          if (p.image_path) {
            const { data: urlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(p.image_path);
            imageUrl = urlData?.publicUrl || '';
          }
          return { ...p, imageUrl };
        })
      );
      setProducts(withUrls);
    } catch (err) {
      console.log('Unexpected error loading products:', err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setProductImageFile(null);
    setProductImagePreview('');
    setSelectedMediaPath('');
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    const isPackageType = ['package-6','package-10','package-12','package-24'].includes(product.package_type || '');
    setForm({
      name: product.name,
      category: product.category,
      price: (isPackageType && product.price === 0) ? '' : String(product.price),
      unit: product.unit,
      description: product.description,
      tags: product.tags?.join(', ') || '',
      badge: product.badge || '',
      min_order: product.min_order ? String(product.min_order) : '',
      available: product.available,
      featured: product.featured,
      sort_order: product.sort_order,
      package_type: product.package_type || 'none',
    });
    setProductImageFile(null);
    setProductImagePreview(product.imageUrl || '');
    setSelectedMediaPath('');
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const handleProductImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showFormError('Please select an image file.');
      return;
    }
    setProductImageFile(file);
    setProductImagePreview(URL.createObjectURL(file));
    setSelectedMediaPath('');
  };

  const openMediaPicker = async () => {
    setShowMediaPicker(true);
    setMediaPickerLoading(true);
    try {
      const { data, error } = await supabase.storage.from('product-images').list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) { setMediaPickerFiles([]); return; }
      const filesWithUrls = await Promise.all(
        (data || []).filter((f) => f.name !== '.emptyFolderPlaceholder').map(async (file) => {
          const { data: signedData } = await supabase.storage
            .from('product-images')
            .createSignedUrl(file.name, 3600);
          return { ...file, signedUrl: signedData?.signedUrl || '' } as StorageFile;
        })
      );
      setMediaPickerFiles(filesWithUrls);
    } catch (err) {
      setMediaPickerFiles([]);
    } finally {
      setMediaPickerLoading(false);
    }
  };

  const handleSelectMediaImage = (file: StorageFile) => {
    setProductImagePreview(file.signedUrl);
    setSelectedMediaPath(file.name);
    setProductImageFile(null);
    setShowMediaPicker(false);
  };

  const uploadProductImage = async (file: File): Promise<string | null> => {
    setUploadingProductImage(true);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    setUploadingProductImage(false);
    if (error) {
      console.log('Image upload error:', error.message);
      return null;
    }
    return fileName;
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.name.trim()) { showFormError('Product name is required.'); return; }
    const isPackageType = ['package-6','package-10','package-12','package-24'].includes(form.package_type);
    if (!isPackageType && (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0)) {
      showFormError('Please enter a valid price.'); return;
    }
    if (!form.description.trim()) { showFormError('Description is required.'); return; }

    setSaving(true);
    try {
      let imagePath = editingProduct?.image_path || null;

      if (selectedMediaPath) {
        imagePath = selectedMediaPath;
      } else if (productImageFile) {
        const uploaded = await uploadProductImage(productImageFile);
        if (uploaded) {
          if (editingProduct?.image_path) {
            await supabase.storage.from('product-images').remove([editingProduct.image_path]);
          }
          imagePath = uploaded;
        } else {
          showFormError('Image upload failed. Please try again.');
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: (isPackageType && (!form.price || Number(form.price) === 0)) ? 0 : Number(form.price),
        unit: form.unit.trim() || 'per serving',
        description: form.description.trim(),
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        badge: form.badge.trim() || null,
        min_order: form.min_order ? Number(form.min_order) : null,
        available: form.available,
        featured: form.featured,
        image_path: imagePath,
        package_type: form.package_type || 'none',
      };

      if (editingProduct) {
        const { error, data: updateData } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id)
          .select();
        if (error) {
          console.error('Update error:', JSON.stringify(error));
          showFormError(`Update failed: ${error.message}`);
          setSaving(false);
          return;
        }
        if (!updateData || updateData.length === 0) {
          showFormError('Update was blocked — you may not have permission to edit this product. Please ensure your account has staff access.');
          setSaving(false);
          return;
        }
        setFormSuccess('Product updated successfully!');
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) {
          console.error('Insert error:', JSON.stringify(error));
          showFormError(error.message);
          setSaving(false);
          return;
        }
        setFormSuccess('Product created successfully!');
      }

      await loadProducts();
      setTimeout(() => {
        setShowForm(false);
        setFormSuccess('');
      }, 1200);
    } catch (err) {
      console.log('Save product error:', err);
      showFormError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    openDeleteModal(
      product.name,
      async () => {
        closeDeleteModal();
        setDeletingProductId(product.id);
        try {
          if (product.image_path) {
            await supabase.storage.from('product-images').remove([product.image_path]);
          }
          const { error } = await supabase.from('products').delete().eq('id', product.id);
          if (error) { console.log('Delete error:', error.message); return; }
          setProducts((prev) => prev.filter((p) => p.id !== product.id));
        } catch (err) {
          console.log('Unexpected delete error:', err);
        } finally {
          setDeletingProductId(null);
        }
      }
    );
  };

  const handleToggleAvailable = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ available: !product.available })
      .eq('id', product.id);
    if (!error) {
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, available: !p.available } : p)
      );
    }
  };

  // ─── Media Library ───────────────────────────────────────────────────────────

  const loadFiles = async (bucket: BucketType) => {
    setMediaLoading(true);
    try {
      const { data, error } = await supabase.storage.from(bucket).list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) { setFiles([]); return; }
      const filesWithUrls = await Promise.all(
        (data || []).filter((f) => f.name !== '.emptyFolderPlaceholder').map(async (file) => {
          const { data: signedData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(file.name, 3600);
          return { ...file, signedUrl: signedData?.signedUrl || '' } as StorageFile;
        })
      );
      setFiles(filesWithUrls);
    } catch (err) {
      setFiles([]);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleBucketChange = async (bucket: BucketType) => {
    setActiveBucket(bucket);
    setUploadError('');
    setUploadSuccess('');
    await loadFiles(bucket);
  };

  const handleUpload = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    let successCount = 0;
    let errorCount = 0;
    for (const file of Array.from(selectedFiles)) {
      if (!file.type.startsWith('image/')) { errorCount++; continue; }
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from(activeBucket).upload(fileName, file, {
        cacheControl: '3600', upsert: false,
      });
      if (error) { errorCount++; } else { successCount++; }
    }
    if (successCount > 0) {
      setUploadSuccess(`${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully!`);
      await loadFiles(activeBucket);
    }
    if (errorCount > 0) {
      showUploadError(`${errorCount} file${errorCount > 1 ? 's' : ''} failed. Only image files are accepted.`);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (fileName: string) => {
    setDeletingId(fileName);
    try {
      const { error } = await supabase.storage.from(activeBucket).remove([fileName]);
      if (!error) setFiles((prev) => prev.filter((f) => f.name !== fileName));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/staff/login');
    router.refresh();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (amount: number) => `R${Number(amount || 0).toFixed(2)}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ─── Orders tab helpers ──────────────────────────────────────────────────────
  const loadWsOrders = async () => {
    setWsOrdersLoading(true);
    setWsOrdersError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) {
        setWsOrdersError(fetchError.message);
        setWsOrders([]);
        return;
      }
      setWsOrders(data || []);
    } catch {
      setWsOrdersError('Failed to load orders');
      setWsOrders([]);
    } finally {
      setWsOrdersLoading(false);
    }
  };

  const getWsOrderUpdateState = (orderId: string): OrderUpdateState =>
    wsOrderUpdateStates[orderId] || {
      fulfillmentSaving: false, paymentSaving: false,
      fulfillmentSuccess: false, paymentSuccess: false,
      fulfillmentError: '', paymentError: '',
    };

  const setWsOrderUpdateField = (orderId: string, fields: Partial<OrderUpdateState>) => {
    setWsOrderUpdateStates((prev) => ({
      ...prev,
      [orderId]: { ...getWsOrderUpdateState(orderId), ...fields },
    }));
  };

  const handleWsFulfillmentUpdate = async (orderId: string, newStatus: FulfillmentStatus) => {
    setWsOrderUpdateField(orderId, { fulfillmentSaving: true, fulfillmentSuccess: false, fulfillmentError: '' });
    try {
      const { error } = await supabase.from('orders').update({ fulfillment_status: newStatus }).eq('id', orderId);
      if (error) { setWsOrderUpdateField(orderId, { fulfillmentSaving: false, fulfillmentError: '' }); showGlobalError(error.message, 'Fulfillment Update Error'); return; }
      setWsOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, fulfillment_status: newStatus } : o));
      setWsOrderUpdateField(orderId, { fulfillmentSaving: false, fulfillmentSuccess: true });
      setTimeout(() => setWsOrderUpdateField(orderId, { fulfillmentSuccess: false }), 2500);
    } catch {
      setWsOrderUpdateField(orderId, { fulfillmentSaving: false, fulfillmentError: '' });
      showGlobalError('Update failed', 'Fulfillment Update Error');
    }
  };

  const handleWsPaymentUpdate = async (orderId: string, newStatus: PaymentStatus) => {
    setWsOrderUpdateField(orderId, { paymentSaving: true, paymentSuccess: false, paymentError: '' });
    try {
      const { error } = await supabase.from('orders').update({ payment_status: newStatus }).eq('id', orderId);
      if (error) { setWsOrderUpdateField(orderId, { paymentSaving: false, paymentError: '' }); showGlobalError(error.message, 'Payment Update Error'); return; }
      setWsOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, payment_status: newStatus } : o));
      setWsOrderUpdateField(orderId, { paymentSaving: false, paymentSuccess: true });
      setTimeout(() => setWsOrderUpdateField(orderId, { paymentSuccess: false }), 2500);
    } catch {
      setWsOrderUpdateField(orderId, { paymentSaving: false, paymentError: '' });
      showGlobalError('Update failed', 'Payment Update Error');
    }
  };

  const filteredProducts = (filterCategory === 'All'
    ? products
    : products.filter((p) => p.category === filterCategory)
  ).filter((p) => !productSearchQuery || p.name.toLowerCase().includes(productSearchQuery.toLowerCase()));

  const wsFilteredOrders = wsOrders.filter((order) => {
    const matchesSearch =
      !wsOrderSearch ||
      order.customer_name.toLowerCase().includes(wsOrderSearch.toLowerCase()) ||
      (order.m_payment_id || '').toLowerCase().includes(wsOrderSearch.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(wsOrderSearch.toLowerCase());
    const matchesPayment = wsFilterPayment === 'all' || order.payment_status === wsFilterPayment;
    const matchesFulfillment = wsFilterFulfillment === 'all' || order.fulfillment_status === wsFilterFulfillment;
    return matchesSearch && matchesPayment && matchesFulfillment;
  });

  const filteredStaffMembers = staffMembers.filter((member) => {
    const matchesRole = staffRoleFilter === 'all' || member.role === staffRoleFilter;
    const matchesStatus =
      staffStatusFilter === 'all' ||
      (staffStatusFilter === 'active' && member.is_active) ||
      (staffStatusFilter === 'suspended' && !member.is_active);
    return matchesRole && matchesStatus;
  });

  const buckets: { id: BucketType; label: string; description: string; icon: string }[] = [
    { id: 'product-images', label: 'Product Images', description: 'Menu items, dishes & catering products', icon: '🍽️' },
    { id: 'event-photos', label: 'Event Photos', description: 'Marketing photos from events', icon: '📸' },
    { id: 'document-management', label: 'Document Management', description: 'Files, contracts & documents', icon: '📄' },
  ];

  // ─── Homepage Cards ──────────────────────────────────────────────────────────

  const loadHomepageCards = async () => {
    setCardsLoading(true);
    try {
      const { data, error } = await supabase
        .from('homepage_cards')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) {
        console.log('Load homepage cards error:', error.message);
        setHomepageCards([]);
        return;
      }
      setHomepageCards((data || []) as HomepageCard[]);
    } catch (err) {
      console.log('Unexpected error loading homepage cards:', err);
      setHomepageCards([]);
    } finally {
      setCardsLoading(false);
    }
  };

  const openCardEditForm = (card: HomepageCard) => {
    setEditingCard(card);
    setCardForm({
      title: card.title,
      subtitle: card.subtitle,
      description: card.description,
      reviewer_name: card.reviewer_name,
      reviewer_event: card.reviewer_event,
      rating: card.rating,
      is_visible: card.is_visible,
    });
    setCardFormError('');
    setCardFormSuccess('');
    setShowCardForm(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    setCardFormError('');
    setCardFormSuccess('');

    if (!cardForm.title?.trim()) {
      showCardFormError('Title is required.');
      return;
    }

    setSavingCard(true);
    try {
      const payload: Partial<HomepageCard> = {
        title: cardForm.title?.trim() || '',
        description: cardForm.description?.trim() || null,
        price: cardForm.price !== undefined ? Number(cardForm.price) || null : null,
        price_unit: cardForm.price_unit?.trim() || null,
        badge_label: cardForm.badge_label?.trim() || null,
        event_date: cardForm.event_date?.trim() || null,
        guest_count: cardForm.guest_count !== undefined ? Number(cardForm.guest_count) || null : null,
        prep_percentage: cardForm.prep_percentage !== undefined ? Number(cardForm.prep_percentage) || null : null,
        reviewer_name: cardForm.reviewer_name?.trim() || null,
        reviewer_event: cardForm.reviewer_event?.trim() || null,
        rating: cardForm.rating !== undefined ? Number(cardForm.rating) || null : null,
        is_visible: cardForm.is_visible ?? true,
      };

      const { error } = await supabase
        .from('homepage_cards')
        .update(payload)
        .eq('id', editingCard.id);

      if (error) {
        showCardFormError(`Save failed: ${error.message}`);
        return;
      }

      setCardFormSuccess('Card updated successfully!');
      await loadHomepageCards();
      setTimeout(() => {
        setShowCardForm(false);
        setCardFormSuccess('');
      }, 1200);
    } catch (err) {
      showCardFormError('An unexpected error occurred.');
    } finally {
      setSavingCard(false);
    }
  };

  const handleToggleCardVisibility = async (card: HomepageCard) => {
    setTogglingCardId(card.id);
    const { error } = await supabase
      .from('homepage_cards')
      .update({ is_visible: !card.is_visible })
      .eq('id', card.id);
    if (!error) {
      setHomepageCards((prev) =>
        prev.map((c) => c.id === card.id ? { ...c, is_visible: !c.is_visible } : c)
      );
    }
    setTogglingCardId(null);
  };

  // ─── Vouchers ───────────────────────────────────────────────────────────────

  const loadVouchers = async () => {
    setVouchersLoading(true);
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('purchased_at', { ascending: false });
      if (error) {
        console.log('Load vouchers error:', error.message);
        setVouchers([]);
        return;
      }
      setVouchers((data || []) as Voucher[]);
    } catch (err) {
      console.log('Unexpected error loading vouchers:', err);
      setVouchers([]);
    } finally {
      setVouchersLoading(false);
    }
  };

  const loadVoucherRedemptions = async (voucherCode: string) => {
    setRedemptionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('voucher_redemptions')
        .select('*')
        .eq('voucher_code', voucherCode)
        .order('redeemed_at', { ascending: false });
      if (error) {
        console.log('Load redemptions error:', error.message);
        setVoucherRedemptions([]);
        return;
      }
      setVoucherRedemptions((data || []) as VoucherRedemption[]);
    } catch (err) {
      console.log('Unexpected error loading redemptions:', err);
      setVoucherRedemptions([]);
    } finally {
      setRedemptionsLoading(false);
    }
  };

  const handleSelectVoucher = async (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    await loadVoucherRedemptions(voucher.voucher_code);
    // Re-fetch the voucher row to get the latest meals_remaining from the DB
    try {
      const { data } = await supabase
        .from('vouchers')
        .select('*')
        .eq('id', voucher.id)
        .single();
      if (data) setSelectedVoucher(data as Voucher);
    } catch {
      // keep the snapshot already set above
    }
  };

  const generateVoucherCode = (): string => {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const rand2 = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `CK-${year}-${rand}${rand2}`;
  };

  const handleIssueVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueVoucherError('');
    setIssueVoucherSuccess('');

    if (!issueVoucherForm.customer_name.trim()) { showIssueVoucherError('Customer name is required.'); return; }
    if (!issueVoucherForm.customer_email.trim()) { showIssueVoucherError('Customer email is required.'); return; }
    const meals = Number(issueVoucherForm.total_meals);
    if (!meals || meals <= 0) { showIssueVoucherError('Please enter a valid number of meals.'); return; }

    setIssuingVoucher(true);
    try {
      const code = generateVoucherCode();
      const pkgTypeMap: Record<number, string> = { 6: 'package-6', 10: 'package-10', 12: 'package-12', 24: 'package-24' };
      const { error } = await supabase.from('vouchers').insert({
        voucher_code: code,
        customer_name: issueVoucherForm.customer_name.trim(),
        customer_email: issueVoucherForm.customer_email.trim().toLowerCase(),
        customer_phone: issueVoucherForm.customer_phone.trim(),
        total_meals: meals,
        meals_remaining: meals,
        status: 'unpaid',
        notes: issueVoucherForm.notes.trim() || null,
        package_type: pkgTypeMap[meals] || 'none',
      });

      if (error) {
        showIssueVoucherError(`Failed to issue voucher: ${error.message}`);
        return;
      }

      setIssueVoucherSuccess(`Voucher ${code} issued successfully!`);
      setIssueVoucherForm({ customer_name: '', customer_email: '', customer_phone: '', total_meals: '12', notes: '' });
      await loadVouchers();
      setTimeout(() => {
        setShowIssueVoucherForm(false);
        setIssueVoucherSuccess('');
      }, 2000);
    } catch (err) {
      showIssueVoucherError('An unexpected error occurred.');
    } finally {
      setIssuingVoucher(false);
    }
  };

  const handleMarkVoucherAsPaid = async (voucher: Voucher) => {
    setMarkingVoucherPaidId(voucher.id);
    try {
      const { error } = await supabase
        .from('vouchers')
        .update({ status: 'paid' })
        .eq('id', voucher.id);

      if (error) {
        console.log('Mark as paid error:', error.message);
        return;
      }

      // Refresh vouchers list
      await loadVouchers();

      // Update selected voucher panel if open
      if (selectedVoucher?.id === voucher.id) {
        setSelectedVoucher({ ...voucher, status: 'paid' });
      }
    } catch (err) {
      console.log('Unexpected error marking voucher as paid:', err);
    } finally {
      setMarkingVoucherPaidId(null);
    }
  };

  // ─── Discount Vouchers CRUD ──────────────────────────────────────────────────

  const generateDvCode = (): string => {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const rand2 = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `DV-${year}-${rand}${rand2}`;
  };

  const loadDiscountVouchers = async () => {
    setDvLoading(true);
    try {
      const { data, error } = await supabase
        .from('discount_vouchers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.log('Load discount vouchers error:', error.message);
        setDiscountVouchers([]);
        return;
      }

      const vouchers = (data || []) as DiscountVoucher[];

      // Auto-deactivate expired vouchers: the day after expiry_date, set status to Inactive
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiredActive = vouchers.filter((dv) => {
        if (dv.status !== 'Active') return false;
        const expiry = new Date(dv.expiry_date);
        expiry.setHours(0, 0, 0, 0);
        // expired = expiry date is strictly before today
        return expiry < today;
      });

      if (expiredActive.length > 0) {
        const expiredIds = expiredActive.map((dv) => dv.id);
        await supabase
          .from('discount_vouchers')
          .update({ status: 'Inactive' })
          .in('id', expiredIds);
        // Reflect change locally
        vouchers.forEach((dv) => {
          if (expiredIds.includes(dv.id)) dv.status = 'Inactive';
        });
      }

      setDiscountVouchers(vouchers);
    } catch (err) {
      console.log('Unexpected error loading discount vouchers:', err);
      setDiscountVouchers([]);
    } finally {
      setDvLoading(false);
    }
  };

  const openCreateDvForm = () => {
    setEditingDv(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultExpiry = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
    setDvForm({ dv_amount: '', expiry_date: defaultExpiry, status: 'Active' });
    setDvFormError('');
    setDvFormSuccess('');
    setShowDvForm(true);
  };

  const openEditDvForm = (dv: DiscountVoucher) => {
    setEditingDv(dv);
    setDvForm({ dv_amount: String(dv.dv_amount), expiry_date: dv.expiry_date, status: dv.status });
    setDvFormError('');
    setDvFormSuccess('');
    setShowDvForm(true);
  };

  const handleSaveDv = async (e: React.FormEvent) => {
    e.preventDefault();
    setDvFormError('');
    setDvFormSuccess('');

    const amount = Number(dvForm.dv_amount);
    if (!dvForm.dv_amount || isNaN(amount) || amount <= 0) {
      showDvFormError('Please enter a valid discount amount.');
      return;
    }
    if (!dvForm.expiry_date) {
      showDvFormError('Expiry date is required.');
      return;
    }

    setSavingDv(true);
    try {
      if (editingDv) {
        const { error } = await supabase
          .from('discount_vouchers')
          .update({ dv_amount: amount, expiry_date: dvForm.expiry_date, status: dvForm.status })
          .eq('id', editingDv.id);
        if (error) {
          showDvFormError(`Update failed: ${error.message}`);
          return;
        }
        setDvFormSuccess('Discount voucher updated successfully!');
      } else {
        const code = generateDvCode();
        const { error } = await supabase
          .from('discount_vouchers')
          .insert({ dv_code: code, dv_amount: amount, expiry_date: dvForm.expiry_date, status: 'Active', times_used: 0 });
        if (error) {
          showDvFormError(`Create failed: ${error.message}`);
          return;
        }
        setDvFormSuccess('Discount voucher created successfully!');
      }

      await loadDiscountVouchers();
      setTimeout(() => {
        setShowDvForm(false);
        setDvFormSuccess('');
      }, 1500);
    } catch (err) {
      showDvFormError('An unexpected error occurred.');
    } finally {
      setSavingDv(false);
    }
  };

  const handleGenerateDvQr = async (dv: DiscountVoucher) => {
    setGeneratingQrId(dv.id);
    try {
      const QRCode = (await import('qrcode')).default;
      const qrText = `Discount Voucher\nCode: ${dv.dv_code}\nAmount: R${Number(dv.dv_amount).toFixed(2)}\nExpiry: ${dv.expiry_date}`;
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, qrText, {
        width: 400,
        margin: 2,
        color: { dark: '#1A1612', light: '#FFFFFF' },
      });

      // Draw label below QR
      const labelCanvas = document.createElement('canvas');
      const ctx = labelCanvas.getContext('2d');
      if (!ctx) return;
      labelCanvas.width = 400;
      labelCanvas.height = 520;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 400, 520);
      ctx.drawImage(canvas, 0, 0, 400, 400);

      ctx.fillStyle = '#1A1612';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(dv.dv_code, 200, 430);

      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#C4622D';
      ctx.fillText(`R${Number(dv.dv_amount).toFixed(2)} Discount`, 200, 458);

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#5C5347';
      ctx.fillText(`Expires: ${dv.expiry_date}`, 200, 482);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#8C8278';
      ctx.fillText(APP_NAME, 200, 508);

      const link = document.createElement('a');
      link.download = `DV-QR-${dv.dv_code}.png`;
      link.href = labelCanvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.log('QR generation error:', err);
    } finally {
      setGeneratingQrId(null);
    }
  };

  // ─── Testimonials CRUD ────────────────────────────────────────────────────────

  const loadTestimonials = async () => {
    setTestimonialsLoading(true);
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) { console.log('Load testimonials error:', error.message); setTestimonials([]); return; }
      setTestimonials((data || []) as Testimonial[]);
    } catch (err) {
      console.log('Unexpected error loading testimonials:', err);
      setTestimonials([]);
    } finally {
      setTestimonialsLoading(false);
    }
  };

  const openAddTestimonialForm = () => {
    setEditingTestimonial(null);
    setTestimonialForm({ quote: '', name: '', role: '', avatar_url: '', rating: 5, is_active: true, display_order: String(testimonials.length + 1) });
    setShowTestimonialForm(true);
  };

  const openEditTestimonialForm = (t: Testimonial) => {
    setEditingTestimonial(t);
    setTestimonialForm({ quote: t.quote, name: t.name, role: t.role, avatar_url: t.avatar_url || '', rating: t.rating, is_active: t.is_active, display_order: String(t.display_order) });
    setShowTestimonialForm(true);
  };

  const handleSaveTestimonial = async () => {
    if (!testimonialForm.quote.trim() || !testimonialForm.name.trim() || !testimonialForm.role.trim()) {
      showGlobalError('Quote, Name and Role are required.', 'Testimonial Error');
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
      display_order: parseInt(testimonialForm.display_order) || 0,
    };
    try {
      if (editingTestimonial) {
        const { error } = await supabase.from('testimonials').update(payload).eq('id', editingTestimonial.id);
        if (error) { showGlobalError(`Update failed: ${error.message}`, 'Testimonial Error'); return; }
      } else {
        const { error } = await supabase.from('testimonials').insert(payload);
        if (error) { showGlobalError(`Create failed: ${error.message}`, 'Testimonial Error'); return; }
      }
      setShowTestimonialForm(false);
      await loadTestimonials();
    } catch (err) {
      showGlobalError('An unexpected error occurred.', 'Testimonial Error');
    } finally {
      setSavingTestimonial(false);
    }
  };

  const handleToggleTestimonialActive = async (t: Testimonial) => {
    const { error } = await supabase.from('testimonials').update({ is_active: !t.is_active }).eq('id', t.id);
    if (!error) setTestimonials((prev) => prev.map((x) => x.id === t.id ? { ...x, is_active: !t.is_active } : x));
  };

  const handleDeleteTestimonial = (t: Testimonial) => {
    setDeleteModal({
      isOpen: true,
      productName: t.name,
      message: `Are you sure you want to delete the testimonial from "${t.name}"? This cannot be undone.`,
      onConfirm: async () => {
        closeDeleteModal();
        const { error } = await supabase.from('testimonials').delete().eq('id', t.id);
        if (!error) setTestimonials((prev) => prev.filter((x) => x.id !== t.id));
        else showGlobalError(`Delete failed: ${error.message}`, 'Testimonial Error');
      },
    });
  };

  const loadProductsOrdered = async () => {
    setProductsOrderedLoading(true);
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, items, customer_name, customer_email, created_at, updated_at, fulfillment_status, notes')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Load products ordered error:', error.message);
        setProductsOrderedRows([]);
        return;
      }

      const rows: ProductsOrderedRow[] = [];

      for (const order of (orders || [])) {
        const items: Array<{ id: string; name: string; quantity: number; price: number; unit: string; category?: string }> = Array.isArray(order.items) ? order.items : [];

        // Parse meal voucher from notes: "Voucher: VC-XXXX."
        let mealVoucher: string | null = null;
        const mealVoucherMatch = (order.notes || '').match(/Voucher:\s*([A-Z0-9-]+)/);
        if (mealVoucherMatch) mealVoucher = mealVoucherMatch[1];

        // Parse discount voucher from notes: "Discount Voucher: DV-XXXX"
        let discountVoucher: string | null = null;
        const dvMatch = (order.notes || '').match(/Discount Voucher:\s*([A-Z0-9-]+)/);
        if (dvMatch) discountVoucher = dvMatch[1];

        // Ordered date: created_at formatted dd/mm/yyyy
        const orderedDate = order.created_at
          ? new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '—';

        // Delivered DT: updated_at if fulfillment_status === 'delivered', else '—'
        const deliveredDt = order.fulfillment_status === 'delivered'&& order.updated_at ? new Date(order.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '—';

        for (const item of items) {
          rows.push({
            orderId: order.id,
            productName: item.name || '—',
            productType: item.category || '—',
            item: `${item.quantity} x ${item.name}`,
            mealVoucher,
            discountVoucher,
            orderedDate,
            deliveredDt,
            clientName: order.customer_name || '—',
            clientEmail: order.customer_email || '—',
          });
        }
      }

      setProductsOrderedRows(rows);
    } catch (err) {
      console.log('Unexpected error loading products ordered:', err);
      setProductsOrderedRows([]);
    } finally {
      setProductsOrderedLoading(false);
    }
  };

  return (
    <>
      <VoucherErrorModal
        isOpen={globalErrorModal.open}
        message={globalErrorModal.message}
        title={globalErrorModal.title}
        onClose={closeGlobalError}
      />
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        productName={deleteModal.productName}
        message={deleteModal.message}
        onConfirm={deleteModal.onConfirm}
        onCancel={closeDeleteModal}
      />
      <div className="min-h-screen bg-[#F5F0E8]">
      {showWarning && (
        <InactivityWarningModal
          countdown={countdown}
          onStayLoggedIn={stayLoggedIn}
          onLogOut={logOutNow}
        />
      )}

      {/* Header */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={40} iconName="FireIcon" text={APP_NAME} />
            <div className="hidden sm:block h-5 w-px bg-gray-600" />
            <span className="hidden sm:block text-sm font-medium text-gray-300">Staff Workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-gray-300">{user?.email}</span>
              {userProfile && <RoleBadge role={userProfile.role} />}
            </div>
            <a
              href="/staff/orders"
              className="text-sm font-medium text-[#C4622D] hover:text-[#E07040] transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800 flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2 2 0 002-2V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              Orders
            </a>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-[#C4622D] hover:text-[#E07040] transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1A1612] mb-1">Staff Workspace</h1>
          <p className="text-xs text-[#8C8278]">Manage your products, prices, and media library</p>
        </div>

        {/* Sidebar + Content Layout */}
        <div className="flex gap-6 items-start">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="w-56 flex-shrink-0 bg-white border border-[#EDE7DA] rounded-2xl shadow-sm overflow-hidden sticky top-6">
            <nav className="flex flex-col py-2">
              <button
                onClick={() => { setActiveTab('products'); if (products.length === 0) loadProducts(); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'products' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">🍽️</span>
                <span>Products &amp; Pricing</span>
              </button>
              <button
                onClick={() => { setActiveTab('categories'); if (categoriesList.length === 0) loadCategories(); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'categories' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">🏷️</span>
                <span>Categories</span>
              </button>
              <button
                onClick={() => { setActiveTab('media'); if (files.length === 0) loadFiles(activeBucket); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'media' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">📸</span>
                <span>Media Library</span>
              </button>
              <button
                onClick={() => { setActiveTab('orders'); loadWsOrders(); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'orders' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">📋</span>
                <span>Orders</span>
              </button>
              <button
                onClick={() => { setActiveTab('weekly_menu'); setWeekOffset(0); loadWeeklyMenu(0); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'weekly_menu' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">📅</span>
                <span>Weekly Menu</span>
              </button>
              <button
                onClick={() => { setActiveTab('vouchers'); loadVouchers(); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'vouchers' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">🎟️</span>
                <span>Vouchers</span>
              </button>
              <button
                onClick={() => { setActiveTab('discount_vouchers'); loadDiscountVouchers(); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'discount_vouchers' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">🏷️</span>
                <span>Discount Vouchers</span>
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => { setActiveTab('staff'); if (staffMembers.length === 0) loadStaffMembers(); }}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                    activeTab === 'staff' ? 'bg-purple-50 text-purple-600 border-r-2 border-purple-600' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                  }`}
                >
                  <span className="text-base">👥</span>
                  <span>Staff Management</span>
                </button>
              )}
              <button
                onClick={() => { setActiveTab('homepage_cards'); if (homepageCards.length === 0) loadHomepageCards(); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'homepage_cards' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">🏠</span>
                <span>Homepage Cards</span>
              </button>
              <button
                onClick={() => { setActiveTab('testimonials'); if (testimonials.length === 0) loadTestimonials(); }}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'testimonials' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">💬</span>
                <span>Testimonials</span>
              </button>
              <button
                onClick={() => setActiveTab('reporting')}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left w-full ${
                  activeTab === 'reporting' ? 'bg-[#FDF6EE] text-[#C4622D] border-r-2 border-[#C4622D]' : 'text-[#5C5347] hover:bg-[#FAF5EE] hover:text-[#C4622D]'
                }`}
              >
                <span className="text-base">📊</span>
                <span>Reporting</span>
              </button>
            </nav>
          </aside>

          {/* ── RIGHT CONTENT AREA ── */}
          <div className="flex-1 min-w-0">

        {/* ── PRODUCTS TAB ── */}
        {activeTab === 'products' && (
          <div>
            {/* Product Form Modal */}
            {showForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">
                      {editingProduct ? 'Edit Product' : 'Add New Product'}
                    </h2>
                    <button onClick={() => setShowForm(false)} className="text-[#8C8278] hover:text-[#1A1612] transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={handleSaveProduct} className="px-6 py-5 space-y-4">
                    {formSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">{formSuccess}</div>
                    )}
                    {/* Package Type */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Package Type</label>
                      <select
                        value={form.package_type}
                        onChange={(e) => {
                          const newPackageType = e.target.value;
                          const updatedForm: typeof form = { ...form, package_type: newPackageType };
                          if (!editingProduct && newPackageType === 'package-10') {
                            updatedForm.tags = 'Gluten-Free, Dairy-Free';
                          }
                          setForm(updatedForm);
                        }}
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors bg-white"
                      >
                        {packageTypes.map((pt) => (
                          <option key={pt.value} value={pt.value}>{pt.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* Product Name */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Product Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Grilled Chicken Platter"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                      />
                    </div>
                    {/* Category */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Category</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors bg-white"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    {/* Price + Unit */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">
                          Price (R) {['package-6','package-10','package-12','package-24'].includes(form.package_type) ? '(Optional)' : '*'}
                        </label>
                        <input
                          type="number"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Unit</label>
                        <input
                          type="text"
                          value={form.unit}
                          onChange={(e) => setForm({ ...form, unit: e.target.value })}
                          placeholder="per serving"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                    </div>
                    {/* Description */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Description *</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={3}
                        placeholder="Brief description of the product..."
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors resize-none"
                      />
                    </div>
                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={form.tags}
                        onChange={(e) => setForm({ ...form, tags: e.target.value })}
                        placeholder="e.g. Gluten-Free, Halal, Vegan"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                      />
                    </div>
                    {/* Badge + Min Order */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Badge Label</label>
                        <input
                          type="text"
                          value={form.badge}
                          onChange={(e) => setForm({ ...form, badge: e.target.value })}
                          placeholder="e.g. Popular, New"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Min Order</label>
                        <input
                          type="number"
                          value={form.min_order}
                          onChange={(e) => setForm({ ...form, min_order: e.target.value })}
                          placeholder="e.g. 10"
                          min="1"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                    </div>
                    {/* Toggles */}
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} className="w-4 h-4 accent-[#C4622D]" />
                        <span className="text-sm font-medium text-[#3D3530]">Available</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4 accent-[#C4622D]" />
                        <span className="text-sm font-medium text-[#3D3530]">Featured</span>
                      </label>
                    </div>
                    {/* Product Image */}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Product Image</label>
                      {productImagePreview && (
                        <div className="mb-3 relative w-32 h-32 rounded-xl overflow-hidden border border-[#DDD5C8]">
                          <img src={productImagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => { setProductImagePreview(''); setProductImageFile(null); setSelectedMediaPath(''); }}
                            className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5 hover:bg-white"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => productImageRef.current?.click()}
                          className="flex-1 border border-dashed border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#8C8278] hover:border-[#C4622D] hover:text-[#C4622D] transition-colors text-center"
                        >
                          {uploadingProductImage ? 'Uploading...' : '📁 Upload New Image'}
                        </button>
                        <button
                          type="button"
                          onClick={openMediaPicker}
                          className="flex-1 border border-dashed border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#8C8278] hover:border-[#C4622D] hover:text-[#C4622D] transition-colors text-center"
                        >
                          🖼️ Pick from Library
                        </button>
                      </div>
                      <input ref={productImageRef} type="file" accept="image/*" className="hidden" onChange={handleProductImageSelect} />
                    </div>
                    {/* Media Picker Modal */}
                    {showMediaPicker && (
                      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDE7DA]">
                            <h3 className="font-bold text-[#1A1612]">Pick from Media Library</h3>
                            <button onClick={() => setShowMediaPicker(false)} className="text-[#8C8278] hover:text-[#1A1612]">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="overflow-y-auto p-4 flex-1">
                            {mediaPickerLoading ? (
                              <div className="flex justify-center py-8">
                                <svg className="animate-spin h-6 w-6 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              </div>
                            ) : mediaPickerFiles.length === 0 ? (
                              <p className="text-center text-[#8C8278] py-8 text-sm">No images in Product Images library.</p>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {mediaPickerFiles.map((file) => (
                                  <button
                                    key={file.id}
                                    type="button"
                                    onClick={() => handleSelectMediaImage(file)}
                                    className="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-[#C4622D] transition-all"
                                  >
                                    <img src={file.signedUrl} alt={file.name} className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="flex-1 px-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors"
                      >Cancel</button>
                      <button
                        type="submit"
                        disabled={saving || uploadingProductImage}
                        className="flex-1 px-4 py-2.5 bg-[#C4622D] text-white rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {saving ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</> : editingProduct ? 'Save Changes' : 'Add Product'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Products Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Products & Pricing</h2>
                <p className="text-xs text-[#8C8278] mt-0.5">{products.length} products</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    placeholder="Search by product name..."
                    className="border border-[#DDD5C8] rounded-xl px-4 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors w-56"
                  />
                  <button
                    onClick={() => {}}
                    className="border border-[#DDD5C8] text-[#5C5347] px-4 py-2 rounded-xl text-sm font-semibold hover:border-[#C4622D] hover:text-[#C4622D] transition-colors"
                  >
                    Search
                  </button>
                </div>
                <button
                  onClick={openCreateForm}
                  className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Product
                </button>
              </div>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 flex-wrap mb-6">
              {['All', ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    if (cat === 'Weekly Menu') { window.location.href = '/weekly-menu'; return; }
                    setFilterCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    filterCategory === cat
                      ? 'bg-[#C4622D] text-white'
                      : 'bg-white border border-[#DDD5C8] text-[#5C5347] hover:border-[#C4622D] hover:text-[#C4622D]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products List */}
            {productsLoading ? (
              <div className="flex justify-center py-16">
                <svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 text-[#8C8278]">
                <p className="text-lg font-medium mb-2">No products found</p>
                <p className="text-sm">Add your first product to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="bg-white rounded-2xl border border-[#EDE7DA] p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#F5F0E8]">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#1A1612] text-sm">{product.name}</p>
                        {product.badge && (
                          <span className="bg-[#C4622D] text-white text-xs px-2 py-0.5 rounded-full font-semibold">{product.badge}</span>
                        )}
                        {!product.available && (
                          <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Unavailable</span>
                        )}
                      </div>
                      <p className="text-xs text-[#8C8278] mt-0.5">{product.category}</p>
                      <p className="text-sm font-bold text-[#C4622D] mt-1">
                        {product.price > 0 ? `R${Number(product.price).toFixed(2)} ${product.unit}` : product.package_type !== 'none' ? 'Package price on request' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggleAvailable(product)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                          product.available
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' :'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {product.available ? 'Available' : 'Hidden'}
                      </button>
                      <button
                        onClick={() => openEditForm(product)}
                        className="text-xs font-semibold text-[#C4622D] hover:underline"
                      >Edit</button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        disabled={deletingProductId === product.id}
                        className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
                      >{deletingProductId === product.id ? '...' : 'Delete'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CATEGORIES TAB ── */}
        {activeTab === 'categories' && (
          <div>
            {showCategoryForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
                    <button onClick={() => setShowCategoryForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={handleSaveCategory} className="px-6 py-5 space-y-4">
                    {categoryFormSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">{categoryFormSuccess}</div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Category Name *</label>
                      <input
                        type="text"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        placeholder="e.g. Catering Packages"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Sort Order</label>
                      <input
                        type="number"
                        value={categoryForm.sort_order}
                        onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })}
                        placeholder="0"
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowCategoryForm(false)} className="flex-1 px-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                      <button type="submit" disabled={savingCategory} className="flex-1 px-4 py-2.5 bg-[#C4622D] text-white rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60">
                        {savingCategory ? 'Saving...' : editingCategory ? 'Save Changes' : 'Add Category'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Product Categories</h2>
                <p className="text-xs text-[#8C8278] mt-0.5">{categoriesList.length} categories</p>
              </div>
              <button onClick={openAddCategoryForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Category
              </button>
            </div>
            {categoriesLoading ? (
              <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : categoriesList.length === 0 ? (
              <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium mb-2">No categories yet</p><p className="text-sm">Add your first category.</p></div>
            ) : (
              <div className="space-y-3">
                {categoriesList.map((cat) => (
                  <div key={cat.id} className="bg-white rounded-2xl border border-[#EDE7DA] px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[#1A1612] text-sm">{cat.name}</p>
                      <p className="text-xs text-[#8C8278] mt-0.5">{cat.slug.charAt(0).toUpperCase() + cat.slug.slice(1)} · Order: {cat.sort_order}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleCategoryActive(cat)}
                        disabled={togglingCategoryId === cat.id}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${cat.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                      >{togglingCategoryId === cat.id ? '...' : cat.active ? 'Active' : 'Inactive'}</button>
                      <button onClick={() => openEditCategoryForm(cat)} className="text-xs font-semibold text-[#C4622D] hover:underline">Edit</button>
                      <button onClick={() => handleDeleteCategory(cat)} disabled={deletingCategoryId === cat.id} className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50">{deletingCategoryId === cat.id ? '...' : 'Delete'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MEDIA LIBRARY TAB ── */}
        {activeTab === 'media' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#1A1612]">Media Library</h2>
            </div>
            {/* Bucket selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {buckets.map((bucket) => (
                <button
                  key={bucket.id}
                  onClick={() => handleBucketChange(bucket.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    activeBucket === bucket.id
                      ? 'border-[#C4622D] bg-[#FFF5EF]'
                      : 'border-[#EDE7DA] bg-white hover:border-[#C4622D]/40'
                  }`}
                >
                  <div className="text-2xl mb-1">{bucket.icon}</div>
                  <p className="font-semibold text-[#1A1612] text-sm">{bucket.label}</p>
                  <p className="text-xs text-[#8C8278] mt-0.5">{bucket.description}</p>
                </button>
              ))}
            </div>

            {activeBucket === 'document-management' ? (
              <GoogleDriveDocuments />
            ) : (
              <>
                {/* Upload area */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center mb-6 transition-colors ${dragOver ? 'border-[#C4622D] bg-[#FFF5EF]' : 'border-[#DDD5C8] hover:border-[#C4622D]/50'}`}
                >
                  <div className="text-4xl mb-3">📸</div>
                  <p className="font-semibold text-[#1A1612] mb-1">Drop images here or click to upload</p>
                  <p className="text-xs text-[#8C8278] mb-4">Supports JPG, PNG, WebP</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-[#C4622D] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60"
                  >
                    {uploading ? 'Uploading...' : 'Choose Files'}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
                </div>
                {uploadSuccess && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mb-4">{uploadSuccess}</div>}

                {/* Files grid */}
                {mediaLoading ? (
                  <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
                ) : files.length === 0 ? (
                  <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium mb-2">No files yet</p><p className="text-sm">Upload your first image above.</p></div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {files.map((file) => (
                      <div key={file.id} className="group relative bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                        <div className="aspect-square">
                          <img src={file.signedUrl} alt={file.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2">
                          <p className="text-xs text-[#5C5347] truncate font-medium">{file.name}</p>
                          <p className="text-xs text-[#8C8278]">{formatFileSize(file.metadata?.size)}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(file.name)}
                          disabled={deletingId === file.name}
                          className="absolute top-2 right-2 bg-white/90 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#1A1612]">Orders</h2>
              <button onClick={loadWsOrders} className="text-sm font-semibold text-[#C4622D] hover:underline">Refresh</button>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <input
                type="text"
                value={wsOrderSearch}
                onChange={(e) => setWsOrderSearch(e.target.value)}
                placeholder="Search by name, email or payment ID..."
                className="flex-1 min-w-[200px] border border-[#DDD5C8] rounded-xl px-4 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
              />
              <select value={wsFilterPayment} onChange={(e) => setWsFilterPayment(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white">
                <option value="all">All Payments</option>
                {PAYMENT_OPTIONS.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
              </select>
              <select value={wsFilterFulfillment} onChange={(e) => setWsFilterFulfillment(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white">
                <option value="all">All Fulfillment</option>
                {FULFILLMENT_OPTIONS.map((s) => <option key={s} value={s}>{FULFILLMENT_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            {wsOrdersLoading ? (
              <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : wsOrdersError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{wsOrdersError}</div>
            ) : wsFilteredOrders.length === 0 ? (
              <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium">No orders found</p></div>
            ) : (
              <div className="space-y-3">
                {wsFilteredOrders.map((order) => {
                  const isExpanded = wsExpandedOrderId === order.id;
                  const updateState = getWsOrderUpdateState(order.id);
                  const discountMatch = order.notes?.match(/\(R([\d.]+)\s+credit\)/);
                  const discountAmount = discountMatch ? parseFloat(discountMatch[1]) : 0;
                  const computedTotal = order.subtotal - discountAmount + order.delivery_fee;
                  return (
                    <div key={order.id} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                      <button
                        onClick={() => setWsExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FDFAF7] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold text-[#1A1612] text-sm">{order.customer_name}</p>
                            <p className="text-xs text-[#8C8278] mt-0.5">{order.customer_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${PAYMENT_STATUS_COLORS[order.payment_status]}`}>
                            {PAYMENT_STATUS_LABELS[order.payment_status]}
                          </span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${FULFILLMENT_STATUS_COLORS[order.fulfillment_status]}`}>
                            {FULFILLMENT_STATUS_LABELS[order.fulfillment_status]}
                          </span>
                          <p className="text-sm font-bold text-[#1A1612]">R{computedTotal.toFixed(2)}</p>
                          <svg className={`w-4 h-4 text-[#8C8278] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-[#EDE7DA] px-5 py-4 space-y-4">
                          {/* Order details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-[#8C8278] mb-1">Phone</p>
                              <p className="font-medium text-[#1A1612]">{order.customer_phone || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#8C8278] mb-1">Event Date</p>
                              <p className="font-medium text-[#1A1612]">{order.event_date ? formatDate(order.event_date) : '—'}</p>
                            </div>
                            <div className="sm:col-span-2">
                              <p className="text-xs text-[#8C8278] mb-1">Delivery Address</p>
                              <p className="font-medium text-[#1A1612]">{order.delivery_address || '—'}</p>
                            </div>
                            {order.notes && (
                              <div className="sm:col-span-2">
                                <p className="text-xs text-[#8C8278] mb-1">Notes</p>
                                <p className="font-medium text-[#1A1612] text-xs">{order.notes}</p>
                              </div>
                            )}
                          </div>
                          {/* Items */}
                          <div>
                            <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-2">Items</p>
                            <div className="space-y-1">
                              {(order.items || []).map((item, i) => (
                                <div key={i} className="flex justify-between text-sm py-1 border-b border-[#F5F0E8] last:border-0">
                                  <span className="text-[#1A1612]">{item.quantity}× {item.name}</span>
                                  <span className="font-semibold text-[#1A1612]">R{(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Payment Summary */}
                          <div className="bg-[#F5F0E8] rounded-xl p-4 text-sm space-y-1">
                            <p className="font-bold text-[#1A1612] text-base mb-2">Payment Summary</p>
                            <div className="flex justify-between"><span className="text-[#5C5347]">Subtotal</span><span className="font-semibold">R{Number(order.subtotal).toFixed(2)}</span></div>
                            {discountAmount > 0 && (
                              <div className="flex justify-between"><span className="text-red-600">Discount</span><span className="font-semibold text-red-600">-R{discountAmount.toFixed(2)}</span></div>
                            )}
                            <div className="flex justify-between"><span className="text-[#5C5347]">Delivery</span><span className="font-semibold">R{Number(order.delivery_fee).toFixed(2)}</span></div>
                            <div className="flex justify-between border-t border-[#DDD5C8] pt-1 mt-1"><span className="font-bold text-[#1A1612]">Total</span><span className="font-bold text-[#C4A882]">R{computedTotal.toFixed(2)}</span></div>
                          </div>
                          {/* Status updates */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-[#5C5347] mb-2">Fulfillment Status</p>
                              <select
                                value={order.fulfillment_status}
                                onChange={(e) => handleWsFulfillmentUpdate(order.id, e.target.value as FulfillmentStatus)}
                                disabled={updateState.fulfillmentSaving}
                                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white disabled:opacity-60"
                              >
                                {FULFILLMENT_OPTIONS.map((s) => <option key={s} value={s}>{FULFILLMENT_STATUS_LABELS[s]}</option>)}
                              </select>
                              {updateState.fulfillmentSuccess && <p className="text-xs text-green-600 mt-1">✓ Updated</p>}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[#5C5347] mb-2">Payment Status</p>
                              <select
                                value={order.payment_status}
                                onChange={(e) => handleWsPaymentUpdate(order.id, e.target.value as PaymentStatus)}
                                disabled={updateState.paymentSaving}
                                className="w-full border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white disabled:opacity-60"
                              >
                                {PAYMENT_OPTIONS.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
                              </select>
                              {updateState.paymentSuccess && <p className="text-xs text-green-600 mt-1">✓ Updated</p>}
                            </div>
                          </div>
                          <p className="text-xs text-[#8C8278]">Created: {formatDate(order.created_at)}</p>
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
          <div>
            {/* Add/Edit Item Modal */}
            {showWeeklyMenuForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">{editingWeeklyEntry ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                    <button onClick={() => setShowWeeklyMenuForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <form onSubmit={handleSaveWeeklyEntry} className="px-6 py-5 space-y-4">
                    {weeklyMenuFormSuccess && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">{weeklyMenuFormSuccess}</div>}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Date *</label>
                      <input type="date" value={weeklyMenuForm.meal_date} onChange={(e) => setWeeklyMenuForm({ ...weeklyMenuForm, meal_date: e.target.value })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={weeklyMenuForm.is_closed} onChange={(e) => setWeeklyMenuForm({ ...weeklyMenuForm, is_closed: e.target.checked })} className="w-4 h-4 accent-[#C4622D]" />
                      <span className="text-sm font-medium text-[#3D3530]">Mark day as closed</span>
                    </label>
                    {weeklyMenuForm.is_closed ? (
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Closed Reason</label>
                        <input type="text" value={weeklyMenuForm.closed_reason} onChange={(e) => setWeeklyMenuForm({ ...weeklyMenuForm, closed_reason: e.target.value })} placeholder="e.g. Public Holiday" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Meal Name *</label>
                          <input type="text" value={weeklyMenuForm.meal_name} onChange={(e) => setWeeklyMenuForm({ ...weeklyMenuForm, meal_name: e.target.value })} placeholder="e.g. Grilled Chicken" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Description</label>
                          <textarea value={weeklyMenuForm.description} onChange={(e) => setWeeklyMenuForm({ ...weeklyMenuForm, description: e.target.value })} rows={2} placeholder="Brief description..." className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors resize-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Price (R) *</label>
                          <input type="number" value={weeklyMenuForm.price} onChange={(e) => setWeeklyMenuForm({ ...weeklyMenuForm, price: e.target.value })} placeholder="0.00" min="0" step="0.01" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                        </div>
                      </>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowWeeklyMenuForm(false)} className="flex-1 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                      <button type="submit" disabled={savingWeeklyEntry} className="flex-1 py-2.5 rounded-xl bg-[#C4622D] text-white text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                        {savingWeeklyEntry ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</> : editingWeeklyEntry ? 'Update Item' : 'Add Item'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Close Day Modal */}
            {closingDayDate && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
                  <h3 className="font-bold text-[#1A1612] mb-3">Close Day</h3>
                  <p className="text-sm text-[#5C5347] mb-4">Mark <strong>{closingDayDate}</strong> as closed. Optionally add a reason.</p>
                  <input type="text" value={closingDayReason} onChange={(e) => setClosingDayReason(e.target.value)} placeholder="e.g. Public Holiday (optional)" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors mb-4" />
                  <div className="flex gap-3">
                    <button onClick={() => { setClosingDayDate(null); setClosingDayReason(''); }} className="flex-1 py-2.5 rounded-xl border border-[#DDD5C8] text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                    <button onClick={() => handleMarkDayClosed(closingDayDate, closingDayReason)} disabled={savingClosedDay} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
                      {savingClosedDay ? 'Saving...' : 'Close Day'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Week navigator */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Weekly Menu</h2>
                <p className="text-xs text-[#8C8278] mt-0.5">
                  {(() => {
                    const { mondayStr, fridayStr } = getWeekBoundsForOffset(weekOffset);
                    return `${mondayStr} — ${fridayStr}`;
                  })()}
                  {weekOffset === 0 ? ' (Current Week)' : weekOffset > 0 ? ` (+${weekOffset} week${weekOffset > 1 ? 's' : ''})` : ` (${weekOffset} week${weekOffset < -1 ? 's' : ''})`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { const newOffset = weekOffset - 1; setWeekOffset(newOffset); loadWeeklyMenu(newOffset); }} className="p-2 rounded-xl border border-[#DDD5C8] hover:bg-[#F5F0E8] transition-colors">
                  <svg className="w-4 h-4 text-[#5C5347]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => { setWeekOffset(0); loadWeeklyMenu(0); }} className="px-3 py-1.5 text-xs font-semibold text-[#C4622D] border border-[#C4622D]/30 rounded-xl hover:bg-[#FFF5EF] transition-colors">Today</button>
                <button onClick={() => { const newOffset = weekOffset + 1; setWeekOffset(newOffset); loadWeeklyMenu(newOffset); }} className="p-2 rounded-xl border border-[#DDD5C8] hover:bg-[#F5F0E8] transition-colors">
                  <svg className="w-4 h-4 text-[#5C5347]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
                {weekOffset >= 0 && (
                  <button onClick={() => { const { mondayStr } = getWeekBoundsForOffset(weekOffset); openAddWeeklyMenuForm(mondayStr); }} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Add Item
                  </button>
                )}
              </div>
            </div>

            {weeklyMenuLoading ? (
              <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(() => {
                  const { monday } = getWeekBoundsForOffset(weekOffset);
                  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
                  return days.map((dayName, i) => {
                    const d = new Date(monday);
                    d.setDate(monday.getDate() + i);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    const dayEntries = weeklyMenuEntries.filter((e) => e.meal_date === dateStr);
                    const closedEntry = dayEntries.find((e) => e.is_closed);
                    const openEntries = dayEntries.filter((e) => !e.is_closed);
                    return (
                      <div key={dayName} className="bg-white rounded-2xl border border-[#EDE7DA] overflow-hidden">
                        <div className="bg-[#F5F0E8] px-3 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#C4622D] uppercase tracking-wider">{dayName}</p>
                            <p className="text-xs text-[#8C8278]">{d.getDate()} {d.toLocaleString('en', { month: 'short' })}</p>
                          </div>
                          {!closedEntry && weekOffset >= 0 && (
                            <button onClick={() => setClosingDayDate(dateStr)} className="text-xs text-[#8C8278] hover:text-red-500 transition-colors font-medium">Close Day</button>
                          )}
                        </div>
                        <div className="p-3 space-y-2 min-h-[80px]">
                          {closedEntry ? (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                              <p className="text-xs font-semibold text-red-600">🚫 Closed</p>
                              {closedEntry.closed_reason && <p className="text-xs text-red-500 mt-0.5">{closedEntry.closed_reason}</p>}
                              {weekOffset >= 0 && (
                                <button onClick={() => handleReopenDay(dateStr)} className="mt-2 text-xs text-red-600 underline hover:no-underline">Reopen day</button>
                              )}
                            </div>
                          ) : openEntries.length > 0 ? (
                            openEntries.map((entry) => (
                              <div key={entry.id} className="bg-[#F5F0E8] rounded-xl p-2.5">
                                <p className="text-sm font-semibold text-[#1A1612] leading-tight">{entry.meal_name}</p>
                                {entry.description && <p className="text-xs text-[#8C8278] mt-0.5 line-clamp-2">{entry.description}</p>}
                                {entry.price !== null && <p className="text-sm font-bold text-[#C4622D] mt-1">R{Number(entry.price).toFixed(2)}</p>}
                                {weekOffset >= 0 && (
                                  <div className="flex gap-2 mt-2">
                                    <button onClick={() => openEditWeeklyMenuForm(entry)} className="text-xs text-[#C4622D] font-semibold hover:underline">Edit</button>
                                    <button onClick={() => handleDeleteWeeklyEntry(entry)} disabled={deletingWeeklyEntryId === entry.id} className="text-xs text-red-500 font-semibold hover:underline disabled:opacity-50">{deletingWeeklyEntryId === entry.id ? '...' : 'Delete'}</button>
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-[#B5ADA5] text-center py-4">No items</p>
                          )}
                        </div>
                        {/* Day actions */}
                        {!closedEntry && weekOffset >= 0 && (
                          <div className="px-3 pb-3 flex gap-2">
                            <button onClick={() => openAddWeeklyMenuForm(dateStr)} className="flex-1 text-xs font-semibold text-[#C4622D] border border-[#C4622D]/30 rounded-lg py-1.5 hover:bg-[#FFF5EF] transition-colors">+ Add</button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── VOUCHERS TAB ── */}
        {activeTab === 'vouchers' && (
          <div>
            {/* Issue Voucher Modal */}
            {showIssueVoucherForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">Issue New Voucher</h2>
                    <button onClick={() => setShowIssueVoucherForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <form onSubmit={handleIssueVoucher} className="px-6 py-5 space-y-4">
                    {issueVoucherSuccess && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">{issueVoucherSuccess}</div>}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Customer Name *</label>
                      <input type="text" value={issueVoucherForm.customer_name} onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, customer_name: e.target.value })} placeholder="Full name" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Email *</label>
                      <input type="email" value={issueVoucherForm.customer_email} onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, customer_email: e.target.value })} placeholder="customer@email.com" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Phone</label>
                      <input type="tel" value={issueVoucherForm.customer_phone} onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, customer_phone: e.target.value })} placeholder="+27..." className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Total Meals *</label>
                      <select value={issueVoucherForm.total_meals} onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, total_meals: e.target.value })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white">
                        <option value="6">6 Meals</option>
                        <option value="10">10 Meals</option>
                        <option value="12">12 Meals</option>
                        <option value="24">24 Meals</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Notes</label>
                      <textarea value={issueVoucherForm.notes} onChange={(e) => setIssueVoucherForm({ ...issueVoucherForm, notes: e.target.value })} rows={2} placeholder="Optional notes..." className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors resize-none" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowIssueVoucherForm(false)} className="flex-1 px-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                      <button type="submit" disabled={issuingVoucher} className="flex-1 px-4 py-2.5 bg-[#C4622D] text-white rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60">
                        {issuingVoucher ? 'Issuing...' : 'Issue Voucher'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Meal Vouchers</h2>
                <p className="text-xs text-[#8C8278] mt-0.5">{vouchers.length} vouchers</p>
              </div>
              <button onClick={() => setShowIssueVoucherForm(true)} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Issue Voucher
              </button>
            </div>

            {/* Search */}
            <div className="mb-4">
              <input type="text" value={voucherSearchQuery} onChange={(e) => setVoucherSearchQuery(e.target.value)} placeholder="Search by name, email or code..." className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
            </div>

            {vouchersLoading ? (
              <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Voucher list */}
                <div className="space-y-3">
                  {vouchers.filter((v) => {
                    if (!voucherSearchQuery) return true;
                    const q = voucherSearchQuery.toLowerCase();
                    return v.customer_name.toLowerCase().includes(q) || v.customer_email.toLowerCase().includes(q) || v.voucher_code.toLowerCase().includes(q);
                  }).map((voucher) => {
                    const statusColors: Record<string, string> = {
                      paid: 'bg-green-100 text-green-700 border-green-200',
                      unpaid: 'bg-amber-100 text-amber-700 border-amber-200',
                      redeemed: 'bg-gray-100 text-gray-600 border-gray-200',
                      expired: 'bg-red-100 text-red-600 border-red-200',
                    };
                    return (
                      <div
                        key={voucher.id}
                        onClick={() => handleSelectVoucher(voucher)}
                        className={`bg-white rounded-2xl border cursor-pointer transition-all p-4 ${selectedVoucher?.id === voucher.id ? 'border-[#C4622D] shadow-md' : 'border-[#EDE7DA] hover:border-[#C4622D]/40'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-[#1A1612] text-sm">{voucher.customer_name}</p>
                            <p className="text-xs text-[#8C8278] mt-0.5">{voucher.customer_email}</p>
                            <p className="text-xs font-mono text-[#C4622D] mt-1">{voucher.voucher_code}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusColors[voucher.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {voucher.status.charAt(0).toUpperCase() + voucher.status.slice(1)}
                            </span>
                            <p className="text-xs text-[#8C8278] mt-1">{voucher.meals_remaining}/{voucher.total_meals} meals left</p>
                          </div>
                        </div>
                        {voucher.status === 'unpaid' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMarkVoucherAsPaid(voucher); }}
                            disabled={markingVoucherPaidId === voucher.id}
                            className="mt-3 w-full py-1.5 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-60"
                          >
                            {markingVoucherPaidId === voucher.id ? 'Marking...' : 'Mark as Paid'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Redemption detail panel */}
                {selectedVoucher && (
                  <div className="bg-white rounded-2xl border border-[#EDE7DA] p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-[#1A1612]">{selectedVoucher.customer_name}</h3>
                        <p className="text-xs font-mono text-[#C4622D] mt-0.5">{selectedVoucher.voucher_code}</p>
                      </div>
                      <button onClick={() => setSelectedVoucher(null)} className="text-[#8C8278] hover:text-[#1A1612]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#F5F0E8] rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-[#C4622D]">{selectedVoucher.meals_remaining}</p>
                        <p className="text-xs text-[#8C8278]">Meals Remaining</p>
                      </div>
                      <div className="bg-[#F5F0E8] rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-[#1A1612]">{selectedVoucher.total_meals}</p>
                        <p className="text-xs text-[#8C8278]">Total Meals</p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-[#5C5347] uppercase tracking-wider mb-3">Redemption History</p>
                    {redemptionsLoading ? (
                      <div className="flex justify-center py-4"><svg className="animate-spin h-5 w-5 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
                    ) : voucherRedemptions.length === 0 ? (
                      <p className="text-xs text-[#8C8278] text-center py-4">No redemptions yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {voucherRedemptions.map((r, i) => (
                          <RedemptionAuditRow key={r.id} redemption={r} index={i + 1} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── DISCOUNT VOUCHERS TAB ── */}
        {activeTab === 'discount_vouchers' && (
          <div>
            {/* DV Form Modal */}
            {showDvForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">{editingDv ? 'Edit Discount Voucher' : 'Generate Discount Voucher'}</h2>
                    <button onClick={() => setShowDvForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <form onSubmit={handleSaveDv} className="px-6 py-5 space-y-4">
                    {dvFormSuccess && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">{dvFormSuccess}</div>}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Discount Amount (R) *</label>
                      <input type="number" value={dvForm.dv_amount} onChange={(e) => setDvForm({ ...dvForm, dv_amount: e.target.value })} placeholder="e.g. 50.00" min="0.01" step="0.01" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Expiry Date *</label>
                      <input type="date" value={dvForm.expiry_date} onChange={(e) => setDvForm({ ...dvForm, expiry_date: e.target.value })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    {editingDv && (
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Status</label>
                        <select value={dvForm.status} onChange={(e) => setDvForm({ ...dvForm, status: e.target.value as 'Active' | 'Inactive' })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white">
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowDvForm(false)} className="flex-1 px-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                      <button type="submit" disabled={savingDv} className="flex-1 px-4 py-2.5 bg-[#C4622D] text-white rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60">
                        {savingDv ? 'Saving...' : editingDv ? 'Save Changes' : 'Generate'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Discount Vouchers</h2>
                <p className="text-xs text-[#8C8278] mt-0.5">{discountVouchers.length} vouchers</p>
              </div>
              <button onClick={openCreateDvForm} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Generate DV
              </button>
            </div>

            <div className="mb-4">
              <input type="text" value={dvSearchQuery} onChange={(e) => setDvSearchQuery(e.target.value)} placeholder="Search by code..." className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
            </div>

            {dvLoading ? (
              <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : discountVouchers.length === 0 ? (
              <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium">No discount vouchers yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#EDE7DA]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Code</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Amount</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider hidden md:table-cell">Expiry</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider hidden sm:table-cell">Used</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F0E8]">
                    {discountVouchers
                      .filter((dv) => !dvSearchQuery || dv.dv_code.toLowerCase().includes(dvSearchQuery.toLowerCase()))
                      .map((dv) => {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const expiry = new Date(dv.expiry_date); expiry.setHours(0,0,0,0);
                        const isExpired = expiry < today;
                        return (
                          <tr key={dv.id} className="hover:bg-[#FDFAF7] transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm font-semibold text-[#1A1612]">{dv.dv_code}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-bold text-[#1A1612]">R{Number(dv.dv_amount).toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${isExpired ? 'bg-gray-100 text-gray-500' : dv.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {isExpired ? 'Expired' : dv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className={`text-xs ${isExpired ? 'text-red-500 font-semibold' : 'text-[#5C5347]'}`}>{dv.expiry_date}</span>
                            </td>
                            <td className="px-4 py-3 text-center hidden sm:table-cell">
                              <span className="text-xs font-semibold text-[#1A1612]">{dv.times_used}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => handleGenerateDvQr(dv)}
                                  disabled={generatingQrId === dv.id}
                                  className="text-xs font-semibold text-white bg-[#1A1612] hover:bg-[#3D342D] px-2.5 py-1 rounded-full transition-colors disabled:opacity-60 whitespace-nowrap flex items-center gap-1"
                                  title="Download QR Code"
                                >
                                  {generatingQrId === dv.id ? (
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                  ) : (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                  )} QR
                                </button>
                                <button onClick={() => openEditDvForm(dv)} className="text-xs font-semibold text-[#C4622D] hover:underline whitespace-nowrap">Edit</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── STAFF MANAGEMENT TAB ── */}
        {activeTab === 'staff' && isSuperAdmin && (
          <div>
            {showInviteForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">Invite Staff Member</h2>
                    <button onClick={() => setShowInviteForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <form onSubmit={handleInviteStaff} className="px-6 py-5 space-y-4">
                    {inviteSuccess && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">{inviteSuccess}</div>}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Full Name *</label>
                      <input type="text" value={inviteForm.full_name} onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })} placeholder="Jane Smith" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Email *</label>
                      <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="jane@example.com" className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Role</label>
                      <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as StaffRole })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white">
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowInviteForm(false)} className="flex-1 px-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                      <button type="submit" disabled={inviting} className="flex-1 px-4 py-2.5 bg-[#C4622D] text-white rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60">
                        {inviting ? 'Sending...' : 'Send Invitation'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Staff Management</h2>
                <p className="text-xs text-[#8C8278] mt-0.5">{staffMembers.length} members</p>
              </div>
              <button onClick={() => setShowInviteForm(true)} className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Invite Staff
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-5 flex-wrap">
              <select value={staffRoleFilter} onChange={(e) => setStaffRoleFilter(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white">
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
              <select value={staffStatusFilter} onChange={(e) => setStaffStatusFilter(e.target.value)} className="border border-[#DDD5C8] rounded-xl px-3 py-2 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {resetPasswordMsg && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mb-4">{resetPasswordMsg}</div>}

            {staffLoading ? (
              <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : filteredStaffMembers.length === 0 ? (
              <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium">No staff members found</p></div>
            ) : (
              <div className="space-y-3">
                {filteredStaffMembers.map((member) => (
                  <div key={member.id} className="bg-white rounded-2xl border border-[#EDE7DA] px-5 py-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#1A1612] text-sm">{member.full_name}</p>
                        <RoleBadge role={member.role} />
                        {!member.is_active && <span className="text-xs bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-semibold">Suspended</span>}
                      </div>
                      <p className="text-xs text-[#8C8278] mt-0.5">{member.email}</p>
                    </div>
                    {member.id !== user?.id && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetPassword(member)}
                          disabled={resetPasswordId === member.id}
                          className="text-xs font-semibold text-[#5C5347] border border-[#DDD5C8] px-3 py-1.5 rounded-full hover:bg-[#F5F0E8] transition-colors disabled:opacity-50"
                        >{resetPasswordId === member.id ? '...' : 'Reset Password'}</button>
                        {member.is_active ? (
                          <button onClick={() => handleSuspendStaff(member)} disabled={staffActionId === member.id} className="text-xs font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50">{staffActionId === member.id ? '...' : 'Suspend'}</button>
                        ) : (
                          <button onClick={() => handleReinstateStaff(member)} disabled={staffActionId === member.id} className="text-xs font-semibold text-green-600 border border-green-200 px-3 py-1.5 rounded-full hover:bg-green-50 transition-colors disabled:opacity-50">{staffActionId === member.id ? '...' : 'Reinstate'}</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HOMEPAGE CARDS TAB ── */}
        {activeTab === 'homepage_cards' && (
          <div>
            {showCardForm && editingCard && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">
                      {CARD_TYPE_ICONS[editingCard.card_type]} Edit {CARD_TYPE_LABELS[editingCard.card_type]}
                    </h2>
                    <button onClick={() => setShowCardForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <form onSubmit={handleSaveCard} className="px-6 py-5 space-y-4">
                    {cardFormSuccess && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">{cardFormSuccess}</div>}
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Title *</label>
                      <input type="text" value={cardForm.title || ''} onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Description</label>
                      <textarea value={cardForm.description || ''} onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })} rows={3} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors resize-none" />
                    </div>
                    {editingCard.card_type === 'customer_review' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Reviewer Name</label>
                          <input type="text" value={cardForm.reviewer_name || ''} onChange={(e) => setCardForm({ ...cardForm, reviewer_name: e.target.value })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Reviewer Event</label>
                          <input type="text" value={cardForm.reviewer_event || ''} onChange={(e) => setCardForm({ ...cardForm, reviewer_event: e.target.value })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Rating (1-5)</label>
                          <input type="number" min="1" max="5" value={cardForm.rating || 5} onChange={(e) => setCardForm({ ...cardForm, rating: Number(e.target.value) })} className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors" />
                        </div>
                      </>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={cardForm.is_visible ?? true} onChange={(e) => setCardForm({ ...cardForm, is_visible: e.target.checked })} className="w-4 h-4 accent-[#C4622D]" />
                      <span className="text-sm font-medium text-[#3D3530]">Visible on homepage</span>
                    </label>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowCardForm(false)} className="flex-1 px-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors">Cancel</button>
                      <button type="submit" disabled={savingCard} className="flex-1 px-4 py-2.5 bg-[#C4622D] text-white rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60">
                        {savingCard ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Homepage Cards</h2>
                <p className="text-xs text-[#8C8278] mt-0.5">Manage the cards displayed on the homepage hero section</p>
              </div>
              <button onClick={loadHomepageCards} className="text-sm font-semibold text-[#C4622D] hover:underline">Refresh</button>
            </div>

            {cardsLoading ? (
              <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : homepageCards.length === 0 ? (
              <div className="text-center py-16 text-[#8C8278]"><p className="text-lg font-medium">No homepage cards found</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {homepageCards.map((card) => (
                  <div key={card.id} className={`bg-white rounded-2xl border p-5 ${card.is_visible ? 'border-[#EDE7DA]' : 'border-gray-200 opacity-60'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{CARD_TYPE_ICONS[card.card_type]}</span>
                        <span className="text-xs font-semibold text-[#8C8278] uppercase tracking-wider">{CARD_TYPE_LABELS[card.card_type]}</span>
                      </div>
                      <button
                        onClick={() => handleToggleCardVisibility(card)}
                        disabled={togglingCardId === card.id}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${card.is_visible ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                      >{togglingCardId === card.id ? '...' : card.is_visible ? 'Visible' : 'Hidden'}</button>
                    </div>
                    <p className="font-semibold text-[#1A1612] text-sm mb-1">{card.title}</p>
                    {card.description && <p className="text-xs text-[#8C8278] line-clamp-2">{card.description}</p>}
                    {card.reviewer_name && <p className="text-xs text-[#5C5347] mt-1 font-medium">— {card.reviewer_name}</p>}
                    <button onClick={() => openCardEditForm(card)} className="mt-3 text-xs font-semibold text-[#C4622D] hover:underline">Edit</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TESTIMONIALS TAB ── */}
        {activeTab === 'testimonials' && (
          <div>
            {/* Testimonial Form Modal */}
            {showTestimonialForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE7DA]">
                    <h2 className="font-bold text-[#1A1612] text-lg">{editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}</h2>
                    <button onClick={() => setShowTestimonialForm(false)} className="text-[#8C8278] hover:text-[#1A1612]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Quote *</label>
                      <textarea
                        value={testimonialForm.quote}
                        onChange={(e) => setTestimonialForm({ ...testimonialForm, quote: e.target.value })}
                        rows={4}
                        placeholder="What the customer said..."
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Customer Name *</label>
                        <input
                          type="text"
                          value={testimonialForm.name}
                          onChange={(e) => setTestimonialForm({ ...testimonialForm, name: e.target.value })}
                          placeholder="e.g. Jane Smith"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Role / Event *</label>
                        <input
                          type="text"
                          value={testimonialForm.role}
                          onChange={(e) => setTestimonialForm({ ...testimonialForm, role: e.target.value })}
                          placeholder="e.g. Wedding · 80 guests"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Avatar URL (optional)</label>
                      <input
                        type="url"
                        value={testimonialForm.avatar_url}
                        onChange={(e) => setTestimonialForm({ ...testimonialForm, avatar_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Rating (1–5)</label>
                        <select
                          value={testimonialForm.rating}
                          onChange={(e) => setTestimonialForm({ ...testimonialForm, rating: Number(e.target.value) })}
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] bg-white"
                        >
                          {[5,4,3,2,1].map((r) => <option key={r} value={r}>{r} Star{r !== 1 ? 's' : ''}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#3D3530] mb-1.5">Display Order</label>
                        <input
                          type="number"
                          value={testimonialForm.display_order}
                          onChange={(e) => setTestimonialForm({ ...testimonialForm, display_order: e.target.value })}
                          min="0"
                          className="w-full border border-[#DDD5C8] rounded-xl px-4 py-2.5 text-sm text-[#1A1612] focus:outline-none focus:border-[#C4622D] transition-colors"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={testimonialForm.is_active}
                        onChange={(e) => setTestimonialForm({ ...testimonialForm, is_active: e.target.checked })}
                        className="w-4 h-4 accent-[#C4622D]"
                      />
                      <span className="text-sm font-medium text-[#3D3530]">Show on homepage</span>
                    </label>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowTestimonialForm(false)}
                        className="flex-1 px-4 py-2.5 border border-[#DDD5C8] rounded-xl text-sm font-semibold text-[#5C5347] hover:bg-[#F5F0E8] transition-colors"
                      >Cancel</button>
                      <button
                        type="button"
                        onClick={handleSaveTestimonial}
                        disabled={savingTestimonial}
                        className="flex-1 px-4 py-2.5 bg-[#C4622D] text-white rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {savingTestimonial ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</> : editingTestimonial ? 'Save Changes' : 'Add Testimonial'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1612]">Testimonials</h2>
                <p className="text-xs text-[#8C8278] mt-0.5">{testimonials.length} testimonials · displayed on the homepage</p>
              </div>
              <button
                onClick={openAddTestimonialForm}
                className="bg-[#C4622D] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#A04E22] transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Testimonial
              </button>
            </div>

            {testimonialsLoading ? (
              <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8 text-[#C4622D]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : testimonials.length === 0 ? (
              <div className="text-center py-16 text-[#8C8278]">
                <p className="text-lg font-medium mb-2">No testimonials yet</p>
                <p className="text-sm">Add your first testimonial to display on the homepage.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {testimonials.map((t) => (
                  <div key={t.id} className={`bg-white rounded-2xl border p-5 ${t.is_active ? 'border-[#EDE7DA]' : 'border-gray-200 opacity-60'}`}>
                    <div className="flex items-start gap-4">
                      {t.avatar_url && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-[#EDE7DA]">
                          <img src={t.avatar_url} alt={t.name} className="w-full h-full object-cover grayscale" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#1A1612] text-sm">{t.name}</p>
                            <p className="text-xs text-[#8C8278] font-mono uppercase tracking-wider mt-0.5">{t.role}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-[#8C8278]">Order: {t.display_order}</span>
                            <button
                              onClick={() => handleToggleTestimonialActive(t)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${t.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                            >{t.is_active ? 'Visible' : 'Hidden'}</button>
                          </div>
                        </div>
                        <p className="text-sm text-[#5C5347] mt-2 italic line-clamp-3">&ldquo;{t.quote}&rdquo;</p>
                        <div className="flex items-center gap-1 mt-2">
                          {[...Array(t.rating)].map((_, i) => (
                            <svg key={i} className="w-3.5 h-3.5 text-[#D4A853]" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <div className="flex gap-3 mt-3">
                          <button onClick={() => openEditTestimonialForm(t)} className="text-xs font-semibold text-[#C4622D] hover:underline">Edit</button>
                          <button onClick={() => handleDeleteTestimonial(t)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTING TAB ── */}
        {activeTab === 'reporting' && (
          <div>
            {/* ── CARD GRID VIEW ── */}
            {reportingView === 'cards' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-[#1A1612]">Reporting</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: Products Ordered */}
                  <div
                    onClick={() => { setReportingView('products_ordered'); loadProductsOrdered(); }}
                    className="bg-white border border-[#EDE7DA] rounded-2xl shadow-sm p-6 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-[#C4622D] transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FDF6EE] flex items-center justify-center text-xl">📦</div>
                    <div>
                      <h3 className="text-base font-bold text-[#1A1612]">Products Ordered</h3>
                      <p className="text-sm text-[#8C8278] mt-1">Overview of all products ordered</p>
                    </div>
                  </div>

                  {/* Card 2: Package Meals Ordered */}
                  <div className="bg-white border border-[#EDE7DA] rounded-2xl shadow-sm p-6 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-[#C4622D] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[#FDF6EE] flex items-center justify-center text-xl">🍱</div>
                    <div>
                      <h3 className="text-base font-bold text-[#1A1612]">Package Meals Ordered</h3>
                      <p className="text-sm text-[#8C8278] mt-1">Overview of all package meals ordered</p>
                    </div>
                  </div>

                  {/* Card 3: Discount Vouchers */}
                  <div className="bg-white border border-[#EDE7DA] rounded-2xl shadow-sm p-6 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-[#C4622D] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[#FDF6EE] flex items-center justify-center text-xl">🏷️</div>
                    <div>
                      <h3 className="text-base font-bold text-[#1A1612]">Discount Vouchers</h3>
                      <p className="text-sm text-[#8C8278] mt-1">Overview of all discount vouchers</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── PRODUCTS ORDERED DETAIL VIEW ── */}
            {reportingView === 'products_ordered' && (
              <div>
                {/* Header with back button */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setReportingView('cards')}
                    className="flex items-center gap-1.5 text-sm text-[#5C5347] hover:text-[#C4622D] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Reporting</span>
                  </button>
                  <span className="text-[#DDD5C8]">/</span>
                  <h2 className="text-lg font-bold text-[#1A1612]">Products Ordered</h2>
                </div>

                {/* Loading state */}
                {productsOrderedLoading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#C4622D] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Empty state */}
                {!productsOrderedLoading && productsOrderedRows.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[#F5F0E8] flex items-center justify-center text-2xl mx-auto mb-4">📦</div>
                    <p className="text-[#5C5347] font-medium">No products ordered yet</p>
                    <p className="text-sm text-[#8C8278] mt-1">Orders will appear here once placed</p>
                  </div>
                )}

                {/* Table */}
                {!productsOrderedLoading && productsOrderedRows.length > 0 && (
                  <div className="bg-white border border-[#EDE7DA] rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#EDE7DA] bg-[#FDFAF7]">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">Product Name</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">Type</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">Item</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">Meal Voucher</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">Discount Voucher</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">Ordered Date</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">Delivered DT</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">Client</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8278] uppercase tracking-wider whitespace-nowrap">eMail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F5F0E8]">
                          {productsOrderedRows.map((row, idx) => (
                            <tr key={`${row.orderId}-${idx}`} className="hover:bg-[#FDFAF7] transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-medium text-[#1A1612]">{row.productName}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[#5C5347]">{row.productType}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[#1A1612]">{row.item}</span>
                              </td>
                              <td className="px-4 py-3">
                                {row.mealVoucher ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F5F0E8] text-[#C4622D] border border-[#DDD5C8]">
                                    {row.mealVoucher}
                                  </span>
                                ) : (
                                  <span className="text-[#B5ADA5] text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {row.discountVoucher ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                    {row.discountVoucher}
                                  </span>
                                ) : (
                                  <span className="text-[#B5ADA5] text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[#5C5347] text-xs whitespace-nowrap">{row.orderedDate}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs whitespace-nowrap ${row.deliveredDt === '—' ? 'text-[#B5ADA5]' : 'text-[#5C5347]'}`}>{row.deliveredDt}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[#1A1612] font-medium whitespace-nowrap">{row.clientName}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[#5C5347] text-xs break-all">{row.clientEmail}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-3 border-t border-[#F5F0E8] bg-[#FDFAF7]">
                      <p className="text-xs text-[#8C8278]">{productsOrderedRows.length} row{productsOrderedRows.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

          </div>
        </div>
      </main>
    </div>
    </>
  );
}