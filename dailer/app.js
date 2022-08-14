import { getGlobals, showPage, hidePage } from './globals.js'
import { pages } from './pages.js'
import {
  /*emjs,*/ qs as localQs, globQs as qs, globQsa as qsa, copyObject, copyArray, checkForFeatures,
  isDesktop, inert, convertEmoji
} from './pages/highLevel/utils.js'
import { getToday, oneDay } from './pages/highLevel/periods.js'
import { paintPeriods, toggleExperiments } from './pages/settings.js'
import { checkInstall } from './pages/main.js'
import { IDB, database } from './IDB.js'
import { processSettings } from './pages/highLevel/settingsBackend.js'

async function deployWorkers() {
  const resp = {
    worker: null,
    periodicSync: { support: false }
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
      data: e.data.data,
      used: false
    });
  };
  worker.postMessage({isWorkerReady: false});
  resp.worker = worker;
  if (!('permissions' in navigator)) return resp;
  const isPeriodicSyncSupported = 'periodicSync' in reg;
  resp.periodicSync.support = isPeriodicSyncSupported;
  if (!isPeriodicSyncSupported) return resp;
  const status = await navigator.permissions.query({
    name: 'periodic-background-sync',
  });
  resp.periodicSync.permission = status.state;
  if (status.state !== 'granted') return resp;
  try {
    await reg.periodicSync.register('dailyNotification', {
      minInterval: oneDay
    });
  } catch (err) {}
  const tags = await reg.periodicSync.getTags();
  return resp;
}

if (!window.dailerData) window.dailerData = {
  nav: 'navigation' in window ? true : false,
  forcePeriodPromo: false,
  experiments: 0,
};
checkForFeatures(['inert', 'focusgroup']);
dailerData.isDesktop = isDesktop();
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
  const params = getParams();
  if (!params.settings) inert.set(qs('#settings'), true);
  inert.set(qs('#popup'), true);
  dailerData.nav ? await startApp() : await renderPage(e, false);
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

window.addEventListener('popstate', onHistoryAPIBack);

async function onHistoryAPIBack(e) {
  if (dailerData.nav) return;
  if (pages[globals.pageName].onBack) {
    pages[globals.pageName].onBack(globals);
  }
  await renderPage(e, true);
  if (globals.additionalBack) {
    const backs = globals.additionalBack;
    globals.additionalBack = 0;
    for (let i = 0; i < backs; i++) { history.back() }
  }
}

const instantPromise = () => new Promise((res) => { res() });
const callsList = ['paintPage', 'settings', 'additionalBack', 'traverseToStart'];

if ('navigation' in window) navigation.addEventListener('navigate', onAppNavigation);

