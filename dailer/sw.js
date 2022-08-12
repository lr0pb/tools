importScripts('./workers/defaultFunctions.js');
importScripts('./workers/sharedFunctions.js');

const APP_CACHE = 'app-24.07';
const EMOJI_CACHE = 'emoji-24.07';
const HTML_TIMEOUT = 670;
const FILE_TIMEOUT = 340;

async function addToCache(cacheName, fileName, onFileReceived) {
  const cache = await caches.open(cacheName);
  const resp = await fetch(`./${fileName}.json`);
  const respData = await resp.json();
  const linksToCache = onFileReceived(respData);
  await Promise.all(
    linksToCache.map(async (file) => {
      const data = await fetch(file);
      if (data.ok) await cache.put(file, data);
    })
  );
}

function getEmojiLink(emoji) {
  return `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/emoji_u${
    emoji
  }.svg`;
}

function getBaseLink() {
  const path = location.pathname.replace(/[\w.]+$/, '');
  return `${location.origin}${path}`;
}

async function saveCacheOnInstall() {
  await addToCache(APP_CACHE, 'files', (data) => data);
  await addToCache(EMOJI_CACHE, 'emoji', (emojis) => {
    const emojiLinks = [];
    for (let name in emojis) {
      emojiLinks.push(getEmojiLink(emojis[name]));
    }
    return emojiLinks;
  });
}

self.addEventListener('install', (e) => {
  skipWaiting();
  e.waitUntil(saveCacheOnInstall());
});

async function updateCache() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) => [APP_CACHE, EMOJI_CACHE].includes(key) || caches.delete(key))
  );
}

self.addEventListener('activate', (e) => {
  clients.claim();
  e.waitUntil(updateCache());
});

function getBadResponse() {
  return new Response(new Blob(), { 'status': 400, 'statusText': 'Something goes wrong with this request' });
}

async function networkFirst(e, cacheName) {
  const fetchResponse = await addCache(e.request, cacheName);
  let cacheResponse = null;
  if (!fetchResponse || (fetchResponse && !fetchResponse.ok)) {
    cacheResponse = await caches.match(e.request, {ignoreSearch: true});
  }
  return cacheResponse || fetchResponse || getBadResponse();
}

async function cacheFirst(e, cacheName) {
  const cacheResponse = await caches.match(e.request, {ignoreSearch: true});
  let fetchResponse = null;
  if (!cacheResponse) {
    fetchResponse = await addCache(e.request, cacheName);
  }
  return cacheResponse || fetchResponse || getBadResponse();
}

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('googlefonts')) {
    return e.respondWith(cacheFirst(e, EMOJI_CACHE));
  }
  if (
    e.request.url.includes('manifest.json') || e.request.url.includes('screenshots') ||
    !e.request.url.includes(location.origin)
  ) return;
  e.respondWith(networkFirst(e, APP_CACHE));
});

async function addCache(request, cacheName) {
  if (!navigator.onLine) return null;
  let fetchResponse = null;
  const url = request.url;
  const params = url.match(/(?:\/)([\w\&=\.\?]+)$/);
  let isHTML = false;
  if (params && (!params[1].includes('.') || params[1].includes('.html')) ) {
    request = new Request(url.replace(params[1], ''));
    isHTML = true;
  }
  try {
    const response = await Promise.race([
      new Promise((res) => {
        setTimeout(res, cacheName == EMOJI_CACHE ? 9000 : (isHTML ? HTML_TIMEOUT : FILE_TIMEOUT));
      }),
      fetch(request)
    ]);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      fetchResponse = response;
    };
  } catch (err) {}
  return fetchResponse;
};

self.addEventListener('periodicsync', (e) => {
  console.log(e.tag);
  e.waitUntil(checkNotifications());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(openApp(e.notification.data));
});

async function checkNotifications() {
  const notifs = await db.getItem('settings', 'notifications');
  const periodicSync = await db.getItem('settings', 'periodicSync');
  periodicSync.callsHistory.push({
    timestamp: Date.now()
  });
  await db.setItem('settings', periodicSync);
  if (!notifs.enabled || notifs.permission !== 'granted') return;
  if (notifs.byCategories.tasksForDay) {
    const { body } = await getDayRecap();
    await showNotification({ title: `\u{1f514} Check remaining tasks for today:`, body });
  }
  if (notifs.byCategories.backupReminder) {
    const { show } = await checkBackupReminder();
    if (show) await showNotification({
      title: `\u{1f4e5} Download a backup`,
      body: `You've set reminders to make backups periodically, so today we have been backed up one for you \u{1f35e}`
    });
  }
}

async function showNotification(options) {
  if (!options || (options && !options.title)) return;
  const title = options.title;
  delete options.title;
  options = Object.assign({
    //badge: './icons/badge.png',
    data: { showPage: 'main' },
    icon: './icons/apple-touch-icon.png',
  }, options);
  await registration.showNotification(title, options);
}

async function openApp(data) {
  const allClients = await clients.matchAll({ type: 'window' });
  console.log(allClients);
  if (allClients.length > 0) {
    return allClients[0].focus();
  }
  try {
    const windowClient = await clients.open(
      `${getBaseLink()}?from=notification&page=${data.showPage || 'main'}`
    );
    console.log(windowClient);
    if (windowClient) windowClient.focus();
  } catch (err) {
    const data = await db.getItem('settings', 'notifications');
    data.callsHistory.push({ timestamp: Date.now(), error: err })
  }
}
