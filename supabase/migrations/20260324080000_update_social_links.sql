-- Remove Pinterest from social links
DELETE FROM public.social_links WHERE platform = 'pinterest';

-- Update URLs to match actual social media profiles
UPDATE public.social_links SET url = 'https://www.facebook.com/cardamomkitchensa/' WHERE platform = 'facebook';
UPDATE public.social_links SET url = 'https://x.com/cardamomcpt/' WHERE platform = 'twitter';
UPDATE public.social_links SET url = 'https://www.instagram.com/cardamomkitchensa/' WHERE platform = 'instagram';
UPDATE public.social_links SET url = 'https://www.capetown.travel/listing/cardamom-kitchen/' WHERE platform = 'custom';
