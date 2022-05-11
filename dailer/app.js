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
    qs('#content').innerHTML = pages[name].page;
    pages[name].script(globals);
  },
  message: ({state, text}) => {
    const msg = qs('#message');
    msg.style.display = 'block';
    msg.style.backgroundColor = state == 'fail'
    ? '#a30000' : '#008000';
    msg.textContent = text;
    setTimeout( () => {
      msg.style.display = 'none';
    }, 2000);
  }
}

globals.paintPage('onboarding');
