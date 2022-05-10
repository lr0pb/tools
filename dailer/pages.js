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
    <h1>Add your daily things you will control</h1>
    <div id="things" class="fullscreen"></div>
    <button id="addThing">Add thing</button>
  `,
  script: onPlanCreator
};

async function onPlanCreator (globals) {
  qs('#addThing').addEventListener(
    'click', () => globals.paintPage('thingCreator')
  );
  const things = await globals.db.getAll('things');
  const thingsContainer = qs('#things');
  if (!things.lenght) {
    thingsContainer.innerHTML = `<h3>There is nothing yet!</h3>`;
  } else for (let td of things) { // td stands for thingsData
    const thing = document.createElement('div');
    thing.className = 'thing';
    thing.dataset.id = td.id;
    thing.innerHTML = `
      <h3>${td.name}</h3>
      <button data-action="edit" class="smolBtn">Edit</button>
      <button data-action="delete" class="smolBtn">Delete</button>
    `;
    thing.addEventListener('click', (e) => {
      
    })
    thingsContainer.append(thing);
  }
}

const thingCreator = {
  page: `
    <h1>Add thing</h1>
    <input type="text" id="name" placeHolder="Enter your task you will add"></input>
    <select id="period">
      <option>One time only</option>
      <option>Everyday</option>
      <option>Every second day</option>
      <option>Two over two</option>
      <option>Only weekdays</option>
      <option>On weekends<option>
      <option>Custom period</option>
    </select>
    <button id="saveThing">Save thing</button>
  `,
  script: onSaveThing
};

function onSaveThing(globals) {
  qs('#saveThing').addEventListener(
    'click', () => {
      globals.db.setItem('things', {
        id: createId(),
        name: String(qs('#name').textContent),
        disabled: false
      });
      globals.paintPage('planCreator');
    }
  );
}

export const pages = {
  onboarding, planCreator, thingCreator
};
