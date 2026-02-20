// ZeroTruster Service Worker — Offline PWA Support
const CACHE_NAME = 'zerotruster-v5';
const ASSETS = [
    '/',
    '/index.html',
    '/fonts.css',
    '/style.css',
    '/script.js',
    '/i18n.js',
    '/manifest.json',
    '/assets/favicon.svg',
    '/assets/icon-192.png',
    '/assets/icon-192-maskable.png',
    '/assets/icon-512.png',
    '/assets/icon-512-maskable.png',
    '/assets/apple-touch-icon.png',
    '/assets/fonts/inter-latin.woff2',
    '/assets/fonts/jetbrains-mono-latin.woff2'
];

// Install — cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — stale-while-revalidate for cached assets, network-first for navigation
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Cache-first for fonts (immutable content-hashed files)
    if (url.pathname.startsWith('/assets/fonts/')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request).then(response => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Stale-while-revalidate for other same-origin assets
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const fetchPromise = fetch(event.request).then(response => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);

                return cached || fetchPromise;
            })
        );
        return;
    }

    // Network-first for external requests
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request)
                .then(cached => cached || caches.match('/index.html')))
    );
});
