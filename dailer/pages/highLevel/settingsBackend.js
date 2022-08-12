import { database } from '../../IDB.js'

export async function processSettings(globals, periodicSync) {
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
  const isSupported = 'Notification' in window;
  const updateFields = {
    support: isSupported, permission: isSupported ? Notification.permission : null,
  };
  const resp = await checkRecord(globals, 'notifications', updateFields, (data) => {
    if (!data.callsHistory) data.callsHistory = [];
  });
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
  await globals.db.setItem('settings', {
    name: 'persistentStorage',
    support: isSupported,
    isPersisted: await navigator.storage.persisted(),
    attempts: localStorage.persistAttempts ? Number(persistAttempts) : 0,
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
    periodsList: localStorage.periodsList ? JSON.parse(localStorage.periodsList) : [],
    updateTasksList: localStorage.updateTasksList ? JSON.parse(localStorage.updateTasksList) : [],
    version: database.settings.session
  });
}
