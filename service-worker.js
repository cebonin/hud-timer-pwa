// ***** MUDE ESTE NÚMERO PARA UM VALOR MAIOR A CADA NOVA PUBLICAÇÃO! *****
const CACHE_VERSION = 30; // << VERSÃO ATUALIZADA PARA FUTTAG PRO v2.1
// **********************************************************************
const CACHE_NAME = `futtag-pro-cache-v${CACHE_VERSION}`;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  // Ícones
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Bibliotecas externas para funcionar offline
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Instalação: pré-cacheia os recursos
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing FutTag Pro v2.1 Service Worker v${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Cache ${CACHE_NAME} opened, adding URLs...`);
        // Tenta cachear tudo, mas não falha se alguma URL der erro
        return Promise.allSettled(
          URLS_TO_CACHE.map(url => 
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err);
              return Promise.resolve(); // Continue mesmo se falhar
            })
          )
        );
      })
      .then(() => self.skipWaiting())
      .catch(error => console.error('[SW] Install failed:', error))
  );
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating FutTag Pro v2.1 Service Worker v${CACHE_VERSION}...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => 
          name.startsWith('futtag-pro-cache-v') && 
          name !== CACHE_NAME
        ).map(name => {
          console.log(`[SW] Deleting old cache: ${name}`);
          return caches.delete(name);
        })
      );
    })
    .then(() => self.clients.claim())
    .catch(error => console.error('[SW] Activate failed:', error))
  );
});

// Fetch: estratégia de cache-first com fallback inteligente
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Apenas lida com requisições GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignora requisições de extensões do navegador
  if (request.url.startsWith('chrome-extension://') || 
      request.url.startsWith('moz-extension://') ||
      request.url.startsWith('safari-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Se encontrou no cache, retorna
        if (cachedResponse) {
          // Para recursos externos, tenta atualizar o cache em background
          if (request.url.includes('cdn.jsdelivr.net') || 
              request.url.includes('cdnjs.cloudflare.com')) {
            // Background fetch para manter atualizado
            fetch(request).then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, response.clone());
                });
              }
            }).catch(() => {}); // Ignora erros de background update
          }
          return cachedResponse;
        }
        
        // Se não está no cache, tenta buscar da rede
        return fetch(request).then(networkResponse => {
          // Se a resposta for válida, cacheia
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Fallback offline: retorna a página principal para navegação
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          // Para outros recursos, retorna undefined (erro 404)
          return new Response('Offline - Resource not available', {
            status: 404,
            statusText: 'Offline'
          });
        });
      })
  );
});

// Message listener para comunicação com o app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Sync background para futuras funcionalidades
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    // Aqui poderia implementar sincronização de dados offline
  }
});

// Push notifications para futuras funcionalidades
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received');
  // Futuras notificações push podem ser implementadas aqui
});