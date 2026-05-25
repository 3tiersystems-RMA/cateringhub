"use client";

import React, { useState } from "react";
import AppImage from "@/components/ui/AppImage";
import Icon from "@/components/ui/AppIcon";
import type { CartProduct } from "./CartContext";
import { useCart } from "./CartContext";
import { shouldShowProductBadge } from "@/lib/product-badge";

interface ProductCardProps {
  product: CartProduct;
  onOpenModal?: (product: CartProduct) => void;
}

const PACKAGE_LABEL: Record<string, string> = {
  "package-6": "6-Meal Package",
  "package-10": "Health Package",
  "package-12": "12-Meal Package",
  "package-24": "24-Meal Package",
};

const PACKAGE_VOUCHER_MAP: Record<string, string> = {
  "package-6": "package-6",
  "package-12": "package-12",
  "package-24": "package-24",
};

export default function ProductCard({ product, onOpenModal }: ProductCardProps) {
  const { addItem, appliedVoucher, openVoucherBanner } = useCart();
  const [added, setAdded] = useState(false);

  const isSoldOut = !product.available || product.badge === "Sold Out";
  const isPackageProduct = product.packageType && product.packageType !== "none";
  const isMacro = product.visualType === "Macro";

  // Determine if this package product is unlocked by the applied voucher
  const voucherPackageType = appliedVoucher?.package_type;
  const isUnlockedByVoucher =
    isPackageProduct && voucherPackageType === product.packageType;

  // Package product with no voucher or wrong voucher tier
  const isVoucherRequired = isPackageProduct && !isUnlockedByVoucher;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSoldOut) return;
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleCardClick = () => {
    if (onOpenModal) onOpenModal(product);
  };

  return (
    <article
      className="group bg-[#FAF7F2] border border-[#DDD5C8] rounded-3xl overflow-hidden hover:border-[#C4622D]/40 hover:shadow-warm hover:-translate-y-1 transition-all duration-400 cursor-pointer flex flex-col"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCardClick(); }}
      aria-label={`View details for ${product.name}`}
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-[#EDE7DA] flex-shrink-0">
        <AppImage
          src={product.image}
          alt={product.imageAlt}
          fill
          className={`${product.imageFit === 'fit' ? 'object-contain' : 'object-cover'} group-hover:scale-105 transition-all duration-700`}
        />
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {shouldShowProductBadge(product.badge) && (
            <span className="text-xs font-semibold bg-[#C4622D] text-white px-2.5 py-0.5 rounded-full">
              {product.badge}
            </span>
          )}
          {!product.available && (
            <span className="text-xs font-semibold bg-[#8C8278] text-white px-2.5 py-0.5 rounded-full">
              Sold Out
            </span>
          )}
          {isPackageProduct && (
            <span className="text-xs font-semibold bg-[#1A1612] text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
              🎟 {PACKAGE_LABEL[product.packageType!] || "Package"}
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
      <div className="p-5 flex flex-col flex-1">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3 min-h-[1.5rem]">
          {product.tags.map((tag) => (
            <span key={tag} className="text-xs text-white bg-black px-2 py-0.5 rounded-full cursor-default transition-colors duration-200 hover:bg-white hover:text-[#C4622D]">
              {tag}
            </span>
          ))}
        </div>

        <h3 className="font-display text-base font-semibold text-[#1A1612] leading-snug mb-2 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-xs text-[#8C8278] leading-relaxed mb-4 h-8 overflow-hidden">
          {product.description && product.description.length > 35
            ? product.description.slice(0, 35).trimEnd() + "..."
            : product.description}
        </p>

        {/* Save Badge (replaces Rating) */}
        <div className="flex items-center mb-4" style={{minHeight: '20px'}}>
          {product.savingPercent && product.savingPercent > 0 ? (
            <span className="inline-block text-xs font-bold bg-[#1A1612] text-white px-2.5 py-0.5 rounded-md">
              Save {product.savingPercent}%
            </span>
          ) : null}
        </div>

        {/* Price + Add */}
        <div className="flex items-center justify-between mt-auto">
          <div>
{(product.price && product.price > 0 && !(product.packageType && product.packageType.toLowerCase().includes('package'))) ? (
              <p className="text-xl font-semibold text-[#1A1612]">
                R{product.price}
                {product.oldPrice && product.oldPrice > 0 ? (
                  <span className="ml-2 text-sm font-normal text-[#8C8278] line-through">R{product.oldPrice}</span>
                ) : null}
              </p>
            ) : null}
            <p className="text-xs text-[#B5ADA5] font-mono">{product.unit}</p>
            {product.minOrder && (
              <p className="text-xs text-[#C4622D] mt-0.5">
                Min. {product.minOrder}
              </p>
            )}
          </div>
          {isMacro ? null : isVoucherRequired ? (
            <button
              onClick={handleAdd}
              disabled={isSoldOut}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                added
                  ? "bg-green-500 text-white scale-95"
                  : isSoldOut
                  ? "bg-[#EDE7DA] text-[#B5ADA5] cursor-not-allowed"
                  : "bg-[#C4622D] text-white hover:bg-[#A04E22] hover:shadow-terra"
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
          ) : (
            <button
              onClick={handleAdd}
              disabled={isSoldOut}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                added
                  ? "bg-green-500 text-white scale-95"
                  : isSoldOut
                  ? "bg-[#EDE7DA] text-[#B5ADA5] cursor-not-allowed"
                  : "bg-[#C4622D] text-white hover:bg-[#A04E22] hover:shadow-terra"
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
          )}
        </div>

        {/* Macro type info */}
        {isMacro && (
          <p className="text-xs text-[#8C8278] mt-2 text-center italic">
            View sub-items to order
          </p>
        )}

        {/* Voucher hint for package products */}
        {!isMacro && isVoucherRequired && (
          <p className="text-xs text-amber-600 mt-2 text-center">
            Requires a valid {PACKAGE_LABEL[product.packageType!] || "package"} voucher
          </p>
        )}
        {!isMacro && isUnlockedByVoucher && (
          <p className="text-xs text-green-600 mt-2 text-center flex items-center justify-center gap-1">
            <Icon name="CheckIcon" size={11} /> Voucher applied — ready to order
          </p>
        )}
      </div>
    </article>
  );
}