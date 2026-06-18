-- Add 'Bookings Closed' as a default cooking class session status
INSERT INTO public.cooking_class_session_statuses (label, sort_order)
VALUES ('Bookings Closed', 4)
ON CONFLICT (label) DO NOTHING;
