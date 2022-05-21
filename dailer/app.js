import { qs, pages } from './pages.js'
import IDB from './IDB.js'

if ('serviceWorker' in navigator && caches) {
  navigator.serviceWorker.register('./sw.js')
};

const globals = {
  db: null,
  pageName: null,
  pageInfo: null,
  paintPage: async (name) => {
    globals.pageName = name;
    const page = pages[name];
    const content = qs('body > .content');
    qs('h1').innerHTML = page.header;
    qs('#pageBtn').onclick = null;
    qs('#pageBtn').style.display = 'none';
    if (page.centerContent) {
      content.classList.add('center');
    } else {
      content.classList.remove('center');
    }
    content.innerHTML = page.page;
    qs('#footer').innerHTML = page.footer;
    history.pushState({}, '', `?page=${name}`);
    await page.script({globals, page: content});
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
  pageButton: ({emoji, onClick}) => {
    const pageBtn = qs('#pageBtn');
    pageBtn.innerHTML = emoji;
    pageBtn.onclick = onClick;
    pageBtn.style.display = 'block';
  },
  openSettings: () => {
    qs('#settings').style.display = 'grid';
  }
}

function createDb() {
  if (!globals.db) globals.db = new IDB('dailer', 2, [
    {
      name: 'tasks', index: {keyPath: 'id'}
    }, {
      name: 'days', index: {keyPath: 'date'}
    }, {
      name: 'periods', index: {keyPath: 'id'}
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
  if (!e.persisted) renderFirstPage();
});

window.addEventListener('popstate', renderFirstPage)

function renderFirstPage() {
  const params = {};
  location.search
    .replace('?', '')
    .split('&')
    .forEach((elem) => {
      const splitted = elem.split('=');
      params[splitted[0]] = splitted[1];
    });
  const page = (params.page && pages[params.page]) || 'main';
  globals.paintPage(localStorage.onboarded == 'true' ? page : 'onboarding');
}

qs('#openSettings').addEventListener('click', globals.openSettings);
qs('#closeSettings').addEventListener('click', async () => {
  qs('#settings').style.display = 'none';
  if (!pages[globals.pageName].onSettingsUpdate) return;
  await pages[globals.pageName].onSettingsUpdate(globals);
});

if (!localStorage.periodsList) {
  localStorage.periodsList = JSON.stringify(['01', '03', '07', '09']);
}

pages.settings.paint({globals, page: qs('#settings > .content')});
