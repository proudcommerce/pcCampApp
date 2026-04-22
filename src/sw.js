// BUILD_VERSION is replaced by build-cache-busting.cjs at image build time.
// CONTENT_VERSION is fetched from /content/sw-version.txt at install time so
// that admin edits (rehash.php bumps that file) trigger a fresh cache.
const BUILD_VERSION = 'dev';
let CACHE_NAME = 'event-app-' + BUILD_VERSION;

const urlsToCache = [
  './',
  './index.html',
  './sessionplan/index.html',
  './timetable/index.html',
  './food/index.html',
  './floorplan/index.html',
  './assets/app.css',
  './assets/header.js',
  './assets/favicon.png',
  './assets/icon-144.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

async function resolveCacheName() {
  try {
    const resp = await fetch('/content/sw-version.txt', { cache: 'no-store' });
    if (resp.ok) {
      const contentVersion = (await resp.text()).trim();
      if (contentVersion) {
        CACHE_NAME = 'event-app-' + BUILD_VERSION + '-' + contentVersion;
      }
    }
  } catch (e) {
    // File missing (fresh install / dev) — stick with build version only.
  }
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    (async () => {
      await resolveCacheName();
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(urlsToCache);
    })()
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    (async () => {
      await resolveCacheName();
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => {
        if (name !== CACHE_NAME) return caches.delete(name);
      }));
    })()
  );
});

self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Nicht-GET (POST/PUT/DELETE) sowie alle Admin/Votes-Endpoints komplett dem
  // Browser ueberlassen — respondWith(fetch(event.request)) zerstoert bei
  // multipart-Bodies den Request-Stream (Upload-Issue).
  if (event.request.method !== 'GET') return;
  if (url.pathname.includes('/votes/') || url.pathname.includes('/admin/')) return;

  // Runtime content is admin-editable and may keep stable URLs (notably
  // /content/assets/logo.jpg). Use network-first so updates are not hidden by
  // the generic cache-first asset branch below, but keep an offline fallback.
  if (url.pathname.includes('/content/')) {
    const cacheKey = url.origin + url.pathname;
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(cacheKey, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(cacheKey);
        })
    );
    return;
  }

  // Network-first with cache update for code JSON data files.
  // Translations and manifest are cached alongside code assets (cache-first).
  if (url.pathname.endsWith('.json') &&
      !url.pathname.endsWith('manifest.json') &&
      !url.pathname.includes('/translations/')) {
    const cacheKey = url.origin + url.pathname;
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(cacheKey, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(cacheKey);
        })
    );
    return;
  }

  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cachedResponse) {
            if (cachedResponse) return cachedResponse;
            return caches.match('/');
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) return response;
        return fetch(event.request).then(function(fetchResponse) {
          if (fetchResponse.status === 200 &&
              (url.pathname.includes('/assets/') ||
               url.pathname.endsWith('.css') ||
               url.pathname.endsWith('.js') ||
               url.pathname.match(/\.(jpg|jpeg|png|gif|svg|ico)$/))) {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return fetchResponse;
        });
      })
  );
});

self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.ports && event.ports.length > 0) {
    event.ports[0].postMessage({ success: true });
  }
});

self.addEventListener('unhandledrejection', function(event) {
  event.preventDefault();
});
