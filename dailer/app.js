import { getGlobals, showPage, hidePage } from './logic/globals.js'
import { pages } from './logic/pages.js'
import { IDB, database } from './logic/IDB.js'
import {
  globQs as qs, checkForFeatures, isDesktop, inert, convertEmoji, getParams,
  isWideInterface, showErrorPage, platform, isIOS, isMacOS, isSafari, isDoubleColumns
} from './pages/highLevel/utils.js'
import { getToday, oneDay } from './pages/highLevel/periods.js'
import { emjs } from './pages/highLevel/emojis.js'

window.addEventListener('unhandledrejection', (e) => {
  showErrorPage(e.reason);
});

if (!window.dailerData) window.dailerData = {
  nav: 'navigation' in window ? true : false,
  forcePeriodPromo: false,
  forceReminderPromo: false,
  platform, isIOS, isMacOS, isSafari,
  isDesktop: isDesktop(),
  isWideInterface: isWideInterface(),
  isDoubleColumns: isDoubleColumns(),
  experiments: 0,
};
checkForFeatures(['inert', 'focusgroup']);

const globals = getGlobals();

window.addEventListener('pageshow', appEntryPoint);

async function appEntryPoint(e) {
  createDb();
  if (e.persisted) return;
  document.documentElement.lang = navigator.language;
  await loadEmojiList();
  await globals.paintPage('transfer', { dontPushHistory: true });
}

window.addEventListener('pagehide', () => {
  if (globals.db) {
    globals.db.db.close();
    globals.db = null;
  }
});

function createDb() {
  if (!globals.db) globals.db = new IDB(database.name, database.version, []);
}

async function loadEmojiList() {
  window.emjs = emjs;
  window.htmlEmjs = {
    sign: '&#x2705;',
    flightMail: '&#x1f4e8;',
  };
  window.hasEmoji = (elem) => typeof elem == 'string' ? elem.includes('emojiSymbol') : undefined;
}

if ('navigation' in window) navigation.addEventListener('navigatesuccess', updatePageTitle);

async function updatePageTitle() {
  const params = getParams();
  const page = pages[params.settings ? 'settings' : params.page];
  if (page.dynamicTitle) {
    await new Promise((res) => {
      const isReady = () => setTimeout(() => globals.isPageReady ? res() : isReady(), 10);
      isReady();
    });
  }
  const te = page.titleEnding || 'text';
  const def = ` dailer ${emjs.sign}`;  // default value
  qs('title').innerHTML = convertEmoji(`${page.title || page.header}${
    te == 'text' ? ' in' + def : (te == 'line' ? ' |' + def : '')
  }`);
}
