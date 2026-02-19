"use client";

import { useState } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import type { Product } from "./ProductsData";
import { useCart } from "./CartContext";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <article className="group bg-[#FAF7F2] border border-[#DDD5C8] rounded-3xl overflow-hidden hover:border-[#C4622D]/40 hover:shadow-warm hover:-translate-y-1 transition-all duration-400">
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-[#EDE7DA]">
        <AppImage
          src={product.image}
          alt={product.imageAlt}
          fill
          className="object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
        />
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.badge && (
            <span className="text-xs font-semibold bg-[#C4622D] text-white px-2.5 py-0.5 rounded-full">
              {product.badge}
            </span>
          )}
          {!product.available && (
            <span className="text-xs font-semibold bg-[#8C8278] text-white px-2.5 py-0.5 rounded-full">
              Sold Out
            </span>
          )}
        </div>
        {/* Category pill */}
        <div className="absolute top-3 right-3">
          <span className="text-xs font-mono text-[#5C5347] bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/50">
            {product.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {product.tags.map((tag) => (
            <span key={tag} className="text-xs text-[#8C8278] bg-[#EDE7DA] px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <h3 className="font-display text-base font-semibold text-[#1A1612] leading-snug mb-2 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-xs text-[#8C8278] leading-relaxed mb-4 line-clamp-2">
          {product.description}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-4">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Icon
                key={i}
                name="StarIcon"
                size={11}
                variant={i < Math.floor(product.rating) ? "solid" : "outline"}
                className={i < Math.floor(product.rating) ? "text-[#D4A853]" : "text-[#DDD5C8]"}
              />
            ))}
          </div>
          <span className="text-xs text-[#8C8278]">
            {product.rating} ({product.reviews})
          </span>
        </div>

        {/* Price + Add */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-semibold text-[#1A1612]">
              ${product.price}
            </p>
            <p className="text-xs text-[#B5ADA5] font-mono">{product.unit}</p>
            {product.minOrder && (
              <p className="text-xs text-[#C4622D] mt-0.5">
                Min. {product.minOrder}
              </p>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!product.available}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 ${
              added
                ? "bg-green-500 text-white scale-95"
                : product.available
                ? "bg-[#C4622D] text-white hover:bg-[#A04E22] hover:shadow-terra"
                : "bg-[#EDE7DA] text-[#B5ADA5] cursor-not-allowed"
            }`}
            aria-label={`Add ${product.name} to cart`}
          >
            {added ? (
              <>
                <Icon name="CheckIcon" size={14} />
                Added!
              </>
            ) : (
              <>
                <Icon name="PlusIcon" size={14} />
                Add
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}