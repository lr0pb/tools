import {
  getToday, convertDate, oneDay, getWeekStart, isCustomPeriod
} from './highLevel/periods.js'
import {
  editTask, setPeriodTitle, renderToggler, toggleFunc
} from './highLevel/taskThings.js'
import {
  qs, /*emjs,*/ copyObject, safeDataInteractions, createOptionsList, syncGlobals, updateState
} from './highLevel/utils.js'

let taskTitle = null;

export const taskCreator = {
  get title() {
    return `${emjs.paperWPen} ${
      taskTitle ? `Edit task: ${taskTitle}` : 'Create new task'
    }`;
  },
  get titleEnding() {
    return taskTitle ? 'line' : 'text';
  },
  dynamicTitle: true,
  get header() { return `${emjs.paperWPen} <span id="taskAction">Add</span> task`},
  get page() { return `
    <h3 id="nameTitle">Enter task you will control</h3>
    <input type="text" id="name" placeHolder="Task name">
    <h3>How important is this task?</h3>
    <select id="priority" title="Select how important is this task"></select>
    <h3>How often will you perform this task?</h3>
    <select id="period" title="Select how often or when will you perform this task"></select>
    <h3 id="description" class="hidedUI"></h3>
    <h3 id="startDateTitle" class="hidedUI">When start to performing this task?</h3>
    <select id="startDate" class="hidedUI" title="Select option when start to performing this task">
    </select>
    <h3 id="dateTitle" class="hidedUI"></h3>
    <input type="date" id="date" class="hidedUI">
    <div id="endDateToggler"></div>
    <h3 id="endDateTitle" class="hidedUI">Select day when stop to performing this task</h3>
    <input type="date" id="endDate" class="hidedUI">
    <div id="editButtons">
      <button id="disable" class="secondary noEmoji">Disable task</button>
      <button id="delete" class="danger noEmoji">Delete task</button>
    </div>
  `},
  get footer() { return `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="saveTask" class="success">${emjs.save} Save task</button>
  `},
  script: onTaskCreator,
  onSettingsUpdate: async ({globals}) => {
    syncGlobals(globals);
    const { periods, periodsList } = await getPeriods(globals);
    const period = qs('#period');
    if (globals.pageInfo.taskAction == 'edit') {
      if (period.children.length) return;
      const id = globals.pageInfo.taskId;
      const task = await globals.db.getItem('tasks', id);
      const per = periods[task.periodId];
      const opt = document.createElement('option');
      opt.setAttribute('selected', '');
      opt.innerHTML = per.title || task.ogTitle || task.periodTitle;
      period.append(opt);
      return period.setAttribute('disabled', '');
    }
    createOptionsList(period, periodsList);
    for (let per of periodsList) {
      if (per.id == globals.pageInfo.lastPeriodValue) {
        period.value = per.id;
        break;
      }
    }
    await onPeriodChange({target: period}, globals);
  },
  onBack: (globals) => {
    delete globals.pageInfo.taskId;
    delete globals.pageInfo.taskAction;
  }
};

async function getPeriods(globals) {
  const periods = await globals.getPeriods();
  const list = JSON.parse(localStorage.periodsList);
  const periodsList = [];
  for (let per of list) {
    if (periods[per]) periodsList.push(periods[per]);
  }
  periodsList.push({
    id: '00',
    title: 'No right period? Click to check others'
  });
  return { periods, periodsList };
}

