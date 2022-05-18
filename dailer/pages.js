import {
  getToday, convertDate, oneDay, periods
} from './periods.js'

export const qs = (elem) => document.querySelector(elem);

const getLast = (arr) => arr[arr.length - 1];

const onboarding = {
  header: '',
  page: `
    <h2 class="emoji">&#128171;</h2>
    <h2>Create your everyday plan for manage how you grow yourself over time</h2>
  `,
  centerContent: true,
  footer: '<button id="create">&#128203; Create now</button>',
  script: ({globals, page}) => {
    qs('#openSettings').style.display = 'none';
    qs('#create').addEventListener('click', () => {
      localStorage.onboarded = 'true';
      localStorage.periodsList = JSON.stringify(['01', '03', '07', '09']);
      qs('#openSettings').style.display = 'block';
      globals.paintPage('taskCreator');
    });
  }
};

const planCreator = {
  header: '&#128209; Manage your tasks',
  page: ``,
  footer: `
    <button id="addTask">&#128221; Add task</button>
    <button id="toMain" class="success">&#128190; Save</button>
  `,
  script: onPlanCreator
};

async function onPlanCreator({globals, page}) {
  qs('#addTask').addEventListener(
    'click', () => globals.paintPage('taskCreator')
  );
  qs('#toMain').addEventListener(
    'click', () => globals.paintPage('main')
  );
  const tasks = await globals.db.getAll('tasks');
  if (!tasks.length) {
    showNoTasks(page);
  } else for (let td of tasks) { // td stands for task's data
    if (td.deleted) continue;
    renderTask({type: 'edit', globals, td, page});
  }
  if (!page.children.length) {
    showNoTasks(page);
  }
}

function showNoTasks(page) {
  page.classList.add('center');
  page.innerHTML = `
    <h2 class="emoji">&#128495;</h2><h2>There is nothing yet!</h2>
  `;
}

const priorities = [{
  title: 'Can miss sometimes'
}, {
  title: 'Normal',
  selected: true
}, {
  title: 'Extra important'
}];

function renderTask({type, globals, td, page}) {
  const task = document.createElement('div');
  const getTaskInner = () => {
    return type == 'edit' ? `
      <h3>${td.name}</h3>
      <p>${td.periodTitle} | ${priorities[td.priority].title}</p>
    ` : `<h2>${td.name}</h2>`;
  };
  const getTaskButtons = () => {
    return type == 'edit' ? `
      ${td.disabled ? '' : '<button data-action="edit" class="emojiBtn">&#128394;</button>'}
      <button data-action="delete" class="emojiBtn">&#128465;</button>
    ` : `
      <button data-action="complete" class="emojiBtn">${getTaskComplete(td)}</button>
     `;
  };
  task.className = 'task';
  task.dataset.id = td.id;
  task.innerHTML = `<div>${getTaskInner()}</div> ${getTaskButtons()}`;
  task.addEventListener('click', (e) => {
    const args = {e, globals, task, page};
    type == 'edit' ? onTaskManageClick(args) : onTaskCompleteClick(args);
  })
  page.append(task);
}

async function onTaskManageClick({ e, globals, task, page }) {
  if (e.target.dataset.action == 'edit') {
    globals.pageInfo = {
      taskAction: 'edit',
      taskId: task.dataset.id
    };
    globals.paintPage('taskCreator');
  } else if (e.target.dataset.action == 'delete') {
    //await globals.db.deleteItem('tasks', this.dataset.id);
    const td = await globals.db.getItem('tasks', task.dataset.id);
    td.deleted = true;
    await globals.db.setItem('tasks', td);
    localStorage.lastTasksChange = Date.now().toString();
    task.remove();
    globals.message({
      state: 'success', text: 'Task deleted'
    });
    if (!page.children.length) {
      showNoTasks(page);
    }
  } else return;
}

const taskCreator = {
  header: '&#128221; <span id="taskAction">Add</span> task',
  page: `
    <h3>Enter task you will control</h3>
    <input type="text" id="name" placeHolder="Task name"></input>
    <h3>How important this task?</h3>
    <select id="priority"></select>
    <h3>How often you will do this task?</h3>
    <select id="period"></select>
    <h3 id="dateTitle"></h3>
    <input type="date" id="date"></input>
    <h3 id="description"></h3>
  `,
  footer: `
    <button id="toPlan" class="secondary">&#9194; Back</button>
    <button id="saveTask">&#128190; Save task</button>
  `,
  script: onTaskCreator,
  onSettingsUpdate: async (globals) => {
    const periodsList = await getPeriods(globals);
    createOptionsList(qs('#period'), periodsList);
  }
};

