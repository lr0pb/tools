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
  onPageShow: ({globals, page}) => {
    if (!globals.pageInfo) globals.pageInfo = history.state;
    const task = await globals.db.getItem('tasks', globals.pageInfo.taskId);
    if (task.disabled || task.deleted) qs('#edit').style.display = 'none';
  }
};

async function renderTaskInfo({globals, page}) {
  qs('#back').addEventListener('click', () => {
    globals.pageInfo = null;
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
  const periodText = !task.special && task.periodStart <= getToday()
    ? `${periods[task.periodId].title} from ${task.periodStart == getToday() ? 'today' : intlDate(task.periodStart)}`
    : task.periodTitle;
  createInfoRect(emjs.calendar, periodText, 'blue');
  
  const isActiveText = `Today ${task.period[task.periodDay] ? 'you should do' : "you haven't"} this task`;
  if (!task.disabled) createInfoRect(emjs.clock, isActiveText, task.period[task.periodDay] ? 'green' : 'red');
  
  createInfoRect(emjs.fire, `Importance: ${priorities[task.priority].title}`, priorities[task.priority].color);
  
  if (task.special && task.history.length) {
    let emoji = emjs.cross, color = 'red';
    if (task.history[0]) emoji = emjs.sign, color = 'green';
    createInfoRect(emoji, `Task was ${task.history[0] ? '' : 'not '}completed`, color);
  } else if (task.history.length) {
    renderHistory(task);
  }
}

function renderHistory(task) {
  const hb = qs('.historyMonth');
  const creationDay = new Date(Number(task.id)).setHours(0, 0, 0, 0);
  const startDay = new Date(creationDay > task.periodStart ? creationDay : task.periodStart);
  const borderValues = (value) => {
    if (value == -1) return 6;
    if (value == 6) return -1;
    return value;
  };
  const emptyDays = borderValues(startDay.getDay() - 1);
  for (let i = 0; i < emptyDays; i++) {
    hb.innerHTML += `<h4> </h4>`;
  }
  let periodCursor = creationDay > task.periodStart ? new Date(creationDay).getDay() : 0;
  let hardUpdate = false;
  const addValue = () => {
    periodCursor++;
    hardUpdate = false;
    if (task.period.length == periodCursor) {
      periodCursor = 0;
      hardUpdate = true;
    }
  };
  for (let item of task.history) {
    while (!task.period[periodCursor]) {
      hb.innerHTML += `<h4>${emjs.blank}</h4>`;
      addValue();
    }
    hb.innerHTML += `<h4>${item ? emjs.sign : emjs.cross}</h4>`;
    addValue();
  }
  periodCursor = borderValues(periodCursor);
  while (periodCursor <= task.periodDay && !hardUpdate && !task.period[task.periodDay]) {
    hb.innerHTML += `<h4>${emjs.blank}</h4>`;
    addValue();
  }
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
