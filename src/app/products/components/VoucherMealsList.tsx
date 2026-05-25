"use client";

import React from "react";
import Link from "next/link";
import AppImage from "@/components/ui/AppImage";

interface VoucherMealsProduct {
  id: string;
  name: string;
  price: number;
  unit?: string;
  description: string;
  image: string;
  imageAlt: string;
  available: boolean;
  packageType?: string;
  imageFit?: string;
}

interface VoucherMealsListProps {
  products: VoucherMealsProduct[];
}

export default function VoucherMealsList({ products }: VoucherMealsListProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center text-[#8C8278] text-sm font-mono">
        No Voucher Meals available at the moment.
      </div>
    );
  }

  // Split into pairs for 2-column grid
  const rows: VoucherMealsProduct[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  return (
    <div className="w-full">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0">
            {row.map((product) => (
              <div
                key={product.id}
                className="flex items-start gap-5 py-7"
              >
                {/* Circular image */}
                <div className="flex-shrink-0 w-28 h-28 rounded-full overflow-hidden border border-[#DDD5C8] bg-[#EDE7DA]">
                  <AppImage
                    src={product.image}
                    alt={product.imageAlt}
                    width={112}
                    height={112}
                    className={`w-full h-full ${product.imageFit === "fit" || (product.packageType && product.packageType.toLowerCase().includes("package")) ? "object-contain" : "object-cover"}`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-semibold text-[#1A1612] mb-1 leading-snug">
                    {product.name}
                  </h3>
                  {product.price > 0 && (
                    <p className="text-sm text-[#5C5347] mb-2">
                      Price: R {product.price}
                    </p>
                  )}
                  <p className="text-sm text-[#5C5347] leading-relaxed mb-3 line-clamp-3">
                    {product.description}
                  </p>
                  {product.packageType &&
                    product.packageType.toLowerCase().includes("package") &&
                    (!product.price || product.price === 0) &&
                    product.unit && (
                      <p className="text-sm text-[#5C5347] font-medium mb-1">
                        {product.unit}
                      </p>
                    )}
                  <Link
                    href={`/products/voucher-meals/${product.id}`}
                    className="text-sm font-semibold text-[#C4622D] hover:underline inline-flex items-center gap-0.5"
                  >
                    Order Now &gt;
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {/* Divider between rows */}
          {rowIdx < rows.length - 1 && (
            <hr className="border-[#DDD5C8]" />
          )}
        </div>
      ))}
    </div>
  );
}
