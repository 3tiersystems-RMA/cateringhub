/** Shared product catalog types and mapping — safe for client + server. */

export interface CatalogProduct {
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
  oldPrice?: number;
  savingPercent?: number;
  visualType?: string | null;
}

export interface ProductsCatalog {
  categories: string[];
  visiblePackages: string[];
  products: CatalogProduct[];
}

const FALLBACK_IMAGE = '/assets/images/no_image.png';

const PRODUCT_LIST_COLUMNS =
  'id, name, category, price, unit, image_path, description, tags, min_order, badge, available, package_type, image_fit, old_price, saving_percent, visual_type';

type ProductRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  image_path: string | null;
  description: string;
  tags: string[] | null;
  min_order: number | null;
  badge: string | null;
  available: boolean;
  package_type: string | null;
  image_fit: string | null;
  old_price: number | null;
  saving_percent: number | null;
  visual_type: string | null;
};

export function resolveProductImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return FALLBACK_IMAGE;
  if (imagePath.startsWith('/') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return FALLBACK_IMAGE;
  return `${base}/storage/v1/object/public/product-images/${imagePath}`;
}

export function mapProductRows(rows: ProductRow[]): CatalogProduct[] {
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    unit: p.unit,
    image: resolveProductImageUrl(p.image_path),
    imageAlt: `${p.name} - ${p.category}`,
    tags: p.tags || [],
    rating: 4.8,
    reviews: 0,
    description: p.description,
    minOrder: p.min_order ?? undefined,
    badge: p.badge ?? undefined,
    available: p.available,
    packageType: p.package_type || 'none',
    imageFit: p.image_fit || 'fill',
    oldPrice: p.old_price ?? undefined,
    savingPercent: p.saving_percent ?? undefined,
    visualType: p.visual_type ?? null,
  }));
}

export { PRODUCT_LIST_COLUMNS };
