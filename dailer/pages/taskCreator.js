import {
  getToday, convertDate, oneDay, getWeekStart, isCustomPeriod
} from './highLevel/periods.js'
import {
  priorities, editTask, setPeriodTitle, renderToggler, toggleFunc
} from './highLevel/taskThings.js'
import {
  qs, emjs, copyObject, safeDataInteractions, createOptionsList
} from './highLevel/utils.js'

export const taskCreator = {
  header: `${emjs.paperWPen} <span id="taskAction">Add</span> task`,
  page: `
    <h3 id="nameTitle">Enter task you will control</h3>
    <input type="text" id="name" placeHolder="Task name">
    <h3>How important is this task?</h3>
    <select id="priority" title="Select how important is this task"></select>
    <h3>How often will you perform this task?</h3>
    <select id="period" title="Select period for this task - how often or when will you perform this task"></select>
    <h3 id="description" class="hidedUI"></h3>
    <h3 id="dateTitle" class="hidedUI"></h3>
    <input type="date" id="date" class="hidedUI">
    <div id="endDateToggler"></div>
    <h3 id="endDateTitle" class="hidedUI">Select tasks end date</h3>
    <input type="date" id="endDate" class="hidedUI">
    <div id="editButtons">
      <button id="disable" class="secondary noEmoji">Disable task</button>
      <button id="delete" class="danger noEmoji">Delete task</button>
    </div>
  `,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="saveTask" class="success">${emjs.save} Save task</button>
  `,
  script: onTaskCreator,
  onSettingsUpdate: async ({globals}) => {
    if (!globals.pageInfo) globals.pageInfo = history.state;
    if (globals.pageInfo.taskAction == 'edit') return;
    const periodsList = await getPeriods(globals);
    const period = qs('#period');
    createOptionsList(period, periodsList);
    for (let per of periodsList) {
      if (per.id == history.state.lastPeriodValue) {
        period.value = per.id;
        break;
      }
    }
    await onPeriodChange({target: period}, globals);
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
  return periodsList;
}

async function onTaskCreator({globals}) {
  qs('#back').addEventListener('click', () => history.back());
  if (!localStorage.firstDayEver) qs('#back').style.display = 'none';
  createOptionsList(qs('#priority'), priorities);
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
  safeDataInteractions(['name', 'priority', 'period', 'date', 'endDate']);
  qs('#period').addEventListener('change', async (e) => await onPeriodChange(e, globals));
  qs('#date').min = convertDate(Date.now());
  qs('#date').addEventListener('change', onDateChange);
  if (!globals.pageInfo) globals.pageInfo = history.state;
  const isEdit = globals.pageInfo && globals.pageInfo.taskAction == 'edit';
  let td;
  if (isEdit) {
    td = await enterEditTaskMode(globals);
    enableEditButtons(globals, td);
    globals.onBack = () => {
      delete globals.pageInfo.taskId;
      delete globals.pageInfo.taskAction;
    };
  } else {
    const { tasksCount, periodsCount } = await asyncDataReceiving({globals, tasks: 3});
    if (tasksCount >= 3 && periodsCount == 0) globals.floatingMsg({
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
  let tasksCount = 0, periodsCount = 0, tasksNotOver = true, periodsNotOver = true;
  globals.db.getAll('tasks', () => tasksCount++)
    .then(() => tasksNotOver = false);
  globals.db.getAll('periods', () => periodsCount++)
    .then(() => periodsNotOver = false);
  while (
    (tasksCount < tasks || tasksNotOver) &&
    (periodsCount < periods || periodsNotOver)
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
      globals, id: td.id, field: 'disabled', onConfirm: () => history.back(),
      elem: qs('#disable')
    });
  });
  qs('#delete').addEventListener('click', async () => {
    await editTask({
      globals, id: td.id, field: 'deleted', onConfirm: () => history.back(),
      elem: qs('#delete')
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
  history.state.lastPeriodValue = value;
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
  if (per.special == 'oneTime') {
    const toggler = qs('[data-id="noEndDate"]');
    if (!Number(toggler.dataset.value)) toggler.activate();
    toggler.style.display = 'none';
  } else qs('[data-id="noEndDate"]').style.display = 'flex';
  onDateChange({ target: qs('#date') });
}

function onDateChange(e) {
  if (e.target.value == '') return;
  const value = new Date(e.target.value).getTime();
  const endValue = new Date(qs('#endDate').value).getTime();
  const newEnd = value + oneDay;
  qs('#endDate').min = convertDate(newEnd);
  if (endValue <= newEnd) qs('#endDate').value = convertDate(newEnd);
}

export function createTask(periods, td = {}) {
  const value = qs('#period') ? qs('#period').value : td.periodId;
  const priority = qs('#priority') ? Number(qs('#priority').value) : td.priority;
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
    ? new Date(qs('#date').value).getTime()
    : td.periodStart || per.startDate,
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
