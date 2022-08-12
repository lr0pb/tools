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
  console.log(tags);
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

const getUrl = () => location.href.toString();

const getPageLink = (name) => {
  const getLink = (sign) => getUrl() + sign + `page=${name}`;
  const matcher = getUrl().match(/(?:page=)(\w+)/);
  let link = getUrl().includes('?')
  ? (getUrl().includes('page')
     ? getUrl().replace(matcher[1], name)
     : getLink('&'))
  : getLink('?');
  link = link.replace(/\&settings=\w+/, '');
  const url = new URL(link);
  return dailerData.nav
  ? url.pathname + url.search : link;
}

const globals = {
  db: null,
  worker: null,
  pageName: null,
  pageInfo: null,
  settings: false,
  additionalBack: 0,
  isPageReady: undefined,
  getPeriods: async () => {
    const periods = {};
    await globals.db.getAll('periods', (per) => {
      periods[per.id] = per;
    });
    return periods;
  },
  getList: async (listName) => {
    await globals._setCacheConfig();
    if (listName in globals._cachedConfigFile) {
      const list = globals._cachedConfigFile[listName];
      if (Array.isArray(list)) return copyArray(list);
      return copyObject(list);
    }
  },
  _setCacheConfig: async () => {
    if (globals._cachedConfigFile) return;
    const raw = await fetch('./config.json');
    globals._cachedConfigFile = await raw.json();
  },
  _cachedConfigFile: null,
  paintPage: async (name, dontPushHistory, replaceState, noAnim) => {
    globals.pageName = name;
    globals.isPageReady = false;
    const page = pages[name];
    const container = document.createElement('div');
    container.className = 'page current';
    container.id = name;
    container.innerHTML = `
      <div class="header">
        <h1>${page.header}</h1>
        <button class="pageBtn emojiBtn" title="Page button" disabled aria-hidden="true"></button>
        <button class="openSettings emojiBtn" title="Open settings" aria-label="Open settings">
          ${emjs.settings}
        </button>
      </div>
      <div class="content">${page.page}</div>
      <div class="footer">${page.footer}</div>
    `;
    container.addEventListener('transitionend', (e) => {
      if (!e.target.classList.contains('page')) return;
      e.target.style.removeProperty('will-change');
    });
    document.body.append(container);
    const content = container.querySelector('.content');
    content.className = `content ${page.styleClasses || ''}`;
    if (page.styleClasses && page.styleClasses.includes('doubleColumns')) {
      content.setAttribute('focusgroup', 'horizontal');
    }
    await showPage(qs('.current'), container, noAnim);
    if (page.noSettings) {
      localQs('.openSettings').remove();
    } else {
      localQs('.openSettings').addEventListener('click', () => globals.openSettings());
    }
    const link = getPageLink(name);
    if (dailerData.nav) {
      let historyAction = null;
      if (!dontPushHistory) historyAction = 'push';
      if (replaceState) historyAction = 'replace';
      if (historyAction) navigation.navigate(link, {
        state: globals.pageInfo || navigation.currentEntry.getState() || {},
        history: historyAction, info: {call: 'paintPage'}
      });
    } else {
      if (replaceState) history.replaceState(history.state || {}, '', link);
      else if (!dontPushHistory) history.pushState(globals.pageInfo || history.state || {}, '', link);
    }
    await page.script({ globals, page: content });
    globals.isPageReady = true;
  },
  message: ({state, text}) => {
    const msg = qs('#message');
    msg.classList.add('animate');
    msg.style.setProperty('--color', state == 'fail' ? '#a30000' : '#008000');
    msg.innerHTML = `${emjs[state == 'fail' ? 'cross' : 'sign']} ${text}`;
    setTimeout( () => { msg.classList.remove('animate') }, 3000);
  },
  openPopup: ({text, action}) => {
    const popup = qs('#popup');
    popup.style.display = 'flex';
    inert.set(qs(globals.settings ? '#settings' : '.current'));
    inert.remove(popup, popup.querySelector('[data-action="cancel"]'));
    qs('#popup h2').innerHTML = text;
    popup.querySelector('[data-action="confirm"]').onclick = action;
  },
  closePopup: () => {
    inert.remove(qs(globals.settings ? '#settings' : '.current'));
    inert.set(qs('#popup'));
    qs('#popup').style.display = 'none';
    qs('[data-action="confirm"]').onclick = null;
  },
  pageButton: ({emoji, title, onClick}) => {
    const pageBtn = localQs('.pageBtn');
    Object.assign(pageBtn, {
      innerHTML: emoji, title, ariaLabel: title, onclick: onClick
    });
    pageBtn.removeAttribute('disabled');
    pageBtn.setAttribute('aria-hidden', 'false');
    pageBtn.style.display = 'block';
  },
  floatingMsg: ({text, button, onClick, pageName, notFixed}) => {
    const prevElem = localQs('.floatingMsg', pageName);
    if (prevElem) prevElem.remove();
    const elem = document.createElement('div');
    elem.className = `floatingMsg ${notFixed ? 'notFixed' : ''}`;
    elem.innerHTML = `
      <h3>${text}</h3>
      ${button ? `<button class="noEmoji">${button}</button>` : ''}
    `;
    const content = localQs('.content', pageName);
    content.append(elem);
    if (button && onClick) {
      localQs('.floatingMsg button', pageName).addEventListener('click', onClick);
    }
    if (!content.classList.contains('center')) {
      const div = document.createElement('div');
      div.style.cssText = `
        min-height: ${elem.getBoundingClientRect().height}px;
        min-width: 1px;
        margin-top: 2.5rem;
      `;
      content.append(div);
    }
    return elem;
  },
  openSettings: async (section, dontPushHistory) => {
    globals.isPageReady = false;
    qs('#settings').style.transform = 'none';
    inert.set(qs('.current'));
    inert.remove(qs('#settings'));
    globals.settings = true;
    if (!dontPushHistory) {
      dailerData.nav
      ? navigation.navigate(getUrl() + '&settings=open', {
          state: {settings: true}, history: 'push', info: {call: 'settings'}
        })
      : history.pushState({settings: true}, '', getUrl() + '&settings=open');
    }
    await pages.settings.opening({globals});
    if (section && pages.settings.sections.includes(section)) {
      qs(`[data-section="${section}"]`).scrollIntoView();
    }
    globals.isPageReady = true;
  },
  closeSettings: async (callSettingsUpdate, backInHistory) => {
    qs('#settings').removeAttribute('style');
    inert.remove(qs('.current'));
    inert.set(qs('#settings'));
    if (backInHistory) history.back();
    if (!callSettingsUpdate) return;
    if (!pages[globals.pageName].onSettingsUpdate) return;
    await pages[globals.pageName].onSettingsUpdate({
      globals, page: qs('.current .content')
    });
  },
  checkPersist: async () => {
    const data = await globals.db.getItem('settings', 'persistentStorage');
    if (!data.support) return undefined;
    if (data.isPersisted) return data.isPersisted;
    const response = await navigator.storage.persist();
    data.attempts++;
    if (response) data.grantedAt = Date.now();
    await globals.db.setItem('settings', data);
    return response;
  }
}

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