async function onTaskCreator({globals}) {
  qs('#back').addEventListener('click', () => history.back());
  if (!localStorage.firstDayEver) qs('#back').style.display = 'none';
  const priorities = await globals.getList('priorities');
  createOptionsList(qs('#priority'), priorities);
  const startDateOptions = await globals.getList('startDateOptions');
  createOptionsList(qs('#startDate'), startDateOptions);
  renderToggler({
    name: 'No limit to end date', id: 'noEndDate',
    page: qs('#endDateToggler'), value: 1, first: true,
    buttons: [{
      emoji: emjs.sign,
      func: ({e, elem}) => {
        const value = toggleFunc({e, elem});
        qs('#endDateTitle').style.display = value ? 'none' : 'block';
        qs('#endDate').style.display = value ? 'none' : 'block';
      }
    }]
  });
  await taskCreator.onSettingsUpdate({globals});
  safeDataInteractions(['name', 'priority', 'period', 'startDate', 'date', 'endDate']);
  qs('#period').addEventListener('change', async (e) => await onPeriodChange(e, globals));
  qs('#startDate').addEventListener('change', onStartDateChange);
  qs('#date').min = convertDate(Date.now());
  qs('#date').addEventListener('change', onDateChange);
  syncGlobals(globals);
  taskTitle = null;
  const isEdit = globals.pageInfo && globals.pageInfo.taskAction == 'edit';
  let td;
  if (isEdit) {
    td = await enterEditTaskMode(globals);
    enableEditButtons(globals, td);
    taskTitle = td.name;
  } else {
    const { tasksCount, periodsCount } = await asyncDataReceiving({globals, tasks: 3});
    if (
      dailerData.forcePeriodPromo || (tasksCount >= 3 && periodsCount == 0)
    ) globals.floatingMsg({
      text: `${emjs.light} Tip: you can create your own periods e.g. Every saturday`,
      button: 'Try&nbsp;it',
      onClick: async (e) => {
        globals.openSettings('periods');
        globals.closeSettings();
        if (!globals.pageInfo) globals.pageInfo = {};
        globals.pageInfo.periodPromo = '#taskCreator .floatingMsg';
        globals.additionalBack = 1;
        await globals.paintPage('periodCreator');
      },
      pageName: 'taskCreator'
    });
  }
  qs('#saveTask').addEventListener('click', async () => {
    await onSaveTaskClick(globals, td, isEdit);
  });
}

async function asyncDataReceiving({globals, tasks = 1, periods = 1}) {
  let tasksCount = 0, periodsCount = 0, tasksOver = false, periodsOver = false;
  globals.db.getAll('tasks', () => tasksCount++)
    .then(() => tasksOver = true);
  globals.db.getAll('periods', () => periodsCount++)
    .then(() => periodsOver = true);
  while (
    tasksOver && periodsOver ? false : (
      (tasksCount < tasks || !tasksOver) &&
      (periodsCount < periods || !periodsOver)
    )
  ) {
    await new Promise((res) => { setTimeout(res, 10) });
  }
  return { tasksCount, periodsCount };
}

async function onSaveTaskClick(globals, td, isEdit) {
  const periods = await globals.getPeriods();
  const task = createTask(periods, td);
  if (task == 'error') return globals.message({
    state: 'fail', text: 'Fill all fields'
  });
  localStorage.lastTasksChange = Date.now().toString();
  globals.db.setItem('tasks', task);
  globals.message({
    state: 'success', text: isEdit ? 'Task saved' : 'Task added'
  });
  if (!globals.pageInfo) globals.pageInfo = {};
  globals.pageInfo.dataChangedTaskId = task.id;
  await globals.checkPersist();
  if (!localStorage.firstDayEver) {
    return globals.paintPage('main', true, true);
  }
  history.back();
}

async function enterEditTaskMode(globals) {
  const td = await globals.db.getItem('tasks', globals.pageInfo.taskId);
  const periods = await globals.getPeriods();
  qs('#taskAction').innerHTML = 'Edit';
  qs('#nameTitle').innerHTML = 'You can change task name only once';
  qs('#name').value = td.name;
  if (td.nameEdited) qs('#name').disabled = 'disabled';
  qs('#priority').value = td.priority;
  if (!td.periodId) setPeriodId(td, periods);
  qs('#date').value = convertDate(td.periodStart);
  if (td.periodStart > getToday() && periods[td.periodId].selectTitle) {
    qs('#dateTitle').innerHTML = periods[td.periodId].selectTitle;
    qs('#dateTitle').style.display = 'block';
    qs('#date').max = convertDate(periods[td.periodId].maxDate);
    qs('#date').style.display = 'block';
  }
  if (td.endDate) {
    qs('[data-id="noEndDate"]').activate();
    qs('#endDate').value = convertDate(td.endDate);
  } else if (td.special == 'oneTime') {
    qs('[data-id="noEndDate"]').style.display = 'none';
  }
  qs('#endDate').min = convertDate(getToday() + oneDay);
  return td;
}

function enableEditButtons(globals, td) {
  qs('#editButtons').style.display = 'block';
  qs('#disable').addEventListener('click', async () => {
    await editTask({
      globals, id: td.id, field: 'disabled', onConfirm: () => history.back()
    });
  });
  qs('#delete').addEventListener('click', async () => {
    await editTask({
      globals, id: td.id, field: 'deleted', onConfirm: () => history.back()
    });
  });
}

function setPeriodId(task, periods) {
  for (let per in periods) {
    const title = periods[per].title;
    if (title == task.periodTitle || title == task.ogTitle) {
      task.periodId = per;
      delete task.ogTitle;
      break;
    }
  }
}

