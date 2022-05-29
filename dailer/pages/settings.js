import { periods } from './highLevel/periods.js'
import { renderToggler } from './highLevel/taskThings.js'
import { qs, emjs } from './highLevel/utils.js'

export const settings = {
  sections: ['periods'],
  paint: ({globals, page}) => {
    const periodsCount = 5;
    page.innerHTML = `
      <h2 data-section="periods">Periods</h2>
      <h3>Set up to ${periodsCount} periods that will be shown in Period choise drop down list of task</h3>
      <div id="periodsContainer"></div>
      <h3>Create your own period for specific task performance</h3>
      <button id="toPeriodCreator">${emjs.calendar} Create custom period</button>
    `;
    await paintPeriods(globals);
    qs('#toPeriodCreator').addEventListener('click', () => {
      globals.closeSettings(true);
      globals.paintPage('periodCreator');
    });
  }
};

export async function paintPeriods(globals) {
  let first = true;
  const pc = qs('#periodsContainer');
  pc.innerHTML = '';
  const customs = await globals.db.getAll('periods');
  for (let per of customs) {
    periods[per.id] = per;
  }
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
  localStorage.periodsList = JSON.stringify(list);
  e.target.innerHTML = getPeriodUsed(id);
}

function getPeriodUsed(id) {
  return JSON.parse(localStorage.periodsList).includes(id)
  ? emjs.sign : emjs.blank;
}
