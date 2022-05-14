import { dates } from './dates.js'

const qs = (elem) => document.querySelector(elem);

const getLast = (arr) => arr[arr.length - 1];

const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

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

function renderTask({type, globals, td, tasksContainer}) {
  const task = document.createElement('div');
  const getTaskInner = () => {
    return type == 'edit' ? `
      <h3>${td.name}</h3>
      <p>${td.periodTitle} | ${td.priorityTitle}</p>
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
    <h3>Choose custom period will be available later</h3>
    <h3 id="dateTitle"></h3>
    <input type="date" id="date"></input>
  `,
  footer: `
    <button id="toPlan" class="secondary">Back</button>
    <button id="saveTask">&#128190; Save task</button>
  `,
  script: onSaveTask
};

const priorities = [{
  title: 'Can miss sometimes'
}, {
  title: 'Normal',
  selected: true
}, {
  title: 'Extra important'
}];

const periods = [{
  title: 'Everyday',
  days: [1],
  get startDate() { return getToday(); },
  periodDay: 0,
  selected: true
},/* {
  title: 'Every second day',
  days: [1, 0],
  selectTitle: 'Select start date'
}, {
  title: 'Two over two',
  days: [1, 1, 0, 0],
  selectTitle: 'Select start date'
},*/ {
  title: 'On weekdays',
  days: [0, 1, 1, 1, 1, 1, 0],
  get startDate() { return getWeekStart(); },
  get periodDay() { return new Date().getDay(); }
}, {
  title: 'Only weekends',
  days: [1, 0, 0, 0, 0, 0, 1],
  get startDate() { return getWeekStart(); },
  get periodDay() { return new Date().getDay(); }
}, {
  title: 'One time only',
  days: [1],
  selectTitle: 'Select the day',
  special: 'oneTime',
  periodDay: -1
}];

function getWeekStart() {
  const day = getToday();
  day.setDate(day.getDate() - day.getDay());
  return day;
}

function onSaveTask(globals) {
  qs('#toPlan').addEventListener(
    'click', () => globals.paintPage('planCreator')
  );
  createOptionsList(qs('#priority'), priorities);
  createOptionsList(qs('#period'), periods);
  qs('#period').addEventListener('change', onPeriodChange);
  qs('#date').min = new Date().toLocaleDateString('en-ca');
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
  if (periods[value].selectTitle) {
    qs('#dateTitle').innerHTML = periods[value].selectTitle;
    qs('#dateTitle').style.display = 'block';
    qs('#date').style.display = 'block';
  } else {
    qs('#dateTitle').style.display = 'none';
    qs('#date').style.display = 'none';
  }
}

function createTask(id) {
  const value = Number(qs('#period').value);
  const priority = Number(qs('#priority').value);
  const task = {
    id: id ? id : Date.now().toString(),
    name: qs('#name').value,
    priority,
    priorityTitle: priorities[priority].title,
    period: periods[value].days,
    periodTitle: periods[value].title,
    periodStart: periods[value].selectTitle
    ? new Date(qs('#date').value)
    : periods[value].startDate,
    periodDay: periods[value].periodDay,
    history: [],
    disabled: false,
    deleted: false
  };
  if (periods[value].special) {
    task[periods[value].special] = true;
  }
  console.log(task);
  if (
    task.name == '' ||
    task.periodStart.toString() == 'Invalid Date'
  ) return 'error';
  return task;
}

const main = {
  header: `&#128481; Today's tasks`,
  centerContent: true,
  page: `
    <h2 class="emoji">&#128302;</h2>
    <h2>You have no tasks today!</h2>
  `,
  footer: '<button id="toPlan" class="secondary">&#128230; Edit tasks</button>',
  script: mainScript
};

async function mainScript(globals) {
  qs('#toPlan').addEventListener(
    'click', () => globals.paintPage('planCreator')
  );
  const day = await createDay(globals);
  if (day == 'error') return;
  const tasksContainer = qs('#content');
  tasksContainer.innerHTML = '';
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
    const value = !getLast(td.history);
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

async function createDay(globals) {
  const today = getToday();
  let day = await globals.db.getItem('days', today.toString());
  if (!day || day.lastTasksChange != localStorage.lastTasksChange) {
    day = {
      date: today.toString(), tasks: [{}, {}, {}], // 3 objects for 3 priorities
      completed: false, lastTasksChange: localStorage.lastTasksChange,
      firstCreation: !day
    };
  } else return day;
  let tasks = await globals.db.getAll('tasks');
  tasks = tasks.filter( (elem) => !elem.disabled || !elem.deleted );
  for (let task of tasks) {
    const resp = dates.compare(today, task.periodStart);
    if (resp != 1) {
      updateTask(task);
      if (!task.period[task.periodDay]) {
        await globals.db.setItem('tasks', task);
        continue;
      }
      if (day.firstCreation) {
        task.history.push(0);
        day.tasks[task.priority][task.id] = 0;
      }
      await globals.db.setItem('tasks', task);
    }
  }
  if (isEmpty(day)) return 'error';
  await globals.db.setItem('days', day);
  return day;
}

function updateTask(task) {
  if (task.oneTime) {
    if (task.history.length) {
      task.periodDay = -1;
      task.disabled = true;
    } else {
      const isSame = dates.compare(getToday(), task.periodStart);
      if (isSame == 0) task.periodDay = 0;
    }
    return;
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
