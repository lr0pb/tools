import { database } from '../../IDB.js'

export async function processSettings(globals, periodicSync) {
  await addNotifications(globals);
  await addPeriodicSync(globals, periodicSync);
  await addBackupReminder(globals);
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
    support: isSupported,
    permission: isSupported ? Notification.permission : null,
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
      tasksForDay: true,
      backupReminder: true,
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
