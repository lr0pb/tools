importScripts('./defaultFunctions.js');
importScripts('./sharedFunctions.js');

self.onmessage = async (e) => { // safari never call message event setted via listener
  if (typeof e.data !== 'object') return;
  const d = e.data;
  const { _id } = d;
  if (d.process && d.process in internals) {
    if (!d.args) d.args = [];
    if (!Array.isArray(d.args)) d.args = [d.args];
    const resp = await internals[d.process](...d.args);
    self.postMessage({ _id, data: resp });
  }
};

const internals = {
  backupReminder: checkBackupReminder,
  disable: disableTask,
  createDay, getRawDay,
  updateSession,
};

async function disableTask(taskId) {
  await db.updateItem('tasks', taskId, disable);
  await db.setItem('settings', session);
}

function updateSession(item) { session = item; }
