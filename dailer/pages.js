const qs = (elem) => document.querySelector(elem);

const getLast = (arr) => arr[arr.length - 1];

const getToday = () => { // date in milliseconds
  return new Date().setHours(0, 0, 0, 0);
};

const convertDate = (date) => {
  return new Date(date).toLocaleDateString('en-ca');
};

const oneDay = 86400000; // 86 400 000 milliseconds in one day

const onboarding = {
  header: '',
  page: `
    <h2 class="emoji">&#128171;</h2>
    <h2>Create your everyday plan for manage how you grow yourself over time</h2>
  `,
  centerContent: true,
  footer: '<button id="create">&#128203; Create now</button>',
  script: (globals) => {
    qs('#create').addEventListener('click', () => {
      localStorage.onboarded = 'true';
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

async function onPlanCreator(globals) {
  qs('#addTask').addEventListener(
    'click', () => globals.paintPage('taskCreator')
  );
  qs('#toMain').addEventListener(
    'click', () => globals.paintPage('main')
  );
  const tasks = await globals.db.getAll('tasks');
  const tasksContainer = qs('#content');
  if (!tasks.length) {
    showNoTasks(tasksContainer);
  } else for (let td of tasks) { // td stands for task's data
    if (td.deleted) continue;
    renderTask({type: 'edit', globals, td, tasksContainer});
  }
  if (!tasksContainer.children.length) {
    showNoTasks(tasksContainer);
  }
}

function showNoTasks(elem) {
  elem.classList.add('center');
  elem.innerHTML = `
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

function renderTask({type, globals, td, tasksContainer}) {
  const task = document.createElement('div');
  const getTaskInner = () => {
    return type == 'edit' ? `
      <h3>${td.name}</h3>
      <p>${td.periodTitle} | ${priorities[td.priority].title}</p>
    ` : `<h2>${td.name}</h2>`;
  };
  const getTaskButtons = () => {
    return type == 'edit' ? `
      <button data-action="edit" class="emojiBtn">&#128394;</button>
      <button data-action="delete" class="emojiBtn">&#128465;</button>
    ` : `
      <button data-action="complete" class="emojiBtn">${getTaskComplete(td)}</button>
     `;
  };
  task.className = 'task';
  task.dataset.id = td.id;
  task.innerHTML = `<div>${getTaskInner()}</div> ${getTaskButtons()}`;
  task.addEventListener('click', (e) => {
    const args = {e, globals, task, tasksContainer};
    type == 'edit' ? onTaskManageClick(args) : onTaskCompleteClick(args);
  })
  tasksContainer.append(task);
}

async function onTaskManageClick({ e, globals, task, tasksContainer }) {
  if (e.target.dataset.action == 'edit') {
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
    if (!tasksContainer.children.length) {
      showNoTasks(tasksContainer);
    }
  } else return;
}

const taskCreator = {
  header: '&#128221; Add task',
  page: `
    <h3>Enter task you will control</h3>
    <input type="text" id="name" placeHolder="Task name"></input>
    <h3>How important this task?</h3>
    <select id="priority"></select>
    <h3>How often you will do this task?</h3>
    <select id="period"></select>
    <h3 id="dateTitle"></h3>
    <input type="date" id="date"></input>
    <h3>Choose custom period will be available later</h3>
  `,
  footer: `
    <button id="toPlan" class="secondary">Back</button>
    <button id="saveTask">&#128190; Save task</button>
  `,
  script: onSaveTask
};

const periods = [{
  title: 'Today only',
  days: [1],
  get startDate() { return getToday(); },
  periodDay: -1,
  special: 'oneTime',
  selected: true
}, {
  title: 'Tomorrow',
  days: [1],
  get startDate() { return getToday() + oneDay; },
  periodDay: -1,
  special: 'oneTime'
}, {
  title: 'Everyday',
  days: [1],
  get startDate() { return getToday(); },
  selectTitle: 'Select day to start',
  periodDay: -1,
  get maxDate() { return getToday() + oneDay * 6; }
}, {
  title: 'Every second day',
  days: [1, 0],
  selectTitle: 'Select day to start',
  periodDay: -1,
  get maxDate() { return getToday() + oneDay * 13; }
}, {
  title: 'Two over two',
  days: [1, 1, 0, 0],
  selectTitle: 'Select day to start',
  periodDay: -1,
  get maxDate() { return getToday() + oneDay * 13; }
}, {
  title: 'On weekdays',
  days: [0, 1, 1, 1, 1, 1, 0],
  get startDate() { return getWeekStart(); },
  get periodDay() { return new Date().getDay() - 1; }
}, {
  title: 'Only weekends',
  days: [1, 0, 0, 0, 0, 0, 1],
  get startDate() { return getWeekStart(); },
  get periodDay() { return new Date().getDay() - 1; }
}, {
  title: 'One time only',
  days: [1],
  selectTitle: 'Select the day',
  periodDay: -1,
  special: 'oneTime'
}, {
  title: 'One time until complete',
  days: [1],
  get startDate() { return getToday(); },
  selectTitle: 'Task will be active unlimited time until you complete them',
  periodDay: -1,
  get maxDate() { return getToday(); },
  special: 'untilComplete'
}];

function getWeekStart() {  // date in milliseconds
  const day = new Date(getToday());
  return day.setDate(day.getDate() - day.getDay());
}

function onSaveTask(globals) {
  qs('#toPlan').addEventListener(
    'click', () => globals.paintPage('planCreator')
  );
  createOptionsList(qs('#priority'), priorities);
  createOptionsList(qs('#period'), periods);
  qs('#period').addEventListener('change', onPeriodChange);
  qs('#date').min = convertDate(Date.now());
  qs('#saveTask').addEventListener('click', () => {
    const task = createTask();
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

function createOptionsList(elem, options) {
  for (let i = 0; i < options.length; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = options[i].title;
    if (options[i].selected) opt.selected = 'selected';
    elem.append(opt);
  }
}

function onPeriodChange(e) {
  const value = Number(e.target.value);
  const date = qs('#date');
  date.value = '';
  date.removeAttribute('max');
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
  } else {
    qs('#dateTitle').style.display = 'none';
    date.style.display = 'none';
  }
}

function createTask(id) {
  const value = Number(qs('#period').value);
  const priority = Number(qs('#priority').value);
  const task = {
    id: id ? id : Date.now().toString(),
    name: qs('#name').value,
    priority,
    period: periods[value].days,
    ogTitle: periods[value].title,
    periodTitle: periods[value].title,
    periodStart: periods[value].selectTitle
    ? new Date(qs('#date').value).getTime()
    : periods[value].startDate,
    periodDay: periods[value].periodDay,
    history: [],
    disabled: false,
    deleted: false
  };
  if (periods[value].special) {
    task.special = periods[value].special;
  }
  const date = new Date(task.periodStart);
  task.periodStart = date.setHours(0, 0, 0, 0);
  let startTitle = date.toLocaleDateString(navigator.language);
  if (task.periodStart == getToday()) startTitle = 'today';
  if (task.periodStart - oneDay == getToday()) startTitle = 'tomorrow';
  
  if (task.special == 'oneTime') {
    task.periodTitle = `Only ${startTitle}`;
  } else if (task.periodStart > getToday() && task.ogTitle != periods[1].title) {
    task.periodTitle += ` from ${startTitle}`;
  }
  console.log(task);
  if (
    task.name == '' || isNaN(task.periodStart)
  ) return 'error';
  return task;
}

const main = {
  header: `&#128481; Today's tasks`,
  centerContent: true,
  page: ``,
  footer: '<button id="toPlan" class="secondary">&#128230; Edit tasks</button>',
  script: mainScript
};

async function mainScript(globals) {
  qs('#toPlan').addEventListener(
    'click', () => globals.paintPage('planCreator')
  );
  const day = await createDay(globals);
  const tasksContainer = qs('#content');
  if (day == 'error') return tasksContainer.innerHTML = `
    <h2 class="emoji">&#128302;</h2>
    <h2>You have no tasks today!</h2>
  `;
  tasksContainer.classList.remove('center');
  for (let i = day.tasks.length - 1; i > -1; i--) {
    for (let id in day.tasks[i]) {
      const td = await globals.db.getItem('tasks', id);
      renderTask({type: 'day', globals, td, tasksContainer});
    }
  }
}

async function onTaskCompleteClick({ e, globals, task, tasksContainer }) {
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
      task.disabled = true;
    } else if (getToday() == task.periodStart) {
      task.periodDay = 0;
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
  if (task.ogTitle) {
    task.periodTitle = task.ogTitle;
    delete task.ogTitle;
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

export const pages = {
  onboarding, main, planCreator, taskCreator
};
