import { qs, emjs } from './highLevel/utils.js'

export const onboarding = {
  header: '',
  page: `
    <h2 class="emoji">${emjs.stars}</h2>
    <h2>Create your everyday plan for manage how you grow yourself over time</h2>
  `,
  centerContent: true,
  noSettings: true,
  footer: `<button id="create">${emjs.paperList} Create now</button>`,
  script: ({globals, page}) => {
    qs('#create').addEventListener('click', () => {
      localStorage.onboarded = 'true';
      qs('#openSettings').style.display = 'block';
      globals.paintPage('taskCreator', true);
    });
  }
};
