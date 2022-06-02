import { getToday, convertDate, oneDay, getWeekStart } from './highLevel/periods.js'
import { priorities, editTask, setPeriodTitle } from './highLevel/taskThings.js'
import { qs, emjs, copyObject, safeDataInteractions } from './highLevel/utils.js'

export const taskCreator = {
  header: `${emjs.paperWPen} <span id="taskAction">Add</span> task`,
  page: `
    <h3 id="nameTitle">Enter task you will control</h3>
    <input type="text" id="name" placeHolder="Task name">
    <h3>How important this task?</h3>
    <select id="priority"></select>
    <h3>How often you will do this task?</h3>
    <select id="period"></select>
    <h3 id="dateTitle"></h3>
    <input type="date" id="date">
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
    await onPeriodChange({target: qs('#period')}, globals);
  }
};

async function getPeriods(globals) {
  const periods = await globals.getPeriods();
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
    if (globals.pageInfo) {
      delete globals.pageInfo.taskId;
      delete globals.pageInfo.taskAction;
    }
    history.back();
  };
  qs('#back').addEventListener('click', safeBack);
  if (!localStorage.firstDayEver) qs('#back').style.display = 'none';
  createOptionsList(qs('#priority'), priorities);
  safeDataInteractions(['name', 'priority', 'period', 'date']);
  await taskCreator.onSettingsUpdate(globals);
  qs('#period').addEventListener('change', async (e) => await onPeriodChange(e, globals));
  qs('#date').min = convertDate(Date.now());
  if (!globals.pageInfo) globals.pageInfo = history.state;
  const isEdit = globals.pageInfo && globals.pageInfo.taskAction == 'edit';
  let td;
  if (isEdit) {
    td = await enterEditTaskMode(globals);
    enableEditButtons(globals, td, safeBack);
  }
  qs('#saveTask').addEventListener('click', async () => {
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
    globals.pageInfo.dataChangedTaskId = task.id;
    await globals.checkPersist();
    if (!localStorage.firstDayEver) {
      return globals.paintPage('main', true, true);
    }
    safeBack();
  });
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

async function onPeriodChange(e, globals) {
  const periods = await globals.getPeriods();
  const value = e.target.value;
  if (value == '00') {
    return globals.openSettings('periods');
  }
  const date = qs('#date');
  date.value = '';
  date.removeAttribute('max');
  date.style.display = 'none';
  qs('#dateTitle').style.display = 'none';
  qs('#description').style.display = 'none';
  const per = periods[value];
  let day;
  if (per.special && per.startDate) day = per.startDate;
  else if (per.getWeekStart) day = getWeekStart();
  else day = getToday();
  date.value = convertDate(day);
  if (per.selectTitle && !per.getWeekStart) {
    qs('#dateTitle').innerHTML = per.selectTitle;
    qs('#dateTitle').style.display = 'block';
    date.style.display = 'block';
    if (per.maxDate) {
      const maxDate = getToday() + oneDay * per.maxDate;
      date.max = convertDate(maxDate);
    }
  }
  if (per.description) {
    qs('#description').innerHTML = per.description;
    qs('#description').style.display = 'block';
  }
}

function createTask(periods, td = {}) {
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
    periodDay: td.periodId
    ? td.periodDay
    : (periods[value].getWeekStart
       ? new Date().getDay() - 1
       : periods[value].periodDay),
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
  if (task.name == '' || isNaN(task.periodStart)) return 'error';
  return task;
}
