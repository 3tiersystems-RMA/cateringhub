"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Icon from "@/components/ui/AppIcon";
import ProductCard from "./ProductCard";
import CartSidebar from "./CartSidebar";
import ProductModal from "./ProductModal";
import { useCart } from "./CartContext";
import { createClient } from "@/lib/supabase/client";
import {
  mapProductRows,
  PRODUCT_LIST_COLUMNS,
  type CatalogProduct,
  type ProductsCatalog,
} from "@/lib/products-catalog";
import type { VoucherData } from "./CartContext";
import VoucherErrorModal from "@/components/ui/VoucherErrorModal";
import VoucherMealsList from "./VoucherMealsList";

type Product = CatalogProduct;

function CartButton() {
  const { totalItems, setIsOpen } = useCart();
  const [popped, setPopped] = useState(false);
  const prevTotal = useRef(totalItems);

  useEffect(() => {
    if (totalItems > prevTotal.current) {
      setPopped(true);
      setTimeout(() => setPopped(false), 300);
    }
    prevTotal.current = totalItems;
  }, [totalItems]);

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="relative flex items-center gap-2 bg-[#C4622D] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#A04E22] transition-all shadow-terra hover:shadow-terra-lg"
      aria-label={`Open cart, ${totalItems} items`}
    >
      <Icon name="ShoppingCartIcon" size={16} />
      <span>Cart</span>
      {totalItems > 0 && (
        <span
          className={`absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#1A1612] text-white text-xs font-bold flex items-center justify-center ${popped ? "badge-pop" : ""}`}
        >
          {totalItems}
        </span>
      )}
    </button>
  );
}

const PACKAGE_LABEL: Record<string, string> = {
  "package-6": "6-Meal Package",
  "package-10": "10-Meal Package",
  "package-12": "12-Meal Package",
  "package-24": "24-Meal Package",
};

function ApplyVoucherBanner() {
  const { appliedVoucher, setAppliedVoucher, registerVoucherBannerOpener } = useCart();
  const supabase = createClient();

  const [showInput, setShowInput] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [voucherErrorModal, setVoucherErrorModal] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const bannerRef = useRef<HTMLDivElement>(null);

  // Register the opener so ProductCard can trigger it
  useEffect(() => {
    registerVoucherBannerOpener(() => {
      setShowInput(true);
      setTimeout(() => {
        bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        (bannerRef.current?.querySelector("input") as HTMLInputElement | null)?.focus();
      }, 50);
    });
  }, [registerVoucherBannerOpener]);

  const handleApply = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) { setVoucherErrorModal({ open: true, message: "Please enter a voucher code." }); return; }
    setLoading(true);
    try {
      const { data, error: dbErr } = await supabase
        .from("vouchers")
        .select("voucher_code, customer_name, customer_email, customer_phone, total_meals, meals_remaining, status, package_type")
        .eq("voucher_code", code)
        .single();

      if (dbErr || !data) { setVoucherErrorModal({ open: true, message: "Voucher code not found. Please check and try again." }); return; }
      if (data.status === "unpaid") {
        setVoucherErrorModal({ open: true, message: "This voucher has not been paid for yet. Please complete your EFT payment at the Meal Vouchers page first." });
        return;
      }
      if (data.status !== "active" && data.status !== "paid") {
        setVoucherErrorModal({ open: true, message: `This voucher is ${data.status} and cannot be used.` });
        return;
      }
      if (data.meals_remaining <= 0) { setVoucherErrorModal({ open: true, message: "No meals remaining on this voucher." }); return; }

      setAppliedVoucher(data as VoucherData);
      setShowInput(false);
      setVoucherCode("");
    } catch {
      setVoucherErrorModal({ open: true, message: "Failed to validate voucher. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setAppliedVoucher(null);
    setVoucherCode("");
    setShowInput(false);
  };

  if (appliedVoucher) {
    const pkgLabel = PACKAGE_LABEL[appliedVoucher.package_type || ""] || appliedVoucher.package_type;
    return (
      <div className="mb-8 bg-green-50 border border-green-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Icon name="TicketIcon" size={18} className="text-green-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-green-800">Voucher Active</span>
              <span className="text-xs font-mono font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{appliedVoucher.voucher_code}</span>
              {pkgLabel && (
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">🎟 {pkgLabel}</span>
              )}
            </div>
            <p className="text-xs text-green-600 mt-0.5">
              {appliedVoucher.meals_remaining} meal(s) remaining · Showing only matching package products below
            </p>
          </div>
        </div>
        <button
          onClick={handleRemove}
          className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-red-500 transition-colors border border-green-200 hover:border-red-200 px-3 py-1.5 rounded-full"
        >
          <Icon name="XMarkIcon" size={12} />
          Remove Voucher
        </button>
      </div>
    );
  }

  return (
    <div ref={bannerRef} className="mb-8 bg-[#FFF8F3] border border-[#C4622D]/20 rounded-2xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C4622D]/10 flex items-center justify-center flex-shrink-0">
            <Icon name="TicketIcon" size={18} className="text-[#C4622D]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A1612]">Have a Meal Voucher?</p>
            <p className="text-xs text-[#8C8278]">Apply your voucher code to unlock your package meals</p>
          </div>
        </div>
        {!showInput && (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-2 bg-[#C4622D] text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-[#A04E22] transition-all flex-shrink-0"
          >
            <Icon name="TicketIcon" size={13} />
            Apply Voucher
          </button>
        )}
      </div>
      {showInput && (
        <div className="mt-3 pt-3 border-t border-[#C4622D]/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={voucherCode}
              onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); }}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              placeholder="e.g. CK-2026-XXXX"
              className="flex-1 bg-white border border-[#DDD5C8] rounded-xl px-3 py-2.5 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] font-mono transition-colors"
              autoFocus
            />
            <button
              onClick={handleApply}
              disabled={loading}
              className="bg-[#C4622D] text-white px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-[#A04E22] transition-colors disabled:opacity-70 flex items-center gap-1.5"
            >
              {loading ? (
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : "Apply"}
            </button>
            <button
              onClick={() => { setShowInput(false); setVoucherCode(""); }}
              className="p-2.5 rounded-xl border border-[#DDD5C8] text-[#8C8278] hover:bg-[#F5F0E8] transition-colors"
              aria-label="Cancel"
            >
              <Icon name="XMarkIcon" size={14} />
            </button>
          </div>
        </div>
      )}
      <VoucherErrorModal
        isOpen={voucherErrorModal.open}
        message={voucherErrorModal.message}
        onClose={() => setVoucherErrorModal({ open: false, message: "" })}
      />
    </div>
  );
}

