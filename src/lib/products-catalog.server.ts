import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  mapProductRows,
  PRODUCT_LIST_COLUMNS,
  type ProductsCatalog,
} from '@/lib/products-catalog';

/** Server-side catalog fetch — runs in parallel before HTML is sent. */
export async function fetchProductsCatalog(): Promise<ProductsCatalog> {
  const supabase = await createClient();

  const [catResult, pvResult, productsResult] = await Promise.all([
    supabase
      .from('categories')
      .select('name')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('package_visibility').select('package_name, is_visible'),
    supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS)
      .eq('available', true)
      .order('sort_order', { ascending: true }),
  ]);

  const categories = (catResult.data || []).map((c) => c.name as string);
  const visiblePackages = (pvResult.data || [])
    .filter((p) => p.is_visible)
    .map((p) => p.package_name as string);
  const products = productsResult.error || !productsResult.data
    ? []
    : mapProductRows(productsResult.data);

  return { categories, visiblePackages, products };
}
