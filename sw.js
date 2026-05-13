const CACHE = 'fg-trilhas-v6';
const PRECACHE = [
    './',
    './index.html',
    './questions.json',
    './manifest.json',
    './logo.png',
    './icon.png'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = e.request.url;

    // Nunca interceptar requisições externas (CDN, fonts, etc.)
    if (!url.startsWith(self.location.origin)) return;

    // JS e CSS: network-first — garante que atualizações de código cheguem imediatamente
    if (url.match(/\.(js|css)(\?|$)/)) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // questions.json: network-first (pode ser atualizado)
    if (url.includes('questions.json')) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Demais assets (imagens, html, manifest): cache-first
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
