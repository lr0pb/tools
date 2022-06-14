import { qs, emjs } from './highLevel/utils.js'
import { renderTask, showNoTasks } from './highLevel/taskThings.js'

export const planCreator = {
  header: `${emjs.notes} Your tasks`,
  page: ``,
  footer: `
    <button id="back" class="secondary">${emjs.back} Back</button>
    <button id="addTask">${emjs.paperWPen} Add task</button>
  `,
  script: onPlanCreator,
  onPageShow: async ({globals, page}) => {
    await onBackupUploaded({globals, page});
    if (!globals.pageInfo) globals.pageInfo = history.state;
    let id = globals.pageInfo.stateChangedTaskId;
    if (id) qs(`[data-id="${id}"]`).remove();
    if (!page.children.length) showNoTasks(page);
    delete globals.pageInfo.stateChangedTaskId;
    id = globals.pageInfo.dataChangedTaskId;
    if (!id) return;
    const td = await globals.db.getItem('tasks', id);
    const elem = qs(`[data-id="${id}"]`);
    const task = renderTask({type: 'edit', globals, td, page: elem ? null : page});
    if (elem && task) elem.replaceWith(task);
    delete globals.pageInfo.dataChangedTaskId;
  },
  onSettingsUpdate: onBackupUploaded
};

const bads = {
  planCreator: (td) => td.deleted || td.disabled,
  tasksArchive: (td) => td.deleted || !td.disabled
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
  await renderTasksList({ globals, page, isBadTask: bads.planCreator });
}

export const tasksArchive = {
  header: `${emjs.books} Archived tasks`,
  page: ``,
  footer: `<button id="back" class="secondary">${emjs.back} Back</button>`,
  script: onTasksArchive,
  onSettingsUpdate: onBackupUploaded
};

async function onTasksArchive({globals, page}) {
  qs('#back').addEventListener('click', () => history.back());
  await renderTasksList({
    globals, page, isBadTask: bads.tasksArchive, sort: (t1, t2) => {
      if (t1.periodStart > t2.periodStart) return -1;
      if (t1.periodStart === t2.periodStart) return 0;
      return 1;
    }
  });
}

async function renderTasksList({globals, page, isBadTask, sort}) {
  const tasks = await globals.db.getAll('tasks');
  page.innerHTML = '';
  let prevTask = null, prevTaskId = null;
  const setPrev = (task, id) => {
    prevTask = task; prevTaskId = id;
  };
  if (!tasks.length) {
    showNoTasks(page);
  } else for (let i = 0; i < tasks.length; i++) {
    // one loop with filtering, sorting and action with data instead of
    // 3 loops for all this actions
    let td = prevTask || tasks[i]; // td stands for task's data
    if (isBadTask(td)) continue;
    if (sort) {
      while (isBadTask(tasks[i + 1] || td)) {
        i++;
      }
      const nextTask = tasks[i + 1] || td;
      const resp = sort(td, nextTask);
      if (resp === -1) {
        td = nextTask;
        setPrev(tasks[i], i);
      } else if (resp === 0) {
        td = prevTaskId ? tasks[prevTaskId] : td;
        setPrev(tasks[i], i);
      } else if (resp === 1) {
        td = prevTaskId ? tasks[prevTaskId] : td;
        setPrev(null, null);
      }
    }
    renderTask({type: 'edit', globals, td, page});
  }
  if (!page.children.length) showNoTasks(page);
}

async function onBackupUploaded({globals, page}) {
  if (!globals.pageInfo || !globals.pageInfo.backupUploaded) return;
  await renderTasksList({globals, page, isBadTask: bads[globals.pageName] });
}
