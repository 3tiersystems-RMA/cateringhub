-- Mixed-class pricing + instructor provision for Cooking Classes
--
-- MIXED classes: a guardian (adult) attends together with their children, and the
-- child is charged a different fee to the adult. The existing `class_fee` is used
-- as the ADULT/guardian fee; `child_fee` (this migration) is the per-child fee.
-- When `child_fee` is null the app falls back to `class_fee`, so existing classes
-- keep working unchanged.
alter table public.cooking_class_event_dates
  add column if not exists child_fee numeric;

comment on column public.cooking_class_event_dates.child_fee is
  'Per-child fee for MIXED classes (guardian/adult pays class_fee, each child pays child_fee). NULL = same as class_fee.';

-- Instructor / chef name shown on the class card + booking form. Optional
-- "provision for later" field — safe to leave blank.
alter table public.cooking_class_events
  add column if not exists instructor text;

comment on column public.cooking_class_events.instructor is
  'Optional instructor/chef name shown on the public class card and booking form.';
