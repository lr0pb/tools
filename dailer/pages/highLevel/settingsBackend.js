import { database } from './../IDB.js'

export async function processSettings(globals) {
  await addNotifications(globals);
}

async function checkRecord(globals, recordName) {
  const data = await globals.db.getItem('settings', recordName);
  return data ? true : false;
}

async function addNotifications(globals) {
  const resp = await checkRecord(globals, 'notifications');
  if (resp) return;
  return console.log('set notifications');
  await globals.db.setItem('settings', {
    name: 'notifications',
    permission: Notification.permission,
    enabled: false,
    byCategories: {
      tasksForDay: true,
      backupReminder: true,
    },
    version: database.settings.notifications
  });
}

async function addBackupReminder(globals) {
  const resp = await checkRecord(globals, 'backupReminder');
  if (resp) return;
  return console.log('set backupReminder');
  await globals.db.setItem('settings', {
    name: 'backupReminder',
    remindId: null,
    remindValue: null,
    reminded: false,
    nextRemind: null,
    version: database.settings.backupReminder
  });
}
