import { getToday, oneDay } from './highLevel/periods.js'
import { qs, emjs, getLast } from './highLevel/utils.js'
import { renderTask, setPeriodTitle } from './highLevel/taskThings.js'

export const main = {
  header: `${emjs.sword} Today's tasks`,
  styleClasses: 'center doubleColumns',
  page: ``,
  footer: `
    <!--<button id="toHistory" class="secondary">&#128198; History</button>-->
    <button id="toPlan" class="secondary">${emjs.notes} Edit tasks</button>
  `,
  script: async ({globals, page}) => {
    qs('#toPlan').addEventListener(
      'click', () => globals.paintPage('planCreator')
    );
    await renderDay({globals, page});
  },
  onPageShow: updatePage,
  onSettingsUpdate: updatePage
};

async function updatePage({globals, page}) {
  const day = await globals.db.getItem('days', getToday().toString());
  if (
    !day || day.lastTasksChange != localStorage.lastTasksChange ||
    (globals.pageInfo && globals.pageInfo.backupUploaded)
  ) {
    await renderDay({globals, page});
    delete globals.pageInfo.backupUploaded;
  }
}

async function renderDay({globals, page}) {
  const periods = await globals.getPeriods();
  const day = await createDay(globals, periods);
  if (day == 'error') {
    page.innerHTML = `
      <h2 class="emoji">${emjs.magic}</h2>
      <h2>You have no tasks today!</h2>
    `;
    await checkInstall(globals);
    return page.classList.add('center');
  }
  page.classList.remove('center');
  page.innerHTML = '';
  for (let i = day.tasks.length - 1; i > -1; i--) {
    const tasks = day.tasks[i];
    for (let id in tasks) {
      const td = await globals.db.getItem('tasks', id);
      renderTask({type: 'day', globals, td, page, onBodyClick: () => {
        globals.pageInfo = {taskId: td.id};
        globals.paintPage('taskInfo');
      }});
    }
  }
  await checkInstall(globals);
}

async function createDay(globals, periods, today = getToday()) {
  if (!localStorage.firstDayEver) {
    localStorage.firstDayEver = today.toString();
  }
  const check = await checkLastDay(globals, today);
  if (!check.check) {
    await createDay(globals, periods, check.dayBefore);
  }
  let day = await globals.db.getItem('days', today.toString());
  if (!day || day.lastTasksChange != localStorage.lastTasksChange) {
    day = getRawDay(today.toString(), !day);
  } else {
    return isEmpty(day) ? 'error' : day;
  }
  let tasks = await globals.db.getAll('tasks');
  tasks = tasks.filter( (elem) => elem.disabled || elem.deleted ? false : true );
  for (let task of tasks) {
    if (task.periodStart <= today) {
      if (day.firstCreation || !task.history.length) {
        updateTask(task, periods);
        if (task.period[task.periodDay]) {
          task.history.push(0);
          day.tasks[task.priority][task.id] = 0;
        }
        await globals.db.setItem('tasks', task);
      } else if (task.period[task.periodDay]) {
        day.tasks[task.priority][task.id] = getLast(task.history);
      }
    }
  }
  await globals.db.setItem('days', day);
  if (isEmpty(day)) return 'error';
  return day;
}

export function getRawDay(date, firstCreation) {
  return {
    date, tasks: [{}, {}, {}], // 3 objects for 3 priorities
    completed: false, lastTasksChange: localStorage.lastTasksChange,
    firstCreation
  };
}

async function checkLastDay(globals, day) {
  const dayBefore = day - oneDay;
  const check = localStorage.firstDayEver == day.toString()
  ? true
  : await globals.db.getItem('days', dayBefore.toString());
  return { check, dayBefore };
}

function disable(task) {
  task.periodDay = -1;
  task.disabled = true;
  setPeriodTitle(task);
}

function updateTask(task, periods) {
  if (task.special == 'oneTime') {
    if (task.history.length) {
      disable(task);
    } else if (getToday() == task.periodStart) {
      task.periodDay = 0; task.periodTitle = 'Only today';
    }
    return;
  } else if (task.special == 'untilComplete') {
    if (task.history[0] == 1) {
      task.endDate = getToday() - oneDay; disable(task);
    } else {
      task.periodDay = 0; task.history.length = 0;
    }
    return;
  }
  task.periodTitle = (task.periodId && periods[task.periodId].title) || task.ogTitle || task.periodTitle;
  if (task.endDate && task.endDate == getToday()) {
    disable(task);
  }
  task.periodDay++;
  if (task.periodDay == task.period.length) {
    task.periodDay = 0;
  }
}

function isEmpty(day) {
  for (let tasks of day.tasks) {
    if (Object.keys(tasks).length > 0) return false;
  }
  return true;
}

export async function checkInstall(globals) {
  if (navigator.standalone === undefined && !globals.installPrompt) return;
  const response = await globals.checkPersist();
  if (response === false || localStorage.installed !== 'true') {
    globals.floatingMsg({
      text: `To protect your data, install dailer app on your home screen${
        navigator.standalone === false ? ': click Share > Add to home screen' : ''
      }`,
      button: globals.installPrompt ? 'Install' : null,
      onClick: async (e) => {
        globals.installPrompt.prompt();
        await globals.installPrompt.userChoice;
        delete globals.installPrompt;
        e.target.parentElement.remove();
      },
      pageName: 'main'
    });
  }
}
