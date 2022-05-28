import {
  getToday, convertDate, oneDay, periods
} from './periods.js'

export const qs = (elem) => document.querySelector(elem);

const getLast = (arr) => arr[arr.length - 1];

const intlDate = (date) => new Date(date).toLocaleDateString(navigator.language);

const emjs = {
  sign: '&#9989;',
  blank: '&#11036;',
  cross: '&#10060;',
  back: '&#9194;',
  stars: '&#128171;',
  books: '&#128218;',
  notes: '&#128209;',
  paperWPen: '&#128221;',
  pen: '&#128394;',
  trashCan: '&#128465;',
  sword: '&#128481;',
  empty: '&#128173;',
  save: '&#128190;',
  magic: '&#128302;',
  calendar: '&#128467;',
  fire: '&#128293;',
  clock: '&#128337;',
  oldPaper: '&#128220;',
  paperList: '&#128203;',
};

const onboarding = {
  header: '',
  page: `
    <h2 class="emoji">${emjs.stars}</h2>
    <h2>Create your everyday plan for manage how you grow yourself over time</h2>
  `,
  centerContent: true,
  footer: '<button id="create">${emjs.paperList} Create now</button>',
  script: ({globals, page}) => {
    qs('#openSettings').style.display = 'none';
    qs('#create').addEventListener('click', () => {
      localStorage.onboarded = 'true';
      qs('#openSettings').style.display = 'block';
      globals.paintPage('taskCreator', true);
    });
  }
};

const planCreator = {
  header: `${emjs.notes} Your tasks`,
  page: ``,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="addTask">${emjs.paperWPen} Add task</button>
  `,
  script: onPlanCreator
};

async function onPlanCreator({globals, page}) {
  globals.pageButton({
    emoji: emjs.books,
    onClick: () => globals.paintPage('tasksArchive')
  });
  qs('#back').addEventListener('click', () => history.back());
  qs('#addTask').addEventListener(
    'click', () => globals.paintPage('taskCreator')
  );
  await renderTasksList({
    globals, page, isBadTask: (td) => td.deleted || td.disabled
  });
}

const tasksArchive = {
  header: `${emjs.books} Archived tasks`,
  page: ``,
  footer: `<button id="back" class="secondary">${emjs.back} Back</button>`,
  script: onTasksArchive
};

async function onTasksArchive({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  await renderTasksList({
    globals, page, isBadTask: (td) => td.deleted || !td.disabled
  });
}

async function renderTasksList({globals, page, isBadTask}) {
  const tasks = await globals.db.getAll('tasks');
  if (!tasks.length) {
    showNoTasks(page);
  } else for (let td of tasks) { // td stands for task's data
    if (isBadTask(td)) continue;
    renderTask({type: 'edit', globals, td, page});
  }
  if (!page.children.length) {
    showNoTasks(page);
  }
}

function showNoTasks(page) {
  page.classList.add('center');
  page.innerHTML = `
    <h2 class="emoji">${emjs.empty}</h2><h2>There is nothing yet!</h2>
  `;
}

const priorities = [{
  title: 'Can miss sometimes',
  color: 'green'
}, {
  title: 'Normal',
  color: 'yellow',
  selected: true
}, {
  title: 'Extra important',
  color: 'red'
}];

function renderToggler({name, id, emoji, func, args, page, onBodyClick}) {
  const elem = document.createElement('div');
  elem.className = 'task';
  elem.dataset.id = id;
  elem.innerHTML = `
    <div><h2>${name}</h2></div>
    <button data-action="complete" class="emojiBtn">${emoji}</button>
  `;
  elem.addEventListener('click', async (e) => {
    args.e = e; args.elem = elem;
    if (e.target.dataset.action == 'complete') {
      await func(args);
    } else if (onBodyClick) onBodyClick();
  })
  page.append(elem);
  return elem;
}

function renderTask({type, globals, td, page, onBodyClick}) {
  if (type == 'day') return renderToggler({
    name: td.name, id: td.id,
    emoji: getTaskComplete(td),
    func: onTaskCompleteClick,
    args: { globals }, page, onBodyClick
  });
  const task = document.createElement('div');
  task.className = 'task';
  task.dataset.id = td.id;
  task.innerHTML = `
    <div>
      <h3>${td.name}</h3>
      <p>${td.periodTitle} | ${priorities[td.priority].title}</p>
    </div>
    ${td.disabled ? '' : `
      <button data-action="edit" class="emojiBtn">${emjs.pen}</button>
      <button data-action="delete" class="emojiBtn">${emjs.trashCan}</button>
    `}
   `;
  task.addEventListener('click', async (e) => {
    await onTaskManageClick({e, globals, task, page});
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
    await editTask({
      globals, id: task.dataset.id, field: 'deleted', onConfirm: () => {
        task.remove();
        if (!page.children.length) showNoTasks(page);
      }
    });
  } else {
    globals.pageInfo = { taskId: task.dataset.id };
    globals.paintPage('taskInfo');
  };
}

async function editTask({globals, id, field, onConfirm}) {
  const td = await globals.db.getItem('tasks', id);
  globals.openPopup({
    text: `Are you sure to ${field.replace(/\w$/, '')} this task?`,
    action: async () => {
      td[field] = true;
      await globals.db.setItem('tasks', td);
      localStorage.lastTasksChange = Date.now().toString();
      globals.closePopup();
      globals.message({
        state: 'success', text: `Task ${field}`
      });
      onConfirm();
    }
  });
}

const taskInfo = {
  header: `${emjs.oldPaper} Task info`,
  page: ``,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="edit">${emjs.pen} Edit task</button>
  `,
  script: renderTaskInfo
};

