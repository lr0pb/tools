const appCache = '20.05-19:59';

self.addEventListener('install', (e) => {
  skipWaiting();
  e.waitUntil(
    (async () => {
      return 'Even cant call console there...';
      /*let cache = await caches.open(appCache)
      let response = await fetch('./files.json')
      cache.put(new Request('./last-seen.json'), response.clone())
      let offlineFiles = await response.json()
      for (let file of offlineFiles) {
        cache.add(file)
      }*/
    })()
  );
});

self.addEventListener('activate', (e) => {
  clients.claim();
  e.waitUntil(
    caches.keys().then( (keys) => {
      Promise.all(
        keys.map( (key) => key == appCache || caches.delete(key) )
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  return 'I really will that pwa';
  /*if (e.request.url.includes('files.json') || e.request.url.includes('manifest.json')) return;
  let cacheResponse = null;
  let fetchResponse = null;
  e.respondWith(
    (async () => {
      cacheResponse = await caches.match(e.request);
      if (cacheResponse) return cacheResponse;
      fetchResponse = await addCache(e.request);
      return fetchResponse;
    })()
  );*/
});

async function addCache(request) {
  let fetchResponse = new Response(new Blob, { 'status': 400, 'statusText': 'Bad request' });
  let response = await fetch(request);
  if (response.ok) {
    let cache = await caches.open(appCache);
    cache.put(request, response.clone());
    fetchResponse = response;
  };
  return fetchResponse;
};
