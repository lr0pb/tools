import { getToday, oneDay } from './highLevel/periods.js'
import { qs, qsa, emjs } from './highLevel/utils.js'
import { renderTask } from './highLevel/taskThings.js'

export const recap = {
  header: `${emjs.newspaper} Yesterday recap`,
  noSettings: true,
  page: `
    <h2 class="emoji completed">${emjs.party}${emjs.sign}</h2>
    <h2 class="completed" id="congrats">Congratulations! </h2>
    <h3>You done <span id="tasksCount"></span> tasks yesterday</h3>
    <progress id="dayProgress"></progress>
    <h3 class="forgotten">
      Check the tasks you didn't complete yesterday and if need mark the ones you forgot
    </h3>
    <div class="forgotten content doubleColumns first" id="tasks" focusgroup="horizontal"></div>
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
    if (!day) return qs('#toMain').click();
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
    if (tasksCount === 0) return qs('#toMain').click();
    const counter = qs('#tasksCount');
    const prog = qs('#dayProgress');
    prog.max = tasksCount;
    const updateUI = () => {
      counter.innerHTML = `${completedTasks}/${tasksCount}`;
      prog.value = completedTasks;
    };
    const completeDay = async (actualDay, completed) => {
      actualDay.completed = completed;
      await globals.db.setItem('days', actualDay);
    }
    updateUI();
    if (tasksCount == completedTasks) {
      await completeDay(day, true);
      for (let elem of qsa('.completed')) {
        elem.style.display = 'block';
      }
      for (let elem of qsa('.content > *:not(.completed)')) {
        elem.style.display = 'none';
      }
      page.classList.add('center', 'doubleColumns');
      qs('#congrats').innerHTML += counter.parentElement.innerHTML;
    } else {
      for (let elem of qsa('.forgotten')) {
        elem.style.display = 'flex';
      }
      const container = qs('#tasks.forgotten');
      for (let taskId of forgottenTasks) {
        const td = await globals.db.getItem('tasks', taskId);
        renderTask({
          type: 'day', globals, td, page: container, extraFunc: async (actualDay, value) => {
            completedTasks += 1 * (value ? 1 : -1);
            await completeDay(actualDay, tasksCount == completedTasks);
            updateUI();
          }, forcedDay: date
        });
      }
    }
  }
};
