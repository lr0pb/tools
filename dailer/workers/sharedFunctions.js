let periods = null;
let session = null;

async function createDay(today = getToday()) {
  if (!periods) {
    periods = {};
    await db.getAll('periods', (per) => { periods[per.id] = per; });
  }
  if (!session) session = await db.getItem('settings', 'session');
  if (!session.firstDayEver) session.firstDayEver = today;
  const check = await checkLastDay(today);
  let tasks = null;
  let previousDay = null;
  if (!check.check) {
    const resp = await createDay(check.dayBefore);
    tasks = resp.tasks;
    await afterDayEnded(resp.day);
  }
  let day = await db.getItem('days', today.toString());
  if (!day) {
    const updateList = session.updateTasksList.map((taskId) => new Promise((res) => {
      db.updateItem('tasks', taskId, setPeriodTitle).then(res);
    }));
    await Promise.all(updateList);
    session.updateTasksList = [];
  }
  if (!day || day.lastTasksChange !== session.lastTasksChange) {
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
  const addTask = (task, value) => {
    day.tasks[task.priority][task.id] = value;
    day.tasksAmount++;
  };
  for (let task of tasks) {
    if (task.periodStart <= today) {
      if (day.firstCreation || !task.history.length) {
        updateTask(task);
        if (task.period[task.periodDay]) {
          task.history.push(0);
          addTask(task, 0);
          if (task.special && task.special == 'untilComplete') day.cleared = false;
        }
        await db.setItem('tasks', task);
      } else if (task.period[task.periodDay]) {
        addTask(task, task.history.at(-1));
      }
    }
  }
  await db.setItem('days', day);
  await db.setItem('settings', session);
  return day.tasksAmount === 0 ? { day: 'error', tasks } : { day, tasks };
}

function getRawDay(date, firstCreation) {
  return {
    date: String(date), tasks: [{}, {}, {}], // 3 objects for 3 priorities
    completed: false, lastTasksChange: session.lastTasksChange,
    firstCreation, cleared: true, tasksAmount: 0, completedTasks: 0,
    afterDayEndedProccessed: false
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
/**
* @onTask(id, value, priority) - async function calls for every task in day
*/
async function enumerateDay(day, onTask) {
  for (let i = day.tasks.length - 1; i > -1; i--) {
    const priority = day.tasks[i];
    for (let taskId in priority) {
      await onTask(taskId, priority[taskId], i);
    }
  }
}

async function afterDayEnded(day) {
  if (day.afterDayEndedProccessed) return;
  let completedTasks = 0;
  let tasksAmount = 0;
  const forgottenTasks = [];
  const tasksToDelete = [];
  await enumerateDay(day, async (id, value, priority) => {
    tasksAmount++;
    if (value === 1) completedTasks++;
    else forgottenTasks.push(id);
    if (day.cleared) return;
    const task = await db.getItem('tasks', id);
    if (task.special && task.special == 'untilComplete' && value === 0) {
      tasksToDelete.push({ priority, id });
    }
  });
  for (let adress of tasksToDelete) {
    delete day.tasks[adress.priority][adress.id];
  }
  day.cleared = true;
  day.tasksAmount = tasksAmount;
  day.completedTasks = completedTasks;
  day.afterDayEndedProccessed = true;
  await db.setItem('days', day);
  return forgottenTasks;
}

async function getYesterdayRecap() {
  const session = await db.getItem('settings', 'session');
  if (session.recaped == getToday()) return {
    response: { recaped: true }
  };
  const noShowResp = { response: { show: false } };
  const date = getToday() - oneDay;
  let day = await db.getItem('days', String(date));
  if (!day) {
    const resp = await createDay(date);
    if (resp.day == 'error') return noShowResp;
    day = resp.day;
  }
  let forgottenTasks = null;
  if (day.forgottenTasks) forgottenTasks = day.forgottenTasks;
  if (!day.forgottenTasks || !day.tasksAmount) {
    forgottenTasks = await afterDayEnded(day);
    if (!forgottenTasks) return noShowResp;
    day.forgottenTasks = forgottenTasks;
    await db.setItem('days', day);
  }
  if (day.tasksAmount === 0) return noShowResp;
  const response = {
    show: true, completed: false, count: day.completedTasks, all: day.tasksAmount
  };
  if (day.completedTasks == day.tasksAmount) {
    day.completed = true;
    response.completed = true;
    await db.setItem('days', day);
  }
  return { response, day };
}

async function getDayRecap() {
  const { response: recap } = await getYesterdayRecap();
  if (recap.recaped) {
    const day = await db.getItem('days', getToday().toString());
    if (day.tasksAmount === 0) return;
    let body = day.tasks[2].length === 0 ? null : '';
    if (!body) return;
    await enumerateDay(day, async (id, value, priority) => {
      if (priority !== 2) return;
      if (value === 1) return;
      const task = await db.getItem('tasks', id);
      body += `- ${task.name}\n`;
    });
    body = body.replace(/\n$/, '');
    return { title: `\u{1f5e1} Don't forget about today's important tasks`, body };
  }
  if (!recap.show) return {
    title: '\u{1f5e1} Explore tasks for today',
    body: `You have no tasks yesterday, but its time to add some new ones\nDon't miss the dailer! \u{23f0}`
  };
  return {
    title: '\u{1f4f0} Recap of yesterday',
    body: `${
      recap.completed ? 'You are awesome! Congratulations \u{1f389}\n' : ''
    }You done ${recap.count} out of ${recap.all} tasks${
      !recap.completed
      ? '\nOpen app to mark forgottens and check newly arrived tasks'
      : '\nCan you repeat this result today?'
    }`
  };
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
