"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherData | null>(null);
  const [appliedDiscountVoucher, setAppliedDiscountVoucher] = useState<DiscountVoucherData | null>(null);
  const voucherBannerOpenerRef = useRef<(() => void) | null>(null);

  const registerVoucherBannerOpener = useCallback((fn: () => void) => {
    voucherBannerOpenerRef.current = fn;
  }, []);

  const openVoucherBanner = useCallback(() => {
    if (voucherBannerOpenerRef.current) {
      voucherBannerOpenerRef.current();
    }
  }, []);

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

  const clearCart = useCallback(() => setItems([]), []);

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