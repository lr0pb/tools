import { getToday, oneDay } from './highLevel/periods.js'
import { qs, emjs, getLast } from './highLevel/utils.js'
import { renderTask, setPeriodTitle } from './highLevel/taskThings.js'

export const main = {
  header: `${emjs.sword} Today's tasks`,
  centerContent: true,
  page: ``,
  footer: `
    <!--<button id="toHistory" class="secondary">&#128198; History</button>-->
    <button id="toPlan" class="secondary">${emjs.notes} Edit tasks</button>
  `,
  script: mainScript
};

async function mainScript({globals, page}) {
  qs('#toPlan').addEventListener(
    'click', () => globals.paintPage('planCreator')
  );
  const periods = await globals.getPeriods();
  const day = await createDay(globals, periods);
  if (day == 'error') return page.innerHTML = `
    <h2 class="emoji">${emjs.magic}</h2>
    <h2>You have no tasks today!</h2>
  `;
  page.classList.remove('center');
  for (let i = day.tasks.length - 1; i > -1; i--) {
    for (let id in day.tasks[i]) {
      const td = await globals.db.getItem('tasks', id);
      renderTask({type: 'day', globals, td, page, onBodyClick: () => {
        globals.pageInfo = {taskId: td.id};
        globals.paintPage('taskInfo');
      }});
    }
  }
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
    day = {
      date: today.toString(), tasks: [{}, {}, {}], // 3 objects for 3 priorities
      completed: false, lastTasksChange: localStorage.lastTasksChange,
      firstCreation: !day
    };
  } else return day;
  let tasks = await globals.db.getAll('tasks');
  tasks = tasks.filter( (elem) => !elem.disabled && !elem.deleted );
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
  if (isEmpty(day)) return 'error';
  await globals.db.setItem('days', day);
  return day;
}

async function checkLastDay(globals, day) {
  const dayBefore = day - oneDay;
  const check = localStorage.firstDayEver == day.toString()
  ? true
  : await globals.db.getItem('days', dayBefore.toString());
  return { check, dayBefore };
}

function updateTask(task, periods) {
  if (task.special == 'oneTime') {
    if (task.history.length) {
      task.periodDay = -1;
      task.disabled = true;
      setPeriodTitle(task);
    } else if (getToday() == task.periodStart) {
      task.periodDay = 0;
      task.periodTitle = 'Only today';
    }
    return;
  } else if (task.special == 'untilComplete') {
    if (task.history[0] == 1) {
      task.periodDay = -1;
      task.disabled = true;
    } else {
      task.periodDay = 0;
      task.history.length = 0;
    }
    return;
  }
  task.periodTitle = task.ogTitle || (task.periodId && periods[task.periodId].title) || task.periodTitle;
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
