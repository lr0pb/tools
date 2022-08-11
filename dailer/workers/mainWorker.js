importScripts('./defaultFunctions.js');
importScripts('./sharedFunctions.js');

self.onmessage = async (e) => { // safari never call message event setted via listener
  if (typeof e.data !== 'object') return;
  const { _id } = e.data;
  if (e.data.process) {
    const resp = await internals[e.data.process]();
    self.postMessage({ _id, data: resp });
  }
};

const internals = {
  backupReminder: checkBackupReminder,
};
