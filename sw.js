// Service worker van de beveiligde webversie: maakt de app offline beschikbaar.
// Bevat alleen versleutelde inhoud; doet geen verzoeken naar andere servers.
const CACHE = 'practice-tracker-85a35465244c';
const FILES = ['./', './index.html', './manifest.webmanifest', './pwa-192.png', './pwa-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('practice-tracker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Eerst netwerk (voor updates), maar nooit langer dan 3 s wachten als er een kopie in de
    // cache staat (wifi zonder werkend internet). Het netwerkantwoord werkt de cache daarna bij.
    const network = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        return caches
          .open(CACHE)
          .then((c) => c.put('./index.html', copy))
          .then(() => res, () => res);
      }
      return res;
    });
    event.waitUntil(network.then(() => undefined, () => undefined));
    event.respondWith(
      new Promise((resolve) => {
        let done = false;
        const finish = (r) => {
          if (!done && r) {
            done = true;
            resolve(r);
          }
        };
        const cached = () => caches.match('./index.html').catch(() => undefined);
        const timer = setTimeout(() => cached().then(finish), 3000);
        network.then(
          (res) => {
            clearTimeout(timer);
            // Serverfout (bijv. 404/503 van de host): liever de app uit de cache dan een foutpagina
            if (res.ok) finish(res);
            else cached().then((hit) => finish(hit || res));
          },
          () => {
            clearTimeout(timer);
            cached().then((hit) => finish(hit || Response.error()));
          },
        );
      }),
    );
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
