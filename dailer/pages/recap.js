import { getToday, oneDay } from './highLevel/periods.js'
import { qs, emjs } from './highLevel/utils.js'
import { renderTask } from './highLevel/taskThings.js'

export const recap = {
  header: `${emjs.newspaper} Yesterday recap`,
  noSettings: true,
  page: `
    <h2 class="emoji completed">${emjs.sing}</h2>
    <h3>You done <span id="tasksCount"></span> tasks yesterday</h3>
    <h3 class="completed">Congratulations ${emjs.party}</h3>
    <progress id="dayProgress"></progress>
    <h3 class="forgotten">
      Check the tasks you didn't complete yesterday and if need mark the ones you forgot
    </h3>
    <div class="forgotten doubleColumns first" id="tasks"></div>
  `,
  footer: `
    <button id="toMain">${emjs.forward} Proceed to today</button>
  `,
  script: async ({globals, page}) => {
    qs('#toMain').addEventListener('click', () => {
      localStorage.recaped = getToday();
      globals.paintPage('main', true, true);
    });
    const date = String(getToday() - oneDay);
    const day = await globals.db.getItem('days', date);
    if (!day) qs('#toMain').click();
    let tasksCount = 0;
    let completedTasks = 0;
    let forgottenTasks = [];
    for (let tasksByPriority of day.tasks) {
      for (let taskId in tasksByPriority) {
        tasksCount++;
        if (tasksByPriority[taskId] == 1) completedTasks++;
        else forgottenTasks.push(taskId);
      }
    }
    const counter = qs('#tasksCount');
    const prog = qs('#dayProgress');
    prog.max = tasksCount;
    const updateUI = () => {
      counter.innerHTML = `${completedTasks}/${tasksCount}`;
      prog.value = completedTasks;
    };
    const completeDay = async (completed) => {
      day.completed = completed;
      await globals.db.setItem('days', day);
    }
    updateUI();
    if (tasksCount == completedTasks) {
      for (let elem of qsa('.completed')) {
        elem.style.display = 'block';
      }
      await completeDay(true);
    } else {
      for (let elem of qsa('.forgotten')) {
        elem.style.display = 'flex';
      }
      const container = qs('#tasks.forgotten');
      for (let taskId of forgottenTasks) {
        const td = await globals.db.getItem('tasks', taskId);
        renderTask({
          type: 'day', globals, td, page: container, extraFunc: (value) => {
            completedTasks + 1 * (value ? 1 : -1);
            await completeDay(tasksCount == completedTasks);
            updateUI();
          }, forcedDay: date
        });
      }
    }
  }
};
