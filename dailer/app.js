import { pages } from './pages.js'
import { qs as localQs } from './pages/highLevel/utils.js'
import { periods } from './pages/highLevel/periods.js'
import { paintPeriods } from './pages/settings.js'
import IDB from './IDB.js'

if ('serviceWorker' in navigator && caches) {
  navigator.serviceWorker.register('./sw.js')
};

const qs = (elem) => document.querySelector(elem);

const getUrl = () => location.href.toString();

const getPageLink = (name) => getUrl().replace(/(?<=page=)\w+/, name);

const globals = {
  db: null,
  pageName: null,
  pageInfo: null,
  settings: false,
  getPeriods: async () => {
    const customs = await globals.db.getAll('periods');
    for (let per of customs) {
      periods[per.id] = per;
    }
    return periods;
  },
  paintPage: async (name, back, replaceState) => {
    globals.pageName = name;
    const page = pages[name];
    const container = document.createElement('div');
    container.className = 'page current';
    container.id = name;
    container.innerHTML = `
      <div class="header">
        <h1>${page.header}</h1>
        <button class="pageBtn emojiBtn"></button>
        <button class="openSettings emojiBtn">&#128736;</button>
      </div>
      <div class="content ${page.centerContent ? 'center' : ''}">
        ${page.page}
      </div>
      <div class="footer">${page.footer}</div>
    `;
    qs('.current').classList.remove('current');
    document.body.append(container);
    localQs('.openSettings').addEventListener('click', () => globals.openSettings());
    const link = getPageLink(name);
    if (replaceState) history.replaceState(history.state, '', link);
    else if (!back) history.pushState(globals.pageInfo || {}, '', link);
    await page.script({globals, page: container.querySelector('.content')});
  },
  message: ({state, text}) => {
    const msg = qs('#message');
    msg.style.display = 'block';
    msg.style.setProperty(
      '--color', state == 'fail' ? '#a30000' : '#008000'
    );
    msg.innerHTML = `
      ${state == 'fail' ? '&#10060;' : '&#9989;'} ${text}
    `;
    setTimeout( () => {
      msg.style.display = 'none';
    }, 2000);
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
  pageButton: ({emoji, onClick}) => {
    const pageBtn = localQs('.pageBtn');
    pageBtn.innerHTML = emoji;
    pageBtn.onclick = onClick;
    pageBtn.style.display = 'block';
  },
  openSettings: async (section, back) => {
    qs('#settings').style.display = 'grid';
    await pages.settings.opening({globals});
    if (section && pages.settings.sections.includes(section)) {
      qs(`[data-section="${section}"]`).scrollIntoView();
    }
    globals.settings = true;
    if (back !== true) history.pushState({settings: true}, '', getUrl() + '&settings=open');
  },
  closeSettings: async (back) => {
    qs('#settings').style.display = 'none';
    if (back !== true) history.back();
    if (!pages[globals.pageName].onSettingsUpdate) return;
    await pages[globals.pageName].onSettingsUpdate(globals);
  },
  checkPersist: async () => {
    if (!navigator.storage || !navigator.storage.persist) return;
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return;
    await navigator.storage.persist();
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
});

window.addEventListener('popstate', (e) => renderPage(e, true));

function renderPage(e, back) {
  const params = {};
  location.search
    .replace('?', '')
    .split('&')
    .forEach((elem) => {
      const splitted = elem.split('=');
      params[splitted[0]] = splitted[1];
    });
  if (params.settings == 'open') {
    globals.openSettings(null, true);
    if (globals.pageName !== params.page) {
      qs('.current').classList.remove('current');
      qs(`#${params.page}`).classList.add('current');
    }
    return;
  }
  if (globals.settings) {
    globals.settings = false;
    return globals.closeSettings(true);
  }
  const page = (params.page && pages[params.page]) ? params.page : 'main';
  const rndr = localStorage.onboarded == 'true' ? page : 'onboarding';
  if (!back) {
    const getLink = (sign) => getUrl() + sign + 'page=main';
    const link = getUrl().includes('?')
    ? (getUrl().includes('page') ? getPageLink('main') : getLink('&'))
    : getLink('?');
    history.replaceState(history.state, '', link);
  }
  globals.closePopup();
  if (back) {
    qs('.current').classList.remove('current');
    qs(`#${rndr}`).classList.add('current');
  } else globals.paintPage(rndr, back, !back);
}

qs('#closeSettings').addEventListener('click', () => globals.closeSettings());

qs('#popup').addEventListener('click', (e) => {
  if (e.target.dataset.action == 'cancel') globals.closePopup();
});

if (!localStorage.periodsList) {
  localStorage.periodsList = JSON.stringify(['01', '03', '07', '09']);
}