window.addEventListener('pagehide', () => {
  if (globals.db) {
    globals.db.db.close();
    globals.db = null;
  }
});

window.addEventListener('pageshow', async (e) => {
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
});

window.addEventListener('popstate', async (e) => {
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
});

const instantPromise = () => new Promise((res) => { res() });
const callsList = ['paintPage', 'settings', 'additionalBack', 'traverseToStart'];

if ('navigation' in window) navigation.addEventListener('navigate', (e) => {
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
});

if ('navigation' in window) navigation.addEventListener('navigatesuccess', async () => {
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
});

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
        ? await globals.openSettings(null, true) : await globals.closeSettings();
      } else {
        dir === -1
        ? await globals.closeSettings(!silent) : await globals.openSettings(null, true);
      }
    }
    if (!settings || (settings && differentPages)) {
      dir === -1
      ? await hidePage(qs('.current'), nextParams.page, silent)
      : await showPage(qs('.current'), qs(`#${nextParams.page}`), false, true);
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

async function startApp() {
  const appHistory = navigation.entries();
  if (appHistory.length <= 1) {
    const params = getParams();
    const session = await globals.db.getItem('settings', 'session');
    const rndr = getRenderPage(params, session);
    await paintFirstPage(rndr, session);
    if (params.settings) await globals.openSettings();
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
      await globals.openSettings(null, true);
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
      await hidePage(qs('.current'), params.page);
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
  back ? await hidePage(qs('.current'), rndr) : await paintFirstPage(rndr, session);
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

async function showPage(prev, current, noAnim, noCleaning) {
  prev.style.willChange = 'transform';
  current.style.willChange = 'transform';
  prev.classList.remove('showing', 'current');
  prev.classList.add('hidePrevPage');
  current.classList.remove('hided');
  inert.set(prev);
  inert.remove(current);
  let done = false;
  setTimeout(() => {
    current.classList.add('showing');
    done = true;
  }, noAnim ? 0 : 10);
  if (!noCleaning) {
    for (let elem of qsa('.hided')) {
      elem.remove();
      inert.clearCache(elem);
    }
  } else {
    current.classList.add('current');
    if (pages[current.id].onPageShow) {
      await pages[current.id].onPageShow({globals, page: qs(`#${current.id} .content`)});
    }
  }
  return new Promise((res) => {
    const isDone = () => {done ? res() : setTimeout(isDone, 10)};
    isDone();
  });
}

async function hidePage(current, prevName, noPageUpdate) {
  inert.set(current);
  const prev = qs(`#${prevName}`);
  if (!prev) {
    if (!qs('#main')) await globals.paintPage('main', false, true);
    if (prevName !== 'main') await globals.paintPage(prevName, true, false);
    return;
  }
  prev.style.willChange = 'transform';
  current.style.willChange = 'transform';
  prev.classList.remove('hidePrevPage', 'hided');
  prev.classList.add('showing', 'current');
  inert.remove(prev);
  current.classList.remove('showing', 'current');
  current.classList.add('hided');
  if (!noPageUpdate && pages[prev.id].onPageShow) {
    await pages[prev.id].onPageShow({globals, page: qs(`#${prev.id} .content`)});
  }
}

qs('#popup').addEventListener('click', (e) => {
  if (e.target.dataset.action == 'cancel') globals.closePopup();
});
qs('#popup').addEventListener('keydown', (e) => {
  if (e.code == 'Escape') globals.closePopup();
});
