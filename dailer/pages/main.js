import { isUnder3AM, getToday, oneDay, isCustomPeriod } from './highLevel/periods.js'
import { qs, /*emjs*/ } from './highLevel/utils.js'
import { renderTask, disable, setPeriodTitle } from './highLevel/taskThings.js'
import { downloadData } from './settings.js'

export const main = {
  get header() { return `${emjs.sword} Today's tasks`},
  styleClasses: 'center doubleColumns',
  get page() { return `
    <h2 class="emoji">${emjs.eyes}</h2>
    <h2>Tasks loading...</h2>
  `},
  get footer() { return `
    <!--<button id="toHistory" class="secondary">${emjs.fileBox} History</button>-->
    <button id="toPlan" class="secondary">${emjs.notes} Edit tasks</button>
  `},
  script: async ({globals, page}) => {
    qs('#toPlan').addEventListener(
      'click', () => globals.paintPage('planCreator')
    );
    if (dailerData.experiments) globals.pageButton({
      emoji: emjs.star, title: 'Open wishlist',
      onClick: () => globals.message({
        state: 'success', text: 'There are will be wishlist page that currently in development'
      })
    });
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
  const { day } = await createDay(globals, periods);
  if (day == 'error') {
    page.innerHTML = `
      <h2 class="emoji">${emjs.magicBall}</h2>
      <h2>You have no tasks today!</h2>
    `;
    page.classList.add('center');
    await checkInstall(globals);
    return;
  }
  page.classList.remove('center');
  page.innerHTML = '';
  for (let i = day.tasks.length - 1; i > -1; i--) {
    const tasks = day.tasks[i];
    for (let id in tasks) {
      const td = await globals.db.getItem('tasks', id);
      renderTask({type: 'day', globals, td, page, onBodyClick: ({elem}) => {
        globals.pageInfo = { taskId: elem.dataset.id };
        globals.paintPage('taskInfo');
      }});
    }
  }
  const existInstallPrompt = await checkInstall(globals);
  if (existInstallPrompt) return;
  const existDayNote = await checkDayNote(globals);
  if (existDayNote) return;
  await checkBackupReminder(globals);
}

async function createDay(globals, periods, today = getToday()) {
  if (!localStorage.firstDayEver) {
    localStorage.firstDayEver = today.toString();
  }
  const check = await checkLastDay(globals, today);
  let tasks = null;
  if (!check.check) {
    const resp = await createDay(globals, periods, check.dayBefore);
    tasks = resp.tasks;
    delete resp.day;
  }
  let day = await globals.db.getItem('days', today.toString());
  if (!day) {
    const updateList = JSON.parse(localStorage.updateTasksList);
    for (let taskId of updateList) {
      const task = await globals.db.getItem('tasks', taskId);
      setPeriodTitle(task);
      await globals.db.setItem('tasks', task);
    }
    localStorage.updateTasksList = JSON.stringify([]);
  }
  if (!day || day.lastTasksChange != localStorage.lastTasksChange) {
    day = getRawDay(today.toString(), !day);
  } else {
    return isEmpty(day) ? { day: 'error' } : { day };
  }
  if (!tasks) {
    tasks = [];
    await globals.db.getAll('tasks', (task) => {
      if (task.disabled || task.deleted ? false : true) tasks.push(task);
    });
  }
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
        day.tasks[task.priority][task.id] = task.history.at(-1);
      }
    }
  }
  await globals.db.setItem('days', day);
  return isEmpty(day) ? { day: 'error' } : { day, tasks };
}

export function getRawDay(date, firstCreation) {
  return {
    date: String(date), tasks: [{}, {}, {}], // 3 objects for 3 priorities
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

function setDefaultPeriodTitle(task, periods) {
  task.periodTitle = isCustomPeriod(task.periodId)
  ? ''
  : (task.periodId && periods[task.periodId].title) || task.ogTitle || task.periodTitle;
}

function updateTask(task, periods) {
  if (task.special == 'oneTime') {
    if (task.history.length == task.period.length) {
      disable(task);
    } else if (getToday() == task.periodStart) {
      task.periodDay = 0;
      setDefaultPeriodTitle(task, periods);
      setPeriodTitle(task);
    } else {
      task.periodDay++;
    }
    return;
  } else if (task.special == 'untilComplete') {
    if (task.history[0] == 1) {
      task.endDate = getToday() - oneDay; disable(task);
    } else {
      task.periodDay = 0; task.history.length = 0;
      setPeriodTitle(task);
    }
    return;
  }
  setDefaultPeriodTitle(task, periods);
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

async function checkDayNote(globals) {
  if (!isUnder3AM()) return;
  globals.floatingMsg({
    text: `${emjs.alarmClock} Tasks for new day will arrive at 3:00 AM`,
    onClick: async (e) => { e.target.parentElement.remove(); },
    button: 'Okay', pageName: 'main'
  });
  return true;
}

export async function checkInstall(globals) {
  if (navigator.standalone === undefined && !globals.installPrompt) return;
  const persist = await globals.checkPersist();
  if (persist === false || localStorage.installed !== 'true') {
    if (persist && dailerData.isDesktop) return;
    globals.floatingMsg({
      text: `${emjs.crateDown} To protect your data, install dailer app on your home screen${
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
    return true;
  }
}

async function checkBackupReminder(globals) {
  if (!localStorage.remindValue) return;
  let nextRemind = Number(localStorage.nextRemind);
  if (nextRemind === getToday() && localStorage.reminded === 'true') return;
  while (nextRemind < getToday()) {
    localStorage.reminded = 'false';
    nextRemind += Number(localStorage.remindValue);
  }
  localStorage.nextRemind = nextRemind;
  if (nextRemind !== getToday()) return;
  globals.floatingMsg({
    text: `${emjs.bread} Your data has been backed up`,
    button: 'Download',
    pageName: 'main',
    onClick: async (e) => {
      const link = await downloadData(globals);
      localStorage.reminded = 'true';
      e.target.parentElement.remove();
      link.click();
    }
  });
}
