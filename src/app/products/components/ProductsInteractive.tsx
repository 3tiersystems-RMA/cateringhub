"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Icon from "@/components/ui/AppIcon";
import ProductCard from "./ProductCard";
import CartSidebar from "./CartSidebar";
import { CartProvider, useCart } from "./CartContext";
import { products, categories, type Category } from "./ProductsData";

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
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "rating">("default");
  const sectionRef = useRef<HTMLDivElement>(null);

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
  }, [activeCategory, search, sortBy]);

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

  return (
    <>
      <CartSidebar />
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
          <CartButton />
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

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
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
                ({cat === "All" ? products.length : products.filter((p) => p.category === cat).length})
              </span>
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[#8C8278] font-mono">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} found
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
                <ProductCard product={product} />
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

        {/* Bottom Info Banner */}
        <div className="mt-16 bg-[#EDE7DA] border border-[#DDD5C8] rounded-4xl p-8 md:p-10">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "TruckIcon" as const,
                title: "Delivery Included",
                desc: "Free delivery on orders over $200. $15 flat fee under $200.",
              },
              {
                icon: "ClockIcon" as const,
                title: "48-Hour Lead Time",
                desc: "Most orders require 48 hours notice. Rush orders available for a fee.",
              },
              {
                icon: "PhoneIcon" as const,
                title: "Custom Quotes",
                desc: "Need something special? Call us at (555) 123-4567 for a custom menu.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-2xl bg-[#C4622D]/10 border border-[#C4622D]/20 flex items-center justify-center flex-shrink-0">
                  <Icon name={item.icon} size={18} className="text-[#C4622D]" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#1A1612] text-sm mb-1">{item.title}</h4>
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