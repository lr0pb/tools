import { pages } from './pages.js'
import {
  globQs as qs, globQsa as qsa, inert, getParams
} from '../pages/highLevel/utils.js'

const getPageLink = (name, params = {}, dontClearParams) => {
  const base = dontClearParams ? location.href : location.origin + location.pathname;
  const getLink = (sign) => base + sign + `page=${name}`;
  const matcher = base.match(/(?:page=)(\w+)/);
  let link = base.includes('?')
  ? (base.includes('page') ? base.replace(matcher[1], name) : getLink('&'))
  : getLink('?');
  link = link.replace(/\&settings=\w+/, '');
  for (let prop in params) { link += `&${prop}=${params[prop]}`; }
  const url = new URL(link);
  return dailerData.nav ? url.pathname + url.search : link;
};

const globals = {
  db: null,
  pageName: null,
  isPageReady: undefined,
  paintPage,
};

export function getGlobals() {
  return globals;
}

async function paintPage(name, {
  dontPushHistory, replaceState, noAnim, params, dontClearParams
} = {}) {
  globals.pageName = name;
  globals.isPageReady = false;
  const page = pages[name];
  const container = document.createElement('div');
  container.className = 'page current';
  container.id = name;
  container.innerHTML = `
    <div class="header"><h1>${page.header}</h1></div>
    <div class="content">${page.page}</div>
    <div class="footer">${page.footer}</div>
  `;
  container.addEventListener('transitionend', (e) => {
    if (!e.target.classList.contains('page')) return;
    e.target.style.removeProperty('will-change');
  });
  let body = document.body;
  if (!body) body = qs('body');
  body.append(container);
  const content = container.querySelector('.content');
  content.className = `content ${page.styleClasses || ''}`;
  if (page.styleClasses && page.styleClasses.includes('doubleColumns')) {
    content.setAttribute('focusgroup', 'horizontal');
  }
  await showPage(globals, qs('.current'), container, noAnim);
  const link = getPageLink(name, params, dontClearParams);
  if (dailerData.nav) {
    let historyAction = null;
    if (!dontPushHistory) historyAction = 'push';
    if (replaceState) historyAction = 'replace';
    if (historyAction) navigation.navigate(link, {
      state: globals.pageInfo || navigation.currentEntry.getState() || {},
      history: historyAction, info: {call: 'paintPage'}
    });
  } else {
    if (replaceState) history.replaceState(globals.pageInfo || history.state || {}, '', link);
    else if (!dontPushHistory) history.pushState(globals.pageInfo || history.state || {}, '', link);
  }
  container.classList.remove('hided');
  container.classList.add('current');
  if (!params) params = getParams(`${dailerData.nav ? location.origin : ''}${link}`);
  await page.script({ globals, page: content, params });
  globals.isPageReady = true;
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
  const addShowing = () => {
    current.classList.add('showing');
    done = true;
  }
  noAnim ? addShowing() : setTimeout(addShowing, 10);
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
    if (!qs('#main')) await globals.paintPage('main', { replaceState: true });
    if (prevName !== 'main') await globals.paintPage(prevName, { dontPushHistory: true });
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