async function onPeriodChange(e, globals) {
  const periods = await globals.getPeriods();
  const value = e.target.value;
  if (value == '00') {
    return globals.openSettings('periods');
  }
  updateState({lastPeriodValue: value});
  const date = qs('#date');
  const dateTitle = qs('#dateTitle');
  const startDate = qs('#startDate');
  const startDateTitle = qs('#startDateTitle');
  const desc = qs('#description');
  date.value = '';
  date.removeAttribute('max');
  for (let elem of [date, dateTitle, startDate, startDateTitle, desc]) {
    elem.style.display = 'none';
  }
  const per = periods[value];
  let day;
  if (per.special && per.startDate) day = per.startDate;
  else if (per.getWeekStart) day = getWeekStart();
  else day = getToday();
  if (per.startDayShift) day += oneDay * per.startDayShift;
  date.value = convertDate(day);
  if (per.selectTitle && !per.getWeekStart) {
    dateTitle.innerHTML = per.selectTitle;
    startDateTitle.style.display = 'block';
    startDate.style.display = 'block';
    startDate.value = '0';
    if (per.maxDate) {
      const maxDate = getToday() + oneDay * per.maxDate;
      date.max = convertDate(maxDate);
    }
  }
  if (per.description) {
    desc.innerHTML = per.description;
    desc.style.display = 'block';
  }
  if (per.special == 'oneTime') {
    const toggler = qs('[data-id="noEndDate"]');
    if (!Number(toggler.dataset.value)) toggler.activate();
    toggler.style.display = 'none';
  } else qs('[data-id="noEndDate"]').style.display = 'flex';
  onStartDateChange({ target: startDate });
  onDateChange({ target: date });
}

function onDateChange(e) {
  if (e.target.value == '') return;
  const value = new Date(e.target.value).getTime();
  const endValue = new Date(qs('#endDate').value).getTime();
  const newEnd = value + oneDay;
  qs('#endDate').min = convertDate(newEnd);
  if (endValue <= newEnd) qs('#endDate').value = convertDate(newEnd);
}

function onStartDateChange(e) {
  const date = qs('#date');
  const dateTitle = qs('#dateTitle');
  date.style.display = 'none';
  dateTitle.style.display = 'none';
  if (['0', '2'].includes(e.target.value)) {
    date.value = convertDate(getToday());
  } else {
    const today = getToday();
    const weekDay = new Date(today).getDay();
    const closestMonday = today + oneDay * (7 - weekDay);
    date.value = convertDate(weekDay == 0 ? today : closestMonday);
  }
  if (e.target.value == '2') {
    date.style.display = 'block';
    dateTitle.style.display = 'block';
  }
}

export function createTask(periods, td = {}) {
  const value = qs('#period') ? qs('#period').value : td.periodId;
  const priority = qs('#priority') ? Number(qs('#priority').value) : td.priority;
  const dateValue = qs('#date') ? new Date(qs('#date').value).getTime() : td.periodStart;
  const per = periods[value];
  const tdPer = td.periodId ? periods[td.periodId] : {};
  const perId = td.periodId || td.ogTitle || per.id;
  const task = {
    id: td.id || Date.now().toString(),
    name: qs('#name') ? qs('#name').value : td.name,
    priority,
    period: td.period || per.days,
    periodId: perId,
    periodTitle: isCustomPeriod(perId) ? '' : tdPer.title || per.title,
    periodStart: td.periodStart && td.periodStart <= getToday()
    ? td.periodStart
    : tdPer.selectTitle || per.selectTitle || per.getWeekStart
    ? dateValue : td.periodStart || dateValue,
    periodDay: td.periodId
    ? td.periodDay
    : (per.getWeekStart
       ? new Date().getDay() - 1
       : per.periodDay),
    history: td.history || [],
    special: td.periodId ? td.special : per.special,
    nameEdited: td.periodId ? td.nameEdited : false,
    disabled: td.disabled || false,
    deleted: false
  };
  if (!task.special) delete task.special;
  if (td.name && task.name != td.name) task.nameEdited = true;
  if (td.created) task.created = td.created;
  const noEndDate = qs('[data-id="noEndDate"]');
  if (!noEndDate) {
    if (td.endDate) task.endDate = td.endDate;
  } else if (qs('#endDate').value === '') {
    task.endDate = null;
  } else if (!Number(noEndDate.dataset.value)) {
    const endDate = new Date(qs('#endDate').value).getTime();
    task.endDate = endDate;
  } else task.endDate = null;
  setPeriodTitle(task);
  console.log(task);
  if (task.name == '' || isNaN(task.periodStart)) return 'error';
  return task;
}
