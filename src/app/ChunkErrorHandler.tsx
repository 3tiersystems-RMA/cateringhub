'use client';

import { useEffect } from 'react';

export default function ChunkErrorHandler() {
  useEffect(() => {
    // Backup for the early inline script: this app ships no service worker, so
    // proactively remove any stale worker/cache (e.g. a leftover "gogebet-v1"
    // cache) that would otherwise serve mismatched webpack chunks and throw
    // "options.factory is undefined". No reload here — layout.tsx owns that.
    try {
      if (navigator.serviceWorker?.getRegistrations) {
        navigator.serviceWorker
          .getRegistrations()
          .then((rs) => Promise.all(rs.map((r) => r.unregister())))
          .catch(() => {});
      }
      if (typeof caches !== 'undefined' && caches.keys) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }
    } catch {}

    const isChunkError = (msg: string) =>
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      (msg.includes('Cannot read properties of undefined') && msg.includes("'call'")) ||
      msg.includes("reading 'call'") ||
      msg.includes('options.factory');

    const reloadWithCacheBust = () => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('_cb', Date.now().toString());
        window.location.replace(url.toString());
      } catch {
        window.location.reload();
      }
    };

    // Purge Cache Storage + service workers so the reload fetches fresh
    // webpack runtime/chunks instead of a cached, mismatched build.
    const purgeAndReload = () => {
      let settled = false;
      const go = () => {
        if (settled) return;
        settled = true;
        reloadWithCacheBust();
      };

      const tasks: Promise<unknown>[] = [];
      try {
        if (typeof caches !== 'undefined' && caches.keys) {
          tasks.push(
            caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {})
          );
        }
      } catch {}
      try {
        if (navigator.serviceWorker?.getRegistrations) {
          tasks.push(
            navigator.serviceWorker
              .getRegistrations()
              .then((rs) => Promise.all(rs.map((r) => r.unregister())))
              .catch(() => {})
          );
        }
      } catch {}

      if (tasks.length) {
        Promise.all(tasks).then(go);
        setTimeout(go, 1500);
      } else {
        go();
      }
    };

    const hardReload = () => {
      // Bounded retries so a genuinely broken build can't reload-loop forever.
      const attempts = parseInt(sessionStorage.getItem('chunk_reload') || '0', 10) || 0;
      if (attempts >= 2) return;
      sessionStorage.setItem('chunk_reload', String(attempts + 1));
      purgeAndReload();
    };

    const handleError = (event: ErrorEvent) => {
      const msg = event?.message || '';
      if (isChunkError(msg)) {
        hardReload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const msg =
        (reason instanceof Error ? reason.message : String(reason)) || '';
      if (isChunkError(msg)) {
        hardReload();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Clear the attempt counter after the page has loaded cleanly so future
    // chunk errors (e.g. after the next deploy) can trigger recovery again.
    const clearTimer = setTimeout(() => {
      sessionStorage.removeItem('chunk_reload');
    }, 5000);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      clearTimeout(clearTimer);
    };
  }, []);

  return null;
}
