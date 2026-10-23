// Service worker van de beveiligde webversie: maakt de app offline beschikbaar.
// Bevat alleen versleutelde inhoud; doet geen verzoeken naar andere servers.
// Voorvoegsel van de cachenaam blijft 'practice-tracker-' (naam van vóór de hernoeming naar Tuttify):
// bij het activeren worden zo ook de caches van oudere versies opgeruimd (zie hieronder).
const CACHE = 'practice-tracker-281df0d5f22c';
const FILES = ['./', './index.html', './manifest.webmanifest', './pwa-192.png', './pwa-512.png', './pwa-maskable-512.png', './apple-touch-icon.png'];

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

// Alleen de app zelf ('./' of './index.html' binnen de scope) komt uit de cache. Andere pagina's
// op dezelfde site (privacy.html, support.html) gaan rechtstreeks naar het netwerk: anders zou
// hun antwoord de offline kopie van de app in de cache overschrijven.
function isAppNavigation(url) {
  const scope = new URL(self.registration.scope);
  return url.origin === scope.origin && (url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    if (!isAppNavigation(url)) return; // gewoon via het netwerk, niets cachen
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
