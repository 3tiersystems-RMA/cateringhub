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
  // --- Unconditional service-worker + cache cleanup ---
  // This app ships NO service worker. A stale worker left over from a previous
  // template (e.g. the "gogebet-v1" cache) keeps intercepting requests and
  // serving cached webpack chunks, which surfaces as "options.factory is
  // undefined" / "Cannot read properties of undefined (reading 'call')" after a
  // new deploy. Proactively remove any worker + cache for every visitor.
  try{
    if('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations){
      navigator.serviceWorker.getRegistrations().then(function(regs){
        var hadSW=regs&&regs.length>0;
        var jobs=(regs||[]).map(function(r){return r.unregister();});
        try{
          if(typeof caches!=='undefined'&&caches.keys){
            jobs.push(caches.keys().then(function(keys){
              return Promise.all(keys.map(function(k){return caches.delete(k);}));
            }));
          }
        }catch(e){}
        Promise.all(jobs).then(function(){
          // The current document may already be running stale chunks served by
          // the worker we just removed, so reload once to fetch fresh assets.
          if(hadSW){
            try{
              if(!sessionStorage.getItem('sw_purged')){
                sessionStorage.setItem('sw_purged','1');
                var u=new URL(window.location.href);
                u.searchParams.set('_cb',Date.now().toString());
                window.location.replace(u.toString());
              }
            }catch(e){}
          }
        }).catch(function(){});
      }).catch(function(){});
    }
  }catch(e){}

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
  function purgeAndReload(){
    var done=false;
    function go(){
      if(done)return;done=true;
      try{
        var u=new URL(window.location.href);
        u.searchParams.set('_cb',Date.now().toString());
        window.location.replace(u.toString());
      }catch(e){try{window.location.reload();}catch(_){}}
    }
    var tasks=[];
    try{
      if(typeof caches!=='undefined'&&caches.keys){
        tasks.push(caches.keys().then(function(keys){
          return Promise.all(keys.map(function(k){return caches.delete(k);}));
        }).catch(function(){}));
      }
    }catch(e){}
    try{
      if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){
        tasks.push(navigator.serviceWorker.getRegistrations().then(function(rs){
          return Promise.all(rs.map(function(r){return r.unregister();}));
        }).catch(function(){}));
      }
    }catch(e){}
    // Reload after caches are purged, but never wait more than 1.5s
    if(tasks.length){Promise.all(tasks).then(go);setTimeout(go,1500);}else{go();}
  }
  function hardReload(){
    try{
      // Count attempts so a genuinely broken build can't loop forever
      var n=parseInt(sessionStorage.getItem('chunk_reload')||'0',10)||0;
      if(n>=2)return;
      sessionStorage.setItem('chunk_reload',String(n+1));
      purgeAndReload();
    }catch(e){purgeAndReload();}
  }
  window.addEventListener('error',function(e){
    if(isChunkErr(e&&e.message))hardReload();
  },true);
  window.addEventListener('unhandledrejection',function(e){
    var msg=e&&e.reason&&(e.reason.message||String(e.reason))||'';
    if(isChunkErr(msg))hardReload();
  },true);
  // Clear the attempt counter once the page has loaded cleanly
  window.addEventListener('load',function(){
    setTimeout(function(){try{sessionStorage.removeItem('chunk_reload');}catch(e){}},4000);
  });
})();
        ` }} />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fcateringhu2257back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.3" /></head>
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
