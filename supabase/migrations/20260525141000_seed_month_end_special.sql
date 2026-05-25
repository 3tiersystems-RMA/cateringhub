-- Seed Month-end Special product
-- 10 Frozen Healthy Meals for R1100 using the flyer image from public assets

DO $$
BEGIN
  -- Only insert if not already present
  IF NOT EXISTS (
    SELECT 1 FROM public.products WHERE name = 'Month-end Special'
  ) THEN
    INSERT INTO public.products (
      name,
      category,
      price,
      unit,
      description,
      long_description,
      tags,
      badge,
      min_order,
      available,
      featured,
      sort_order,
      package_type,
      image_path,
      image_fit,
      old_price,
      saving_percent,
      attribute1,
      attribute2,
      attribute3,
      visual_type
    ) VALUES (
      'Month-end Special',
      'Voucher Meals',
      1100,
      '1/10',
      '10 Frozen Healthy Meals for R1100. A specially curated selection of our most popular frozen meals — perfect for stocking up at month-end.',
      'Includes 10 individually portioned frozen healthy meals. Each meal is chef-crafted, nutritionally balanced, and ready to heat in minutes. Ideal for busy households looking for wholesome, convenient meals at great value.',
      ARRAY['Frozen', 'Healthy', 'Value Pack', 'Month-end Deal'],
      'Special Offer',
      1,
      true,
      true,
      100,
      'month-end-special',
      '/assets/images/CK_Frozen_Meals__Month-end_Special_-1779714951655.webp',
      'fit',
      NULL,
      NULL,
      'SANHA Halaal Certified',
      '10 Meals included',
      'Heat & Serve — ready in minutes',
      'Macro'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Month-end Special seed failed: %', SQLERRM;
END $$;
