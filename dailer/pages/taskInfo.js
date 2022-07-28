import { getToday, normalizeDate, oneDay, isCustomPeriod } from './highLevel/periods.js'
import { getTextDate } from './highLevel/taskThings.js'
import { qs, /*emjs,*/ intlDate, syncGlobals } from './highLevel/utils.js'

let taskTitle = null;

export const taskInfo = {
  get title() {
    return `${emjs.oldPaper} ${
      taskTitle ? `Task info: ${taskTitle}` : 'Task info'
    }`;
  },
  get titleEnding() {
    return taskTitle ? 'line' : 'text';
  },
  dynamicTitle: true,
  get header() { return `${emjs.oldPaper} Task info`},
  get page() { return ``},
  styleClasses: 'doubleColumns',
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="edit" class="success">${emjs.pen} Edit task</button>
  `},
  script: renderTaskInfo,
  onPageShow: async ({globals, page}) => {
    syncGlobals(globals);
    if (globals.pageInfo.stateChangedTaskId) qs('#edit').style.display = 'none';
    if (!globals.pageInfo.dataChangedTaskId) return;
    const td = await globals.db.getItem('tasks', globals.pageInfo.taskId);
    const periods = await globals.getPeriods();
    const priorities = await globals.getList('priorities');
    qs('#infoBackground h4').innerHTML = td.name;
    qs('.itemsHolder').innerHTML = '';
    const iha = isHistoryAvailable(td);
    renderItemsHolder({task: td, periods, priorities, iha});
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
  taskTitle = task.name;
  const periods = await globals.getPeriods();
  const priorities = await globals.getList('priorities');
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
  const isa = isStatsAvailable(task);
  page.innerHTML = `
    <div>
      <div id="infoBackground">
        <h4>${task.name}</h4>
      </div>
      <div class="itemsHolder"></div>
    </div>
    <div>${isa ? `
      <h2>Stats</h2>
      <div id="stats">
        <h3>Stats for this tasks is available and will be rendering with coming updates to app</h3>
      </div>
      ` : isa === false && !task.disabled ? `
      <h2>Stats</h2>
      <div class="content center">
        <h2 class="emoji">${emjs.empty}</h2>
        <h3>Stats will be available as soon as you running this task for 2 weeks</h3>
      </div>` : ''
    }${!iha ? '' : `
      <h2>History</h2>
      <div id="history" class="hiddenScroll">
        <div class="historyMonth"></div>
      </div>
    `}</div>
  `;
  renderItemsHolder({task, periods, priorities, iha});
  if (iha) await renderHistory(task);
  if (isa) await renderStats(task);
}

function renderItemsHolder({task, periods, priorities, iha}) {
  const { periodsInWeek, runnedPeriods } = getPeriodsData(task);
  const showQS = runnedPeriods >= periodsInWeek;

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
  createInfoRect(
    emjs.calendar, periodText, 'blue', (!iha && !task.disabled) || (iha && showQS) ? 1 : 2
  );

  const isActive = task.period[task.periodDay];
  const isActiveText = `Today ${isActive ? 'you should do' : `you haven't`} this task`;
  if (!task.disabled) createInfoRect(
    emjs[isActive ? 'alarmClock' : 'moon'], isActiveText, isActive ? 'green' : 'yellow'
  );

  const priority = priorities[task.priority];
  createInfoRect(emjs[priority.emoji || 'fire'], `Importance: ${priority.title}`, priority.color);

  if (iha && showQS) {
    const quickStats = {
      amount: task.period.length * periodsInWeek,
      completed: 0, done: false
    };
    for (let i = 1; i < quickStats.amount + 1; i++) {
      if (task.history.at(-1 * i)) quickStats.completed++;
    }
    if (quickStats.completed == quickStats.amount) quickStats.done = true;
    createInfoRect(
      emjs[quickStats.done ? 'party' : 'chartUp'],
      `Last week you done task ${quickStats.completed}/${quickStats.amount} times`,
      quickStats.done ? 'green' : 'blue'
    );
  }

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

function getPeriodsData(task) {
  let activeDays = 0;
  for (let day of task.period) {
    if (day) activeDays++;
  }
  return {
    periodsInWeek: 7 / task.period.length,
    runnedPeriods: task.history.length / activeDays
  };
}

function isStatsAvailable(task) {
  if (!dailerData.experiments) return undefined;
  if (task.special && task.period.length == 1) return undefined;
  const { periodsInWeek, runnedPeriods } = getPeriodsData(task);
  if (runnedPeriods >= periodsInWeek * 2) return true;
  return false;
}

function createMonth(name, month, history) {
  const elem = document.createElement('div');
  elem.dataset.month = month;
  elem.innerHTML = `
    <h3>${name}</h3>
    <div class="historyMonth"></div>
  `;
  history.append(elem);
  return elem.querySelector('.historyMonth');
}

async function renderHistory(task) {
  const h = qs('#history');
  let hm = null;
  const formatter = new Intl.DateTimeFormat(navigator.language, {
    month: "long"
  });
  const init = (date) => {
    date = new Date(date);
    const month = date.getMonth();
    if (!hm || hm.parentElement.dataset.month !== String(month)) {
      hm = createMonth(formatter.format(date), month, h);
      const borderValues = (value) => {
        if (value == -1) return 6;
        if (value == 6) return -1;
        return value;
      };
      const emptyDays = borderValues(date.getDay() - 1);
      for (let i = 0; i < emptyDays; i++) {
        hm.innerHTML += `<h4> </h4>`;
      }
    }
  };
  await getHistory({
    task,
    onBlankDay: (date) => {
      init(date);
      hm.innerHTML += `<h4>${emjs.blank}</h4>`;
    },
    onActiveDay: (date, item) => {
      init(date);
      hm.innerHTML += `<h4>${item ? emjs.sign : emjs.cross}</h4>`;
    }
  });
  qs('#history .historyMonth:last-child').scrollIntoView();
}

export async function getHistory({task, onEmptyDays, onBlankDay, onActiveDay}) {
  const creationDay = normalizeDate(task.created || task.id);
  const startDay = new Date(creationDay > task.periodStart ? creationDay : task.periodStart);
  let day = normalizeDate(startDay);
  const borderValues = (value) => {
    if (value == -1) return 6;
    if (value == 6) return -1;
    return value;
  };
  const emptyDays = borderValues(startDay.getDay() - 1);
  if (onEmptyDays) for (let i = emptyDays; i > 0; i--) {
    onEmptyDays(day - oneDay * i);
  }
  let periodCursor = creationDay > task.periodStart ? new Date(creationDay).getDay() : 0;
  let hardUpdate = false;
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
      if (onBlankDay) onBlankDay(day);
      addValue();
    }
    await onActiveDay(day, item); addValue();
  }
  periodCursor = borderValues(periodCursor);
  while (periodCursor <= task.periodDay && !hardUpdate && !task.period[task.periodDay]) {
    if (onBlankDay) onBlankDay(day);
    addValue();
  }
}

async function renderStats(task) {
  //
}
