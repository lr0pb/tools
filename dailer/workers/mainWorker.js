importScripts('./workers/sharedFunctions.js');

const db = new IDB(database.name, database.version, []);

self.onmessage = async (e) => { // safari never call message event setted via listener
  if (typeof e.data !== 'object') return;
  const { _id } = e.data;
  if (e.data.process) {
    const resp = await internals[e.data.process]();
    e.postMessage({ _id, data: resp });
  }
};

const internals = {
  backupReminder: checkBackupReminder,
};

async function checkBackupReminder() {
  const data = await db.getItem('settings', 'backupReminder');
  const resp = { show: false };
  if (!data.remindValue) return resp;
  if (data.nextRemind === getToday() && data.reminded) return resp;
  while (data.nextRemind < getToday()) {
    data.reminded = false;
    data.nextRemind += data.remindValue;
  }
  if (data.nextRemind === getToday()) resp.show = true;
  await db.setItem('settings', data);
  return resp;
};
