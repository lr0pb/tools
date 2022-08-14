import { database } from '../../logic/IDB.js'
import { globQsa as qsa } from './utils.js'

export async function processSettings(globals, periodicSync) {
  const session = await globals.db.getItem('settings', 'session');
  if (session) dailerData.experiments = session.experiments;
  await Promise.all([
    setPeriods(globals),
    addNotifications(globals),
    addPeriodicSync(globals, periodicSync),
    addPersistentStorage(globals),
    addBackupReminder(globals),
    addSession(globals)
  ]);
  await globals.db.onDataUpdate('settings', async (store, item) => {
    if (item.name !== 'session') return;
    await globals.worker.call({ process: 'updateSession', args: item });
  });
}

export function toggleExperiments() {
  if (dailerData.experiments) {
    //document.documentElement.classList.add('compress');
    const color = getComputedStyle(document.documentElement).accentColor;
    for (let elem of qsa('meta[name="theme-color"]')) {
      elem.content = color;
    }
  } else {
    //document.documentElement.classList.remove('compress');
    const metas = qsa('meta[name="theme-color"]');
    metas[0].content = '#f2f2f2';
    metas[1].content = '#000000';
  }
}

async function setPeriods(globals) {
  await globals._setCacheConfig();
  const periods = globals._cachedConfigFile.periods;
  for (let perId in periods) {
    await globals.db.setItem('periods', periods[perId]);
  }
}

async function checkRecord(globals, recordName, updateFields, onVersionUpgrade) {
  const data = await globals.db.getItem('settings', recordName);
  let shouldUpdateRecord = false;
  if (data && updateFields && typeof updateFields == 'object') {
    Object.assign(data, updateFields);
    shouldUpdateRecord = true;
  }
  if (data && data.version !== database.settings[recordName] && onVersionUpgrade) {
    data.version = database.settings[recordName];
    onVersionUpgrade(data);
    shouldUpdateRecord = true;
  }
  if (shouldUpdateRecord) await globals.db.setItem('settings', data);
  return data ? true : false;
}

async function addNotifications(globals) {
  if (!dailerData.experiments) return;
  const isSupported = 'Notification' in window;
  const updateFields = {
    support: isSupported, permission: isSupported ? Notification.permission : null,
  };
  const resp = await checkRecord(globals, 'notifications', updateFields);
  if (resp) return;
  await globals.db.setItem('settings', {
    name: 'notifications',
    support: isSupported,
    permission: isSupported ? Notification.permission : null,
    enabled: true,
    byCategories: {
      tasksForDay: true, backupReminder: true,
    },
    callsHistory: [],
    version: database.settings.notifications
  });
}

async function addPeriodicSync(globals, periodicSync) {
  if (!dailerData.experiments) return;
  const isSupported = periodicSync.support;
  const resp = await checkRecord(globals, 'periodicSync', periodicSync);
  if (resp) return;
  await globals.db.setItem('settings', {
    name: 'periodicSync',
    support: isSupported,
    permission: isSupported ? periodicSync.permission : null,
    callsHistory: [],
    version: database.settings.periodicSync
  });
}

async function addPersistentStorage(globals) {
  const isSupported = ('storage' in navigator) && ('persist' in navigator.storage);
  const resp = await checkRecord(globals, 'persistentStorage', { support: isSupported });
  if (resp) return;
  const isPersisted = await navigator.storage.persisted();
  await globals.db.setItem('settings', {
    name: 'persistentStorage',
    support: isSupported,
    isPersisted,
    attempts: localStorage.persistAttempts ? Number(localStorage.persistAttempts) : 0,
    grantedAt: localStorage.persistGranted ? Number(localStorage.persistGranted) : null,
    version: database.settings.persistentStorage
  });
}

async function addBackupReminder(globals) {
  const resp = await checkRecord(globals, 'backupReminder');
  if (resp) return;
  await globals.db.setItem('settings', {
    name: 'backupReminder',
    remindId: localStorage.remindId,
    remindValue: localStorage.remindValue ? Number(localStorage.remindValue) : null,
    reminded: localStorage.reminded ? (localStorage.reminded == 'true' ? true : false) : false,
    nextRemind: localStorage.nextRemind ? Number(localStorage.nextRemind) : null,
    version: database.settings.backupReminder
  });
}

async function addSession(globals) {
  const defaultLastPeriodId = 50;
  const resp = await checkRecord(globals, 'session');
  if (resp) {
    if (
      window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
    ) await globals.db.updateItem('settings', 'session', (session) => {
      session.installed = true;
    });
    return;
  }
  await globals.db.setItem('settings', {
    name: 'session',
    firstDayEver: localStorage.firstDayEver ? Number(localStorage.firstDayEver) : null,
    lastTasksChange: localStorage.lastTasksChange ? Number(localStorage.lastTasksChange) : null,
    onboarded: localStorage.onboarded ? (localStorage.onboarded == 'true' ? true : false) : false,
    installed: localStorage.installed ? (localStorage.installed == 'true' ? true : false) : false,
    recaped: localStorage.recaped ? Number(localStorage.recaped) : 0,
    periodsList: localStorage.periodsList ? JSON.parse(localStorage.periodsList) : ['01', '03', '07', '09'],
    defaultLastPeriodId,
    lastPeriodId: localStorage.lastPeriodId ? Number(localStorage.lastPeriodId) : defaultLastPeriodId,
    updateTasksList: localStorage.updateTasksList ? JSON.parse(localStorage.updateTasksList) : [],
    experiments: localStorage.experiments ? Number(localStorage.experiments) : 0,
    version: database.settings.session
  });
}
