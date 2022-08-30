import { qs, qsa } from './highLevel/utils.js'

export const onboarding = {
  get title() { return `${emjs.sparkles} Welcome to the dailer ${emjs.sign}`},
  titleEnding: 'none',
  get header() { return ''},
  get page() { return `
    <div class="content center doubleColumns" data-stage="0">
      <h2 class="emoji">${emjs.sparkles}</h2>
      <h2>Plan tasks for the day and analyze how you grow yourself over time</h2>
    </div>
    <div class="content center doubleColumns" data-stage="1">
      <h2 class="emoji">${emjs.phone}</h2>
      <h2>You can choose to run dailer in browser or install it to homescreen</h2>
    </div>
    <div class="content center doubleColumns" data-stage="2">
      <h2 class="emoji">${emjs.warning}</h2>
      <h2>Sure to use in Safari?</h2>
      <h3>If you use dailer via Safari and will be inactive for 7 days, all your data will be deleted due to Apple restrictions</h3>
    </div>
  `},
  styleClasses: 'slider',
  noSettings: true,
  get footer() { return `<button id="action">${emjs.paperList} Create first task</button>`},
  script: ({globals, page}) => {
    const action = qs('#action');
    const setStage = (stage, title) => {
      action.dataset.stage = stage;
      action.innerHTML = title;
      qs(`div[data-stage="${stage}"]`).scrollIntoView({ behavior: 'smooth' });
    };
    if (dailerData.isSafari) setStage(0, `${emjs.forward} Start dailer`);
    else qsa('div:not([data-stage="0"])').forEach((el) => el.remove());
    action.addEventListener('click', async () => {
      if (dailerData.isSafari) {
        if (action.dataset.stage == '0') {
          action.classList.add('secondary');
          setStage(1, `${emjs.forward} Continue in Safari`);
          return globals.floatingMsg({
            id: 'installIOS', pageName: 'onboarding',
            text: `${emjs.crateUp} Click 'Share' and 'Install to homescreen'. Then close Safari and open dailer`
          });
        } else if (action.dataset.state == '1') {
          action.classList.remove('secondary');
          return setStage(2, `${emjs.forward} Confirm to use Safari`);
        }
      }
      await globals.db.updateItem('settings', 'session', (session) => {
        session.onboarded = true;
      });
      await globals.paintPage('taskCreator', { dontPushHistory: true });
    });
  }
};
