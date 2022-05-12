const qs = (elem) => document.querySelector(elem);

const onboarding = {
  header: '',
  page: `
    <h2>Create your everyday plan for manage how you grow yourself over time</h2>
  `,
  footer: '<button id="create">&#128203; Create now</button>',
  script: (globals) => {
    qs('#create').addEventListener(
      'click', () => globals.paintPage('planCreator')
    );
  }
};

const planCreator = {
  header: '&#128209; Manage your tasks',
  page: `
    <div id="tasks"></div>
  `,
  footer: '<button id="addTask">Add task</button>',
  script: onPlanCreator
};

async function onPlanCreator(globals) {
  qs('#addTask').addEventListener(
    'click', () => globals.paintPage('taskCreator')
  );
  const tasks = await globals.db.getAll('tasks');
  const tasksContainer = qs('#tasks')
  if (!tasks.length) {
    tasksContainer.style.justifyContent = 'center';
    tasksContainer.innerHTML = `<h2>&#128495;</h2><h3>There is nothing yet!</h3>`;
  } else for (let td of tasks) { // td stands for task's data
    if (td.disabled) continue;
    const task = document.createElement('div');
    task.className = 'task';
    task.dataset.td = JSON.stringify(td);
    task.innerHTML = `
      <div>
        <h3>${td.name}</h3>
        <p>${td.periodTitle}</p>
      </div>
      <button data-action="edit" class="emojiBtn">&#128394;</button>
      <button data-action="delete" class="emojiBtn">&#128465;</button>
    `;
    task.addEventListener('click', (e) => { onTaskManageClick({e, globals, task}) })
    tasksContainer.append(task);
  }
}

async function onTaskManageClick({e, globals, task}) {
  if (e.target.dataset.action == 'edit') {
    globals.paintPage('taskCreator');
    
  } else if (e.target.dataset.action == 'delete') {
    //await globals.db.deleteItem('tasks', this.dataset.id);
    const td = JSON.parse(task.dataset.td);
    td.disabled = true;
    await globals.db.setItem('tasks', td);
    task.remove();
    globals.message({
      state: 'success', text: 'Task deleted'
    });
  } else return;
}

const taskCreator = {
  header: '&#128221; Add task',
  page: `
    <h3>Enter task you will control</h3>
    <input type="text" id="name" placeHolder="Task name"></input>
    <h3>How often you will do this task?</h3>
    <select id="period">
      <option value="1">Everyday</option>
      <option value="10">Every second day</option>
      <option value="1100">Two over two</option>
      <option value="1111100">On weekdays</option>
      <option value="0000011">Only weekends</option>
      <option value="oneTime">One time only</option>
      <!--<option value="custom">Custom period</option>-->
    </select>
    <h3 id="dateTitle"></h3>
    <input type="date" id="date"></input>
  `,
  footer: '<button id="saveTask">Save task</button>',
  script: onSaveTask
};

function onSaveTask(globals) {
  qs('#period').addEventListener('change', (e) => {
    const value = e.target.value;
    const show = (text) => {
      qs('#dateTitle').textContent = text;
      qs('#dateTitle').style.display = 'block';
      qs('#date').style.display = 'block';
    };
    if (value == 'oneTime') show('Select the date')
    else if (value == '10') show('Select start date')
    else if (value == '1100') show('Select first date')
    else {
      qs('#dateTitle').style.display = 'none';
      qs('#date').style.display = 'none';
    }
  });
  qs('#saveTask').addEventListener('click', () => {
    const task = createTask();
    if (task == 'error') return globals.message({
      state: 'fail', text: 'Fill all fields'
    });
    globals.db.setItem('tasks', task);
    globals.message({
      state: 'success', text: 'Task added'
    });
    globals.paintPage('planCreator');
  });
}

function createTask(id) {
  let period = qs('#period').value;
  if (parseInt(period)) period = parseInt(period);
  const task = {
    id: id ? id : Date.now().toString(),
    name: qs('#name').value,
    oneTime: period == 'oneTime',
    period,
    periodTitle: period,
    periodStart: qs('#date').value,
    periodDay: 0,
    disabled: false
  };
  console.log(task);
  if (task.name == '') return 'error';
  return task;
}

export const pages = {
  onboarding, planCreator, taskCreator
};
