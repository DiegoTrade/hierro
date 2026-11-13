/* Hierro offline shell. Bump VERSION on every release. */
'use strict';

const VERSION = '1.0.0';
const SCOPE = new URL(self.registration.scope);
const SCOPE_KEY = encodeURIComponent(SCOPE.pathname);
const CACHE_PREFIX = `hierro-${SCOPE_KEY}-`;
const CACHE_NAME = `${CACHE_PREFIX}v${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './engine.js',
  './storage.js',
  './manifest.webmanifest',
  './assets/barlow-latin.woff2',
  './assets/barlow-semibold-latin.woff2',
  './assets/barlow-condensed-latin.woff2',
  './assets/barlow-condensed-medium-latin.woff2',
  './assets/barlow-condensed-semibold-latin.woff2',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  // A missing shell file fails installation, keeping the previous release intact.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL.map(path => new Request(new URL(path, SCOPE), { cache: 'reload' })));
  })());
  // Do not skipWaiting here. The app offers the complete update to the user.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    // Send only after the current workout is saved and the user chooses Update.
    event.waitUntil(self.skipWaiting());
  }
  if (event.data?.type === 'GET_VERSION') {
    const reply = { type: 'VERSION', version: VERSION, cache: CACHE_NAME };
    if (event.ports?.[0]) event.ports[0].postMessage(reply);
    else if (event.source) event.source.postMessage(reply);
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A controlled navigation uses the staged HTML and its matching code. New
    // releases are discovered by registration.update(), never mixed into a workout.
    if (request.mode === 'navigate') {
      const page = await cache.match(new URL('./index.html', SCOPE).href);
      if (page) return page;
      return fetch(request);
    }
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Do not cache arbitrary requests or external form-help links.
    return fetch(request);
  })());
});