function onAppNavigation() {
  console.log(e);
  if (!dailerData.nav) return;
  const info = e.info || {};
  if (info.call === 'hardReload') return e.transitionWhile(hardReload(info));
  if (e.downloadRequest || e.navigationType == 'reload') return;
  if (
    callsList.includes(info.call) || e.navigationType !== 'traverse'
  ) {
    return e.transitionWhile(instantPromise());
  }
  return e.transitionWhile(onTraverseNavigation(e));
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

async function hardReload(info) {
  const appHistory = navigation.entries();
  await navigation.traverseTo(appHistory[0].key, {
    info: {call: 'traverseToStart'}
  }).finished;
  qs('.hidePrevPage').classList.add('current');
  for (let page of qsa('.page')) {
    page.remove();
  }
  const session = await globals.db.getItem('settings', 'session');
  await globals.paintPage(info.page || getFirstPage(session), true, true);
}

async function onTraverseNavigation(e, silent) {
  const idx = (e.from || navigation.currentEntry).index;
  const rawDelta = idx - e.destination.index;
  let delta = Math.abs(rawDelta);
  const dir = rawDelta > 0 ? -1 : 1; // -1 stands for backward, 1 stands for forward
  const appHistory = navigation.entries();
  for (let i = 0; i < delta; i++) {
    const currentIndex = idx + i * dir;
    const nextIndex = currentIndex + dir;
    const currentParams = getParams(appHistory[currentIndex].url);
    const nextParams = getParams(appHistory[nextIndex].url);
    const settings = currentParams.settings || nextParams.settings;
    const differentPages = currentParams.page !== nextParams.page;
    if (!silent && dir === -1 && pages[currentParams.page].onBack) {
      pages[currentParams.page].onBack(globals);
    }
    globals.pageName = nextParams.page;
    if (settings) {
      if (differentPages) {
        dir === -1
        ? await globals.openSettings(currentParams.section, true) : await globals.closeSettings();
      } else {
        dir === -1
        ? await globals.closeSettings(!silent) : await globals.openSettings(nextParams.section, true);
      }
    }
    if (!settings || (settings && differentPages)) {
      dir === -1
      ? await hidePage(globals, qs('.current'), nextParams.page, silent)
      : await showPage(globals, qs('.current'), qs(`#${nextParams.page}`), false, true);
    }
    if (!silent && i === 0 && delta === 1 && dir === -1 && globals.additionalBack) {
      delta += globals.additionalBack;
      const finalIndex = idx + delta * dir;
      await navigation.traverseTo(appHistory[finalIndex].key, {
        info: {call: 'additionalBack'}
      }).finished;
      globals.additionalBack = 0;
    }
  }
}

async function startApp() {
  const appHistory = navigation.entries();
  if (appHistory.length <= 1) {
    const params = getParams();
    const session = await globals.db.getItem('settings', 'session');
    const rndr = getRenderPage(params, session);
    await paintFirstPage(rndr, session);
    if (params.settings) await globals.openSettings(params.section);
    if (params.popup/* && params.popup in popups*/) {
      console.log('Render popup: ' + params.popup);
      //globals.openPopup(params.popup);
    }
  } else {
    await restoreApp(appHistory);
  }
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
  if (diff > 0) await onTraverseNavigation({
    from: {index: appHistory.length - 1},
    destination: {index: navigation.currentEntry.index}
  }, true);
  globals.message({
    state: 'success', text: 'Previously opened dailer session has been fully restored'
  });
}

async function renderPage(e, back) {
  const params = getParams();
  if (params.settings == 'open') {
    if (globals.pageName !== params.page) {
      await hidePage(globals, qs('.current'), params.page);
      globals.pageName = params.page;
    }
    await globals.openSettings(null, true);
    return;
  }
  if (globals.settings) {
    globals.settings = false;
    await globals.closeSettings(back, false);
    return;
  }
  const session = await globals.db.getItem('settings', 'session');
  const rndr = getRenderPage(params, session);
  globals.closePopup();
  back ? await hidePage(globals, qs('.current'), rndr) : await paintFirstPage(rndr, session);
}

function getParams(url) {
  const params = {};
  (url ? new URL(url) : location).search
    .replace('?', '')
    .split('&')
    .forEach((elem) => {
      const splitted = elem.split('=');
      params[splitted[0]] = splitted[1];
    });
  return params;
}

function getFirstPage(session) {
  if (!session.firstDayEver) return 'main';
  if (session.firstDayEver == getToday()) return 'main';
  return session.recaped < getToday() ? 'recap' : 'main';
}

function getRenderPage(params, session) {
  const onbrd = session.onboarded;
  if (!onbrd) return 'onboarding';
  let page = (params.page && pages[params.page]) ? params.page : getFirstPage(session);
  if (onbrd && page == 'onboarding') page = getFirstPage(session);
  if (page == 'recap' && session.recaped == getToday()) page = 'main';
  if (page == 'main') page = getFirstPage(session);
  return page;
}

async function paintFirstPage(rndr, session) {
  if (['main', 'recap', 'onboarding'].includes(rndr)) {
    return globals.paintPage(rndr, true, true);
  }
  await globals.paintPage(getFirstPage(session), true, true, true);
  await globals.paintPage(rndr);
}

window.addEventListener('appinstalled', async () => {
  await globals.db.updateItem('settings', 'session', (session) => {
    session.installed = true;
  });
  const elem = qs('#main .floatingMsg');
  if (elem) elem.remove();
});

window.addEventListener('beforeinstallprompt', async (e) => {
  e.preventDefault();
  await globals.db.updateItem('settings', 'session', (session) => {
    session.installed = false;
  });
  globals.installPrompt = e;
  if (qs('#main')) await checkInstall(globals);
});

qs('#popup').addEventListener('click', (e) => {
  const popup = qs('#popup');
  if (popup.classList.contains('strictClosing') && e.target === popup) return;
  if (e.target.dataset.action == 'cancel') globals.closePopup();
});
qs('#popup').addEventListener('keydown', (e) => {
  if (e.code == 'Escape') globals.closePopup();
});
