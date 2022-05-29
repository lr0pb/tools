import { periods } from './highLevel/periods.js'
import { renderToggler } from './highLevel/taskThings.js'
import { qs, qsa, emjs } from './highLevel/utils.js'
import { paintPeriods } from './settings.js'

const maxDays = 7;

export const periodCreator = {
  header: `${emjs.calendar} Create period`,
  page: `
    <h3>Enter period title</h3>
    <input type="text" id="periodName" placeHolder="Period title">
    <h3>How much days will be in period?</h3>
    <input type="range" id="daysCount" min="1" max="${maxDays}" value="${maxDays}">
    <h3>Select days in which you need to do the task</h3>
    <div>
      <div class="historyMonth"></div>
    </div>
  `,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="savePeriod" class="success">${emjs.save} Save task</button>
  `,
  script: onPeriodCreator
};

async function onPeriodCreator({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  appendDays();
  qs('#daysCount').addEventListener('change', onDaysCountChange);
  let elem = renderToggler({
    name: 'Task is repeatable',id: 'isRepeatable', emoji: emjs.sign,
    func: toggler, args: {}, page
  });
  elem.classList.add('first');
  elem.dataset.value = 1;
  /*elem = renderToggler({
    name: 'Start task at previous sunday', emoji: emjs.blank,
    func: toggler, args: {}, page
  });
  elem.dataset.value = 0;*/
  qs('#savePeriod').addEventListener('click', async () => {
    const period = createPeriod();
    if (period == 'error') return globals.message({
      state: 'fail', text: 'Fill all fields'
    });
    globals.db.setItem('periods', period);
    globals.message({
      state: 'success', text: 'Task created'
    });
    await globals.checkPersist();
    await paintPeriods(globals);
    history.back();
  });
}

function appendDays() {
  const hm = qs('.historyMonth:last-child');
  for (let i = 0; i < maxDays; i++) {
    hm.innerHTML += `<h4 data-value="0" data-used="true">${emjs.blank}</h4>`;
  }
  hm.addEventListener('click', (e) => {
    if (e.target.tagName !== 'H4') return;
    const value = Number(e.target.dataset.value) == 1 ? 0 : 1;
    e.target.dataset.value = value;
    e.target.innerHTML = value ? emjs.sign : emjs.blank;
  });
}

function onDaysCountChange(e) {
  const value = e.target.value;
  const rects = qsa('.historyMonth:last-child > h4');
  for (let i = 0; i < maxDays; i++) {
    rects[i].dataset.used = i < value ? 'true' : 'false';
  }
}

function toggler({e, elem}) {
  elem.dataset.value = !elem.dataset.value;
  e.target.innerHTML = elem.dataset.value ? emjs.sign : emjs.blank;
}

function createPeriod() {
  if (!localStorage.lastPeriodId) localStorage.lastPeriodId = 50;
  const period = {
    id: Number(localStorage.lastPeriodId) + 1,
    title: qs('#periodName').value,
    days: [],
    selectTitle: 'Select day to start',
    periodDay: -1
  };
  const rects = qsa('.historyMonth:last-child > h4[data-used="true"]');
  for (let elem of rects) {
    period.days.push(Number(elem.dataset.value));
  }
  if (!qs('[data-is="isRepeatable"]').dataset.value) period.special = 'oneTime';
  if (period.title == '') return 'error'
  return period;
}

