let periods = null;
let session = null;

async function createDay(today = getToday()) {
  if (!periods) periods = await db.getAll('periods');
  if (!session) session = await db.getItem('settings', 'session');
  if (!session.firstDayEver) session.firstDayEver = today;
  const check = await checkLastDay(today);
  let tasks = null;
  if (!check.check) {
    const resp = await createDay(check.dayBefore);
    tasks = resp.tasks;
    delete resp.day;
  }
  let day = await db.getItem('days', today.toString());
  if (!day) {
    const updateList = session.updateTasksList.map((taskId) => new Promise((res) => {
      db.updateItem('tasks', taskId, setPeriodTitle).then(res);
    }));
    await Promise.all(updateList);
    session.updateTasksList = [];
  }
  if (!day || day.lastTasksChange != session.lastTasksChange) {
    day = getRawDay(today, !day);
  } else {
    return isEmpty(day) ? { day: 'error' } : { day };
  }
  if (!tasks) {
    tasks = [];
    await db.getAll('tasks', (task) => {
      if (task.disabled || task.deleted ? false : true) tasks.push(task);
    });
  }
  for (let task of tasks) {
    if (task.periodStart <= today) {
      if (day.firstCreation || !task.history.length) {
        updateTask(task);
        if (task.period[task.periodDay]) {
          task.history.push(0);
          day.tasks[task.priority][task.id] = 0;
        }
        await db.setItem('tasks', task);
      } else if (task.period[task.periodDay]) {
        day.tasks[task.priority][task.id] = task.history.at(-1);
      }
    }
  }
  await db.setItem('days', day);
  await db.setItem('settings', session);
  return isEmpty(day) ? { day: 'error', tasks } : { day, tasks };
}

function getRawDay(date, firstCreation) {
  return {
    date: String(date), tasks: [{}, {}, {}], // 3 objects for 3 priorities
    completed: false, lastTasksChange: session.lastTasksChange,
    firstCreation
  };
}

async function checkLastDay(day) {
  const dayBefore = day - oneDay;
  const check = session.firstDayEver == day
  ? true
  : await db.getItem('days', dayBefore.toString());
  return { check, dayBefore };
}

function setDefaultPeriodTitle(task) {
  task.periodTitle = isCustomPeriod(task.periodId)
  ? ''
  : (task.periodId && periods[task.periodId].title) || task.ogTitle || task.periodTitle;
}

function disable(task) {
  task.periodDay = -1;
  task.disabled = true;
  session.updateTasksList.push(task.id);
  setPeriodTitle(task);
}

function updateTask(task) {
  if (task.special == 'oneTime') {
    if (task.history.length == task.period.length) {
      disable(task);
    } else if (getToday() == task.periodStart) {
      task.periodDay = 0;
      setDefaultPeriodTitle(task, periods);
      setPeriodTitle(task);
    } else {
      task.periodDay++;
    }
    return;
  } else if (task.special == 'untilComplete') {
    if (task.history[0] == 1) {
      task.endDate = getToday() - oneDay; disable(task);
    } else {
      task.periodDay = 0; task.history.length = 0;
      setPeriodTitle(task);
    }
    return;
  }
  setDefaultPeriodTitle(task, periods);
  if (task.endDate && task.endDate == getToday()) {
    disable(task);
  }
  task.periodDay++;
  if (task.periodDay == task.period.length) {
    task.periodDay = 0;
  }
}

function isEmpty(day) {
  for (let tasks of day.tasks) {
    if (Object.keys(tasks).length > 0) return false;
  }
  return true;
}

async function getDayRecap() {
  const day = await db.getItem('days', getToday().toString());
  let body = 'There are no tasks yet :(\n';
  let isBodyStringChanged = false;
  if (day) for (let i = day.tasks.length - 1; i > -1; i--) {
    const priority = day.tasks[i];
    for (let taskId in priority) {
      if (priority[taskId]) continue;
      const task = await db.getItem('tasks', taskId);
      if (!isBodyStringChanged) {
        body = '';
        isBodyStringChanged = true;
      }
      body += `- ${task.name}\n`
    }
  }
  body = body.replace(/\\n$/, '');
  return { body };
}

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
