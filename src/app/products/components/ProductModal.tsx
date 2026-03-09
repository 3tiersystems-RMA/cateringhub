"use client";

import { useEffect, useCallback } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import type { CartProduct } from "./CartContext";


interface ProductModalProps {
  product: CartProduct | null;
  onClose: () => void;
  added: boolean;
  onAdd: () => void;
}

export default function ProductModal({ product, onClose, added, onAdd }: ProductModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!product) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [product, handleKeyDown]);

  if (!product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ animation: "modalFadeIn 0.22s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#1A1612]/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div
        className="relative z-10 bg-[#F5F0E8] rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ animation: "modalScaleIn 0.25s cubic-bezier(0.16,1,0.3,1) both" }}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm border border-[#DDD5C8] flex items-center justify-center text-[#5C5347] hover:bg-[#C4622D] hover:text-white hover:border-[#C4622D] transition-all duration-200"
          aria-label="Close product details"
        >
          <Icon name="XMarkIcon" size={16} />
        </button>

        {/* Product Image — full colour */}
        <div className="relative h-64 rounded-t-3xl overflow-hidden bg-[#EDE7DA]">
          <AppImage
            src={product.image}
            alt={product.imageAlt}
            fill
            className="object-cover"
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
          <div className="absolute top-3 right-10">
            <span className="text-xs font-mono text-[#5C5347] bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/50">
              {product.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {product.tags.map((tag) => (
              <span key={tag} className="text-xs text-[#8C8278] bg-[#EDE7DA] px-2 py-0.5 rounded-full border border-[#DDD5C8]">
                {tag}
              </span>
            ))}
          </div>

          {/* Name */}
          <h2 className="font-display text-2xl font-semibold text-[#1A1612] leading-snug mb-3">
            {product.name}
          </h2>

          {/* Full Description */}
          <p className="text-sm text-[#5C5347] leading-relaxed mb-5">
            {product.description}
          </p>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Icon
                  key={i}
                  name="StarIcon"
                  size={14}
                  variant={i < Math.floor(product.rating) ? "solid" : "outline"}
                  className={i < Math.floor(product.rating) ? "text-[#D4A853]" : "text-[#DDD5C8]"}
                />
              ))}
            </div>
            <span className="text-sm text-[#8C8278]">
              {product.rating} ({product.reviews} reviews)
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-[#DDD5C8] mb-5" />

          {/* Price block */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold text-[#1A1612]">R{product.price}</p>
              <p className="text-xs text-[#B5ADA5] font-mono mt-0.5">{product.unit}</p>
              {product.minOrder && (
                <p className="text-xs text-[#C4622D] mt-1 font-medium">
                  Minimum {product.minOrder} guests
                </p>
              )}
            </div>

            {/* Add to Cart */}
            <button
              onClick={onAdd}
              disabled={!product.available}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${
                added
                  ? "bg-green-500 text-white scale-95"
                  : product.available
                  ? "bg-[#C4622D] text-white hover:bg-[#A04E22] hover:shadow-lg"
                  : "bg-[#EDE7DA] text-[#B5ADA5] cursor-not-allowed"
              }`}
              aria-label={`Add ${product.name} to cart`}
            >
              {added ? (
                <>
                  <Icon name="CheckIcon" size={16} />
                  Added!
                </>
              ) : (
                <>
                  <Icon name="PlusIcon" size={16} />
                  Add to Cart
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