async function renderTaskInfo({globals, page}) {
  qs('#back').addEventListener('click', () => {
    globals.pageInfo = null;
    history.back();
  });
  if (!globals.pageInfo) globals.pageInfo = history.state;
  const task = await globals.db.getItem('tasks', globals.pageInfo.taskId);
  if (task.disabled || task.deleted) {
    qs('#edit').style.display = 'none';
  } else {
    qs('#edit').addEventListener('click', () => {
      globals.pageInfo.taskAction = 'edit';
      globals.paintPage('taskCreator');
    });
  }
  page.innerHTML = `
    <div id="infoBackground">
      <h4>${task.name}</h4>
    </div>
    <div class="itemsHolder"></div>
    ${!task.history.length || task.special ? '' : `
      <h2>History</h2>
      <div id="history" class="hiddenScroll">
        <div class="historyMonth"></div>
      </div>
    `}
  `;
  const periodText = !task.special && task.periodStart <= getToday()
    ? `${periods[task.periodId].title} from ${task.periodStart == getToday() ? 'today' : intlDate(task.periodStart)}`
    : task.periodTitle;
  createInfoRect(emjs.calendar, periodText, 'blue');
  
  const isActiveText = `Today ${task.period[task.periodDay] ? 'you should do' : "you haven't"} this task`;
  if (!task.disabled) createInfoRect(emjs.clock, isActiveText, task.period[task.periodDay] ? 'green' : 'red');
  
  createInfoRect(emjs.fire, `Importance: ${priorities[task.priority].title}`, priorities[task.priority].color);
  
  if (task.special && task.history.length) {
    let emoji = emjs.cross, color = 'red';
    if (task.history[0]) emoji = emjs.sign, color = 'green';
    createInfoRect(emoji, `Task was ${task.history[0] ? '' : 'not '}completed`, color);
  } else if (task.history.length) {
    const hb = qs('.historyMonth');
    const creationDay = new Date(Number(task.id)).setHours(0, 0, 0, 0);
    const startDay = new Date(creationDay > task.periodStart ? creationDay : task.periodStart);
    let emptyDays = startDay.getDay() - 1;
    if (emptyDays == -1) emptyDays = 6;
    for (let i = 0; i < emptyDays; i++) {
      hb.innerHTML += `<h4> </h4>`;
    }
    let periodCursor = creationDay > task.periodStart ? new Date(creationDay).getDay() : 0;
    let hardUpdate = false;
    const addValue = () => {
      periodCursor++;
      hardUpdate = false;
      if (task.period.length == periodCursor) {
        periodCursor = 0;
        hardUpdate = true;
      }
    };
    for (let item of task.history) {
      while (!task.period[periodCursor]) {
        hb.innerHTML += `<h4>${emjs.blank}</h4>`;
        addValue();
      }
      hb.innerHTML += `<h4>${item ? emjs.sign : emjs.cross}</h4>`;
      addValue();
    }
    while (periodCursor <= task.periodDay && !hardUpdate && !task.period[task.periodDay]) {
      hb.innerHTML += `<h4>${emjs.blank}</h4>`;
      addValue();
    }
  }
}

function createInfoRect(emoji, text, color) {
  const elem = document.createElement('div');
  elem.className = 'infoRect';
  elem.style.setProperty('--color', `var(--${color})`);
  elem.innerHTML = `
    <h4>${emoji}</h4>
    <h3>${text}</h3>
  `;
  qs('.itemsHolder').append(elem);
}

