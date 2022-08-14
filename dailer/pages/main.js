import { isUnder3AM, getToday, oneDay, isCustomPeriod } from './highLevel/periods.js'
import { qs, /*emjs*/ } from './highLevel/utils.js'
import { renderTask, setPeriodTitle } from './highLevel/taskThings.js'
import { downloadData } from './highLevel/createBackup.js'

export const main = {
  get header() { return `${emjs.sword} Today's tasks`},
  styleClasses: 'center doubleColumns',
  get page() { return `
    <h2 class="emoji">${emjs.eyes}</h2>
    <h2>Tasks loading...</h2>
  `},
  get footer() { return `
    <button id="toHistory" class="secondary">${emjs.fileBox} History</button>
    <button id="toPlan" class="secondary">${emjs.notes} Edit tasks</button>
  `},
  script: async ({globals, page}) => {
    qs('#toPlan').addEventListener(
      'click', () => globals.paintPage('planCreator')
    );
    if (dailerData.experiments) {
      globals.pageButton({
        emoji: emjs.star, title: 'Open wishlist', onClick: () => {}
      });
    } else {
      qs('#toHistory').style.display = 'none';
    }
    await renderDay({globals, page});
  },
  onPageShow: updatePage,
  onSettingsUpdate: updatePage
};

async function updatePage({globals, page}) {
  const day = await globals.db.getItem('days', getToday().toString());
  const session = await globals.db.getItem('settings', 'session');
  if (
    !day || day.lastTasksChange != session.lastTasksChange ||
    (globals.pageInfo && globals.pageInfo.backupUploaded)
  ) {
    await renderDay({globals, page});
    delete globals.pageInfo.backupUploaded;
  }
}

async function renderDay({globals, page}) {
  const { day } = await globals.worker.call({ process: 'createDay' });
  if (day == 'error') {
    page.innerHTML = `
      <h2 class="emoji">${emjs.magicBall}</h2>
      <h2>You have no tasks today!</h2>
    `;
    page.classList.add('center');
    await processChecks(globals);
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
  await processChecks(globals);
}

async function processChecks(globals) {
  const existInstallPrompt = await checkInstall(globals);
  if (existInstallPrompt) return;
  const existDayNote = await checkDayNote(globals);
  if (existDayNote) return;
  const existReminder = await checkBackupReminder(globals);
  if (existReminder) return;
  await checkNotifications(globals);
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
  const session = await globals.db.getItem('settings', 'session');
  if (persist === false || !session.installed) {
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
  const resp = await globals.worker.call({ process: 'backupReminder' });
  if (!resp.show) return;
  globals.floatingMsg({
    text: `${emjs.bread} Your data has been backed up`,
    button: 'Download',
    pageName: 'main',
    onClick: async (e) => {
      const data = await globals.db.getItem('settings', 'backupReminder');
      data.reminded = true;
      await globals.db.setItem('settings', data);
      const link = await downloadData(globals);
      e.target.parentElement.remove();
      link.click();
    }
  });
  return true;
}

async function checkNotifications(globals) {
  if (!dailerData.experiments) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  globals.floatingMsg({
    text: `${emjs.bell} Get a daily recap of the tasks through notifications`,
    button: 'Turn&nbsp;on',
    pageName: 'main',
    onClick: async (e) => {
      e.target.parentElement.remove();
      await Notification.requestPermission();
    }
  });
  return true;
}
