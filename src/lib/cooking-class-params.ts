/**
 * URL/query helpers for in-person cooking class routes.
 * Prefer `classId` / `class`; legacy `eventId` / `event` remain supported.
 */

/** Preferred + legacy query param names for a cooking class id. */
export const CLASS_ID_QUERY_KEYS = ['classId', 'eventId'] as const;

/** Preferred + legacy query param names for a cooking class display name. */
export const CLASS_NAME_QUERY_KEYS = ['class', 'event'] as const;

export function getClassIdFromSearchParams(params: URLSearchParams): string | null {
  for (const key of CLASS_ID_QUERY_KEYS) {
    const value = params.get(key);
    if (value) return value;
  }
  return null;
}

export function getClassNameFromSearchParams(params: URLSearchParams): string | null {
  for (const key of CLASS_NAME_QUERY_KEYS) {
    const value = params.get(key);
    if (value) return value;
  }
  return null;
}

/** Public registration deep link from /events "Register Now" (class cards). */
export function buildCookingClassEnrollmentUrl(classId: string, sessionId: string): string {
  const q = new URLSearchParams({
    classId,
    sessionId,
    // Legacy alias — keep so old links and external bookmarks using eventId still work.
    eventId: classId,
  });
  return `/cooking-classes?${q.toString()}`;
}
