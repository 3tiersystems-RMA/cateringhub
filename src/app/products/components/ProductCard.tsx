"use client";

import React, { useState } from "react";
import AppImage from "@/components/ui/AppImage";
import type { CartProduct } from "./CartContext";
import { useCart } from "./CartContext";
import { shouldShowProductBadge } from "@/lib/product-badge";

interface ProductCardProps {
  product: CartProduct;
  onOpenModal?: (product: CartProduct) => void;
  imagePriority?: boolean;
}

const PACKAGE_LABEL: Record<string, string> = {
  "package-6": "6-Meal Package",
  "package-10": "Health Package",
  "package-12": "12-Meal Package",
  "package-24": "24-Meal Package",
};

export default function ProductCard({ product, onOpenModal, imagePriority = false }: ProductCardProps) {
  const { addItem, appliedVoucher } = useCart();
  const [added, setAdded] = useState(false);

  const isSoldOut = !product.available || product.badge === "Sold Out";
  const isPackageProduct = product.packageType && product.packageType !== "none";
  const isMacro = product.visualType === "Macro";

  const voucherPackageType = appliedVoucher?.package_type;
  const isUnlockedByVoucher = isPackageProduct && voucherPackageType === product.packageType;
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

  // Build category label string
  const categoryLabel = product.category ? product.category.toUpperCase() : "";

  return (
    <article
      className="group flex flex-col cursor-pointer"
      style={{
        background: "#FDFBF8",
        border: "0.5px solid #E2DDD6",
        borderRadius: "14px",
        transition: "border-color 150ms ease",
      }}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCardClick(); }}
      aria-label={`View details for ${product.name}`}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#4A7C5F"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E2DDD6"; }}
    >
      {/* Image Area */}
      <div
        className="relative flex-shrink-0 overflow-hidden"
        style={{
          height: "200px",
          background: "#F7F4EF",
          borderRadius: "14px 14px 0 0",
          opacity: isSoldOut ? 0.5 : 1,
        }}
      >
        <div className="absolute inset-0 p-6 flex items-center justify-center">
          <AppImage
            src={product.image}
            alt={product.imageAlt}
            fill
            priority={imagePriority}
            loading={imagePriority ? "eager" : "lazy"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
            style={{ padding: "0px" }}
          />
        </div>

        {/* Overlay badges — top-left */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {isSoldOut && (
            <span
              style={{
                fontSize: "10px",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 500,
                background: "rgba(26,26,24,0.72)",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "999px",
                letterSpacing: "0.3px",
              }}
            >
              Sold out
            </span>
          )}
          {!isSoldOut && shouldShowProductBadge(product.badge) && product.badge !== "Sold Out" && (
            <span
              style={{
                fontSize: "10px",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 500,
                background: "rgba(26,26,24,0.72)",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "999px",
                letterSpacing: "0.3px",
              }}
            >
              {product.badge}
            </span>
          )}
          {!isSoldOut && product.savingPercent && product.savingPercent > 0 ? (
            <span
              style={{
                fontSize: "10px",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 500,
                background: "rgba(30,61,47,0.82)",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "999px",
                letterSpacing: "0.3px",
              }}
            >
              -{product.savingPercent}%
            </span>
          ) : null}
          {!isSoldOut && isPackageProduct && (
            <span
              style={{
                fontSize: "10px",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 500,
                background: "rgba(26,26,24,0.72)",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "999px",
                letterSpacing: "0.3px",
              }}
            >
              {PACKAGE_LABEL[product.packageType!] || "Package"}
            </span>
          )}
          {/* Dietary tags from product.tags */}
          {!isSoldOut && product.tags && product.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "10px",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 500,
                background: "rgba(74,124,95,0.82)",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "999px",
                letterSpacing: "0.3px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Card Body */}
      <div
        className="flex flex-col flex-1"
        style={{ padding: "16px 18px 18px" }}
      >
        {/* Line 1 — Category label */}
        {categoryLabel && (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "10px",
              fontWeight: 500,
              color: "#8A8A82",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {categoryLabel}
          </p>
        )}

        {/* Line 2 — Product name */}
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "22px",
            fontWeight: 400,
            color: "#1A1A18",
            marginTop: "4px",
            lineHeight: 1.15,
            margin: "4px 0 0 0",
          }}
        >
          {product.name}
        </h3>

        {/* Line 3 — Description */}
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            color: "#5A5A54",
            lineHeight: 1.55,
            marginTop: "6px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {product.description}
        </p>

        {/* Line 4 — Unit/size */}
        {product.unit && (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              color: "#8A8A82",
              marginTop: "10px",
            }}
          >
            {product.unit}
          </p>
        )}

        {/* Macro hint */}
        {isMacro && (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              color: "#8A8A82",
              marginTop: "8px",
              fontStyle: "italic",
            }}
          >
            View sub-items to order
          </p>
        )}

        {/* Voucher hints */}
        {!isMacro && isVoucherRequired && (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "11px",
              color: "#B45309",
              marginTop: "6px",
            }}
          >
            Requires a valid {PACKAGE_LABEL[product.packageType!] || "package"} voucher
          </p>
        )}
        {!isMacro && isUnlockedByVoucher && (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "11px",
              color: "#166534",
              marginTop: "6px",
            }}
          >
            ✓ Voucher applied — ready to order
          </p>
        )}

        {/* Card Footer — pinned to bottom */}
        <div
          className="flex items-center justify-between"
          style={{ marginTop: "auto", paddingTop: "14px" }}
        >
          {/* Price */}
          <div>
            {product.price && product.price > 0 && !(product.packageType && product.packageType.toLowerCase().includes("package")) ? (
              <div className="flex items-baseline gap-2">
                <span
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "18px",
                    fontWeight: 500,
                    color: "#1E3D2F",
                  }}
                >
                  R{product.price}
                </span>
                {product.oldPrice && product.oldPrice > 0 ? (
                  <span
                    style={{
                      fontFamily: "DM Sans, sans-serif",
                      fontSize: "13px",
                      color: "#8A8A82",
                      textDecoration: "line-through",
                    }}
                  >
                    R{product.oldPrice}
                  </span>
                ) : null}
              </div>
            ) : (
              <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "#8A8A82" }}>
                {product.packageType && product.packageType !== "none" ? "Voucher item" : ""}
              </span>
            )}
          </div>

          {/* Add button */}
          {isMacro ? null : isSoldOut ? (
            <button
              disabled
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "#8A8A82",
                background: "#F0EDE8",
                border: "0.5px solid #E2DDD6",
                borderRadius: "999px",
                padding: "6px 14px",
                cursor: "not-allowed",
                fontWeight: 500,
              }}
            >
              Sold out
            </button>
          ) : (
            <button
              onClick={handleAdd}
              aria-label={`Add ${product.name} to cart`}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: added ? "#4A7C5F" : "#1E3D2F",
                color: "#fff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                lineHeight: 1,
                cursor: "pointer",
                transition: "background 150ms ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!added) (e.currentTarget as HTMLElement).style.background = "#4A7C5F";
              }}
              onMouseLeave={(e) => {
                if (!added) (e.currentTarget as HTMLElement).style.background = "#1E3D2F";
              }}
            >
              {added ? "✓" : "+"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}