"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppImage from "@/components/ui/AppImage";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/app/products/components/CartContext";
import CartSidebar from "@/app/products/components/CartSidebar";
import Icon from "@/components/ui/AppIcon";

interface VoucherMealDetail {
  id: string;
  name: string;
  price: number;
  unit: string;
  description: string;
  longDescription?: string;
  attribute1?: string;
  attribute2?: string;
  attribute3?: string;
  image: string;
  imageAlt: string;
  available: boolean;
  packageType?: string;
  imageFit?: string;
  tags: string[];
  badge?: string;
  oldPrice?: number;
  savingPercent?: number;
  minOrder?: number;
}

export default function VoucherMealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [product, setProduct] = useState<VoucherMealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .single();

        if (error || !data) {
          setProduct(null);
          setLoading(false);
          return;
        }

        let imageUrl = "/assets/images/no_image.png";
        if (data.image_path) {
          const { data: urlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(data.image_path);
          imageUrl = urlData?.publicUrl || imageUrl;
        }

        setProduct({
          id: data.id,
          name: data.name,
          price: data.price,
          unit: data.unit,
          description: data.description,
          longDescription: data.long_description || "",
          attribute1: data.attribute1 || "",
          attribute2: data.attribute2 || "",
          attribute3: data.attribute3 || "",
          image: imageUrl,
          imageAlt: `${data.name} - Voucher Meals`,
          available: data.available,
          packageType: data.package_type || "none",
          imageFit: data.image_fit || "fill",
          tags: data.tags || [],
          badge: data.badge || undefined,
          oldPrice: data.old_price ?? undefined,
          savingPercent: data.saving_percent ?? undefined,
          minOrder: data.min_order || undefined,
        });
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (!product || !product.available) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.image,
      imageAlt: product.imageAlt,
      tags: product.tags,
      rating: 4.8,
      reviews: 0,
      description: product.description,
      available: product.available,
      category: "Voucher Meals",
      packageType: product.packageType,
      imageFit: product.imageFit,
      badge: product.badge,
      oldPrice: product.oldPrice,
      savingPercent: product.savingPercent,
      minOrder: product.minOrder,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <>
      <Header />
      <CartSidebar />
      <main className="pt-20 min-h-screen bg-[#ddd4cb]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
          {/* Back link */}
          <button
            onClick={() => router.push("/products?category=Voucher+Meals")}
            className="flex items-center gap-2 text-sm text-[#C4622D] hover:underline font-medium mb-8"
          >
            <Icon name="ArrowLeftIcon" size={14} />
            Back to Voucher Meals
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <svg className="animate-spin h-10 w-10 text-[#C4622D]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : !product ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-16 h-16 rounded-full bg-[#EDE7DA] flex items-center justify-center">
                <Icon name="FaceFrownIcon" size={28} className="text-[#B5ADA5]" />
              </div>
              <p className="text-[#8C8278] text-base font-medium">Product not found.</p>
              <button
                onClick={() => router.push("/products")}
                className="text-sm font-semibold text-[#C4622D] hover:underline"
              >
                Return to Menu
              </button>
            </div>
          ) : (
            <>
              {/* Main detail section */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
                <div className="flex flex-col md:flex-row">
                  {/* Left: Image */}
                  <div className="md:w-5/12 flex-shrink-0">
                    <div className="relative w-full h-72 md:h-96 bg-[#EDE7DA]">
                      <AppImage
                        src={product.image}
                        alt={product.imageAlt}
                        fill
                        className={`${product.imageFit === "fit" ? "object-contain" : "object-cover"}`}
                      />
                    </div>
                  </div>

                  {/* Right: Details */}
                  <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-start">
                    <h1 className="font-display text-3xl md:text-4xl font-semibold text-[#1A1612] mb-5 leading-tight">
                      {product.name}
                    </h1>

                    {product.price > 0 && (
                      <p className="text-xl font-bold text-[#1A1612] mb-4">
                        Price: R {product.price}
                        {product.oldPrice && product.oldPrice > 0 && (
                          <span className="ml-3 text-base font-normal text-[#8C8278] line-through">
                            R {product.oldPrice}
                          </span>
                        )}
                      </p>
                    )}

                    {/* Short description */}
                    {product.description && (
                      <p className="text-sm text-[#5C5347] leading-relaxed mb-6">
                        {product.description}
                      </p>
                    )}

                    {/* Attributes */}
                    {(product.attribute1 || product.attribute2 || product.attribute3) && (
                      <div className="flex flex-col gap-1.5 mb-8">
                        {product.attribute1 && (
                          <p className="text-sm text-[#5C5347]">{product.attribute1}</p>
                        )}
                        {product.attribute2 && (
                          <p className="text-sm text-[#5C5347]">{product.attribute2}</p>
                        )}
                        {product.attribute3 && (
                          <p className="text-sm text-[#5C5347]">{product.attribute3}</p>
                        )}
                      </div>
                    )}

                    {/* Add to Cart button */}
                    <button
                      onClick={handleAddToCart}
                      disabled={!product.available}
                      className={`w-full max-w-xs border-2 py-3.5 px-8 text-sm font-semibold transition-all duration-300 rounded-sm ${
                        added
                          ? "bg-green-500 border-green-500 text-white"
                          : !product.available
                          ? "border-[#DDD5C8] text-[#B5ADA5] cursor-not-allowed"
                          : "border-[#1A1612] text-[#1A1612] hover:bg-[#1A1612] hover:text-white"
                      }`}
                    >
                      {added ? "Added to cart ✓" : !product.available ? "Sold Out" : "Add to cart"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Long description section */}
              {product.longDescription && (
                <div className="mt-8 bg-white rounded-3xl p-8 md:p-12 shadow-sm">
                  <h2 className="text-base font-bold text-[#1A1612] mb-3">Additional description</h2>
                  <p className="text-sm text-[#5C5347] leading-relaxed whitespace-pre-line">
                    {product.longDescription}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
