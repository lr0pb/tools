const appCache = '22.05-14:59';

self.addEventListener('install', (e) => {
  skipWaiting();
  e.waitUntil(
    (async () => {
      const cache = await caches.open(appCache);
      //const response = await fetch('./files.json');
      const offlineFiles = [
        './app.js', './pages.js', './periods.js', './IDB.js', './index.html', './app.css'
      ]; //await response.json();
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
      if (!fetchResponse) cacheResponse = await caches.match(e.request);
      return fetchResponse || cacheResponse || badResponse;
    })()
  );
});

async function addCache(request) {
  let fetchResponse = null;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(appCache);
    cache.put(request, response.clone());
    fetchResponse = response;
  };
  return fetchResponse;
};
