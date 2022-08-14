import { pages } from './pages.js'
import {
  qs as localQs, globQs as qs, globQsa as qsa, copyArray
} from '../pages/highLevel/utils.js'

const getUrl = () => location.href.toString();

const getPageLink = (name) => {
  const getLink = (sign) => getUrl() + sign + `page=${name}`;
  const matcher = getUrl().match(/(?:page=)(\w+)/);
  let link = getUrl().includes('?')
  ? (getUrl().includes('page')
     ? getUrl().replace(matcher[1], name)
     : getLink('&'))
  : getLink('?');
  link = link.replace(/\&settings=\w+/, '');
  const url = new URL(link);
  return dailerData.nav ? url.pathname + url.search : link;
};

export function getGlobals() {
  const globals = {
    db: null,
    worker: null,
    pageName: null,
    pageInfo: null,
    settings: false,
    additionalBack: 0,
    isPageReady: undefined,
    getPeriods: async () => {
      const periods = {};
      await globals.db.getAll('periods', (per) => {
        periods[per.id] = per;
      });
      return periods;
    },
    getList: async (listName) => {
      await globals._setCacheConfig();
      if (listName in globals._cachedConfigFile) {
        const list = globals._cachedConfigFile[listName];
        return copyArray(list);
      }
    },
    _setCacheConfig: async () => {
      if (globals._cachedConfigFile) return;
      const raw = await fetch('./config.json');
      globals._cachedConfigFile = await raw.json();
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
      container.addEventListener('transitionend', (e) => {
        if (!e.target.classList.contains('page')) return;
        e.target.style.removeProperty('will-change');
      });
      document.body.append(container);
      const content = container.querySelector('.content');
      content.className = `content ${page.styleClasses || ''}`;
      if (page.styleClasses && page.styleClasses.includes('doubleColumns')) {
        content.setAttribute('focusgroup', 'horizontal');
      }
      await showPage(globals, qs('.current'), container, noAnim);
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
    openPopup: ({text, action, emoji, strictClosing}) => {
      const popup = qs('#popup');
      if (strictClosing) popup.classList.add('strictClosing');
      popup.style.display = 'flex';
      inert.set(qs(globals.settings ? '#settings' : '.current'));
      inert.remove(popup, popup.querySelector('[data-action="cancel"]'));
      qs('#popup h2.emoji').innerHTML = emoji;
      qs('#popup h2:not(.emoji)').innerHTML = text;
      popup.querySelector('[data-action="confirm"]').onclick = action;
    },
    closePopup: () => {
      const popup = qs('#popup');
      inert.remove(qs(globals.settings ? '#settings' : '.current'));
      inert.set(popup);
      popup.classList.remove('strictClosing');
      popup.style.display = 'none';
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
      const data = await globals.db.getItem('settings', 'persistentStorage');
      if (!data.support) return undefined;
      if (data.isPersisted) return data.isPersisted;
      const response = await navigator.storage.persist();
      data.attempts++;
      if (response) data.grantedAt = Date.now();
      await globals.db.setItem('settings', data);
      return response;
    }
  };
  return globals;
}

export async function showPage(globals, prev, current, noAnim, noCleaning) {
  prev.style.willChange = 'transform';
  current.style.willChange = 'transform';
  prev.classList.remove('showing', 'current');
  prev.classList.add('hidePrevPage');
  current.classList.remove('hided');
  inert.set(prev);
  inert.remove(current);
  let done = false;
  setTimeout(() => {
    current.classList.add('showing');
    done = true;
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
  return new Promise((res) => {
    const isDone = () => {done ? res() : setTimeout(isDone, 10)};
    isDone();
  });
}

export async function hidePage(globals, current, prevName, noPageUpdate) {
  inert.set(current);
  const prev = qs(`#${prevName}`);
  if (!prev) {
    if (!qs('#main')) await globals.paintPage('main', false, true);
    if (prevName !== 'main') await globals.paintPage(prevName, true, false);
    return;
  }
  prev.style.willChange = 'transform';
  current.style.willChange = 'transform';
  prev.classList.remove('hidePrevPage', 'hided');
  prev.classList.add('showing', 'current');
  inert.remove(prev);
  current.classList.remove('showing', 'current');
  current.classList.add('hided');
  if (!noPageUpdate && pages[prev.id].onPageShow) {
    await pages[prev.id].onPageShow({globals, page: qs(`#${prev.id} .content`)});
  }
}
