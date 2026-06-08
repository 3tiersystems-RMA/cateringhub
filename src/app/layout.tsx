import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/index.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ChunkErrorHandler from './ChunkErrorHandler';
import { CartProvider } from '@/app/products/components/CartContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Central Kitchen',
  description: 'Premium catering for weddings, corporate events, and everyday occasions. Weekly meal prep delivered to your door.',
  icons: {
    icon: [
      { url: '/assets/images/Favicon-1778145940787.jpg', type: 'image/jpeg' },
    ],
    shortcut: '/assets/images/Favicon-1778145940787.jpg',
    apple: '/assets/images/Favicon-1778145940787.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/assets/images/Favicon-1778145940787.jpg" type="image/jpeg" />
        <link rel="shortcut icon" href="/assets/images/Favicon-1778145940787.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/assets/images/Favicon-1778145940787.jpg" />

        {/* Early stale-chunk guard — fires before React mounts so the race condition is covered */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  function isChunkErr(msg){
    return msg&&(
      msg.indexOf('ChunkLoadError')!==-1||
      msg.indexOf('Loading chunk')!==-1||
      msg.indexOf('Failed to fetch dynamically imported module')!==-1||
      msg.indexOf('Importing a module script failed')!==-1||
      (msg.indexOf('Cannot read properties of undefined')!==-1&&msg.indexOf("'call'")!==-1)||
      msg.indexOf("reading 'call'")!==-1||
      msg.indexOf('options.factory')!==-1
    );
  }
  function hardReload(){
    try{
      if(sessionStorage.getItem('chunk_reload'))return;
      sessionStorage.setItem('chunk_reload','1');
      var u=new URL(window.location.href);
      u.searchParams.set('_cb',Date.now().toString());
      window.location.replace(u.toString());
    }catch(e){}
  }
  window.addEventListener('error',function(e){
    if(isChunkErr(e&&e.message))hardReload();
  },true);
  window.addEventListener('unhandledrejection',function(e){
    var msg=e&&e.reason&&(e.reason.message||String(e.reason))||'';
    if(isChunkErr(msg))hardReload();
  },true);
  setTimeout(function(){try{sessionStorage.removeItem('chunk_reload');}catch(e){}},5000);
})();
        ` }} />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fcateringhu2257back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.19" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></head>
      <body>
        <ChunkErrorHandler />
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
