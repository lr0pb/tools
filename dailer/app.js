import { pages } from './pages.js'
import IDB from './IDB.js'

const qs = (elem) => document.querySelector(elem);

const db = new IDB('dailer', 1, [
  {
    name: 'tasks', index: {keyPath: 'id'}
  }, {
    name: 'days', index: {keyPath: 'date'}
  }
]);

const globals = {
  db,
  paintPage: (name) => {
    const page = pages[name];
    const content = qs('#content');
    qs('h1').innerHTML = page.header;
    if (page.centerContent) {
      content.classList.add('center');
    } else {
      content.classList.remove('center');
    }
    content.innerHTML = page.page;
    qs('#footer').innerHTML = page.footer;
    page.script(globals);
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
  }
}

globals.paintPage(localStorage.onboarded == 'true' ? 'main' : 'onboarding');
