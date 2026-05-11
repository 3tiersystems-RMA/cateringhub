-- Clear Marcus Webb's avatar_url — the stored image is a woman in a wedding dress, not Marcus.
-- Setting to NULL so the neutral avatar SVG renders instead.
UPDATE public.testimonials
SET avatar_url = NULL
WHERE name = 'Marcus Webb';

-- Verify Patricia & James Holloway and Danielle Torres avatars are still set.
-- If either is also incorrect, clear them too.
-- Based on review: only Marcus Webb's image is confirmed wrong.
-- Patricia & James Holloway and Danielle Torres avatars remain as-is.
