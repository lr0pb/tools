import { pages } from './pages.js'
import IDB from './IDB.js'

const qs = (elem) => document.querySelector(elem);

const db = new IDB('dailer', 2, [
  {
    name: 'tasks', index: {keyPath: 'id'}
  }, {
    name: 'days', index: {keyPath: 'date'}
  }, {
    name: 'periods', index: {keyPath: 'id'}
  }
]);

const globals = {
  db,
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
    await page.script(globals);
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

qs('#openSettings').addEventListener('click', globals.openSettings);
qs('#closeSettings').addEventListener('click', async () => {
  qs('#settings').style.display = 'none';
  if (!pages[globals.pageName].onSettingsUpdate) return;
  await pages[globals.pageName].onSettingsUpdate(globals);
});

pages.settings.paint(globals, qs('#settings > .content'));

globals.paintPage(localStorage.onboarded == 'true' ? 'main' : 'onboarding');
