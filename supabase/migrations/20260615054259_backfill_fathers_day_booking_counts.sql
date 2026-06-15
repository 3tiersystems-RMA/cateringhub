-- Backfill cooking_class_booking_counts for paid registrations that are missing entries.
-- This fixes the case where the class was renamed from
-- "Father's Day Cooking Class (For Kids 5-16)" to "Father's Day Cooking Class",
-- causing existing paid bookings to be orphaned (no booking_count row).
--
-- Strategy:
--   1. Find all paid registrations that have NO entry in cooking_class_booking_counts.
--   2. For each such registration, find the matching cooking_class_event_dates row(s)
--      by joining cooking_class_events on the event name stored in selected_events[1],
--      treating both the old and new class name as equivalent.
--   3. Further narrow the match by comparing the stored adult_class_dates text label
--      against the event_date column (extract the day/month/year from the label).
--   4. Insert the missing booking_count rows.

DO $$
DECLARE
  rec RECORD;
  date_label TEXT;
  matched_date_id UUID;
  inserted_count INT := 0;
BEGIN
  -- Loop over every paid registration that has no booking_count entry at all
  FOR rec IN
    SELECT r.id, r.selected_events, r.adult_class_dates
    FROM public.cooking_class_registrations r
    WHERE r.payment_status = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM public.cooking_class_booking_counts bc
        WHERE bc.registration_id = r.id
      )
  LOOP
    -- For each date label stored in adult_class_dates, find the matching event_date row
    IF rec.adult_class_dates IS NOT NULL THEN
      FOREACH date_label IN ARRAY rec.adult_class_dates
      LOOP
        matched_date_id := NULL;

        -- Match event_date_id by:
        --   a) The event name in selected_events[1] matches cooking_class_events.name
        --      (accept both old name and new name for Father's Day class)
        --   b) The event_date formatted as "D Month YYYY" appears at the start of the label
        SELECT ced.id INTO matched_date_id
        FROM public.cooking_class_event_dates ced
        JOIN public.cooking_class_events ce ON ce.id = ced.event_id
        WHERE (
          -- Match current event name
          ce.name = ANY(rec.selected_events)
          OR
          -- Match old Father's Day class name (renamed)
          (
            'Father''s Day Cooking Class (For Kids 5-16)' = ANY(rec.selected_events)
            AND ce.name = 'Father''s Day Cooking Class'
          )
        )
        AND (
          -- Match date label: label starts with "D Month YYYY" or "DD Month YYYY"
          date_label LIKE (
            to_char(ced.event_date, 'FMDD') || ' ' ||
            to_char(ced.event_date, 'FMMonth') || ' ' ||
            to_char(ced.event_date, 'YYYY') || '%'
          )
        )
        LIMIT 1;

        IF matched_date_id IS NOT NULL THEN
          -- Insert only if not already present (idempotent)
          INSERT INTO public.cooking_class_booking_counts (event_date_id, registration_id)
          VALUES (matched_date_id, rec.id)
          ON CONFLICT DO NOTHING;

          inserted_count := inserted_count + 1;
        ELSE
          RAISE NOTICE 'No matching event_date found for registration % with label: %', rec.id, date_label;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % booking_count row(s) inserted.', inserted_count;
END $$;
