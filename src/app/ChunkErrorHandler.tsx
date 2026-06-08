'use client';

import { useEffect } from 'react';

export default function ChunkErrorHandler() {
  useEffect(() => {
    const isChunkError = (msg: string) =>
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      (msg.includes('Cannot read properties of undefined') && msg.includes("'call'")) ||
      msg.includes('options.factory');

    const hardReload = () => {
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        // Cache-busting hard reload to clear stale webpack chunks
        const url = new URL(window.location.href);
        url.searchParams.set('_cb', Date.now().toString());
        window.location.replace(url.toString());
      }
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

    // Clear the reload flag after 5 seconds — enough time for the page to fully
    // load without errors, so future chunk errors can trigger a reload again.
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
