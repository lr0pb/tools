import {
  getToday, convertDate, oneDay, isCustomPeriod
} from './highLevel/periods.js'
import { priorities, getTextDate } from './highLevel/taskThings.js'
import { qs, emjs, getLast, intlDate, syncGlobals } from './highLevel/utils.js'

export const taskInfo = {
  header: `${emjs.oldPaper} Task info`,
  page: ``,
  styleClasses: 'doubleColumns',
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="edit" class="success">${emjs.pen} Edit task</button>
  `,
  script: renderTaskInfo,
  onPageShow: async ({globals, page}) => {
    syncGlobals(globals);
    if (globals.pageInfo.stateChangedTaskId) qs('#edit').style.display = 'none';
    if (!globals.pageInfo.dataChangedTaskId) return;
    const td = await globals.db.getItem('tasks', globals.pageInfo.taskId);
    const periods = await globals.getPeriods();
    qs('#infoBackground h4').innerHTML = td.name;
    qs('.itemsHolder').innerHTML = '';
    const iha = isHistoryAvailable(td);
    renderItemsHolder(td, periods, iha);
  },
  onSettingsUpdate: ({globals}) => { syncGlobals(globals); },
  onBack: (globals) => {
    if (!globals.pageInfo) return;
    delete globals.pageInfo.taskId;
    delete globals.pageInfo.taskAction;
  }
};

async function renderTaskInfo({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  syncGlobals(globals);
  const task = await globals.db.getItem('tasks', globals.pageInfo.taskId);
  const periods = await globals.getPeriods();
  if (task.disabled || task.deleted) {
    qs('#edit').style.display = 'none';
  } else {
    qs('#edit').addEventListener('click', () => {
      if (!globals.pageInfo) globals.pageInfo = history.state;
      globals.pageInfo.taskAction = 'edit';
      globals.paintPage('taskCreator');
    });
  }
  const iha = isHistoryAvailable(task);
  page.innerHTML = `
    <div>
      <div id="infoBackground">
        <h4>${task.name}</h4>
      </div>
      <div class="itemsHolder"></div>
    </div>
    <div>${!iha ? '' : `
      <h2>History</h2>
      <div id="history" class="hiddenScroll">
        <div class="historyMonth"></div>
      </div>
    `}</div>
  `;
  renderItemsHolder(task, periods, iha);
  if (iha) await renderHistory(task);
}

function renderItemsHolder(task, periods, iha) {
  const rawTitle = periods[task.periodId].title;
  const perTitle = isCustomPeriod(task.periodId)
  ? `<span class="customTitle" data-period="${task.periodId}">${rawTitle}</span>`
  : rawTitle;
  const startTitle = getTextDate(task.periodStart);
  const endTitle = task.endDate ? getTextDate(task.endDate) : null;
  const periodText = !task.special
    ? `${perTitle} from ${startTitle}${task.endDate ? ` to ${endTitle}` : ''}`
    : (task.endDate
      ? `${perTitle}${task.disabled ? '. Ended' : ' to'} ${endTitle}` : task.periodTitle);
  createInfoRect(emjs.calendar, periodText, 'blue', !iha && !task.disabled ? 1 : 2);

  const isActiveText = `Today ${task.period[task.periodDay] ? 'you should do' : `you haven't`} this task`;
  if (!task.disabled) createInfoRect(emjs.clock, isActiveText, task.period[task.periodDay] ? 'green' : 'red');

  createInfoRect(emjs.fire, `Importance: ${priorities[task.priority].title}`, priorities[task.priority].color);

  if (iha) return;
  let emoji = emjs.cross, color = 'red';
  if (task.history[0]) emoji = emjs.sign, color = 'green';
  createInfoRect(emoji, `Task ${
    task.history.length && task.disabled ? 'was' : 'is'
  } ${task.history[0] ? '' : 'not '}completed`, color);
}

function createInfoRect(emoji, text, color, coef = 1) {
  const elem = document.createElement('div');
  elem.className = 'infoRect';
  elem.style.setProperty('--color', `var(--${color})`);
  elem.style.setProperty('--coef', coef);
  elem.innerHTML = `
    <h4>${emoji}</h4>
    <h3>${text}</h3>
  `;
  qs('.itemsHolder').append(elem);
}

export function isHistoryAvailable(task) {
  if (task.special && task.period.length == 1) return false;
  if (task.history.length) return true;
  return undefined;
}

async function renderHistory(task) {
  const hb = qs('.historyMonth');
  await getHistory({
    task,
    onEmptyDays: () => hb.innerHTML += `<h4> </h4>`,
    onBlankDay: () => hb.innerHTML += `<h4>${emjs.blank}</h4>`,
    onActiveDay: (date, item) => hb.innerHTML += `<h4>${item ? emjs.sign : emjs.cross}</h4>`
  });
}

export async function getHistory({task, onEmptyDays, onBlankDay, onActiveDay}) {
  const creationDay = new Date(Number(task.created || task.id)).setHours(0, 0, 0, 0);
  const startDay = new Date(creationDay > task.periodStart ? creationDay : task.periodStart);
  const borderValues = (value) => {
    if (value == -1) return 6;
    if (value == 6) return -1;
    return value;
  };
  const emptyDays = borderValues(startDay.getDay() - 1);
  if (onEmptyDays) for (let i = 0; i < emptyDays; i++) {
    onEmptyDays();
  }
  let periodCursor = creationDay > task.periodStart ? new Date(creationDay).getDay() : 0;
  let hardUpdate = false;
  let day = startDay.setHours(0, 0, 0, 0);
  const addValue = () => {
    periodCursor++;
    hardUpdate = false;
    day += oneDay;
    if (periodCursor >= task.period.length) {
      periodCursor = 0;
      hardUpdate = true;
    }
  };
  for (let item of task.history) {
    while (!task.period[periodCursor]) {
      if (onBlankDay) onBlankDay();
      addValue();
    }
    await onActiveDay(day, item); addValue();
  }
  periodCursor = borderValues(periodCursor);
  while (periodCursor <= task.periodDay && !hardUpdate && !task.period[task.periodDay]) {
    if (onBlankDay) onBlankDay();
    addValue();
  }
}
