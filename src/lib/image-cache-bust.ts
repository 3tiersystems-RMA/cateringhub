/** Append a version query param so browsers fetch fresh images after admin updates. */
export function cacheBustImageUrl(url: string, version: string | null | undefined): string {
  if (!url || !version) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(version)}`;
}