// ─── Section-grouped product layout ───────────────────────────────────────────
const SECTION_CATEGORIES = ["Frozen Meals", "Wellness", "Fadwah Mugs"];

const SECTION_SUBTITLES: Record<string, string> = {
  "Fadwah Mugs": "A charitable collection supporting children with spina bifida",
};

interface ProductSectionsProps {
  products: Product[];
  onOpenModal: (product: Product) => void;
  sectionRef: React.RefObject<HTMLDivElement>;
}

function ProductSections({ products, onOpenModal, sectionRef }: ProductSectionsProps) {
  // Group products by category, preserving section order
  const sections = SECTION_CATEGORIES.map((cat) => ({
    category: cat,
    items: products.filter((p) => p.category === cat),
  })).filter((s) => s.items.length > 0);

  // Products not in any named section
  const otherProducts = products.filter(
    (p) => !SECTION_CATEGORIES.includes(p.category)
  );

  // Combine: named sections first, then "other" as a catch-all
  const allSections = [
    ...sections,
    ...(otherProducts.length > 0
      ? [{ category: "Other", items: otherProducts }]
      : []),
  ];

  if (allSections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-[#8C8278] text-base font-medium">No items match your search.</p>
      </div>
    );
  }

  let globalIndex = 0;

  return (
    <div ref={sectionRef}>
      {allSections.map((section, sIdx) => {
        const subtitle = SECTION_SUBTITLES[section.category];
        return (
          <div key={section.category}>
            {/* Horizontal rule separator (not before first section) */}
            {sIdx > 0 && (
              <hr
                style={{
                  border: "none",
                  borderTop: "0.5px solid #E2DDD6",
                  margin: "0 0 2.5rem 0",
                }}
              />
            )}

            {/* Section heading block */}
            <div style={{ marginBottom: "1.25rem", marginTop: sIdx === 0 ? 0 : "2.5rem" }}>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "clamp(22px, 4vw, 28px)",
                    fontWeight: 400,
                    color: "#1E3D2F",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {section.category}
                </h2>
                <span
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "14px",
                    color: "#8A8A82",
                    fontWeight: 400,
                  }}
                >
                  {section.items.length} item{section.items.length !== 1 ? "s" : ""}
                </span>
              </div>
              {subtitle && (
                <p
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "13px",
                    fontStyle: "italic",
                    color: "#8A8A82",
                    marginTop: "4px",
                    marginBottom: 0,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            {/* Product grid */}
            <div
              className="product-section-grid"
              style={{ marginBottom: "2.5rem" }}
            >
              {section.items.map((product) => {
                const idx = globalIndex++;
                return (
                  <div
                    key={`${product.category}-${product.id}`}
                    className="pc-reveal"
                    style={{
                      opacity: 0,
                      transform: "translateY(24px)",
                      transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${idx * 0.05}s`,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <ProductCard
                      product={product}
                      onOpenModal={onOpenModal}
                      imagePriority={idx < 3}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div className="bg-[#FAF7F2] border border-[#DDD5C8] rounded-3xl overflow-hidden animate-pulse">
      <div className="h-52 bg-[#DDD5C8]" />
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-[#DDD5C8] rounded-full" />
          <div className="h-5 w-20 bg-[#DDD5C8] rounded-full" />
        </div>
        <div className="h-5 bg-[#DDD5C8] rounded w-3/4" />
        <div className="h-4 bg-[#DDD5C8] rounded w-full" />
        <div className="flex justify-between items-end pt-2">
          <div className="h-6 bg-[#DDD5C8] rounded w-16" />
          <div className="h-9 w-20 bg-[#DDD5C8] rounded-full" />
        </div>
      </div>
    </div>
  );
}

function activateProductReveals(container: HTMLElement) {
  container.querySelectorAll('.pc-reveal').forEach((el, i) => {
    setTimeout(() => {
      const node = el as HTMLElement;
      node.style.opacity = '1';
      node.style.transform = 'translateY(0)';
    }, i * 80);
  });
}

interface ProductsContentProps {
  initialCatalog?: ProductsCatalog;
}

function ProductsContent({ initialCatalog }: ProductsContentProps) {
  const isPrefetched = initialCatalog !== undefined;
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "rating">("default");
  const [products, setProducts] = useState<Product[]>(initialCatalog?.products ?? []);
  const [categories, setCategories] = useState<string[]>(initialCatalog?.categories ?? []);
  const [loading, setLoading] = useState(!isPrefetched);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalAdded, setModalAdded] = useState(false);
  const [visiblePackages, setVisiblePackages] = useState<Set<string>>(
    () => new Set(initialCatalog?.visiblePackages ?? [])
  );
  const [visibilityLoaded, setVisibilityLoaded] = useState(isPrefetched);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { addItem, appliedVoucher } = useCart();
  const [showCustomizePopup, setShowCustomizePopup] = useState(false);

  // Apply category from URL on first render
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam) setActiveCategory(categoryParam);
  }, [searchParams]);

  // Client refresh only when server did not prefetch (e.g. client navigation edge cases)
  useEffect(() => {
    if (isPrefetched) return;

    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const [catResult, pvResult, productsResult] = await Promise.all([
          supabase
            .from('categories')
            .select('name')
            .order('sort_order', { ascending: true }),
          supabase.from('package_visibility').select('package_name, is_visible'),
          supabase
            .from('products')
            .select(PRODUCT_LIST_COLUMNS)
            .neq('available', false)
            .order('sort_order', { ascending: true }),
        ]);

        if (cancelled) return;

        setCategories((catResult.data || []).map((c) => c.name as string));
        setVisiblePackages(
          new Set(
            (pvResult.data || [])
              .filter((p) => p.is_visible)
              .map((p) => p.package_name as string)
          )
        );
        setVisibilityLoaded(true);

        if (productsResult.error || !productsResult.data) {
          setProducts([]);
        } else {
          setProducts(mapProductRows(productsResult.data));
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [isPrefetched]);

  const filtered = useMemo(() => {
    let result = products;

    // If a voucher is applied, only show products matching the voucher's package_type
    if (appliedVoucher?.package_type && appliedVoucher.package_type !== "none") {
      result = result.filter((p) => p.packageType === appliedVoucher.package_type);
    }

    if (activeCategory !== "All") {
      result = result.filter((p) => p.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    switch (sortBy) {
      case "price-asc":
        return [...result].sort((a, b) => a.price - b.price);
      case "price-desc":
        return [...result].sort((a, b) => b.price - a.price);
      case "rating":
        return [...result].sort((a, b) => b.rating - a.rating);
      default:
        return result;
    }
  }, [activeCategory, search, sortBy, products, appliedVoucher]);

  useEffect(() => {
    if (loading || filtered.length === 0 || !sectionRef.current) return;

    const section = sectionRef.current;
    const rect = section.getBoundingClientRect();
    const alreadyInView = rect.top < window.innerHeight * 0.95 && rect.bottom > 0;

    if (alreadyInView) {
      activateProductReveals(section);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activateProductReveals(entry.target as HTMLElement);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.05 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [loading, filtered]);

  const handleOpenModal = (product: Product) => {
    setSelectedProduct(product);
    setModalAdded(false);
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
    setModalAdded(false);
  };

  const handleModalAdd = () => {
    if (!selectedProduct) return;
    addItem(selectedProduct);
    setModalAdded(true);
    setTimeout(() => setModalAdded(false), 1800);
  };

  const displayCategories = (() => {
    const desiredOrder = ["All", "Packaged Meals", "Voucher Meals", "Frozen Meals", "Prepared Meals", "À La Carte", "Wellness", "Retail POD", "Fadwah Mugs"];
    const available = ["All", ...categories];
    return desiredOrder.filter((c) => available.includes(c));
  })();

  // When voucher is active, count products for the active category from filtered set
  const getCategoryCount = (cat: string) => {
    if (appliedVoucher?.package_type && appliedVoucher.package_type !== "none") {
      const voucherFiltered = products.filter((p) => p.packageType === appliedVoucher.package_type);
      return cat === "All" ? voucherFiltered.length : voucherFiltered.filter((p) => p.category === cat).length;
    }
    return cat === "All" ? products.length : products.filter((p) => p.category === cat).length;
  };

  return (
    <>
      <CartSidebar />
      <ProductModal
        product={selectedProduct}
        onClose={handleCloseModal}
        added={modalAdded}
        onAdd={handleModalAdd}
      />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#C4622D] mb-2">
              Fresh · Local · Chef-Crafted
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-semibold text-[#1A1612] tracking-tight">
              Our Menu &
              <span className="italic text-[#C4622D]"> Packages</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCustomizePopup(true)}
              className="flex items-center gap-2 bg-white border border-[#C4622D]/40 text-[#C4622D] px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-[#F5EDE6] transition-all"
            >
              <Icon name="AdjustmentsHorizontalIcon" size={15} />
              Customize Meal Package
            </button>
            <span
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-400 px-4 py-2.5 rounded-full text-sm font-semibold cursor-not-allowed opacity-60 select-none"
              title="Meal Vouchers (currently unavailable)"
            >
              <Icon name="TicketIcon" size={15} />
              Meal Vouchers
            </span>
            <CartButton />
          </div>
        </div>

        {/* Customize Meal Package popup */}
        {showCustomizePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCustomizePopup(false)}>
            <div className="bg-white rounded-2xl shadow-xl px-8 py-7 max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center mb-4">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F5EDE6]">
                  <Icon name="AdjustmentsHorizontalIcon" size={24} className="text-[#C4622D]" />
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#2C1810] mb-2">Coming Soon</h3>
              <p className="text-[#6B4226] text-sm mb-6">This OPTION will be available in our next release.</p>
              <button
                onClick={() => setShowCustomizePopup(false)}
                className="bg-[#C4622D] text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-[#A8522A] transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* ─── Apply Voucher Banner ─── */}
        <ApplyVoucherBanner />

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="appearance-none bg-white border border-[#DDD5C8] rounded-full px-5 py-2.5 pr-10 text-sm text-[#5C5347] focus:outline-none focus:border-[#C4622D] transition-colors cursor-pointer"
            >
              <option value="default">Sort: Default</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
            <Icon
              name="ChevronDownIcon"
              size={14}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8C8278] pointer-events-none"
            />
          </div>

          {/* Search */}
          <div className="relative w-40">
            <Icon
              name="MagnifyingGlassIcon"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B5ADA5]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-white border border-[#DDD5C8] rounded-full pl-8 pr-8 py-2.5 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B5ADA5] hover:text-[#5C5347] transition-colors"
                aria-label="Clear search"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            )}
          </div>

          {/* Category Filter Buttons — hidden when voucher is active */}
          {!appliedVoucher?.package_type || appliedVoucher.package_type === "none" ? (
            <>
              {displayCategories.map((cat) => {
                const count = getCategoryCount(cat);
                const isZero = cat !== "All" && count === 0;
                if (isZero) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                    }}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      activeCategory === cat
                        ? "bg-[#C4622D] text-white shadow-terra"
                        : "bg-white border border-[#DDD5C8] text-[#5C5347] hover:border-[#C4622D]/40 hover:text-[#C4622D]"
                    }`}
                  >
                    {cat}
                    <span
                      className={`ml-2 text-xs ${
                        activeCategory === cat ? "text-white/70" : "text-[#B5ADA5]"
                      }`}
                    >
                      {`(${count})`}
                    </span>
                  </button>
                );
              })}
              {(search || activeCategory !== "All") && (
                <button
                  onClick={() => { setSearch(""); setActiveCategory("All"); }}
                  className="text-xs text-[#C4622D] hover:underline font-medium"
                >
                  Clear filters
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#8C8278]">
              <Icon name="FunnelIcon" size={14} className="text-[#C4622D]" />
              <span>Showing <strong className="text-[#1A1612]">{PACKAGE_LABEL[appliedVoucher.package_type]}</strong> products only — remove voucher to browse all items</span>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[#8C8278] font-mono">
            {loading ? 'Loading products...' : `${filtered.length} item${filtered.length !== 1 ? "s" : ""} to choose from`}
          </p>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="product-section-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : activeCategory === "Voucher Meals" ? (
          <VoucherMealsList products={filtered.filter((p) => {
            const hasUnit = p.unit && p.unit.trim() !== '';
            const priceIsZeroOrBlank = !p.price || p.price === 0;
            const pkgType = p.packageType || 'none';
            const isVisible = visibilityLoaded && visiblePackages.has(pkgType);
            return hasUnit && priceIsZeroOrBlank && isVisible;
          }).map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            unit: p.unit,
            description: p.description,
            image: p.image,
            imageAlt: p.imageAlt,
            available: p.available,
            packageType: p.packageType,
            imageFit: p.imageFit,
          }))} />
        ) : activeCategory === "All" && !appliedVoucher?.package_type ? (
          // Grouped section layout for "All" view
          <ProductSections
            products={filtered}
            onOpenModal={handleOpenModal}
            sectionRef={sectionRef}
          />
        ) : (
          // Single flat grid for filtered category view
          <div
            ref={sectionRef}
            className="product-section-grid"
          >
            {filtered.length > 0 ? (
              filtered.map((product, i) => (
                <div
                  key={`${product.category}-${product.id}`}
                  className="pc-reveal"
                  style={{
                    opacity: 0,
                    transform: "translateY(24px)",
                    transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s`,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <ProductCard
                    product={product}
                    onOpenModal={handleOpenModal}
                    imagePriority={i < 3}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 rounded-full bg-[#EDE7DA] flex items-center justify-center">
                  <Icon name="FaceFrownIcon" size={28} className="text-[#B5ADA5]" />
                </div>
                <p className="text-[#8C8278] text-base font-medium">
                  {appliedVoucher?.package_type && appliedVoucher.package_type !== "none"
                    ? `No ${PACKAGE_LABEL[appliedVoucher.package_type] || "package"} products are available yet.`
                    : "No items match your search."}
                </p>
                {(!appliedVoucher?.package_type || appliedVoucher.package_type === "none") && (
                  <button
                    onClick={() => { setSearch(""); setActiveCategory("All"); }}
                    className="text-sm font-semibold text-[#C4622D] hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Info Banner */}
        <div className="mt-16 bg-[#EDE7DA] border border-[#DDD5C8] rounded-4xl p-8 md:p-10">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "TruckIcon" as const, title: "Delivery Included", desc: "Delivery charges will be applied where applicable. Distance calculated based on Location" },
              { icon: "ClockIcon" as const, title: "48-Hour Lead Time", desc: "Most orders require 48 hours notice. Rush orders available for a fee." },
              { icon: "PhoneIcon" as const, title: "Custom Quotes", desc: "Need something special? Call us at 087 265 2262 for a custom menu." },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-2xl bg-[#C4622D]/10 border border-[#C4622D]/20 flex items-center justify-center flex-shrink-0">
                  <Icon name={item.icon} size={18} className="text-[#C4622D]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1A1612] text-sm mb-1">{item.title}</p>
                  <p className="text-xs text-[#8C8278] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

interface ProductsInteractiveProps {
  initialCatalog?: ProductsCatalog;
}

export default function ProductsInteractive({ initialCatalog }: ProductsInteractiveProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <ProductsContent initialCatalog={initialCatalog} />
    </Suspense>
  );
}