importScripts('./defaultFunctions.js');
importScripts('./sharedFunctions.js');

db = new IDB(database.name, database.version, database.stores);

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
  updateSession, getYesterdayRecap, checkNotifications, checkReminderPromo,
};

async function disableTask(taskId) {
  await db.updateItem('tasks', taskId, disable);
  await db.setItem('settings', session);
}

function updateSession(item) { session = item; }

async function checkNotifications() {
  const notifs = await db.getItem('settings', 'notifications');
  let show = false;
  for (let i = 0; i < notifs.showPromoLag.length; i++) {
    if (!notifs.firstPromoDay[i]) notifs.firstPromoDay.push(getToday());
    const lag = (value) => notifs.showPromoLag[value];
    const start = notifs.firstPromoDay[i] + lag(i) * oneDay;
    const end = start + notifs.daysToShowPromo[i] * oneDay;
    if (getToday() >= start && getToday() < end) {
      show = true; break;
    }
    if (!lag(i + 1)) break;
    if (end + lag(i + 1) > getToday()) break;
  }
  await db.setItem('settings', notifs);
  return { show };
}

async function checkReminderPromo() {
  const resp = { show: false };
  const remind = await db.getItem('settings', 'backupReminder');
  if (remind.knowAboutFeature) return resp;
  const session = await db.getItem('settings', 'session');
  if (getToday() < session.firstDayEver + oneDay * remind.dayToStartShowPromo) return resp;
  if (!remind.firstPromoDay) {
    remind.firstPromoDay = getToday();
    await db.setItem('settings', remind);
  }
  if (remind.firstPromoDay + oneDay * remind.daysToShowPromo <= getToday()) return resp;
  resp.show = true;
  return resp;
}
