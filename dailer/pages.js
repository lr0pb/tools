const qs = (elem) => document.querySelector(elem);

const onboarding = {
  page: `
    <h1>Create your everyday plan for control over time how you grow yourself</h1>
    <button id="create">Create now</button>
  `,
  script: (globals) => {
    qs('#create').addEventListener(
      'click', () => globals.paintPage('planCreator')
    );
  }
};

const planCreator = {
  page: `
    <h1>Add your daily tasks you will control</h1>
    <div id="tasks" class="fullscreen"></div>
    <button id="addTask">Add task</button>
  `,
  script: onPlanCreator
};

async function onPlanCreator(globals) {
  qs('#addTask').addEventListener(
    'click', () => globals.paintPage('taskCreator')
  );
  const tasks = await globals.db.getAll('tasks');
  const tasksContainer = qs('#tasks');
  if (tasks.lenght == 0) {
    tasksContainer.innerHTML = `<h3>There is nothing yet!</h3>`;
  } else for (let td of tasks) { // td stands for task's data
    if (td.disabled) continue;
    const task = document.createElement('div');
    task.className = 'task';
    task.dataset.data = JSON.stringify(td);
    task.innerHTML = `
      <h3>${td.name}</h3>
      <button data-action="edit" class="smolBtn">Edit</button>
      <button data-action="delete" class="smolBtn">Delete</button>
    `;
    task.addEventListener('click', (e) => { onTaskManageClick(e, globals) })
    tasksContainer.append(task);
  }
}

async function onTaskManageClick(e, globals) {
  if (e.target.dataset.action == 'edit') {
    globals.paintPage('taskCreator');
    
  } else if (e.target.dataset.action == 'delete') {
    //await globals.db.deleteItem('tasks', this.dataset.id);
    const td = JSON.parse(this.dataset.td);
    td.disabled = true;
    await globals.db.setItem('tasks', td);
    this.remove();
    globals.message({
      state: 'success', text: 'Task deleted'
    });
  } else return;
}

const taskCreator = {
  page: `
    <h1>Add task</h1>
    <input type="text" id="name" placeHolder="Enter task you will control"></input>
    <select id="period">
      <option>One time only</option>
      <option>Everyday</option>
      <option>Every second day</option>
      <option>Two over two</option>
      <option>Only weekdays</option>
      <option>On weekends</option>
      <option>Custom period</option>
    </select>
    <button id="saveTask">Save task</button>
  `,
  script: onSaveTask
};

function onSaveTask(globals) {
  qs('#saveTask').addEventListener(
    'click', () => {
      try {
        const task = {
          id: createId(),
          name: qs('#name').value,
          disabled: false
        };
        globals.db.setItem('tasks', task);
        globals.message({
          state: 'success', text: 'Task added'
        });
        globals.paintPage('planCreator');
      } catch (err) {
        globals.message({
          state: 'fail', text: 'Fill all fields'
        });
      };
    }
  );
}

function createId() {
  return Date.now().toString();
}

export const pages = {
  onboarding, planCreator, taskCreator
};
