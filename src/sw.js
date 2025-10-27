const CACHE_NAME = 'event-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './sessionplan/index.html',
  './timetable/index.html',
  './food/index.html',
  './floorplan/index.html',
  './assets/menu.json',
  './assets/news.json',
  './sponsors/sponsors.json',
  // './sessionplan/sessions.json' removed - always fetch fresh to get latest updates
  './timetable/timetable.json',
  './food/menue.json',
  './food/allergene.json',
  './assets/app.css',
  './assets/header.js',
  './assets/favicon.png',
  './assets/logo.png',
  './assets/icon-144.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './floorplan/floorplan-min.jpg'
  // Sponsor images are loaded dynamically from sponsors.json and cached on-demand
];

// Service Worker Installation
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

// Service Worker Aktivierung
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch Event - Network First for HTML, Cache First for static assets
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // Don't cache session data and votes data - always fetch fresh
  if ((url.pathname.includes('sessionplan_') && url.pathname.endsWith('.json')) ||
      url.pathname.includes('sessions.json') ||
      url.pathname.includes('votes.json') ||
      url.pathname.includes('votes/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Network First for HTML documents - always fetch fresh HTML
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Cache successful HTML responses for offline fallback
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(function(error) {
          console.log('HTML fetch failed, using cache:', error);
          // Fallback to cached version for offline
          return caches.match(event.request).then(function(cachedResponse) {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Ultimate fallback to homepage
            return caches.match('/');
          });
        })
    );
    return;
  }
  
  // Cache first strategy for static assets (CSS, JS, images, etc.)
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request).then(function(fetchResponse) {
          // Cache successful responses for static assets
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
        }).catch(function(error) {
          console.log('Static asset fetch failed:', error);
          // For static assets, we can return a fallback or let the browser handle it
          throw error;
        });
      })
  );
});


// Background Sync für Offline-Funktionalität
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Hier können Offline-Daten synchronisiert werden
  return Promise.resolve();
}

// Message Event Handler für bessere Fehlerbehandlung
self.addEventListener('message', function(event) {
  try {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    
    // Sende Bestätigung zurück falls ein Port vorhanden ist
    if (event.ports && event.ports.length > 0) {
      event.ports[0].postMessage({ success: true });
      
      // Cleanup für Message Ports
      event.ports.forEach(port => {
        port.addEventListener('close', () => {
          console.log('Message Port geschlossen');
        });
      });
    }
  } catch (error) {
    console.error('Fehler im Message Handler:', error);
    // Sende Fehler zurück falls ein Port vorhanden ist
    if (event.ports && event.ports.length > 0) {
      try {
        event.ports[0].postMessage({ success: false, error: error.message });
      } catch (portError) {
        console.error('Fehler beim Senden der Antwort:', portError);
      }
    }
  }
});

// Error Handler für unhandled promise rejections
self.addEventListener('unhandledrejection', function(event) {
  console.log('Unhandled promise rejection in Service Worker:', event.reason);
  event.preventDefault();
});