const taskCreator = {
  header: `${emjs.paperWPen} <span id="taskAction">Add</span> task`,
  page: `
    <h3 id="nameTitle">Enter task you will control</h3>
    <input type="text" id="name" placeHolder="Task name"></input>
    <h3>How important this task?</h3>
    <select id="priority"></select>
    <h3>How often you will do this task?</h3>
    <select id="period"></select>
    <h3 id="dateTitle"></h3>
    <input type="date" id="date"></input>
    <h3 id="description"></h3>
    <div id="editButtons">
      <button id="disable" class="secondary">Disable task</button>
      <button id="delete" class="danger">Delete task</button>
    </div>
  `,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="saveTask" class="success">${emjs.save} Save task</button>
  `,
  script: onTaskCreator,
  onSettingsUpdate: async (globals) => {
    if (globals.pageInfo && globals.pageInfo.taskAction == 'edit') return;
    const periodsList = await getPeriods(globals);
    createOptionsList(qs('#period'), periodsList);
  }
};

async function getPeriods(globals) {
  const customs = await globals.db.getAll('periods');
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
  const safeBack = () => {
    globals.pageInfo = null;
    history.back();
  };
  qs('#back').addEventListener('click', safeBack);
  if (!localStorage.firstDayEver) qs('#back').style.display = 'none';
  createOptionsList(qs('#priority'), priorities);
  await taskCreator.onSettingsUpdate(globals);
  qs('#period').addEventListener('change', (e) => onPeriodChange(e, globals));
  qs('#date').min = convertDate(Date.now());
  if (!globals.pageInfo) globals.pageInfo = history.state;
  const isEdit = globals.pageInfo && globals.pageInfo.taskAction == 'edit';
  let td;
  if (isEdit) {
    td = await enterEditTaskMode(globals);
    enableEditButtons(globals, td, safeBack);
  } else {
    onPeriodChange({target: qs('#period')}, globals);
  }
  qs('#saveTask').addEventListener('click', () => {
    const task = createTask(td);
    if (task == 'error') return globals.message({
      state: 'fail', text: 'Fill all fields'
    });
    localStorage.lastTasksChange = Date.now().toString();
    globals.db.setItem('tasks', task);
    globals.message({
      state: 'success', text: isEdit ? 'Task saved' : 'Task added'
    });
    if (!localStorage.firstDayEver) {
      globals.paintPage('main', true, true);
      return;
    }
    await globals.checkPersist();
    safeBack();
  });
}

async function enterEditTaskMode(globals) {
  const td = await globals.db.getItem('tasks', globals.pageInfo.taskId);
  qs('#taskAction').innerHTML = 'Edit';
  qs('#nameTitle').innerHTML = 'You can change task name only once';
  qs('#name').value = td.name;
  if (td.nameEdited) qs('#name').disabled = 'disabled';
  qs('#priority').value = td.priority;
  if (!td.periodId) setPeriodId(td);
  const opt = document.createElement('option');
  opt.selected = 'selected';
  opt.innerHTML = td.ogTitle || periods[td.periodId].title || td.periodTitle;
  qs('#period').append(opt);
  qs('#period').disabled = 'disabled';
  qs('#date').value = convertDate(td.periodStart);
  if (td.periodStart > getToday() && periods[td.periodId].selectTitle) {
    qs('#dateTitle').innerHTML = periods[td.periodId].selectTitle;
    qs('#dateTitle').style.display = 'block';
    qs('#date').max = convertDate(periods[td.periodId].maxDate);
    qs('#date').style.display = 'block';
  }
  return td;
}

function enableEditButtons(globals, td, safeBack) {
  qs('#editButtons').style.display = 'block';
  qs('#disable').addEventListener('click', async () => {
    await editTask({
      globals, id: td.id, field: 'disabled', onConfirm: safeBack
    });
  });
  qs('#delete').addEventListener('click', async () => {
    await editTask({
      globals, id: td.id, field: 'deleted', onConfirm: safeBack
    });
  });
}

function setPeriodId(task) {
  for (let per in periods) {
    const title = periods[per].title;
    if (title == task.periodTitle || title == task.ogTitle) {
      task.periodId = per;
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
  const value = e.target.value;
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
  const value = qs('#period').value;
  const priority = Number(qs('#priority').value);
  const task = {
    id: td.id || Date.now().toString(),
    name: qs('#name').value,
    priority,
    period: td.period || periods[value].days,
    periodId: td.periodId || td.ogTitle || periods[value].id,
    periodTitle: td.periodId ? periods[td.periodId].title : periods[value].title,
    periodStart: td.periodStart && td.periodStart <= getToday()
    ? td.periodStart
    : (td.periodId ? periods[td.periodId].selectTitle : periods[value].selectTitle)
    ? new Date(qs('#date').value).getTime()
    : td.periodStart || periods[value].startDate,
    periodDay: td.periodId ? td.periodDay : periods[value].periodDay,
    history: td.history || [],
    special: td.periodId ? td.special : periods[value].special,
    nameEdited: td.periodId ? td.nameEdited : false,
    disabled: false,
    deleted: false
  };
  if (!task.special) delete task.special;
  if (td.name && task.name != td.name) task.nameEdited = true;
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
  let startTitle = intlDate(date);
  if (task.periodStart == getToday()) startTitle = 'today';
  if (task.periodStart - oneDay == getToday()) startTitle = 'tomorrow';
  
  if (task.special == 'oneTime') {
    task.periodTitle = `Only ${startTitle}`;
  } else if (task.periodStart > getToday()) {
    task.periodTitle += ` from ${startTitle}`;
  }
}

const main = {
  header: `${emjs.sword} Today's tasks`,
  centerContent: true,
  page: ``,
  footer: `
    <!--<button id="toHistory" class="secondary">&#128198; History</button>-->
    <button id="toPlan" class="secondary">${emjs.notes} Edit tasks</button>
  `,
  script: mainScript
};

