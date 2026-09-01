const CACHE = "sonnoe-tsarstvo-v25";
const CANDIDATES = [
  ["./index.html", "./"],
  ["./styles.css"],
  ["./manifest.json"],
  ["./js/app.js", "./app.js"],
  ["./js/engine.js", "./engine.js"],
  ["./js/storage.js", "./storage.js"],
  ["./js/moon.js", "./moon.js"],
  ["./js/notifications.js", "./notifications.js"],
  ["./data/dreams.js", "./dreams.js"],
  ["./data/articles.js", "./articles.js"],
  ["./data/affiliates.js", "./affiliates.js"],
  ["./data/meditations.js", "./meditations.js"],
  ["./data/quiz.js", "./quiz.js"],
  ["./data/sleep-calc.js", "./sleep-calc.js"],
  ["./data/moon-tips.js", "./moon-tips.js"],
  ["./icons/icon.svg", "./icon.svg"],
  ["./icons/icon-192.png", "./icon-192.png"],
  ["./icons/icon-512.png", "./icon-512.png"],
  ["./images/hero-dreams.png", "./hero-dreams.png"],
  ["./images/moon-card.png", "./moon-card.png"],
  ["./images/quiz-card.png", "./quiz-card.png"],
  ["./images/articles-card.png", "./articles-card.png"]
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        CANDIDATES.map(async (list) => {
          for (const url of list) {
            try {
              const res = await fetch(url, { cache: "reload" });
              if (res.ok) {
                await cache.put(url, res);
                return;
              }
            } catch (_) {
              /* try next path */
            }
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
