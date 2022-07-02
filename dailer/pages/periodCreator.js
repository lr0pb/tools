import { periods } from './highLevel/periods.js'
import { renderToggler, toggleFunc } from './highLevel/taskThings.js'
import { qs, qsa, emjs, safeDataInteractions } from './highLevel/utils.js'
import { paintPeriods } from './settings.js'

const maxDays = 7;
const transform = 'translateY(3rem)';

export const periodCreator = {
  header: `${emjs.calendar} <span id="periodAction">Create</span> period`,
  page: `
    <h3>Enter period title</h3>
    <input type="text" id="periodName" placeHolder="Period title e.g. Every saturday">
    <h3>You also can type period description</h3>
    <input type="text" id="periodDesc" placeHolder="Period description">
    <h3>How much days will be in period?</h3>
    <input type="range" id="daysCount" min="1" max="${maxDays}" value="${maxDays}">
    <h3>Select the days you need to perform the task</h3>
    <h3>At least one day is required</h3>
    <div>
      <div class="historyMonth"></div>
    </div>
    <div class="togglerContainer first"></div>
    <h3>When period is over, task will continue period from start</h3>
    <div class="togglerContainer first"></div>
    <h3>Automatically set task start day to the previous Sunday</h3>
    <div class="togglerContainer first"></div>
    <h3>This period will be selected by default in periods drop down list if no other default periods created later are in the list</h3>
  `,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="savePeriod" class="success">${emjs.save} Save period</button>
  `,
  noSettings: true,
  script: onPeriodCreator
};

function toggleDays(value) {
  const hm = qs('.historyMonth:last-child');
  for (let elem of hm.children) {
    elem.children[0].style.transform = value ? 'none' : transform;
    elem.children[1].style.opacity = value;
  }
}

async function onPeriodCreator({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  if (!globals.pageInfo) globals.pageInfo = history.state;
  const isEdit = globals.pageInfo && globals.pageInfo.periodAction == 'edit';
  let per;
  if (isEdit) {
    per = await globals.db.getItem('periods', globals.pageInfo.periodId);
    qs('#periodAction').innerHTML = 'Edit';
    qs('#periodName').value = per.title;
    if (per.description) qs('#periodDesc').value = per.description;
    qs('#daysCount').value = per.days.length;
    qs('#daysCount').setAttribute('disabled', 'disabled');
    globals.onBack = () => {
      delete globals.pageInfo.periodAction;
      delete globals.pageInfo.periodId;
    };
  }
  appendDays(isEdit ? per.days : null);
  if (isEdit) toggleDays(per.getWeekStart ? 1 : 0);
  qs('#daysCount').addEventListener('input', onDaysCountChange);
  const containers = qsa('.togglerContainer');
  renderToggler({
    name: 'Task will be looped', id: 'isRepeatable',
    toggler: isEdit ? emjs[per.special == 'oneTime' ? 'blank' : 'sign'] : emjs.sign,
    page: containers[0], value: isEdit ? (per.special == 'oneTime' ? 0 : 1) : 1, disabled: isEdit
  });
  renderToggler({
    name: 'Start on Sundays', id: 'getWeekStart',
    page: containers[1], value: isEdit ? (per.getWeekStart ? 1 : 0) : 0,
    buttons: [{
      emoji: isEdit ? emjs[per.getWeekStart ? 'sign' : 'blank'] : emjs.blank,
      func: ({e, elem}) => toggleDays(toggleFunc({e, elem}))
    }], disabled: isEdit
  });
  renderToggler({
    name: 'Period is selected by default', id: 'selected',
    toggler: isEdit ? emjs[per.selected ? 'sign' : 'blank'] : emjs.blank,
    page: containers[2], value: isEdit ? (per.selected ? 1 : 0) : 0
  });
  /*page.innerHTML += `
    <!--<h3>Limit days to select task start day</h3>-->
  `;
  renderToggler({
    name: 'No limit', id: 'noMaxDate', page: containers[3],
    toggler: emjs.sign, value: 1
  });
  page.innerHTML += `
    <div id="maxDateBlock">
      <input type="range" id="maxDate" min="1" max="13" value="13">
      <h3>In task creation process you able to select start day from today +<span id="maxDateTitle">13</span> days</h3>
    </div>
  `;*/
  safeDataInteractions(['periodName', 'periodDesc', /*'daysCount'*/]);
  qs('#savePeriod').addEventListener('click', async () => {
    const period = createPeriod(per, isEdit);
    if (period == 'error') return globals.message({
      state: 'fail', text: 'Fill all fields'
    });
    globals.db.setItem('periods', period);
    globals.message({
      state: 'success', text: `Period ${isEdit ? 'edited' : 'created'}`
    });
    await globals.checkPersist();
    await paintPeriods(globals);
    globals.additionalBack = 0;
    /*if (globals.pageInfo && globals.pageInfo.periodPromo) {
      globals.pageInfo.periodPromo.remove();
      delete globals.pageInfo.periodPromo;
    }*/
    history.back();
  });
}

function appendDays(days) {
  const hm = qs('.historyMonth:last-child');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysCount = days ? days.length : maxDays;
  for (let i = 0; i < daysCount; i++) {
    hm.innerHTML += `
      <div data-used="true" data-value="0" ${days ? 'disabled' : ''}>
        <h4 style="transform: ${transform};">${days ? emjs[days[i] ? 'sign' : 'blank'] : emjs.blank}</h4>
        <h3 class="dayTitle">${dayNames[i]}</h3>
      </div>
    `;
  }
  if (!days) hm.addEventListener('click', (e) => {
    const elem = e.target.dataset.value
    ? e.target : ['H4', 'H3'].includes(e.target.tagName)
    ? e.target.parentElement : null;
    if (!elem.dataset.value) return;
    const value = Number(elem.dataset.value) == 1 ? 0 : 1;
    elem.dataset.value = value;
    elem.children[0].innerHTML = value ? emjs.sign : emjs.blank;
  });
}

function onDaysCountChange(e) {
  const value = e.target.value;
  const rects = qsa('.historyMonth:last-child > div');
  for (let i = 0; i < maxDays; i++) {
    rects[i].dataset.used = i < value ? 'true' : 'false';
  }
}

export function createPeriod(per = {}, isEdit) {
  const period = {
    id: isEdit ? per.id : String(Number(localStorage.lastPeriodId) + 1),
    title: qs('#periodName') ? qs('#periodName').value : per.title,
    days: per.days || [],
    selectTitle: 'Select day to start',
    periodDay: -1
  };
  const rects = qsa('.historyMonth:last-child > [data-used="true"]');
  if (!per.days) for (let elem of rects) {
    period.days.push(Number(elem.dataset.value));
  }
  if (per.title) {
    const fields = ['description', 'special', 'getWeekStart', 'selected'];
    for (let field of fields) {
      if (per[field]) period[field] = per[field];
    }
  } else {
    if (!getValue('isRepeatable')) period.special = 'oneTime';
    if (getValue('getWeekStart')) period.getWeekStart = true;
  }
  if (isEdit || !per.title) {
    if (qs('#periodDesc').value !== '') period.description = qs('#periodDesc').value;
    if (getValue('selected')) period.selected = true;
    else if (period.selected) delete period.selected;
  }
  console.log(period);
  if (period.title == '' || !period.days.includes(1)) return 'error'
  if (!isEdit) localStorage.lastPeriodId = period.id;
  return period;
}

function getValue(elem) {
  return Number(qs(`[data-id="${elem}"]`).dataset.value);
}
