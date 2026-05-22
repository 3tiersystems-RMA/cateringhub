import { createClient } from '@/lib/supabase/client';

/** Read section visibility; defaults when row is missing (no .single() 406). */
export async function getHomepageSectionVisibility(
  sectionKey: string,
  defaultVisible = true
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('homepage_section_settings')
    .select('is_visible')
    .eq('section_key', sectionKey)
    .maybeSingle();

  if (error) {
    console.warn(`homepage_section_settings(${sectionKey}):`, error.message);
    return defaultVisible;
  }
  if (!data) return defaultVisible;
  return data.is_visible ?? defaultVisible;
}

export async function getTickerBannerSettings(): Promise<{
  isVisible: boolean;
  bannerText: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('homepage_section_settings')
    .select('is_visible, banner_text')
    .eq('section_key', 'ticker_banner')
    .maybeSingle();

  if (error) {
    console.warn('homepage_section_settings(ticker_banner):', error.message);
    return { isVisible: false, bannerText: null };
  }
  if (!data) {
    return { isVisible: false, bannerText: null };
  }
  return {
    isVisible: data.is_visible === true,
    bannerText: data.banner_text ?? null,
  };
}
