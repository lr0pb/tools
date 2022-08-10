import { database } from '../../IDB.js'

export async function processSettings(globals, periodicSync) {
  await addNotifications(globals);
  await addPeriodicSync(globals, periodicSync);
  await addBackupReminder(globals);
}

async function checkRecord(globals, recordName, support) {
  const data = await globals.db.getItem('settings', recordName);
  if (data && 'support' in data && support !== undefined) {
    data.support = support;
  }
  await globals.db.setItem('settings', data);
  return data ? true : false;
}

async function addNotifications(globals) {
  const isSupported = 'Notification' in window;
  const resp = await checkRecord(globals, 'notifications', isSupported);
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
    version: database.settings.notifications
  });
}

async function addPeriodicSync(globals, periodicSync) {
  const isSupported = periodicSync.support;
  const resp = await checkRecord(globals, 'periodicSync', isSupported);
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
  return console.log('set backupReminder');
  await globals.db.setItem('settings', {
    name: 'backupReminder',
    remindId: localStorage.remindId,
    remindValue: localStorage.remindValue ? Number(localStorage.remindValue) : null,
    reminded: localStorage.reminded ? (localStorage.reminded == 'true' ? true : false) : false,
    nextRemind: localStorage.nextRemind ? Number(localStorage.nextRemind) : null,
    version: database.settings.backupReminder
  });
}
