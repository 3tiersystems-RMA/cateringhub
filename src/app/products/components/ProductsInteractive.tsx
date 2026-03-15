"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/AppIcon";
import ProductCard from "./ProductCard";
import CartSidebar from "./CartSidebar";
import ProductModal from "./ProductModal";
import { CartProvider, useCart } from "./CartContext";
import { createClient } from "@/lib/supabase/client";

interface Product {
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
}

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

function ProductsContent() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "rating">("default");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalAdded, setModalAdded] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const supabase = createClient();

        // Fetch active categories from DB
        const { data: catData } = await supabase
          .from('categories')
          .select('name')
          .eq('active', true)
          .order('sort_order', { ascending: true });

        const activeCategories = (catData || []).map((c: any) => c.name as string);
        setCategories(activeCategories);

        // Fetch products
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('available', true)
          .order('sort_order', { ascending: true });

        if (error || !data || data.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const withImages = await Promise.all(
          data.map(async (p) => {
            let imageUrl = '/assets/images/no_image.png';
            if (p.image_path) {
              const { data: urlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(p.image_path);
              imageUrl = urlData?.publicUrl || imageUrl;
            }
            return {
              id: p.id,
              name: p.name,
              category: p.category as string,
              price: p.price,
              unit: p.unit,
              image: imageUrl,
              imageAlt: `${p.name} - ${p.category}`,
              tags: p.tags || [],
              rating: 4.8,
              reviews: 0,
              description: p.description,
              minOrder: p.min_order || undefined,
              badge: p.badge || undefined,
              available: p.available,
              packageType: p.package_type || 'none',
            } as Product;
          })
        );
        setProducts(withImages);
      } catch (err) {
        console.log('Error fetching products:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = products;

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
  }, [activeCategory, search, sortBy, products]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll(".pc-reveal").forEach((el, i) => {
              setTimeout(() => {
                (el as HTMLElement).style.opacity = "1";
                (el as HTMLElement).style.transform = "translateY(0)";
              }, i * 80);
            });
          }
        });
      },
      { threshold: 0.05 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [filtered]);

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

  // Build display categories: All + Weekly Menu first + remaining active categories from DB
  const displayCategories = [
    "All",
    "Weekly Menu",
    ...categories.filter((c) => c !== "Weekly Menu"),
  ];

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
            <Link
              href="/vouchers"
              className="flex items-center gap-2 bg-white border border-[#C4622D]/40 text-[#C4622D] px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-[#F5EDE6] transition-all"
            >
              <Icon name="TicketIcon" size={15} />
              Gift a Voucher
            </Link>
            <CartButton />
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Icon
              name="MagnifyingGlassIcon"
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B5ADA5]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu..."
              className="w-full bg-white border border-[#DDD5C8] rounded-full pl-10 pr-4 py-2.5 text-sm text-[#1A1612] placeholder-[#B5ADA5] focus:outline-none focus:border-[#C4622D] transition-colors"
            />
          </div>

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
        </div>

        {/* Category Tabs — only active categories from DB */}
        <div className="flex flex-wrap gap-2 mb-10">
          {displayCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                if (cat === "Weekly Menu") {
                  router.push("/weekly-menu");
                } else {
                  setActiveCategory(cat);
                }
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
                {cat !== "Weekly Menu" && `(${cat === "All" ? products.length : products.filter((p) => p.category === cat).length})`}
              </span>
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[#8C8278] font-mono">
            {loading ? 'Loading products...' : `${filtered.length} item${filtered.length !== 1 ? "s" : ""} to choose from`}
          </p>
          {(search || activeCategory !== "All") && (
            <button
              onClick={() => { setSearch(""); setActiveCategory("All"); }}
              className="text-xs text-[#C4622D] hover:underline font-medium"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin h-10 w-10 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div
            ref={sectionRef}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
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
                  }}
                >
                  <ProductCard product={product} onOpenModal={handleOpenModal} />
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 rounded-full bg-[#EDE7DA] flex items-center justify-center">
                  <Icon name="FaceFrownIcon" size={28} className="text-[#B5ADA5]" />
                </div>
                <p className="text-[#8C8278] text-base font-medium">No items match your search.</p>
                <button
                  onClick={() => { setSearch(""); setActiveCategory("All"); }}
                  className="text-sm font-semibold text-[#C4622D] hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom Info Banner */}
        <div className="mt-16 bg-[#EDE7DA] border border-[#DDD5C8] rounded-4xl p-8 md:p-10">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "TruckIcon" as const, title: "Delivery Included", desc: "Free delivery on orders over R200. R15 flat fee under R200." },
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

export default function ProductsInteractive() {
  return (
    <CartProvider>
      <ProductsContent />
    </CartProvider>
  );
}