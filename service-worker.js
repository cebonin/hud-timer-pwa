// ***** MUDE ESTE NÚMERO PARA UM VALOR MAIOR A CADA NOVA PUBLICAÇÃO! *****
const CACHE_VERSION = 12; // << AGORA É 10! DA PRÓXIMA VEZ, MUDARIA PARA 11.
// **********************************************************************
const CACHE_NAME = `juega10-tagger-cache-v${CACHE_VERSION}`;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  // Ícones (ajuste a lista conforme os arquivos que você tem na pasta icons/)
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalação: pré-cacheia os recursos
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing Service Worker v${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Cache ${CACHE_NAME} opened, adding URLs...`);
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Força o service worker a ativar imediatamente
      .catch(error => console.error('[SW] Cache.addAll failed:', error))
  );
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating Service Worker v${CACHE_VERSION}...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name.startsWith('juega10-tagger-cache-v') && name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Permite que o novo SW controle os clientes imediatamente
    .catch(error => console.error('[SW] Activate failed:', error))
  );
});

// Fetch: estratégia de cache-first (depois network)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Apenas lida com requisições GET
  if (request.method !== 'GET') {
    return;
  }

  // Verifica se a requisição está no cache, senão tenta da rede
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // Se encontrou no cache, retorna
      if (cachedResponse) {
        //console.log(`[SW] Serving from cache: ${request.url}`);
        return cachedResponse;
      }
      // Senão, tenta buscar da rede
      return fetch(request).then(networkResponse => {
        // Clona a resposta para poder armazenar no cache e retornar ao cliente
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          //console.log(`[SW] Caching new resource: ${request.url}`);
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback offline (se a requisição falhar e não estiver no cache, retorna a página principal)
        //console.log(`[SW] Fetch failed for ${request.url}, serving offline fallback.`);
        return caches.match('./'); // Garante que a página principal esteja sempre disponível offline
      });
    })
  );
});
