import { pages } from './pages.js'
import {
  emjs, qs as localQs, globQs as qs, globQsa as qsa, copyObject, copyArray, checkForFeatures,
  isDesktop, inert
} from './pages/highLevel/utils.js'
import { getToday } from './pages/highLevel/periods.js'
import { paintPeriods } from './pages/settings.js'
import { checkInstall } from './pages/main.js'
import IDB from './IDB.js'

if ('serviceWorker' in navigator && 'caches' in window) {
  navigator.serviceWorker.register('./sw.js');
}

if (!window.dailerData) window.dailerData = {
  nav: 'navigation' in window ? true : false,
  forcePeriodPromo: false,
};
checkForFeatures(['inert', 'focusgroup']);
dailerData.isDesktop = isDesktop();

const getUrl = () => location.href.toString();

const getPageLink = (name) => {
  const getLink = (sign) => getUrl() + sign + `page=${name}`;
  let link = getUrl().includes('?')
  ? (getUrl().includes('page')
     ? getUrl().replace(/(?<=page=)\w+/, name)
     : getLink('&'))
  : getLink('?');
  link = link.replace(/\&settings=\w+/, '');
  const url = new URL(link);
  return dailerData.nav
  ? url.pathname + url.search : link;
}

const globals = {
  db: null,
  pageName: null,
  pageInfo: null,
  settings: false,
  additionalBack: 0,
  isPageReady: undefined,
  getPeriods: async () => {
    const periods = await globals.getList('periods');
    await globals.db.getAll('periods', (per) => {
      periods[per.id] = per;
    });
    return periods;
  },
  getList: async (listName) => {
    if (!globals._cachedConfigFile) {
      const raw = await fetch('./config.json');
      globals._cachedConfigFile = await raw.json();
    }
    if (listName in globals._cachedConfigFile) {
      const list = globals._cachedConfigFile[listName];
      if (Array.isArray(list)) return copyArray(list);
      return copyObject(list);
    }
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
    document.body.append(container);
    const content = container.querySelector('.content');
    content.className = `content ${page.styleClasses || ''}`;
    if (page.styleClasses && page.styleClasses.includes('doubleColumns')) {
      content.focusgroup = 'horizontal';
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
    if (!navigator.storage || !navigator.storage.persist) return undefined;
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return isPersisted;
    const response = await navigator.storage.persist();
    localStorage.persistAttempts = Number(localStorage.persistAttempts) + 1;
    if (response) localStorage.persistGranted = Date.now().toString();
    return response;
  }
}

function createDb() {
  if (!globals.db) globals.db = new IDB('dailer', 4, [
    { name: 'tasks', index: {keyPath: 'id'} },
    { name: 'days', index: {keyPath: 'date'} },
    { name: 'periods', index: {keyPath: 'id'} },
    { name: 'labels', index: {keyPath: 'id'} },
    { name: 'themes', index: {keyPath: 'id'} },
  ]);
}

window.addEventListener('pagehide', () => {
  if (globals.db) {
    globals.db.db.close();
    globals.db = null;
  }
});

window.addEventListener('pageshow', async (e) => {
  createDb();
  if (!e.persisted) {
    dailerData.nav ? await startApp() : await renderPage(e, false);
  }
});

window.addEventListener('load', async () => {
  document.documentElement.lang = navigator.language;
  await pages.settings.paint({globals, page: qs('#settings > .content')});
  const params = getParams();
  if (!params.settings) inert.set(qs('#settings'), true);
  inert.set(qs('#popup'), true);
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
const callsList = ['paintPage', 'settings', 'additionalBack'];

if ('navigation' in window) navigation.addEventListener('navigate', (e) => {
  if (!dailerData.nav) return;
  const info = e.info || {};
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
  qs('title').innerHTML = `${page.title || page.header}${
    te == 'text' ? ' in' + def : (te == 'line' ? ' |' + def : '')
  }`;
});

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
    if (settings) {
      if (differentPages) {
        dir === -1
        ? await globals.openSettings(null, true) : await globals.closeSettings();
        globals.pageName = nextParams.page;
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

window.addEventListener('appinstalled', () => {
  localStorage.installed = 'true';
  const elem = qs('#main .floatingMsg');
  if (elem) elem.remove();
});

window.addEventListener('beforeinstallprompt', async (e) => {
  e.preventDefault();
  localStorage.installed = 'false';
  globals.installPrompt = e;
  if (qs('#main')) await checkInstall(globals);
});

async function startApp() {
  const appHistory = navigation.entries();
  if (appHistory.length <= 1) {
    const params = getParams();
    const rndr = getRenderPage(params);
    await paintFirstPage(rndr);
    if (params.settings) await globals.openSettings();
  } else {
    await restoreApp(appHistory);
  }
}

async function restoreApp(appHistory) {
  for (let entry of appHistory) {
    dailerData.forcedStateEntry = entry;
    const params = getParams(entry.url);
    if (['main', 'recap'].includes(params.page)) {
      params.page = getFirstPage();
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
  const rndr = getRenderPage(params);
  globals.closePopup();
  back ? await hidePage(qs('.current'), rndr) : await paintFirstPage(rndr);
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

function getFirstPage() {
  if (!localStorage.firstDayEver) return 'main';
  if (localStorage.firstDayEver == getToday()) return 'main';
  return localStorage.recaped < getToday() ? 'recap' : 'main';
}

function getRenderPage(params) {
  const onbrd = localStorage.onboarded == 'true';
  if (!onbrd) return 'onboarding';
  let page = (params.page && pages[params.page]) ? params.page : getFirstPage();
  if (onbrd && page == 'onboarding') page = getFirstPage();
  if (page == 'recap' && localStorage.recaped == getToday()) page = 'main';
  return page;
}

async function paintFirstPage(rndr) {
  if (['main', 'recap', 'onboarding'].includes(rndr)) {
    return globals.paintPage(rndr, true, true);
  }
  await globals.paintPage(getFirstPage(), true, true, true);
  await globals.paintPage(rndr);
}

async function showPage(prev, current, noAnim, noCleaning) {
  prev.classList.remove('showing', 'current');
  prev.classList.add('hidePrevPage');
  inert.set(prev);
  inert.remove(current);
  setTimeout(() => {
    current.classList.add('showing');
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
}

async function hidePage(current, prevName, noPageUpdate) {
  inert.set(current);
  const prev = qs(`#${prevName}`);
  if (!prev) {
    if (!qs('#main')) await globals.paintPage('main', false, true);
    if (prevName !== 'main') await globals.paintPage(prevName, true, false);
    return;
  }
  prev.classList.remove('hidePrevPage', 'hided');
  prev.classList.add('showing', 'current');
  inert.remove(prev);
  current.classList.remove('showing', 'current');
  current.classList.add('hided');
  if (!noPageUpdate && pages[prev.id].onPageShow) {
    await pages[prev.id].onPageShow({globals, page: qs(`#${prev.id} .content`)});
  }
}

qs('#closeSettings').addEventListener('click', () => history.back());

qs('#popup').addEventListener('click', (e) => {
  if (e.target.dataset.action == 'cancel') globals.closePopup();
});
qs('#popup').addEventListener('keydown', (e) => {
  if (e.code == 'Escape') globals.closePopup();
});

if (!localStorage.periodsList) {
  localStorage.periodsList = JSON.stringify(['01', '03', '07', '09']);
}
if (!localStorage.updateTasksList) {
  localStorage.updateTasksList = JSON.stringify([]);
}
if (!localStorage.defaultLastPeriodId) localStorage.defaultLastPeriodId = '50';
if (!localStorage.lastPeriodId) localStorage.lastPeriodId = localStorage.defaultLastPeriodId;
if (!localStorage.persistAttempts) localStorage.persistAttempts = '0';
if (
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
) {
  localStorage.installed = 'true';
}
