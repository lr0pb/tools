import { qs, emjs, getLast } from './utils.js'

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


export 
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
  page.append(task);
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



export async function editTask({globals, id, field, onConfirm}) {
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

export function setPeriodTitle(task) {
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

export async function onTaskCompleteClick({ e, globals, elem: task }) {
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

export function getTaskComplete(td) {
  return getLast(td.history) ? emjs.sign : emjs.blank;
}