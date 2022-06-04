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
  const isPersisted = navigator.storage ? await navigator.storage.persisted() : null;
  const memory = navigator.storage ? await navigator.storage.estimate() : {
    quota: 0, usage: 0, usageDetails: {
      caches: 0, indexedDb: 0
    }
  };
  page.innerHTML = `
    <h3>Is storage persisted:</h3>
    <p>${isPersisted.toString()}</p>
    <h3>Available memory:</h3>
    <p>${memory.quota / 1e6} Mb</p>
    <h3>Used memory:</h3>
    <p>${memory.usage / 1e3} kb</p>
    <h3>Used by Cache storage:</h3>
    <p>${memory.usageDetails.caches / 1e3} kb</p>
    <h3>Used by IndexedDb:</h3>
    <p>${memory.usageDetails.indexedDb / 1e3} kb</p>
    <h3>First day ever:</h3>
    <p>${intlDate(Number(localStorage.firstDayEver))}</p>
    <h3>Periods list:</h3>
    <p>${localStorage.periodsList}</p>
  `;
}
