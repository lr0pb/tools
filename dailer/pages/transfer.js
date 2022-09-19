import { qs, qsa } from './highLevel/utils.js'

export const transfer = {
  get title() { return `${htmlEmjs.flightMail} dailer moved to other address ${htmlEmjs.sign}`},
  titleEnding: 'none',
  get header() { return ''},
  styleClasses: 'center',
  get page() { return `
    <div id="onboardingBg" class="content abs center">
      <div class="content abs circle"></div>
      <div class="content abs circle"></div>
      <div class="content abs circle"></div>
      <div class="content abs circle"></div>
    </div>
    <div class="content abs center">
      <h2 class="emoji">${emjs.sword}</h2>
      <h2>dailer is moved</h2>
      <h3>We just remove <strong>/tools</strong> from a URL</h3>
      <h3>All your data including tasks, settings, permissions and other are saved ${emjs.sign}</h3>
    </div>
    <div class="floatingMsg">
      <h3>${emjs.light} Just go to the new address, install app and delete the previous one</h3>
    </div>
  `},
  get footer() { return `
    <button id="action">${emjs.flightMail} Move to the new dailer home</button>
  `},
  script: async ({globals, page}) => {
    const transferDay = 1662411600000; // 06.09.2022, day in which /tools/dailer was disabled
    const session = await globals.db.getItem('settings', 'session');
    await unregisterPreviousSW();
    const newHome = location.href.replace('/tools', '');
    if (!session || session.firstDayEver > transferDay) {
      return location.href = newHome;
    }
    qs('#action').addEventListener('click', () => {
      window.open(newHome);
    });
  }
};

async function unregisterPreviousSW() {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (let reg of regs) {
    if (!reg.active.scriptURL.includes('/tools')) continue;
    await reg.unregister();
  }
}
