-- Restore correct avatar_url values for all three testimonials.
-- These URLs match the images shown in the Staff Workspace (the source of truth).
UPDATE public.testimonials
SET avatar_url = 'https://img.rocket.new/generatedImages/rocket_gen_img_1a76b71b8-1766735364749.png'
WHERE name = 'Patricia & James Holloway';

UPDATE public.testimonials
SET avatar_url = 'https://img.rocket.new/generatedImages/rocket_gen_img_1ddae73d2-1763292681856.png'
WHERE name = 'Marcus Webb';

UPDATE public.testimonials
SET avatar_url = 'https://img.rocket.new/generatedImages/rocket_gen_img_1098b3c8f-1763293669401.png'
WHERE name = 'Danielle Torres';
