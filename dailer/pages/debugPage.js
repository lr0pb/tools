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
  ? await navigator.storage.estimate() : { quota: 0, usage: 0 };
  if (!memory.usageDetails) memory.usageDetails = { caches: 0, indexedDB: 0 };
  const days = await globals.db.getAll('days');
  const tasks = await globals.db.getAll('tasks');
  const periods = await globals.db.getAll('periods');
  page.innerHTML = `
    <div id="dataContainer"></div>
    <button id="clear" class="danger">Clear database</button>
    <h3>It's actually delete all your tasks and other. Make sure you have backup</h3>
  `;
  const data = {
    'Is storage persisted': isPersisted.toString(),
    'Persist attempts': localStorage.persistAttempts,
    'Persist granted': localStorage.persistGranted
      ? intlDate(Number(localStorage.persistGranted)) : 'no data',
    'Theoretical available memory': convertBytes(memory.quota, 'Mb'),
    'Used memory': convertBytes(memory.usage, 'kb'),
    'Used by Cache storage': convertBytes(memory.usageDetails.caches, 'kb'),
    'Used by IndexedDb': convertBytes(memory.usageDetails.indexedDB, 'kb'),
    'First day ever': intlDate(Number(localStorage.firstDayEver)),
    'Periods list': localStorage.periodsList,
    'Days amount': days.length,
    'Tasks amount': tasks.length,
    'Periods amount': periods.length,
    'Last period id': localStorage.lastPeriodId,
    'Is app installed': localStorage.installed,
    'Network connection type': navigator.connection.effectiveType,
    'Is online': navigator.onLine,
  };
  const container = qs('#dataContainer');
  for (let title in data) {
    const elem = document.createElement('div');
    elem.className = 'dataLine';
    elem.innerHTML = `<h3>${title}:</h3><p>${data[title]}</p>`;
    container.append(elem);
  }
  qs('#clear').addEventListener('click', async () => {
    await clearDatabase(globals);
    globals.paintPage('main');
    location.reload();
  });
}

function convertBytes(value, unit) {
  const divisioner = unit == 'Gb'
  ? 1e9 : (unit == 'Mb' ? 1e6 : 1e3);
  return Math.round(value / divisioner) + unit;
}

export async function clearDatabase(globals) {
  const stores = globals.db.db.objectStoreNames;
  for (let store of stores) {
    const items = await globals.db.getAll(store);
    for (let item of items) {
      await globals.db.deleteItem(store, item.id || item.date);
    }
  }
  delete localStorage.lastPeriodId;
  const list = JSON.parse(localStorage.periodsList);
  const toDelete = []
  for (let item of list) {
    if (item.startsWith('5')) toDelete.push(item);
  }
  for (let item of toDelete) {
    const idx = list.indexOf(item);
    list.splice(idx, 1);
  }
  localStorage.periodsList = JSON.stringify(list);
}
