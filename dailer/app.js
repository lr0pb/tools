import { pages } from './pages.js'
import IDB from './IDB.js'

const db = new IDB('dailer', 1, [
  {
    name: 'things', index: {keyPath: 'id'}
  }, {
    name: 'days', index: {keyPath: 'date'}
  }
]);

const globals = {
  db,
  paintPage: (name) => {
    document.body.innerHTML = pages[name].page;
    pages[name].script(globals);
  }
}

globals.paintPage('onboarding');
