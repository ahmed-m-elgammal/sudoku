// ASSIZE service worker — precache shell + assets; offline-capable (spec §6).
// Strategy: precache critical shell/fonts/brand; cache-first for /assets; network-first for /api;
// the daily puzzle seed is served from cache when offline (M3 read-only), duels M0/M1/M5/Shade run local.
const VERSION = 'assize-v1';
const SHELL = [
  '/', '/manifest.webmanifest',
  '/fonts/im-fell-english-sc.woff2', '/fonts/im-fell-dw-pica.woff2',
  '/fonts/im-fell-dw-pica-italic.woff2', '/fonts/libre-caslon-400.woff2',
  '/fonts/libre-caslon-700.woff2', '/fonts/libre-caslon-italic.woff2',
  '/assets/brand/wordmark.svg', '/assets/brand/app-icon-192.png', '/assets/brand/app-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(SHELL.map((u) => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // API: network-first with cache fallback (daily leaderboard etc.)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(event.request);
        const cache = await caches.open(VERSION);
        cache.put(event.request, res.clone());
        return res;
      } catch {
        const hit = await caches.match(event.request);
        return hit ?? new Response(JSON.stringify({ ok: false, offline: true }), { headers: { 'content-type': 'application/json' } });
      }
    })());
    return;
  }

  // assets + fonts: cache-first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname === '/' || url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const hit = await caches.match(event.request);
      if (hit) return hit;
      try {
        const res = await fetch(event.request);
        const cache = await caches.open(VERSION);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch {
        return hit ?? Response.error();
      }
    })());
  }
});
