const APP_CACHE = '01.06-13:32';
const HTML_TIMEOUT = 670;
const FILE_TIMEOUT = 290;

self.addEventListener('install', (e) => {
  skipWaiting();
  e.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
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
        keys.map( (key) => key == APP_CACHE || caches.delete(key) )
      );
    })
  );
});

function getBadResponse() {
  return new Response(new Blob(), { 'status': 400, 'statusText': 'Something goes wrong with this request' });
}

async function networkFirst(e) {
  const fetchResponse = await addCache(e.request);
  let cacheResponse = null;
  if (!fetchResponse || (fetchResponse && !fetchResponse.ok)) {
    cacheResponse = await caches.match(e.request, {ignoreSearch: true});
  }
  return cacheResponse || fetchResponse || getBadResponse();
}

async function cacheFirst(e) {
  const cacheResponse = await caches.match(e.request, {ignoreSearch: true});
  let fetchResponse = null;
  console.log(cacheResponse);
  if (!cacheResponse) {
    fetchResponse = await addCache(e.request);
  }
  return cacheResponse || fetchResponse || getBadResponse();
}

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('twitter')) {
    return e.respondWith(cacheFirst(e));
  }
  if (
    e.request.url.includes('manifest.json') || e.request.url.includes('screenshots') ||
    !e.request.url.includes(location.origin)
  ) return;
  e.respondWith(networkFirst(e));
});

async function addCache(request) {
  if (!navigator.onLine) return null;
  let fetchResponse = null;
  const url = request.url;
  const params = url.match(/(?<=\/)[\w\&=\.\?]+$/);
  let isHTML = false;
  if (params && (!params[0].includes('.') || params[0].includes('.html')) ) {
    request = new Request(url.replace(params, ''));
    isHTML = true;
  }
  try {
    const response = await Promise.race([
      new Promise((res) => {
        setTimeout(res, isHTML ? HTML_TIMEOUT : FILE_TIMEOUT);
      }),
      fetch(request)
    ]);
    if (response.ok) {
      const cache = await caches.open(APP_CACHE);
      cache.put(request, response.clone());
      fetchResponse = response;
    };
  } catch (err) {}
  return fetchResponse;
};
