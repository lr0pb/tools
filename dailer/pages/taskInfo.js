import { getToday, convertDate, oneDay } from './highLevel/periods.js'
import { priorities } from './highLevel/taskThings.js'
import { qs, emjs, getLast, intlDate } from './highLevel/utils.js'

export const taskInfo = {
  header: `${emjs.oldPaper} Task info`,
  page: ``,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="edit">${emjs.pen} Edit task</button>
  `,
  script: renderTaskInfo,
  onPageShow: async ({globals, page}) => {
    if (!globals.pageInfo) globals.pageInfo = history.state;
    else Object.assign(globals.pageInfo, history.state);
    if (globals.pageInfo.stateChangedTaskId) qs('#edit').style.display = 'none';
    if (!globals.pageInfo.dataChangedTaskId) return;
    const td = await globals.db.getItem('tasks', globals.pageInfo.taskId);
    const periods = await globals.getPeriods();
    qs('#infoBackground h4').innerHTML = td.name;
    qs('.itemsHolder').innerHTML = '';
    renderItemHolder(td, periods);
  }
};

async function renderTaskInfo({globals, page}) {
  qs('#back').addEventListener('click', () => {
    if (globals.pageInfo) {
      delete globals.pageInfo.taskId;
      delete globals.pageInfo.taskAction;
    }
    history.back();
  });
  if (!globals.pageInfo) globals.pageInfo = history.state;
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
  page.innerHTML = `
    <div id="infoBackground">
      <h4>${task.name}</h4>
    </div>
    <div class="itemsHolder"></div>
    ${!task.history.length || task.special ? '' : `
      <h2>History</h2>
      <div id="history" class="hiddenScroll">
        <div class="historyMonth"></div>
      </div>
    `}
  `;
  renderItemHolder(task, periods);
  const iha = isHistoryAvailable(task);
  if (iha) {
    await renderHistory(task);
  } else if (iha === false) {
    let emoji = emjs.cross, color = 'red';
    if (task.history[0]) emoji = emjs.sign, color = 'green';
    createInfoRect(emoji, `Task ${
      task.history.length && task.disabled ? 'was' : 'is'
    } ${task.history[0] ? '' : 'not '}completed`, color);
  }
}

function renderItemHolder(task, periods) {
  const perTitle = periods[task.periodId].title;
  const periodText = !task.special && task.periodStart <= getToday()
    ? `${perTitle} from ${task.periodStart == getToday() ? 'today' : intlDate(task.periodStart)}${
      task.endDate ? ` to ${task.endDate == getToday() + oneDay ? 'tomorrow' : intlDate(task.endDate)}` : ''
    }`
    : (task.endDate ? `${perTitle}. Ended ${intlDate(task.endDate)}` :
      (task.periodStart < getToday() ? `${perTitle} from ${intlDate(task.periodStart)}` : task.periodTitle));
  createInfoRect(emjs.calendar, periodText, 'blue');

  const isActiveText = `Today ${task.period[task.periodDay] ? 'you should do' : "you haven't"} this task`;
  if (!task.disabled) createInfoRect(emjs.clock, isActiveText, task.period[task.periodDay] ? 'green' : 'red');

  createInfoRect(emjs.fire, `Importance: ${priorities[task.priority].title}`, priorities[task.priority].color);
}

function createInfoRect(emoji, text, color) {
  const elem = document.createElement('div');
  elem.className = 'infoRect';
  elem.style.setProperty('--color', `var(--${color})`);
  elem.innerHTML = `
    <h4>${emoji}</h4>
    <h3>${text}</h3>
  `;
  qs('.itemsHolder').append(elem);
}

export function isHistoryAvailable(task) {
  if (task.special && task.history.length) return false;
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
