-- Separate in-person Classes from marketing Events at the database layer.
-- Marketing events: public.events + event_management_*
-- In-person classes: cooking_classes + cooking_class_sessions (renamed from cooking_class_events / cooking_class_event_dates)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_class_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_classes'
  ) THEN
    ALTER TABLE public.cooking_class_events RENAME TO cooking_classes;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_class_event_dates'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_class_sessions'
  ) THEN
    ALTER TABLE public.cooking_class_event_dates RENAME TO cooking_class_sessions;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cooking_class_sessions' AND column_name = 'event_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cooking_class_sessions' AND column_name = 'class_id'
  ) THEN
    ALTER TABLE public.cooking_class_sessions RENAME COLUMN event_id TO class_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_cooking_class_event_dates_event_id'
  ) THEN
    ALTER INDEX public.idx_cooking_class_event_dates_event_id
      RENAME TO idx_cooking_class_sessions_class_id;
  END IF;
END $$;

COMMENT ON TABLE public.cooking_classes IS
  'In-person cooking & baking class types (e.g. Kids Class, Adults Class). Not marketing events.';

COMMENT ON TABLE public.cooking_class_sessions IS
  'Scheduled sessions for an in-person class (date, time, fee, seating).';

-- Read-only compatibility views (legacy names). Deploy updated app code; do not write via these views.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'cooking_class_events'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_classes'
  ) THEN
    CREATE VIEW public.cooking_class_events AS
      SELECT * FROM public.cooking_classes;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'cooking_class_event_dates'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cooking_class_sessions'
  ) THEN
    CREATE VIEW public.cooking_class_event_dates AS
      SELECT
        id,
        class_id AS event_id,
        event_date,
        start_time,
        end_time,
        location,
        sort_order,
        created_at,
        updated_at,
        class_fee,
        child_fee,
        seating,
        status_id,
        session_name
      FROM public.cooking_class_sessions;
  END IF;
END $$;
