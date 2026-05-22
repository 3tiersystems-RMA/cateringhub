/** Suppress internal "Hidden" badge labels on customer and staff UIs. */
export function shouldShowProductBadge(badge: string | null | undefined): boolean {
  if (!badge?.trim()) return false;
  return badge.trim().toLowerCase() !== 'hidden';
}
