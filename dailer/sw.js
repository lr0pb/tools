const appCache = '01.06-13:32';

self.addEventListener('install', (e) => {
  skipWaiting();
  e.waitUntil(
    (async () => {
      const cache = await caches.open(appCache);
      const response = await fetch('./files.json');
      const offlineFiles = await response.json();
      offlineFiles.forEach( (file) => cache.add(file));
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
  if (e.request.url.includes('manifest.json')) return;
  const badResponse = new Response(new Blob, { 'status': 400, 'statusText': 'No network' });
  e.respondWith(
    (async () => {
      const fetchResponse = await addCache(e.request);
      let cacheResponse = null;
      if (!fetchResponse || (fetchResponse && !fetchResponse.ok)) {
        cacheResponse = await caches.match(e.request, {ignoreSearch: true});
      }
      return cacheResponse || fetchResponse || badResponse;
    })()
  );
});

async function addCache(request) {
  let fetchResponse = null;
  const url = request.url;
  const params = url.match(/(?<=\/)[\w\&=\.\?]+$/);
  if (params && (!params[0].includes('.') || params[0].includes('.html')) ) {
    request = new Request(url.replace(params, ''));
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(appCache);
      cache.put(request, response.clone());
      fetchResponse = response;
    };
  } catch (err) {}
  return fetchResponse;
};
