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
    <div id="things"></div>
    <button id="addThing">Add thing</button>
  `,
  script: onPlanCreator
};

const onPlanCreator = async (globals) => {
  qs('#addThing').addEventListener(
    'click', () => globals.paintPage('thingCreator')
  );
  const things = await globals.db.getAll('things');
  const thingsContainer = qs('#things')
  if (!things.lenght) {
    thingsContainer.innerHTML = `<h3>There is nothing yet!</h3>`;
  } else for (let td of things) { // td stands for thingsData
    const thing = document.createElement('div');
    thing.className = 'thing';
    thing.innerHTML = `
      <h4>${td.name}</h4>
    `;
    thingsContainer.append(thing);
  }
}

const thingCreator = {
  page: `
    <h1>Add thing</h1>
    
    <button id="saveThing">Save thing</button>
  `,
  script: (globals) => {
    qs('#saveThing').addEventListener(
      'click', () => globals.paintPage('planCreator')
    );
  }
};

export const pages = {
  onboarding, planCreator, thingCreator
};
