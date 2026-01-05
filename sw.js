// Service Worker para PWA - Ale y Mili Album
const CACHE_NAME = 'ale-mili-album-v1000'; // v1000: Forzar actualización
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './firebase-config.js',
    './manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando archivos estáticos');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.warn('[SW] Error cacheando:', error);
            })
    );
    self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker activado');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estrategia de fetch: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
    // Ignorar requests que no sean HTTP/HTTPS
    if (!event.request.url.startsWith('http')) {
        return;
    }

    // IMPORTANTE: En iOS standalone, NO interceptar NADA para evitar problemas con Firebase
    // Detectamos si viene de una PWA standalone por los headers
    const isStandalone = event.request.mode === 'navigate' &&
        event.request.destination === 'document';

    // Para APIs externas (Firebase, Firestore Storage), SIEMPRE usar network sin cachear
    if (event.request.url.includes('googleapis.com') ||
        event.request.url.includes('firebasestorage') ||
        event.request.url.includes('firebaseio.com') ||
        event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('gstatic.com') ||
        event.request.url.includes('firebase')) {
        // NO interceptar, dejar pasar directo
        return;
    }

    // Para el resto de requests, usar estrategia Network First
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta esválida, guardarla en cache
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, buscar en cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Si no está en cache, devolver página offline
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// Escuchar mensajes del cliente
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
