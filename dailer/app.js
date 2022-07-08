import { pages } from './pages.js'
import {
  emjs, qs as localQs, globQs as qs, globQsa as qsa, copyObject, checkForFeatures,
  isDesktop, inert
} from './pages/highLevel/utils.js'
import { periods } from './pages/highLevel/periods.js'
import { paintPeriods } from './pages/settings.js'
import { checkInstall } from './pages/main.js'
import IDB from './IDB.js'

if ('serviceWorker' in navigator && caches) {
  navigator.serviceWorker.register('./sw.js');
}

if (!window.dailerData) window.dailerData = {
  nav: false,
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
  history: null,
  getPeriods: async () => {
    await globals.db.getAll('periods', (per) => {
      periods[per.id] = per;
    });
    return periods;
  },
  paintPage: async (name, dontPushHistory, replaceState, noAnim) => {
    globals.pageName = name;
    const page = pages[name];
    const container = document.createElement('div');
    container.className = 'page current';
    container.id = name;
    container.innerHTML = `
      <div class="header">
        <h1>${page.header}</h1>
        <button class="pageBtn emojiBtn" title="Page button" disabled aria-hidden="true"></button>
        <button class="openSettings emojiBtn" title="Open settings">${emjs.settings}</button>
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
    showPage(qs('.current'), container, noAnim);
    if (page.noSettings) {
      localQs('.openSettings').style.display = 'none';
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
    pageBtn.innerHTML = emoji;
    pageBtn.title = title;
    pageBtn.onclick = onClick;
    pageBtn.disabled = false;
    pageBtn.ariaHidden = false;
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

function instantPromise() {
  return new Promise((res) => { res() });
}

if (navigation) navigation.addEventListener('navigate', (e) => {
  console.log(e);
  if (!dailerData.nav) return;
  const info = e.info || {};
  console.log(info.call);
  if (['paintPage', 'settings'].includes(info.call)) {
    console.log('instantPromise coz internal call');
    return e.transitionWhile(instantPromise());
  }
  if (e.navigationType !== 'traverse') {
    console.log('instantPromise coz non traverse navigation');
    return e.transitionWhile(instantPromise());
  }
  console.log('canTransition', e.canTransition);
  console.log('canIntercept', e.canIntercept);
  console.log('traverse navigation proccessing');
  return e.transitionWhile((async () => {
    await onTraverseNavigation(e);
  })());
});

if (navigation) navigation.addEventListener('navigatesuccess', () => {
  globals.history = navigation.entries();
});

async function onTraverseNavigation(e) {
  const idx = navigation.currentEntry.index;
  const rawDiff = idx - e.destination.index;
  let diff = Math.abs(rawDiff);
  const dir = rawDiff > 0 ? -1 : 1; // -1 stands for backward, 1 stands for forward
  const currentParams = getParams(navigation.currentEntry.url);
  const params = getParams(e.destination.url);
  const settings = currentParams.settings || params.settings;
  const calcIndex = idx - (1 + 0) * dir;
  const calcEntry = globals.history[calcIndex];
  console.log(
    'from index:', idx, '\n',
    'to index:', e.destination.index, '\n',
    'abs delta:', diff, '\n',
    'direction:', dir == -1 ? 'backward' : 'forward', '\n',
    'onBack:', pages[currentParams.page] ? true : false, '\n',
    'additionalBack:', globals.additionalBack, '\n',
    'settings:', params.settings, '\n',
    'calculated index:', calcIndex, '\n',
    'calculated url:', calcEntry.url,
  );
  if (dir === -1 && pages[currentParams.page].onBack) {
    pages[currentParams.page].onBack(globals);
  }
  if (settings) {
    dir === -1 ? await globals.closeSettings(true) : await globals.openSettings(null, true);
  } else {
    dir === -1
    ? hidePage(qs('.current'), params.page)
    : showPage(qs('.current'), qs(`#${params.page}`), false, true);
  }
  if (/*i === 0 && diff === 1 && */dir === -1 && globals.additionalBack) {
    diff += globals.additionalBack;
    globals.additionalBack = 0;
  }
  /*const appHistory = navigation.entries();
  for (let i = 0; i < diff; i++) {
    const params = getParams(appHistory[idx - (1 + i) * dir].url)
    //
  }*/
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
    if (params.settings) globals.openSettings();
  } else {
    await restoreApp(appHistory);
  }
}

async function restoreApp(appHistory) {
  const paramsCache = new Map();
  for (let entry of appHistory) {
    dailerData.forcedStateEntry = entry;
    const params = getParams(entry.url);
    paramsCache.set(entry.url, params);
    if (params.settings) {
      await globals.openSettings(null, true);
    } else {
      if (globals.settings) await globals.closeSettings();
      await globals.paintPage(params.page, true, false, true);
    }
  }
  dailerData.forcedStateEntry = null;
  const diff = appHistory.length - 1 - navigation.currentEntry.index;
  if (diff > 0) {
    return console.log(diff);
    const lastEntry = appHistory[appHistory.length - 1];
    const lastParams = paramsCache.get(lastEntry.url);
    for (let i = 0; i < diff; i++) {
      const prevEntry = appHistory[appHistory.length - 1 - i];
    }
  }
}

async function renderPage(e, back) {
  const params = getParams();
  if (params.settings == 'open') {
    if (globals.pageName !== params.page) {
      hidePage(qs('.current'), params.page);
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
  back ? hidePage(qs('.current'), rndr) : await paintFirstPage(rndr);
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

function getRenderPage(params) {
  const onbrd = localStorage.onboarded == 'true';
  let page = (params.page && pages[params.page]) ? params.page : 'main';
  if (onbrd && page == 'onboarding') page = 'main';
  return onbrd ? page : 'onboarding';
}

async function paintFirstPage(rndr) {
  if (rndr == 'main' || rndr == 'onboarding') {
    return globals.paintPage(rndr, false, true);
  }
  await globals.paintPage('main', false, true, true);
  await globals.paintPage(rndr);
}

function showPage(prev, current, noAnim, noCleaning) {
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
      pages[current.id].onPageShow({globals, page: qs(`#${current.id} .content`)});
    }
  }
}

function hidePage(current, prevName, noPageUpdate) {
  inert.set(current);
  const prev = qs(`#${prevName}`);
  if (!prev) {
    if (!qs('#main')) globals.paintPage('main', false, true);
    if (prevName !== 'main') globals.paintPage(prevName, true, false);
    return;
  }
  prev.classList.remove('hidePrevPage', 'hided');
  prev.classList.add('showing', 'current');
  inert.remove(prev);
  current.classList.remove('showing', 'current');
  current.classList.add('hided');
  if (!noPageUpdate && pages[prev.id].onPageShow) {
    pages[prev.id].onPageShow({globals, page: qs(`#${prev.id} .content`)});
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
