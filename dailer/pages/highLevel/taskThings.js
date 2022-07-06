import { qs, emjs, getLast, intlDate, handleKeyboard } from './utils.js'
import { getToday, oneDay, isCustomPeriod } from './periods.js'

export const priorities = [{
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

export function renderToggler({
  name, id, buttons = [], toggler, page, onBodyClick, value, first, disabled
}) {
  // toggler property represents emoji, that will arrive as first toggle value
  // but either this prop gives understand to enable default toggle function
  const elem = document.createElement('div');
  elem.className = `task ${first ? 'first' : ''}`;
  elem.dataset.id = id;
  const noChilds = page.children.length == 0;
  if (onBodyClick) {
    elem.role = 'button';
    elem.tabIndex = dailerData.focusgroup ? (noChilds ? 0 : -1) : 0;
    handleKeyboard(elem, true);
  }
  elem.focusgroup = 'extend horizontal';
  let buttonsString = ``;
  if (toggler) buttons.push({ emoji: toggler, func: toggleFunc });
  buttons.forEach((btn, i) => {
    buttonsString += `
      <button
        data-action="${i}" class="emojiBtn"
        ${disabled ? 'disabled' : ''} title="${btn.title || 'Toggle value'}"
        tabIndex="${dailerData.focusgroup ? (noChilds && !onBodyClick && i == 0 ? 0 : -1) : 0}"
      >${btn.emoji}</button>
    `;
  });
  elem.innerHTML = `
    <div><h2>${name}</h2></div>
    ${buttonsString}
  `;
  elem.addEventListener('click', async (e) => {
    if (e.target.dataset.action) {
      const btn = buttons[e.target.dataset.action];
      if (!btn.args) btn.args = {};
      await btn.func({...btn.args, e, elem});
    } else if (onBodyClick) onBodyClick({e, elem});
  });
  if (value !== undefined) elem.dataset.value = value;
  elem.activate = () => elem.querySelector('button').click();
  page.append(elem);
  return elem;
}

export function toggleFunc({e, elem}) {
  const value = Number(elem.dataset.value) ? 0 : 1;
  elem.dataset.value = value;
  e.target.innerHTML = value ? emjs.sign : emjs.blank;
  return value;
}

export function renderTask({type, globals, td, page, onBodyClick, periods}) {
  if (type == 'day') return renderToggler({
    name: td.name, id: td.id, buttons: [{
      emoji: getTaskComplete(td),
      title: 'Mark task as completed',
      func: onTaskCompleteClick,
      args: { globals }
    }], page, onBodyClick
  });
  const task = document.createElement('div');
  task.className = 'task';
  task.role = 'button';
  task.tabIndex = dailerData.focusgroup ? (page.children.length == 0 ? 0 : -1) : 0;
  task.focusgroup = 'extend horizontal';
  task.dataset.id = td.id;
  task.innerHTML = `
    <div>
      <h3>${td.name}</h3>
      <p>${isCustomPeriod(td.periodId)
        ? `<span class="customTitle" data-period="${td.periodId}">${
          periods[td.periodId].title
        }</span>${td.periodTitle}` : td.periodTitle
      } | ${priorities[td.priority].title}</p>
    </div>
    ${td.disabled ? '' : `
      <button data-action="edit" class="emojiBtn" title="Edit task"
        tabIndex="${dailerData.focusgroup ? -1 : 0}">${emjs.pen}</button>
      <button data-action="delete" class="emojiBtn" title="Delete task"
        tabIndex="${dailerData.focusgroup ? -1 : 0}">${emjs.trashCan}</button>
    `}
   `;
  task.addEventListener('click', async (e) => {
    await onTaskManageClick({e, globals, task, page});
  });
  handleKeyboard(task, true);
  if (page) page.append(task);
  return task;
}

export async function onTaskManageClick({ e, globals, task, page }) {
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

export function showNoTasks(page) {
  page.classList.add('center');
  const isArchive = page.parentElement.id == 'tasksArchive';
  page.innerHTML = `
    <h2 class="emoji">${isArchive ? emjs.book : emjs.empty}</h2>
    <h2>${isArchive
    ? 'When tasks expired or you disable them, they will get here'
    : 'There is no tasks right now!'}</h2>
  `;
}

export async function editTask({globals, id, field, onConfirm}) {
  const td = await globals.db.getItem('tasks', id);
  globals.openPopup({
    text: `Are you sure to ${field.replace(/\w$/, '')} this task?`,
    action: async () => {
      td[field] = true;
      td.endDate = getToday();
      disable(td);
      await globals.db.setItem('tasks', td);
      localStorage.lastTasksChange = Date.now().toString();
      globals.closePopup();
      globals.message({
        state: 'success', text: `Task ${field}`
      });
      if (!globals.pageInfo) globals.pageInfo = {};
      globals.pageInfo.stateChangedTaskId = id;
      onConfirm();
    }
  });
}

export function disable(task) {
  task.periodDay = -1;
  task.disabled = true;
  const updateList = JSON.parse(localStorage.updateTasksList);
  updateList.push(task.id);
  localStorage.updateTasksList = JSON.stringify(updateList);
  setPeriodTitle(task);
}

export function getTextDate(date) {
  let resp = intlDate(date);
  if (date == getToday()) resp = 'today';
  else if (date - oneDay == getToday()) resp = 'tomorrow';
  else if (date + oneDay == getToday()) resp = 'yesterday';
  return resp;
}

export function setPeriodTitle(task) {
  task.periodStart = new Date(task.periodStart).setHours(0, 0, 0, 0);
  const startTitle = getTextDate(task.periodStart);
  const endTitle = task.endDate ? getTextDate(task.endDate) : null;

  if (task.special == 'oneTime' && task.period.length == 1) {
    task.periodTitle = `Only ${startTitle}`;
  } else if (task.special == 'untilComplete' && task.endDate) {
    task.periodTitle = `${task.disabled ? 'Ended' : 'Complete until'} ${endTitle}`;
  } else if (task.periodStart > getToday()) {
    task.periodTitle += ` from ${startTitle}`;
  } else if (task.endDate && !task.disabled) {
    task.periodTitle += ` to ${endTitle}`;
  }
}

export async function onTaskCompleteClick({ e, globals, elem: task }) {
  const td = await globals.db.getItem('tasks', task.dataset.id);
  const day = await globals.db.getItem('days', getToday().toString());
  if (!day) return globals.floatingMsg({
    text: `${emjs.alarmClock} Day is expired! So you need to reload tasks for today`,
    button: 'Reload',
    onClick: () => location.reload(),
    pageName: 'main'
  });
  const value = getLast(td.history) == 1 ? 0 : 1;
  td.history.pop();
  td.history.push(value);
  day.tasks[td.priority][td.id] = value;
  await globals.db.setItem('tasks', td);
  await globals.db.setItem('days', day);
  e.target.innerHTML = getTaskComplete(td);
}

export function getTaskComplete(td) {
  return getLast(td.history) ? emjs.sign : emjs.blank;
}
