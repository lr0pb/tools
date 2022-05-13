const qs = (elem) => document.querySelector(elem);

const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

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
    if (td.disabled) continue;
    renderTask(td, tasksContainer);
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

function renderTask(td, tasksContainer) {
  const task = document.createElement('div');
  task.className = 'task';
  task.dataset.id = td.id;
  task.innerHTML = `
    <div>
      <h3>${td.name}</h3>
      <p>${td.periodTitle}</p>
    </div>
    <button data-action="edit" class="emojiBtn">&#128394;</button>
    <button data-action="delete" class="emojiBtn">&#128465;</button>
  `;
  task.addEventListener('click', (e) => {
    onTaskManageClick({e, globals, task, tasksContainer})
  })
  tasksContainer.append(task);
}

async function onTaskManageClick({
  e, globals, task, tasksContainer
}) {
  if (e.target.dataset.action == 'edit') {
    globals.paintPage('taskCreator');
    
  } else if (e.target.dataset.action == 'delete') {
    //await globals.db.deleteItem('tasks', this.dataset.id);
    const td = await globals.db.getItem('tasks', task.dataset.id);
    td.disabled = true;
    await globals.db.setItem('tasks', td);
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
    <h3>How often you will do this task?</h3>
    <select id="period"></select>
    <h3 id="dateTitle"></h3>
    <input type="date" id="date"></input>
  `,
  footer: `
    <button id="toPlan" class="secondary">Back</button>
    <button id="saveTask">&#128190; Save task</button>
  `,
  script: onSaveTask
};

const periods = [{
  title: 'Everyday',
  days: [1],
  get startDate() { return getToday(); },
  periodDay: 0
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
  const periodElem = qs('#period');
  for (let i = 0; i < periods.length; i++) {
    const per = document.createElement('option');
    per.value = i;
    per.textContent = periods[i].title;
    periodElem.append(per);
  }
  periodElem.addEventListener('change', (e) => {
    const value = Number(e.target.value);
    if (periods[value].selectTitle) {
      qs('#dateTitle').textContent = periods[value].selectTitle;
      qs('#dateTitle').style.display = 'block';
      qs('#date').style.display = 'block';
    } else {
      qs('#dateTitle').style.display = 'none';
      qs('#date').style.display = 'none';
    }
  });
  qs('#saveTask').addEventListener('click', () => {
    const task = createTask();
    if (task == 'error') return globals.message({
      state: 'fail', text: 'Fill all fields'
    });
    globals.db.setItem('tasks', task);
    globals.message({
      state: 'success', text: 'Task added'
    });
    globals.paintPage('planCreator');
  });
}

function createTask(id) {
  const value = Number(qs('#period').value);
  const task = {
    id: id ? id : Date.now().toString(),
    name: qs('#name').value,
    period: periods[value].days,
    periodTitle: periods[value].title,
    periodStart: periods[value].selectTitle
    ? new Date(qs('#date').value).toString()
    : periods[value].startDate.toString(),
    periodDay: periods[value].periodDay,
    disabled: false
  };
  if (periods[value].special) {
    task[periods[value].special] = true;
  }
  console.log(task);
  if (
    task.name == '' ||
    task.periodStart == 'Invalid Date'
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
}

async function createDay(globals) {
  const today = getToday().toString();
  let day = await globals.db.getItem('days', today);
  if (!day) {
    day = { date: today, tasks: [], completed: false };
  } else return day;
  const tasks = await globals.db.getAll('tasks')
    .filter( (elem) => !elem.disabled );
  for (task of tasks) {
    
  }
  if (!day.tasks.length) return 'error';
  await globals.db.setItem('days', day);
  return day;
}

export const pages = {
  onboarding, main, planCreator, taskCreator
};
