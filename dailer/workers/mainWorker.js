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
  updateSession, getYesterdayRecap,
};

async function disableTask(taskId) {
  await db.updateItem('tasks', taskId, disable);
  await db.setItem('settings', session);
}

function updateSession(item) { session = item; }

function sortTasks(tasks) {
  const sorted = [];
  for (let i = 0; i < tasks.length; i++) {
    // one loop with filtering, sorting and action with data instead of
    // 3 loops for all this actions
    let td = prevTask || tasks[i]; // td stands for task's data
    if (isBadTask(td)) continue;
    while (isBadTask(tasks[i + 1] || td)) {
      i++;
    }
    const nextTask = tasks[i + 1] || td;
    const resp = sort(td, nextTask);
    if (resp === -1) {
      td = nextTask;
      setPrev(tasks[i], i);
    } else if (resp === 0) {
      td = prevTaskId ? tasks[prevTaskId] : td;
      prevTaskId ? setPrev(tasks[i], i) : setPrev(null, null);
    } else if (resp === 1) {
      td = prevTaskId ? tasks[prevTaskId] : td;
      setPrev(null, null);
    }
    sorted.push(td);
  }
  return sorted;
}
