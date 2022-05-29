import { qs, emjs } from './highLevel/utils.js'

import { priorities, renderToggler, renderTask, onTaskManageClick, editTask, onTaskCompleteClick } from './highLevel/taskThings.js'

export const planCreator = {
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

export const tasksArchive = {
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