"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CartProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  image: string;
  imageAlt: string;
  tags: string[];
  rating: number;
  reviews: number;
  description: string;
  minOrder?: number;
  badge?: string;
  available: boolean;
  packageType?: string;
  imageFit?: string;
  oldPrice?: number;
  savingPercent?: number;
  visualType?: string | null;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: CartProduct, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  appliedVoucher: VoucherData | null;
  setAppliedVoucher: (v: VoucherData | null) => void;
  openVoucherBanner: () => void;
  registerVoucherBannerOpener: (fn: () => void) => void;
  appliedDiscountVoucher: DiscountVoucherData | null;
  setAppliedDiscountVoucher: (v: DiscountVoucherData | null) => void;
  guestToken: string | null;
  captureCustomerInfo: (email: string, name: string) => void;
}

export interface VoucherData {
  voucher_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  total_meals: number;
  meals_remaining: number;
  status: string;
  package_type?: string;
}

export interface DiscountVoucherData {
  id: string;
  dv_code: string;
  dv_amount: number;
  status: string;
  expiry_date: string;
  times_used: number;
}

const CartContext = createContext<CartContextType | null>(null);

const GUEST_TOKEN_KEY = "ck_guest_token";

function getOrCreateGuestToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(GUEST_TOKEN_KEY);
  if (!token) {
    token = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  }
  return token;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherData | null>(null);
  const [appliedDiscountVoucher, setAppliedDiscountVoucher] = useState<DiscountVoucherData | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const voucherBannerOpenerRef = useRef<(() => void) | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const customerEmailRef = useRef<string>("");
  const customerNameRef = useRef<string>("");

  // Initialise guest token and load cart from Supabase on mount
  useEffect(() => {
    let token = getOrCreateGuestToken();
    setGuestToken(token);

    const supabase = createClient();
    supabase
      .from("guest_carts")
      .select("items, customer_email, customer_name")
      .eq("guest_token", token)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (Array.isArray(data.items) && data.items.length > 0) {
            setItems(data.items as CartItem[]);
          }
          if (data.customer_email) customerEmailRef.current = data.customer_email;
          if (data.customer_name) customerNameRef.current = data.customer_name;
        }
        setHydrated(true);
      });
  }, []);

  // Persist cart to Supabase whenever items change (debounced 800ms)
  // ABANDONED CART PAUSED — not capturing cart details during testing
  useEffect(() => {
    if (!hydrated || !guestToken) return;
    // Abandoned cart saving is temporarily disabled
    // if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    // saveTimeoutRef.current = setTimeout(async () => {
    //   const supabase = createClient();
    //   await supabase.from("guest_carts").upsert(
    //     {
    //       guest_token: guestToken,
    //       items: items,
    //       customer_email: customerEmailRef.current || null,
    //       customer_name: customerNameRef.current || null,
    //       last_activity_at: new Date().toISOString(),
    //       reminder_sent_at: items.length > 0 ? undefined : null,
    //     },
    //     { onConflict: "guest_token" }
    //   );
    // }, 800);
    // return () => {
    //   if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    // };
  }, [items, hydrated, guestToken]);

  const registerVoucherBannerOpener = useCallback((fn: () => void) => {
    voucherBannerOpenerRef.current = fn;
  }, []);

  const openVoucherBanner = useCallback(() => {
    if (voucherBannerOpenerRef.current) {
      voucherBannerOpenerRef.current();
    }
  }, []);

  // Called when customer fills in their details — capture email/name for abandoned cart email
  // ABANDONED CART PAUSED — not capturing customer info during testing
  const captureCustomerInfo = useCallback((email: string, name: string) => {
    customerEmailRef.current = email;
    customerNameRef.current = name;
    // Abandoned cart customer info saving is temporarily disabled
    // if (!guestToken) return;
    // const supabase = createClient();
    // supabase
    //   .from("guest_carts")
    //   .update({
    //     customer_email: email,
    //     customer_name: name,
    //     last_activity_at: new Date().toISOString(),
    //   })
    //   .eq("guest_token", guestToken)
    //   .then(() => {});
  }, [guestToken]);

  const addItem = useCallback((product: CartProduct, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    // Remove the cart row from Supabase on purchase completion
    if (guestToken) {
      const supabase = createClient();
      supabase.from("guest_carts").delete().eq("guest_token", guestToken).then(() => {});
      // Generate a fresh token so the next visit starts clean
      const newToken = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(GUEST_TOKEN_KEY, newToken);
      setGuestToken(newToken);
      customerEmailRef.current = "";
      customerNameRef.current = "";
    }
  }, [guestToken]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items, addItem, removeItem, updateQty, clearCart, totalItems, subtotal,
        isOpen, setIsOpen,
        appliedVoucher, setAppliedVoucher,
        openVoucherBanner, registerVoucherBannerOpener,
        appliedDiscountVoucher, setAppliedDiscountVoucher,
        guestToken,
        captureCustomerInfo,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}