async function getPeriods(globals) {
  const customs = await globals.getAll('periods');
  for (let per of customs) {
    periods[per.id] = per;
  }
  const list = JSON.parse(localStorage.periodsList);
  const periodsList = [];
  for (let per of list) {
    periodsList.push(periods[per]);
  }
  periodsList.push({
    id: '00',
    title: 'Other period'
  });
  return periodsList;
}

async function onTaskCreator({globals}) {
  qs('#toPlan').addEventListener(
    'click', () => globals.paintPage('planCreator')
  );
  createOptionsList(qs('#priority'), priorities);
  await taskCreator.onSettingsUpdate(globals);
  qs('#period').addEventListener('change', (e) => onPeriodChange(e, globals));
  qs('#date').min = convertDate(Date.now());
  let td = null;
  if (globals.pageInfo && globals.pageInfo.taskAction == 'edit') {
    td = await enterEditTaskMode(globals);
  }
  qs('#saveTask').addEventListener('click', () => {
    const task = createTask(td);
    if (task == 'error') return globals.message({
      state: 'fail', text: 'Fill all fields'
    });
    localStorage.lastTasksChange = Date.now().toString();
    globals.db.setItem('tasks', task);
    globals.message({
      state: 'success', text: 'Task added'
    });
    globals.paintPage('planCreator');
  });
}

async function enterEditTaskMode(globals) {
  const td = await globals.db.getItem('tasks', globals.pageInfo.taskId);
  qs('#taskAction').innerHTML = 'Edit';
  qs('#name').value = td.name;
  qs('#name').disabled = 'disabled';
  qs('#priority').value = td.priority;
  qs('#period').value = td.ogTitle || td.periodTitle;
  qs('#period').disabled = 'disabled';
  qs('#date').value = convertDate(td.periodStart);
  if (td.startDate > getToday() && periods[td.periodId].selectTitle) {
    qs('#dateTitle').innerHTML = periods[td.periodId].selectTitle;
    qs('#dateTitle').style.display = 'block';
    qs('#date').max = periods[td.periodId].maxDate;
    qs('#date').style.display = 'block';
  }
  if (!td.periodId) setPeriodId(td);
  return td;
}

function setPeriodId(task) {
  for (let per in periods) {
    if (per.title == task.periodTitle || per.title == task.ogTitle) {
      task.periodId = per.id;
      delete task.ogTitle;
      break;
    }
  }
}

function createOptionsList(elem, options) {
  elem.innerHTML = '';
  for (let i = 0; i < options.length; i++) {
    const opt = document.createElement('option');
    opt.value = options[i].id || i;
    opt.textContent = options[i].title;
    if (options[i].selected) opt.selected = 'selected';
    elem.append(opt);
  }
}

function onPeriodChange(e, globals) {
  const value = Number(e.target.value);
  if (value == '00') {
    return globals.openSettings();
  }
  const date = qs('#date');
  date.value = '';
  date.removeAttribute('max');
  date.style.display = 'none';
  qs('#dateTitle').style.display = 'none';
  qs('#description').style.display = 'none';
  if (periods[value].selectTitle) {
    qs('#dateTitle').innerHTML = periods[value].selectTitle;
    qs('#dateTitle').style.display = 'block';
    date.style.display = 'block';
    if (periods[value].startDate) {
      date.value = convertDate(periods[value].startDate);
    }
    if (periods[value].maxDate) {
      date.max = convertDate(periods[value].maxDate);
    }
  } else if (periods[value].description) {
    qs('#description').innerHTML = periods[value].description;
    qs('#description').style.display = 'block';
  }
}

function createTask(td = {}) {
  const value = Number(qs('#period').value);
  const priority = Number(qs('#priority').value);
  const task = {
    id: td.id || Date.now().toString(),
    name: qs('#name').value,
    priority,
    period: td.period || periods[value].days,
    periodId: td.periodId || td.ogTitle || periods[value].id,
    periodTitle: td.periodTitle || periods[value].title,
    periodStart: td.periodStart && td.periodStart <= getToday()
    ? td.periodStart
    : periods[td.periodId].selectTitle || periods[value].selectTitle
    ? new Date(qs('#date').value).getTime()
    : td.periodStart || periods[value].startDate,
    periodDay: td.periodDay || periods[value].periodDay,
    history: td.history || [],
    disabled: false,
    deleted: false
  };
  if (periods[value].special) {
    task.special = periods[value].special;
  }
  setPeriodTitle(task);
  console.log(task);
  if (
    task.name == '' || isNaN(task.periodStart)
  ) return 'error';
  return task;
}

