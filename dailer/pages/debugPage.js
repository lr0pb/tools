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
  page.innerHTML = `
    <h3>Is storage persisted:</h3>
    <p>${isPersisted.toString()}</p>
    <h3>Available memory:</h3>
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
  `;
}

function convertBytes(value, unit) {
  const divisioner = unit == 'Gb'
  ? 1e9 : (unit == 'Mb' ? 1e6 : 1e3);
  return Math.round(value / divisioner) + unit;
}
