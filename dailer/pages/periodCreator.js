import { periods } from './highLevel/periods.js'
import { renderToggler } from './highLevel/taskThings.js'
import { qs, qsa, emjs, safeDataInteractions } from './highLevel/utils.js'
import { paintPeriods } from './settings.js'

const maxDays = 7;

export const periodCreator = {
  header: `${emjs.calendar} Create period`,
  page: `
    <h3>Enter period title</h3>
    <input type="text" id="periodName" placeHolder="Period title">
    <h3>You also can type period description</h3>
    <input type="text" id="periodDesc" placeHolder="Period description">
    <h3>How much days will be in period?</h3>
    <input type="range" id="daysCount" min="1" max="${maxDays}" value="${maxDays}">
    <h3>Select the days you need to complete the task</h3>
    <h3>At least one selected day is required</h3>
    <div>
      <div class="historyMonth"></div>
    </div>
  `,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="savePeriod" class="success">${emjs.save} Save period</button>
  `,
  noSettings: true,
  script: onPeriodCreator
};

async function onPeriodCreator({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  appendDays();
  qs('#daysCount').addEventListener('input', onDaysCountChange);
  renderToggler({
    name: 'Task will be looped', id: 'isRepeatable',
    emoji: emjs.sign, page, value: 1, first: true
  });
  renderToggler({
    name: 'Start on Sundays', id: 'getWeekStart',
    emoji: emjs.blank, page, value: 0
  });
  const text = document.createElement('h3');
  text.innerHTML = 'Automatically set task start day to the previous Sunday';
  page.append(text);
  /*page.innerHTML += `
    <!--<h3>Limit days to select task start day</h3>-->
  `;
  elem = renderToggler({
    name: 'No limit', id: 'noMaxDate',
    emoji: emjs.sign, func: toggler, args: {}, page
  });
  elem.classList.add('first');
  elem.dataset.value = 1;
  page.innerHTML += `
    <div id="maxDateBlock">
      <input type="range" id="maxDate" min="1" max="13" value="13">
      <h3>In task creation process you able to select start day from today +<span id="maxDateTitle">13</span> days</h3>
    </div>
  `;*/
  safeDataInteractions(['periodName', 'periodDesc', 'daysCount']);
  qs('#savePeriod').addEventListener('click', async () => {
    const period = createPeriod();
    if (period == 'error') return globals.message({
      state: 'fail', text: 'Fill all fields'
    });
    globals.db.setItem('periods', period);
    globals.message({
      state: 'success', text: 'Period created'
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

function createPeriod() {
  if (!localStorage.lastPeriodId) localStorage.lastPeriodId = 50;
  const period = {
    id: String(Number(localStorage.lastPeriodId) + 1),
    title: qs('#periodName').value,
    days: [],
    selectTitle: 'Select day to start',
    periodDay: -1
  };
  const rects = qsa('.historyMonth:last-child > h4[data-used="true"]');
  for (let elem of rects) {
    period.days.push(Number(elem.dataset.value));
  }
  if (qs('#periodDesc').value !== '') period.description = qs('#periodDesc').value;
  if (!getValue('[data-id="isRepeatable"]')) period.special = 'oneTime';
  if (getValue('[data-id="getWeekStart"]')) period.getWeekStart = true;
  console.log(period);
  if (period.title == '' || !period.days.includes(1)) return 'error'
  localStorage.lastPeriodId = period.id;
  return period;
}

function getValue(elem) {
  return Number(qs(elem).dataset.value);
}
