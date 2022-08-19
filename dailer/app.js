import { getGlobals, showPage, hidePage } from './logic/globals.js'
import { pages } from './logic/pages.js'
import { IDB, database } from './logic/IDB.js'
import {
  getFirstPage, renderFirstPage, renderPage, onHistoryAPIBack, onAppNavigation,
  onTraverseNavigation
} from './logic/navigation.js'
import {
  globQs as qs, checkForFeatures, isDesktop, inert, convertEmoji, getParams,
  isWideInterface
} from './pages/highLevel/utils.js'
import { getToday, oneDay } from './pages/highLevel/periods.js'
import { processSettings, toggleExperiments } from './pages/highLevel/settingsBackend.js'
import { checkInstall, onAppInstalled } from './pages/main.js'
import { registerPeriodicSync, toggleNotifReason } from './pages/settings/notifications.js'

if (!('at' in Array.prototype)) {
  function at(n) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    if (n < 0 || n >= this.length) return undefined;
    return this[n];
  }
  Object.defineProperty(Array.prototype, 'at', {
    value: at, writable: true, enumerable: false, configurable: true
  });
}

if (!window.dailerData) window.dailerData = {
  nav: 'navigation' in window ? true : false,
  forcePeriodPromo: false,
  forceReminderPromo: false,
  isIOS: 'standalone' in navigator,
  isDesktop: isDesktop(),
  isWideInterface: isWideInterface(),
  experiments: 0,
};
checkForFeatures(['inert', 'focusgroup']);

const globals = getGlobals();

window.addEventListener('pageshow', appEntryPoint);

async function appEntryPoint(e) {
  createDb();
  if (e.persisted) return;
  document.documentElement.lang = navigator.language;
  const { worker, periodicSync } = await deployWorkers();
  globals.worker = worker;
  await loadEmojiList();
  await processSettings(globals, periodicSync);
  toggleExperiments();
  pages.settings.fillHeader({page: qs('#settings > .header')});
  await pages.settings.paint({globals, page: qs('#settings > .content')});
  inert.set(qs('#settings'), true);
  inert.set(qs('#popup'), true);
  dailerData.nav ? await startApp() : await renderPage(e, false, globals);
}

window.addEventListener('pagehide', () => {
  if (globals.db) {
    globals.db.db.close();
    globals.db = null;
  }
});

function createDb() {
  if (!globals.db) globals.db = new IDB(
    database.name, database.version, database.stores
  );
}

async function deployWorkers() {
  const resp = {
    worker: null, periodicSync: { support: false }
  };
  if (!('serviceWorker' in navigator && 'caches' in window)) return resp;
  const reg = await navigator.serviceWorker.register('./sw.js');
  const worker = new Worker('./workers/mainWorker.js');
  worker._callsList = new Map();
  worker.call = async (call = {}) => {
    for (let [key, value] of worker._callsList) {
      if (value.used) worker._callsList.delete(key);
    }
    if (typeof call !== 'object') return;
    call._id = Date.now();
    worker.postMessage(call);
    await new Promise((res, rej) => {
      const isReady = () => worker._callsList.has(call._id) ? res() : setTimeout(isReady, 10);
      isReady();
    });
    const resp = worker._callsList.get(call._id);
    resp.used = true;
    return resp.data;
  };
  worker.onmessage = (e) => {
    worker._callsList.set(e.data._id, {
      data: e.data.data, used: false
    });
  };
  worker.postMessage({isWorkerReady: false});
  resp.worker = worker;
  if (!('permissions' in navigator)) return resp;
  const isPeriodicSyncSupported = 'periodicSync' in reg;
  resp.periodicSync.support = isPeriodicSyncSupported;
  if (!isPeriodicSyncSupported) return resp;
  resp.periodicSync.permission = await registerPeriodicSync(reg);
  return resp;
}

function getEmojiLink(emoji) {
  return `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/svg/emoji_u${
    _emojiList[emoji]
  }.svg`;
}

async function loadEmojiList() {
  const resp = await fetch('./emoji.json');
  window._emojiList = await resp.json();
  const loadArray = [];
  for (let name in _emojiList) {
    const link = getEmojiLink(name);
    loadArray.push(fetch(link));
  }
  await Promise.all(loadArray);
  window.emjs = new Proxy({}, {
    get(target, prop) {
      if (!(prop in _emojiList)) return '';
      return `
        <span class="emojiSymbol" style="background-image: url(${getEmojiLink(prop)});">&#x${
          _emojiList[prop]
        };</span>
      `;
    }
  });
  window.hasEmoji = (elem) => {
    return typeof elem == 'string' ? elem.includes('emojiSymbol') : undefined;
  };
}

async function startApp() {
  const appHistory = navigation.entries();
  appHistory.length <= 1 ? await renderFirstPage(globals) : await restoreApp(appHistory);
}

async function restoreApp(appHistory) {
  const session = await globals.db.getItem('settings', 'session');
  for (let entry of appHistory) {
    dailerData.forcedStateEntry = entry;
    const params = getParams(entry.url);
    const ogPage = params.page;
    if (['main', 'recap'].includes(params.page)) {
      params.page = getFirstPage(session);
    }
    if (ogPage !== params.page) {
      await globals.paintPage(params.page, true, true);
      dailerData.forcedStateEntry = null;
      await navigation.traverseTo(appHistory[0].key, {
        info: {call: 'traverseToStart'}
      }).finished;
      return;
    }
    if (params.settings) {
      await globals.openSettings(params.section, true);
    } else {
      if (globals.settings) await globals.closeSettings();
      await globals.paintPage(params.page, true, false, true);
    }
  }
  dailerData.forcedStateEntry = null;
  const diff = appHistory.length - 1 - navigation.currentEntry.index;
  if (diff > 0) await onTraverseNavigation(globals, {
    from: {index: appHistory.length - 1},
    destination: {index: navigation.currentEntry.index}
  }, true);
  globals.message({
    state: 'success', text: 'Previously opened dailer session has been fully restored'
  });
}

if ('navigation' in window) navigation.addEventListener('navigatesuccess', updatePageTitle);

async function updatePageTitle() {
  const params = getParams();
  const page = pages[params.settings ? 'settings' : params.page];
  if (page.dynamicTitle) {
    await new Promise((res) => {
      const isReady = () => {
        setTimeout(() => globals.isPageReady ? res() : isReady(), 10);
      };
      isReady();
    });
  }
  const te = page.titleEnding || 'text';
  const def = ` dailer ${emjs.sign}`;  // default value
  qs('title').innerHTML = convertEmoji(`${page.title || page.header}${
    te == 'text' ? ' in' + def : (te == 'line' ? ' |' + def : '')
  }`);
}

window.addEventListener('popstate', async (e) => await onHistoryAPIBack(e, globals));

if ('navigation' in window) {
  navigation.addEventListener('navigate', (e) => onAppNavigation(e, globals));
}

window.addEventListener('beforeinstallprompt', async (e) => {
  e.preventDefault();
  globals.installPrompt = e;
  const session = await globals.db.updateItem('settings', 'session', (session) => {
    session.installed = false;
  });
  toggleNotifReason(session, null, globals);
  if (qs('#main')) await checkInstall(globals);
});

window.addEventListener('appinstalled', async () => await onAppInstalled(globals));

qs('#popup').addEventListener('click', (e) => {
  const popup = qs('#popup');
  if (popup.classList.contains('strictClosing') && e.target === popup) return;
  if (e.target.dataset.action == 'cancel') globals.closePopup();
});
qs('#popup').addEventListener('keydown', (e) => {
  if (e.code == 'Escape') globals.closePopup();
});