function setPeriodTitle(task) {
  const date = new Date(task.periodStart);
  task.periodStart = date.setHours(0, 0, 0, 0);
  let startTitle = date.toLocaleDateString(navigator.language);
  if (task.periodStart == getToday()) startTitle = 'today';
  if (task.periodStart - oneDay == getToday()) startTitle = 'tomorrow';
  
  if (task.special == 'oneTime') {
    task.periodTitle = `Only ${startTitle}`;
  } else if (task.periodStart > getToday()) {
    task.periodTitle += ` from ${startTitle}`;
  }
}

const main = {
  header: `&#128481; Today's tasks`,
  centerContent: true,
  page: ``,
  footer: `
    <!--<button id="toHistory" class="secondary">&#128198; History</button>-->
    <button id="toPlan" class="secondary">&#128230; Edit tasks</button>
  `,
  script: mainScript
};

async function mainScript({globals, page}) {
  qs('#toPlan').addEventListener(
    'click', () => globals.paintPage('planCreator')
  );
  const day = await createDay(globals);
  if (day == 'error') return page.innerHTML = `
    <h2 class="emoji">&#128302;</h2>
    <h2>You have no tasks today!</h2>
  `;
  page.classList.remove('center');
  for (let i = day.tasks.length - 1; i > -1; i--) {
    for (let id in day.tasks[i]) {
      const td = await globals.db.getItem('tasks', id);
      renderTask({type: 'day', globals, td, page});
    }
  }
}

async function onTaskCompleteClick({ e, globals, task, page }) {
  if (e.target.dataset.action == 'complete') {
    const td = await globals.db.getItem('tasks', task.dataset.id);
    const day = await globals.db.getItem('days', getToday().toString());
    const value = getLast(td.history) == 1 ? 0 : 1;
    td.history.pop();
    td.history.push(value);
    day.tasks[td.priority][td.id] = value;
    await globals.db.setItem('tasks', td);
    await globals.db.setItem('days', day);
    e.target.innerHTML = getTaskComplete(td);
  } else return;
}

function getTaskComplete(td) {
  return getLast(td.history) ? '&#9989;' : '&#11036;';
}

async function createDay(globals, today = getToday()) {
  if (!localStorage.firstDayEver) {
    localStorage.firstDayEver = today.toString();
  }
  const check = await checkLastDay(globals, today);
  if (!check.check) {
    await createDay(globals, check.dayBefore);
  }
  let day = await globals.db.getItem('days', today.toString());
  if (!day || day.lastTasksChange != localStorage.lastTasksChange) {
    day = {
      date: today.toString(), tasks: [{}, {}, {}], // 3 objects for 3 priorities
      completed: false, lastTasksChange: localStorage.lastTasksChange,
      firstCreation: !day
    };
  } else return day;
  let tasks = await globals.db.getAll('tasks');
  tasks = tasks.filter( (elem) => !elem.disabled && !elem.deleted );
  for (let task of tasks) {
    if (task.periodStart <= today) {
      if (day.firstCreation || !task.history.length) {
        updateTask(task);
        if (task.period[task.periodDay]) {
          task.history.push(0);
          day.tasks[task.priority][task.id] = 0;
        }
        await globals.db.setItem('tasks', task);
      } else {
        day.tasks[task.priority][task.id] = getLast(task.history);
      }
    }
  }
  if (isEmpty(day)) return 'error';
  await globals.db.setItem('days', day);
  return day;
}

async function checkLastDay(globals, day) {
  const dayBefore = day - oneDay;
  const check = localStorage.firstDayEver == day.toString()
  ? true
  : await globals.db.getItem('days', dayBefore.toString());
  return { check, dayBefore };
}

function updateTask(task) {
  if (task.special == 'oneTime') {
    if (task.history.length) {
      task.periodDay = -1;
      task.periodTitle = `Only ${convertDate(task.periodStart)}`;
      task.disabled = true;
    } else if (getToday() == task.periodStart) {
      task.periodDay = 0;
      task.periodTitle = 'Only today';
    }
    return;
  } else if (task.special == 'untilComplete') {
    if (task.history[0] == 1) {
      task.periodDay = -1;
      task.disabled = true;
    } else {
      task.periodDay = 0;
      task.history.length = 0;
    }
    return;
  }
  task.periodTitle = task.ogTitle || periods[task.periodId].title;
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

const settings = {
  paint: ({globals, page}) => {
    page.innerHTML = '<h2>Settings will be available soon</h2>';
  }
};

export const pages = {
  onboarding, main, settings, planCreator, taskCreator
};
