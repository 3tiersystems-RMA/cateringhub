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

    const handleError = (event: ErrorEvent) => {
      const msg = event?.message || '';
      if (isChunkError(msg)) {
        const reloaded = sessionStorage.getItem('chunk_reload');
        if (!reloaded) {
          sessionStorage.setItem('chunk_reload', '1');
          window.location.reload();
        }
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const msg =
        (reason instanceof Error ? reason.message : String(reason)) || '';
      if (isChunkError(msg)) {
        const reloaded = sessionStorage.getItem('chunk_reload');
        if (!reloaded) {
          sessionStorage.setItem('chunk_reload', '1');
          window.location.reload();
        }
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Clear the reload flag on successful load so future errors can trigger reload again
    sessionStorage.removeItem('chunk_reload');

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
