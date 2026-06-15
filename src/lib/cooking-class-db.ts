/** Supabase table names for in-person cooking & baking classes (not marketing events). */
export const COOKING_CLASS_TABLES = {
  classes: 'cooking_class_name',
  sessions: 'cooking_class_sessions',
  settings: 'cooking_class_settings',
  registrations: 'cooking_class_registrations',
  sessionStatuses: 'cooking_class_session_statuses',
  bookingCounts: 'cooking_class_booking_counts',
} as const;

/** FK on cooking_class_sessions linking to cooking_class_name.id */
export const COOKING_CLASS_SESSION_CLASS_ID = 'class_id' as const;

/**
 * Legacy DB column on cooking_class_registrations — stores selected class *names*
 * (not marketing event ids). Renaming the column requires a migration.
 */
export const COOKING_CLASS_REGISTRATION_SELECTED_CLASSES_COLUMN = 'selected_events' as const;
