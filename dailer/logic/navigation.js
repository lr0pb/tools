import { pages } from './pages.js'
import { showPage, hidePage } from './globals.js'
import { globQs as qs, globQsa as qsa, getParams } from '../pages/highLevel/utils.js'
import { getToday } from '../pages/highLevel/periods.js'

export function getFirstPage(session) {
  if (!session.firstDayEver) return 'main';
  if (session.firstDayEver == getToday()) return 'main';
  return session.recaped < getToday() ? 'recap' : 'main';
}

function getRenderPage(params, session, firstPage) {
  const onbrd = session.onboarded;
  if (!onbrd) return 'onboarding';
  let page = (params.page && pages[params.page]) ? params.page : firstPage;
  if (onbrd && page == 'onboarding') page = firstPage;
  if (page == 'recap' && session.recaped == getToday()) page = 'main';
  if (page == 'main') page = firstPage;
  return page;
}

export async function renderFirstPage(globals) {
  const params = getParams();
  const session = await globals.db.getItem('settings', 'session');
  const firstPage = getFirstPage(session);
  const rndr = getRenderPage(params, session, firstPage);
  if (['main', 'recap', 'onboarding'].includes(rndr)) {
    await globals.paintPage(rndr, true, true);
  } else {
    await globals.paintPage(firstPage, true, true, true);
    await globals.paintPage(rndr);
  }
  if (params.settings) await globals.openSettings(params.section);
  if (params.popup/* && params.popup in popups*/) {
    console.log('Render popup: ' + params.popup);
    //globals.openPopup(params.popup);
  }
}

export async function renderPage(e, back, globals) {
  if (!back) renderFirstPage();
  const params = getParams();
  if (params.settings == 'open') {
    if (globals.pageName !== params.page) {
      await hidePage(globals, qs('.current'), params.page);
      globals.pageName = params.page;
    }
    await globals.openSettings(null, true);
    return;
  }
  if (globals.settings) {
    globals.settings = false;
    await globals.closeSettings(back, false);
    return;
  }
  const session = await globals.db.getItem('settings', 'session');
  const rndr = (params.page && pages[params.page]) ? params.page : getFirstPage(session);
  globals.closePopup();
  await hidePage(globals, qs('.current'), rndr);
}

export async function onHistoryAPIBack(e, globals) {
  if (dailerData.nav) return;
  if (pages[globals.pageName].onBack) {
    pages[globals.pageName].onBack(globals);
  }
  await renderPage(e, true);
  if (globals.additionalBack) {
    const backs = globals.additionalBack;
    globals.additionalBack = 0;
    for (let i = 0; i < backs; i++) { history.back() }
  }
}

const callsList = ['paintPage', 'settings', 'additionalBack', 'traverseToStart'];
const instantPromise = () => new Promise((res) => { res() });

export function onAppNavigation(e, globals) {
  console.log(e);
  if (!dailerData.nav) return;
  const info = e.info || {};
  if (info.call === 'hardReload') return e.transitionWhile(hardReload(globals, info));
  if (e.downloadRequest || e.navigationType == 'reload') return;
  if (
    callsList.includes(info.call) || e.navigationType !== 'traverse'
  ) {
    return e.transitionWhile(instantPromise());
  }
  return e.transitionWhile(onTraverseNavigation(globals, e));
}

async function hardReload(globals, info) {
  const appHistory = navigation.entries();
  await navigation.traverseTo(appHistory[0].key, {
    info: {call: 'traverseToStart'}
  }).finished;
  qs('.hidePrevPage').classList.add('current');
  for (let page of qsa('.page')) {
    page.remove();
  }
  const session = await globals.db.getItem('settings', 'session');
  await globals.paintPage(info.page || getFirstPage(session), true, true);
}

export async function onTraverseNavigation(globals, e, silent) {
  const idx = (e.from || navigation.currentEntry).index;
  const rawDelta = idx - e.destination.index;
  let delta = Math.abs(rawDelta);
  const dir = rawDelta > 0 ? -1 : 1; // -1 stands for backward, 1 stands for forward
  const appHistory = navigation.entries();
  for (let i = 0; i < delta; i++) {
    const currentIndex = idx + i * dir;
    const nextIndex = currentIndex + dir;
    const currentParams = getParams(appHistory[currentIndex].url);
    const nextParams = getParams(appHistory[nextIndex].url);
    const settings = currentParams.settings || nextParams.settings;
    const differentPages = currentParams.page !== nextParams.page;
    if (!silent && dir === -1 && pages[currentParams.page].onBack) {
      pages[currentParams.page].onBack(globals);
    }
    globals.pageName = nextParams.page;
    if (settings) {
      if (differentPages) {
        dir === -1
        ? await globals.openSettings(currentParams.section, true) : await globals.closeSettings();
      } else {
        dir === -1
        ? await globals.closeSettings(!silent) : await globals.openSettings(nextParams.section, true);
      }
    }
    if (!settings || (settings && differentPages)) {
      dir === -1
      ? await hidePage(globals, qs('.current'), nextParams.page, silent)
      : await showPage(globals, qs('.current'), qs(`#${nextParams.page}`), false, true);
    }
    if (!silent && i === 0 && delta === 1 && dir === -1 && globals.additionalBack) {
      delta += globals.additionalBack;
      const finalIndex = idx + delta * dir;
      await navigation.traverseTo(appHistory[finalIndex].key, {
        info: {call: 'additionalBack'}
      }).finished;
      globals.additionalBack = 0;
    }
  }
}