async function mainScript({globals, page}) {
  qs('#toPlan').addEventListener(
    'click', () => globals.paintPage('planCreator')
  );
  const day = await createDay(globals);
  if (day == 'error') return page.innerHTML = `
    <h2 class="emoji">${emjs.magic}</h2>
    <h2>You have no tasks today!</h2>
  `;
  page.classList.remove('center');
  for (let i = day.tasks.length - 1; i > -1; i--) {
    for (let id in day.tasks[i]) {
      const td = await globals.db.getItem('tasks', id);
      renderTask({type: 'day', globals, td, page, onBodyClick: () => {
        globals.pageInfo = {taskId: td.id};
        globals.paintPage('taskInfo');
      }});
    }
  }
}

async function onTaskCompleteClick({ e, globals, elem: task }) {
  const td = await globals.db.getItem('tasks', task.dataset.id);
  const day = await globals.db.getItem('days', getToday().toString());
  const value = getLast(td.history) == 1 ? 0 : 1;
  td.history.pop();
  td.history.push(value);
  day.tasks[td.priority][td.id] = value;
  await globals.db.setItem('tasks', td);
  await globals.db.setItem('days', day);
  e.target.innerHTML = getTaskComplete(td);
}

function getTaskComplete(td) {
  return getLast(td.history) ? emjs.sign : emjs.blank;
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
      } else if (task.period[task.periodDay]) {
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
      setPeriodTitle(task);
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
  task.periodTitle = task.ogTitle || (task.periodId && periods[task.periodId].title) || task.periodTitle;
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
    const periodsCount = 5;
    page.innerHTML = `
      <h2>Periods</h2>
      <h3>Set up to ${periodsCount} periods that will be shown in Period choise drop down list of task</h3>
      <div id="periodsContainer"></div>
      <h3>Custom period creation will be available soon</h3>
    `;
    let first = true;
    const pc = qs('#periodsContainer');
    for (let per in periods) {
      const period = periods[per];
      const elem = renderToggler({
        name: period.title, id: period.id,
        emoji: getPeriodUsed(per),
        func: updatePeriodsList,
        args: { globals, periodsCount }, page: pc
      });
      if (first) {
        elem.classList.add('first');
        first = false;
      }
    }
  }
};

function updatePeriodsList({e, globals, periodsCount, elem }) {
  const list = JSON.parse(localStorage.periodsList);
  const id = elem.dataset.id;
  if (list.includes(id)) {
    if (list.length == 1) {
      return globals.message({
        state: 'fail', text: `You need to have at least 1 period`
      });
    }
    const idx = list.indexOf(id);
    list.splice(idx, 1);
  } else {
    list.length == periodsCount
    ? globals.message({
        state: 'fail', text: `You already choose ${periodsCount} periods`
      })
    : list.push(id);
  }
  localStorage.periodsList = JSON.stringify(list);
  e.target.innerHTML = getPeriodUsed(id);
}

function getPeriodUsed(id) {
  return JSON.parse(localStorage.periodsList).includes(id)
  ? emjs.sign : emjs.blank;
}

export const pages = {
  onboarding, main, settings, planCreator, taskCreator, tasksArchive, taskInfo
};
