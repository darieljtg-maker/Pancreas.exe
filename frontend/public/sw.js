/*
 * Service worker mínimo.
 *
 * Existe para que la app se pueda instalar en la pantalla de inicio, nada más.
 * NO cachea páginas ni respuestas de la base de datos a propósito: mostrar una
 * glucosa vieja como si fuera la actual sería peor que no mostrar nada.
 * Solo se cachean los assets con hash de Next, que son inmutables.
 */

const CACHE = 'pancreasos-estaticos-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Los archivos de /_next/static llevan hash en el nombre: cachearlos es seguro.
  if (!url.pathname.startsWith('/_next/static/')) return;

  event.respondWith(
    caches.match(request).then(
      (cacheado) =>
        cacheado ||
        fetch(request).then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copia));
          return respuesta;
        })
    )
  );
});
