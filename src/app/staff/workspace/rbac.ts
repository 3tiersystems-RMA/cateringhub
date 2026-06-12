export type WorkspaceTab = 'products' | 'media' | 'media_events' | 'media_products' | 'orders' | 'staff' | 'homepage_cards' | 'categories' | 'weekly_menu' | 'vouchers' | 'discount_vouchers' | 'testimonials' | 'reporting' | 'analytics' | 'social_media' | 'gallery' | 'section_visibility' | 'customer_order_history' | 'correspondence_settings' | 'abandoned_carts' | 'package_visibility' | 'cooking_classes' | 'cooking_class_customers' | 'cooking_class_analytics' | 'cooking_class_confirmation' | 'event_registrations' | 'organisation_details' | 'payment_confirmation' | 'collection_notification' | 'global_settings' | 'event_management' | 'event_management_customers' | 'event_management_registrations' | 'event_management_analytics' | 'event_booking_confirmation' | 'bookings_credit' | 'customer_registrations';

export type StaffRole = 'admin' | 'staff' | 'super_admin';

// ─── Role-based access control (single source of truth) ──────────────────────
// Tiered model: staff ⊂ admin ⊂ super_admin.
//   • staff       → daily operations only (orders, lookups, scanner, docs)
//   • admin       → operations + all business & content management
//   • super_admin → everything, incl. staff accounts & system settings
// Tab VISIBILITY — which roles can open each tab. Action-level permissions
// (view/edit/create/delete/…) are handled separately by canDo() below, so a role
// can be granted a tab in "view only" or "view + edit" mode per the client matrix.
export const TAB_ACCESS: Record<WorkspaceTab, StaffRole[]> = {
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
  cooking_class_confirmation: ['super_admin', 'admin'],
  event_registrations: ['super_admin', 'admin', 'staff'], // staff: view only
  event_management: ['super_admin', 'admin', 'staff'],   // staff: view only
  event_management_customers: ['super_admin', 'admin', 'staff'], // staff: view only
  event_management_registrations: ['super_admin', 'admin', 'staff'], // staff: view only
  event_management_analytics: ['super_admin', 'admin', 'staff'], // staff: view only
  event_booking_confirmation: ['super_admin', 'admin'],
  bookings_credit: ['super_admin', 'admin'],
  customer_registrations: ['super_admin', 'admin', 'staff'], // staff: view only
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
  payment_confirmation: ['super_admin', 'admin'],
  collection_notification: ['super_admin', 'admin'],
  global_settings: ['super_admin', 'admin'],
};

// Action-level permission model. super_admin = everything; admin = full CRUD on
// every accessible tab EXCEPT correspondence settings (view only); staff = the
// per-tab actions defined below (any accessible tab not listed = view only).
export type PermAction = 'view' | 'create' | 'edit' | 'delete' | 'status' | 'redeem';

export const STAFF_TAB_ACTIONS: Partial<Record<WorkspaceTab, PermAction[]>> = {
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
  event_management: ['view'],
  event_management_customers: ['view'],
  event_management_registrations: ['view'],
  event_management_analytics: ['view'],
  customer_registrations: ['view'],
};

export function roleCanAccessTab(role: string | undefined | null, tab: WorkspaceTab): boolean {
  if (!role) return false;
  return TAB_ACCESS[tab]?.includes(role as StaffRole) ?? false;
}

// Single source of truth for "can this role perform <action> on <tab>?"
export function canDo(role: string | undefined | null, tab: WorkspaceTab, action: PermAction): boolean {
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
export const DEFAULT_TAB_BY_ROLE: Record<StaffRole, WorkspaceTab> = {
  super_admin: 'products',
  admin: 'products',
  staff: 'orders',
};
