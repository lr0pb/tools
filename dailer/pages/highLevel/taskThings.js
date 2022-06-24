import { qs, emjs, getLast, intlDate } from './utils.js'
import { getToday, oneDay } from './periods.js'

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
  name, id, emoji, func = toggleFunc, args = {}, page, onBodyClick, value, first
}) {
  const elem = document.createElement('div');
  elem.className = `task ${first ? 'first' : ''}`;
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

export function renderTask({type, globals, td, page, onBodyClick}) {
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
  page.innerHTML = `
    <h2 class="emoji">${emjs.empty}</h2><h2>There is nothing yet!</h2>
  `;
}

export async function editTask({globals, id, field, onConfirm}) {
  const td = await globals.db.getItem('tasks', id);
  globals.openPopup({
    text: `Are you sure to ${field.replace(/\w$/, '')} this task?`,
    action: async () => {
      td[field] = true;
      td.endDate = getToday();
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

  if (task.special == 'oneTime') {
    task.periodTitle = `Only ${startTitle}`;
  } else if (task.special == 'untilComplete' && task.endDate) {
    task.periodTitle = `${task.disabled ? 'Ended' : 'Until'} ${endTitle}`;
  } else if (task.periodStart > getToday()) {
    task.periodTitle += ` from ${startTitle}`;
  } else if (task.endDate) {
    task.periodTitle += ` to ${endTitle}`;
  }
}

export async function onTaskCompleteClick({ e, globals, elem: task }) {
  const td = await globals.db.getItem('tasks', task.dataset.id);
  const day = await globals.db.getItem('days', getToday().toString());
  if (!day) return globals.floatingMsg({
    text: 'Day is expired! So you need to reload tasks for today',
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
