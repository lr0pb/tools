import { qs, /*emjs,*/ intlDate, reloadApp } from './highLevel/utils.js'
import { isCustomPeriod } from './highLevel/periods.js'

export const debugPage = {
  get header() { return `${emjs.construction} Debug page`},
  get page() { return `
    <div id="dataContainer" class="doubleColumns"></div>
    <div class="doubleColumns">
      <div class="content">
        <button id="clear" class="danger noEmoji">Clear database</button>
        <h3>It's actually delete all your tasks and other. Make sure you have backup</h3>
      </div>
      <div class="content">
        <button id="toRecap" class="noEmoji">Show recap page</button>
        <h3>Reload app and show Yesterday recap page</h3>
      </div>
    </div>
  `},
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
  `},
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
  const data = {
    'Is storage persisted': isPersisted.toString(),
    'Persist attempts': localStorage.persistAttempts,
    'Persist granted': localStorage.persistGranted
      ? intlDate(Number(localStorage.persistGranted)) : 'no data',
    'Is periodic sync support': localStorage.periodicSync || 'no data',
    'Periodic sync status': localStorage.periodicSyncStatus || 'no data',
    'Notification permission': Notification.permission,
    'Theoretical available memory': convertBytes(memory.quota, 'Mb'),
    'Used memory': convertBytes(memory.usage, 'kb'),
    'Used by Cache storage': convertBytes(memory.usageDetails.caches, 'kb'),
    'Used by IndexedDb': convertBytes(memory.usageDetails.indexedDB, 'kb'),
    'First day ever': intlDate(Number(localStorage.firstDayEver)),
    'Was reminder used': localStorage.reminded,
    'Periods list': localStorage.periodsList,
    'Tasks to additional update': JSON.parse(localStorage.updateTasksList).length,
    'Days amount': days.length,
    'Tasks amount': tasks.length,
    'Periods amount': periods.length,
    'Last period id': localStorage.lastPeriodId,
    'Is app installed': localStorage.installed,
    'Network connection type': navigator.connection
    ? navigator.connection.effectiveType : 'no data',
    'Is online': navigator.onLine,
    'dailerData': JSON.stringify(dailerData)
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
    await reloadApp(globals);
  });
  qs('#toRecap').addEventListener('click', async () => {
    delete localStorage.recaped;
    await reloadApp(globals);
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
    /*await globals.db.getAll(store, async (item) => {
      await globals.db.deleteItem(store, item.id || item.date);
    });*/
    const items = await globals.db.getAll(store);
    for (let item of items) {
      await globals.db.deleteItem(store, item.id || item.date);
    }
  }
  delete localStorage.lastPeriodId;
  const list = JSON.parse(localStorage.periodsList);
  const toDelete = []
  for (let item of list) {
    if (isCustomPeriod(item)) toDelete.push(item);
  }
  for (let item of toDelete) {
    const idx = list.indexOf(item);
    list.splice(idx, 1);
  }
  localStorage.periodsList = JSON.stringify(list);
}
