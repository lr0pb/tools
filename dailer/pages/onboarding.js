import { qs, /*emjs*/ } from './highLevel/utils.js'

export const onboarding = {
  title: `${emjs.stars} Welcome to the dailer ${emjs.sign}`,
  titleEnding: 'none',
  get header() { return ''},
  get page() { return `
    <h2 class="emoji">${emjs.stars}</h2>
    <h2>Create your everyday plan for manage how you grow yourself over time</h2>
  `},
  styleClasses: 'center doubleColumns',
  noSettings: true,
  get footer() { return `<button id="create">${emjs.paperList} Create now</button>`},
  script: ({globals, page}) => {
    qs('#create').addEventListener('click', () => {
      localStorage.onboarded = 'true';
      globals.paintPage('taskCreator', true);
    });
  }
};
