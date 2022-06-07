import { qs, emjs, intlDate } from './highLevel/utils.js'

export const debugPage = {
  header: `${emjs.construction} Debug page`,
  page: ``,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
  `,
  noSettings: true,
  script: renderPage
};

async function renderPage({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  const isPersisted = navigator.storage && navigator.storage.persisted
  ? await navigator.storage.persisted() : 'null';
  const memory = navigator.storage && navigator.storage.estimate
  ? await navigator.storage.estimate()
  : { quota: 0, usage: 0, usageDetails: { caches: 0, indexedDB: 0 } };
  const days = await globals.db.getAll('days');
  const tasks = await globals.db.getAll('tasks');
  const periods = await globals.db.getAll('periods');
  page.innerHTML = `<div>
    <h3>Is storage persisted:</h3>
    <p>${isPersisted.toString()}</p>
    <h3>Theoretical available memory:</h3>
    <p>${convertBytes(memory.quota, 'Mb')}</p>
    <h3>Used memory:</h3>
    <p>${convertBytes(memory.usage, 'kb')}</p>
    <h3>Used by Cache storage:</h3>
    <p>${convertBytes(memory.usageDetails.caches, 'kb')}</p>
    <h3>Used by IndexedDb:</h3>
    <p>${convertBytes(memory.usageDetails.indexedDB, 'kb')}</p>
    <h3>First day ever:</h3>
    <p>${intlDate(Number(localStorage.firstDayEver))}</p>
    <h3>Periods list:</h3>
    <p>${localStorage.periodsList}</p>
    <h3>Days amount:</h3>
    <p>${days.length}</p>
    <h3>Tasks amount:</h3>
    <p>${tasks.length}</p>
    <h3>Periods amount:</h3>
    <p>${periods.length}</p>
    <h3>Last period id:</h3>
    <p>${localStorage.lastPeriodId || 50}</p>
    <h3>Is app installed:</h3>
    <p>${localStorage.installed}</p>
    <h3>Network connection type:</h3>
    <p>${navigator.connection.effectiveType}</p>
    <h3>Is online:</h3>
    <p>${navigator.onLine}</p>
  </div>
  <button id="clear">Clear database</button>
  `;
  qs('#clear').addEventListener('click', () => clearDatabase(globals));
}

function convertBytes(value, unit) {
  const divisioner = unit == 'Gb'
  ? 1e9 : (unit == 'Mb' ? 1e6 : 1e3);
  return Math.round(value / divisioner) + unit;
}

async function clearDatabase(globals) {
  const stores = globals.db.objectStoreNames;
  for (let store of stores) {
    const items = await globals.db.getAll(store);
    for (let item of items) {
      await globals.db.deleteItem(store, item.id);
    }
  }
  delete localStorage.lastPeriodId;
}
