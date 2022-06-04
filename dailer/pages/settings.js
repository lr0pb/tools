import { renderToggler } from './highLevel/taskThings.js'
import { emjs } from './highLevel/utils.js'

const qs = (elem) => document.querySelector(elem);

const periodsCount = 5;

export const settings = {
  sections: ['periods'],
  paint: async ({globals, page}) => {
    page.innerHTML = `
      <h2 data-section="periods">Periods</h2>
      <h3>Set up to ${periodsCount} periods that will be shown in Period choise drop down list of task</h3>
      <div id="periodsContainer"></div>
      <h3>Create your own period for specific task performance</h3>
      <button id="toPeriodCreator">${emjs.calendar} Create custom period</button>
      <button id="toDebug" class="secondary">${emjs.construction} Open debug page</button>
    `;
    qs('#toPeriodCreator').addEventListener('click', () => {
      globals.closeSettings(true);
      globals.paintPage('periodCreator');
    });
    qs('#toDebug').addEventListener('click', () => {
      globals.closeSettings(true);
      globals.paintPage('debugPage');
    });
  },
  opening: async ({globals}) => {
    if (!qs('#periodsContainer').children.length) {
      await paintPeriods(globals);
    }
  }
};

export async function paintPeriods(globals) {
  let first = true;
  const pc = qs('#periodsContainer');
  const periods = await globals.getPeriods();
  pc.innerHTML = '';
  for (let per in periods) {
    const period = periods[per];
    const elem = renderToggler({
      name: period.title, id: period.id,
      emoji: getPeriodUsed(per),
      func: updatePeriodsList,
      args: { globals, periodsCount }, page: pc
    });
    if (first) {
      elem.classList.add('first');
      first = false;
    }
  }
}

function updatePeriodsList({e, globals, periodsCount, elem }) {
  const list = JSON.parse(localStorage.periodsList);
  const id = elem.dataset.id;
  if (list.includes(id)) {
    if (list.length == 1) {
      return globals.message({
        state: 'fail', text: `You need to have at least 1 period`
      });
    }
    const idx = list.indexOf(id);
    list.splice(idx, 1);
  } else {
    list.length == periodsCount
    ? globals.message({
        state: 'fail', text: `You already choose ${periodsCount} periods`
      })
    : list.push(id);
  }
  list.sort((el1, el2) => {
    el1 = Number(el1);
    el2 = Number(el2);
    if (el1 > el2) return 1;
    if (el1 == el2) return 0;
    return -1;
  });
  localStorage.periodsList = JSON.stringify(list);
  e.target.innerHTML = getPeriodUsed(id);
}

function getPeriodUsed(id) {
  return JSON.parse(localStorage.periodsList).includes(id)
  ? emjs.sign : emjs.blank;
}
