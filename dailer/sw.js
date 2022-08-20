importScripts('./workers/defaultFunctions.js');
importScripts('./workers/sharedFunctions.js');

const APP_CACHE = 'app-14.08';
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
  db = new IDB(database.name, database.version, database.stores);
  e.waitUntil(checkNotifications(e.tag));
});

self.addEventListener('notificationclick', (e) => {
  db = new IDB(database.name, database.version, database.stores);
  e.notification.close();
  e.waitUntil(openApp(e.notification));
});

self.addEventListener('notificationclose', (e) => {
  db = new IDB(database.name, database.version, database.stores);
  console.log(e.notification);
  e.waitUntil(statNotification(e.notification.timestamp, 'close'));
});

async function statNotification(timestamp, field) {
  await db.updateItem('settings', 'notifications', (notifs) => {
    notifs.callsHistory[timestamp][field] = Date.now();
  });
}

async function checkNotifications(tag) {
  const notifs = await db.getItem('settings', 'notifications');
  const periodicSync = await db.getItem('settings', 'periodicSync');
  periodicSync.callsHistory.push({ timestamp: Date.now() });
  await db.setItem('settings', periodicSync);
  if (!notifs.enabled || notifs.permission !== 'granted') return;
  const isAppAlreadyOpened = await cleaning(notifs, tag);
  if (isAppAlreadyOpened) return;
  if (notifs.byCategories.tasksForDay) {
    const recap = await getDayRecap();
    if (recap) await showNotification(notifs, 'tasksForDay', recap);
  }
  if (notifs.byCategories.backupReminder) {
    const { show } = await checkBackupReminder();
    if (show) await showNotification(notifs, 'backupReminder', {
      title: `\u{1f4e5} It's time to back up your data`,
      body: `You've set reminders to make backups, so today we made one for you \u{1f4e6}`,
      icon: './icons/downloadBackup.png',
      data: { popup: 'downloadBackup' }
    });
  }
  await db.setItem('settings', notifs);
}

async function cleaning(notifs, tag) {
  const remainingNotifications = await registration.getNotifications();
  for (let notif of remainingNotifications) {
    notif.close();
    notifs.callsHistory[notif.timestamp].clean = Date.now();
  }
  await db.setItem('settings', notifs);
  console.log(tag);
  if (tag !== 'dailyNotification') return;
  const allClients = await clients.matchAll({ type: 'window' });
  for (let windowClient of allClients) {
    console.log(windowClient.focused);
    if (windowClient.focused) return true;
  }
}

async function showNotification(notifs, type, options) {
  if (!options || (options && !options.title)) return;
  const title = options.title;
  delete options.title;
  const ts = Date.now();
  options = Object.assign({
    //badge: './icons/badge.png',
    timestamp: ts,
    data: { page: 'main' },
    icon: './icons/apple-touch-icon.png',
  }, options);
  notifs.callsHistory[ts] = { type };
  await registration.showNotification(title, options);
}

async function openApp({ timestamp, data }) {
  let link = `${getBaseLink()}?from=notification`;
  for (let param in data) {
    link += `&${param}=${data[param]}`;
  }
  const allClients = await clients.matchAll({ type: 'window' });
  if (allClients.length > 0) {
    allClients[0].focus();
    allClients[0].postMessage({ navigate: link });
  } else {
    const windowClient = await clients.openWindow(link);
    if (windowClient) windowClient.focus();
  }
  await statNotification(timestamp, 'click');
}

async function getDayRecap() {
  const { response: recap } = await getYesterdayRecap();
  if (recap.recaped) {
    const day = await db.getItem('days', getToday().toString());
    if (day.tasksAmount === 0) return;
    let body = day.tasks[2].length === 0 ? null : '';
    if (body !== '') return;
    await enumerateDay(day, async (id, value, priority) => {
      if (priority !== 2) return;
      if (value === 1) return;
      const task = await db.getItem('tasks', id);
      body += `- ${task.name}\n`;
    });
    body = body.replace(/\n$/, '');
    return { title: `\u{1f5e1} Don't forget about importants:`, body };
  }
  if (!recap.show) return {
    title: '\u{1f4d1} Explore tasks for today',
    body: `You have no tasks yesterday, but its time to add some new ones\nDon't miss the dailer! \u{23f0}`
  };
  const resp = {
    title: '\u{1f4f0} Recap of yesterday',
    body: `${
      recap.completed ? 'Congratulations! \u{1f389} ' : ''
    }You done ${recap.count} out of ${recap.all} tasks${
      !recap.completed
      ? '\nOpen app to mark forgottens and check newly arrived tasks'
      : '\nTry to make a streak?'
    }`,
    icon: './icons/statsUp.png',
    data: { page: 'recap' }
  };
  return resp;
}
