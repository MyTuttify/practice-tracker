// Geladen door de service worker van de webversie (importScripts, zie vite.config.ts).
// Ruimt bij het activeren de caches op van de vroegere afgeschermde webversie op dezelfde site
// (scripts/protected/sw.js, cachenamen 'practice-tracker-<versie>'). Die bevatten alleen een oude kopie
// van de app, geen gegevens: de oefengegevens staan in IndexedDB en blijven bewaard. Doet geen verzoeken.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('practice-tracker-')).map((k) => caches.delete(k))))
      .catch(() => undefined),
  );
});
