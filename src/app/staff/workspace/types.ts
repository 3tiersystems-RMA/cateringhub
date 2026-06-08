import type { StaffRole } from '@/app/staff/workspace/rbac';

export interface Category {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface WeeklyMenuEntry {
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

export interface WeeklyMenuItemForm {
  meal_date: string;
  day_name: string;
  meal_name: string;
  description: string;
  price: string;
  is_closed: boolean;
  closed_reason: string;
}

export interface Testimonial {
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

export interface TestimonialForm {
  quote: string;
  name: string;
  role: string;
  avatar_url: string;
  rating: number;
  is_active: boolean;
  display_order: string;
}

export type ProductCategory = string;

export interface Product {
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

export interface ProductForm {
  name: string;
  category: ProductCategory;
  price: string;
  unit: string;
  description: string;
  tags: string;
  badge: string;
  min_order: string;
  available: boolean;
  featured: boolean;
  sort_order: number;
  package_type: string;
  image_fit: string;
  old_price: string;
  saving_percent: string;
  attribute1: string;
  attribute2: string;
  attribute3: string;
  long_description: string;
  visual_type: string;
}

export interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

export interface HomepageCard {
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

export interface Voucher {
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

export interface DiscountVoucher {
  id: string;
  dv_code: string;
  dv_amount: number;
  status: 'Active' | 'Inactive';
  expiry_date: string;
  times_used: number;
  created_at: string;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  display_order: number;
}

export interface HomepageSection {
  id: string;
  section_key: string;
  section_label: string;
  is_visible: boolean;
}

export interface PackageVisibilityItem {
  id: string;
  package_name: string;
  is_visible: boolean;
}
