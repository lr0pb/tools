const appCache = '23.05-20:55';

self.addEventListener('install', (e) => {
  skipWaiting();
  e.waitUntil(
    (async () => {
      const cache = await caches.open(appCache);
      //const response = await fetch('./files.json');
      const offlineFiles = [
        './app.js', './pages.js', './periods.js', './IDB.js', './', './app.css'
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
  let request = e.request;
  const url = e.request.url.match(/(?<=\/)[\w\&=\.]+$/);
  if (url && (!url.includes('.') || url.includes('.html')) ) request = new Request(request.replace(url, ''));
  e.respondWith(
    (async () => {
      const fetchResponse = await addCache(request);
      let cacheResponse = null;
      if (!fetchResponse) cacheResponse = await caches.match(request);
      return fetchResponse || cacheResponse || badResponse;
    })()
  );
});

async function addCache(request) {
  let fetchResponse = null;
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
