import { pages } from './pages.js'
import {
  emjs, qs as localQs, globQs as qs, globQsa as qsa, copyObject, inert
} from './pages/highLevel/utils.js'
import { periods } from './pages/highLevel/periods.js'
import { paintPeriods } from './pages/settings.js'
import { checkInstall } from './pages/main.js'
import IDB from './IDB.js'

if ('serviceWorker' in navigator && caches) {
  navigator.serviceWorker.register('./sw.js');
}

if (!window.dailerData) window.dailerData = {};

const getUrl = () => location.href.toString();

const getPageLink = (name) => {
  const getLink = (sign) => getUrl() + sign + `page=${name}`;
  let link = getUrl().includes('?')
  ? (getUrl().includes('page')
     ? getUrl().replace(/(?<=page=)\w+/, name)
     : getLink('&'))
  : getLink('?');
  link = link.replace(/\&settings=\w+/, '');
  return link;
}

const globals = {
  db: null,
  pageName: null,
  pageInfo: null,
  settings: false,
  additionalBack: 0,
  getPeriods: async () => {
    await globals.db.getAll('periods', (per) => {
      periods[per.id] = per;
    });
    return periods;
  },
  paintPage: async (name, back, replaceState, noAnim) => {
    globals.pageName = name;
    const page = pages[name];
    const container = document.createElement('div');
    container.className = 'page current';
    container.id = name;
    container.innerHTML = `
      <div class="header">
        <h1>${page.header}</h1>
        <button class="pageBtn emojiBtn"></button>
        <button class="openSettings emojiBtn" title="Open settings">${emjs.settings}</button>
      </div>
      <div class="content">${page.page}</div>
      <div class="footer">${page.footer}</div>
    `;
    document.body.append(container);
    const content = container.querySelector('.content');
    content.className = `content ${page.styleClasses || ''}`;
    showPage(qs('.current'), container, noAnim);
    if (page.noSettings) {
      localQs('.openSettings').style.display = 'none';
    } else {
      localQs('.openSettings').addEventListener('click', () => globals.openSettings());
    }
    const link = getPageLink(name);
    if (replaceState) history.replaceState(history.state, '', link);
    else if (!back) history.pushState(globals.pageInfo || history.state || {}, '', link);
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
    qs('#popup').style.display = 'flex';
    qs('#popup h2').innerHTML = text;
    qs('[data-action="confirm"]').onclick = action;
  },
  closePopup: () => {
    qs('#popup').style.display = 'none';
    qs('[data-action="confirm"]').onclick = null;
  },
  pageButton: ({emoji, title, onClick}) => {
    const pageBtn = localQs('.pageBtn');
    pageBtn.innerHTML = emoji;
    pageBtn.title = title;
    pageBtn.onclick = onClick;
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
      div.style.minHeight = `${elem.getBoundingClientRect().height}px`;
      div.style.marginTop = '3rem';
      content.append(div);
    }
    return elem;
  },
  openSettings: async (section, dontPushHistory) => {
    qs('#settings').style.transform = 'none';
    inert.set(qs('.current'));
    inert.remove(qs('#settings'));
    globals.settings = true;
    if (!dontPushHistory) history.pushState({settings: true}, '', getUrl() + '&settings=open');
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
  if (!globals.db) globals.db = new IDB('dailer', 3, [
    {
      name: 'tasks', index: {keyPath: 'id'}
    }, {
      name: 'days', index: {keyPath: 'date'}
    }, {
      name: 'periods', index: {keyPath: 'id'}
    }, {
      name: 'labels', index: {keyPath: 'id'}
    }
  ]);
}

window.addEventListener('pagehide', () => {
  if (globals.db) {
    globals.db.db.close();
    globals.db = null;
  }
});

window.addEventListener('pageshow', (e) => {
  createDb();
  if (!e.persisted) renderPage(e, false);
});

window.addEventListener('load', async () => {
  await pages.settings.paint({globals, page: qs('#settings > .content')});
  const params = getParams();
  if (!params.settings) inert.set(qs('#settings'));
});

window.addEventListener('popstate', (e) => {
  if (globals.onBack) {
    globals.onBack();
    globals.onBack = null;
  }
  renderPage(e, true);
  if (globals.additionalBack) {
    const backs = globals.additionalBack;
    globals.additionalBack = 0;
    for (let i = 0; i < backs; i++) { history.back() }
  }
});

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

function renderPage(e, back) {
  const params = getParams();
  if (params.settings == 'open') {
    globals.openSettings(null, true);
    if (globals.pageName !== params.page) hidePage(qs('.current'), params.page);
    return;
  }
  if (globals.settings) {
    globals.settings = false;
    return globals.closeSettings(back, false);
  }
  const onbrd = localStorage.onboarded == 'true';
  const page = (params.page && pages[params.page]) ? params.page : 'main';
  if (onbrd && page == 'onboarding') page = 'main';
  const rndr = onbrd ? page : 'onboarding';
  globals.closePopup();
  if (back) hidePage(qs('.current'), rndr);
  else paintFirstPage(rndr);
}

function getParams() {
  const params = {};
  location.search
    .replace('?', '')
    .split('&')
    .forEach((elem) => {
      const splitted = elem.split('=');
      params[splitted[0]] = splitted[1];
    });
  return params;
}

function paintFirstPage(rndr) {
  if (rndr == 'main' || rndr == 'onboarding') {
    return globals.paintPage(rndr, false, true);
  }
  globals.paintPage('main', false, true, true);
  globals.paintPage(rndr);
}

function showPage(prev, current, noAnim) {
  prev.classList.remove('showing', 'current');
  prev.classList.add('hidePrevPage');
  inert.set(prev);
  setTimeout(() => {
    current.classList.add('showing');
  }, noAnim ? 0 : 10);
  for (let elem of qsa('.hided')) {
    elem.remove();
  }
}

function hidePage(current, prevName) {
  inert.set(current);
  const prev = qs(`#${prevName}`);
  if (!prev) {
    if (!qs('#main')) globals.paintPage('main', false, true);
    return globals.paintPage(prevName, true, false);
  }
  prev.classList.remove('hidePrevPage', 'hided');
  prev.classList.add('showing', 'current');
  inert.remove(prev);
  current.classList.remove('showing', 'current');
  current.classList.add('hided');
  if (pages[prev.id].onPageShow) {
    pages[prev.id].onPageShow({globals, page: qs(`#${prev.id} .content`)});
  }
}

qs('#closeSettings').addEventListener('click', () => globals.closeSettings(true, true));

qs('#popup').addEventListener('click', (e) => {
  if (e.target.dataset.action == 'cancel') globals.closePopup();
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
