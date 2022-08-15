import { renderToggler, toggleFunc, getTextDate } from './highLevel/taskThings.js'
import {
  /*emjs,*/ globQs as qs, globQsa as qsa, createOptionsList, togglableElement
} from './highLevel/utils.js'
import { getToday, oneDay, isCustomPeriod } from './highLevel/periods.js'
import { uploadData } from './highLevel/uploadBackup.js'
import { downloadData } from './highLevel/createBackup.js'
import { toggleExperiments } from './highLevel/settingsBackend.js'

const periodsCount = 5;

export const settings = {
  get title() { return `${emjs.box} Settings`},
  sections: ['periods', 'manageData', 'notifications'],
  fillHeader: ({page}) => {
    page.innerHTML = `
      <h4>${settings.title}</h4>
      <button id="closeSettings" class="emojiBtn" title="Close settings" aria-label="Close settings">
        ${emjs.cross}
      </button>
    `;
    qs('#closeSettings').addEventListener('click', () => history.back());
  },
  paint: async ({globals, page}) => {
    page.innerHTML = `
      <h2 data-section="periods">Periods</h2>
      <h3>Select up to ${periodsCount} periods that will be shown in Period choise drop down list of task</h3>
      <div id="periodsContainer" class="first doubleColumns" focusgroup></div>
      <h3>Create your own period for specific task performance</h3>
      <button id="toPeriodCreator">${emjs.calendar} Create custom period</button>
      <!--<h2 data-section="storage">Protect your data</h2>
      <h3>We store your data on your device and have no remote access to it</h3>
      <h3>Install app to the home screen to show your browser importance of the site's data to activate site's data protection</h3>-->
      <h2 data-section="manageData">Data management</h2>
      <div class="floatingMsg notFixed">
        <h3>${emjs.lockWKey} Your data is stored only on your device and have no remote access</h3>
      </div>
      <div class="doubleColumns">
        <div class="content">
          <h3>
            <!--Backups are using for be safe and prevent accidental data deletion or for transfer it to other device. -->
            Upload existent backup to this device or back up your current data
          </h3>
          <button id="uploadData" class="beforeUpload">${emjs.crateUp} Upload existent backup</button>
          <h3 class="beforeUpload">Only <strong>.dailer</strong> files accepted</h3>
          <input type="file" accept=".dailer" id="chooseFile" disabled aria-hidden="true">
          <progress class="uploadUI"></progress>
          <h3 class="uploadUI">Be patient and don't quit the app before uploading is done</h3>
          <h2 class="uploadSuccess emoji">${emjs.sign}</h2>
          <h3 class="uploadSuccess">Upload successfully completed, go back to check the tasks</h3>
          <button id="getData" class="success">${emjs.crateDown} Backup your current data</button>
          <progress class="downloadUI"></progress>
          <a id="downloadData" class="downloadLink" aria-hidden="true"></a>
        </div>
        <div>
          <h3>Set up a reminder to create backups periodically. You will able to download it just from app's main screen</h3>
          <div id="reminderInfo">
            <select id="reminderList" title="Select how often to remind you about creating backups"></select>
            <h3 id="nextRemind">Next remind</h3>
          </div>
          <div id="reminder" class="first"></div>
        </div>
      </div>
      <div id="notificationsC">
      <h2 data-section="notifications">Notifications</h2>
      <h3>You will get one time per day notifications about below listed things</h3>
      <div id="notifications" class="first"></div>
      <div id="notifTopics" class="doubleColumns" focusgroup>
        <!-- Bruh -->
      </div>
      </div>
      <div id="experiments"></div>
      <button id="toDebug" class="secondary">${emjs.construction} Open debug page</button>
      <h2>About</h2>
      <h3>${emjs.label} dailer app, version 1.3.8</h3>
      <h3>${emjs.sparkles} Emojis powered by <a href="https://github.com/googlefonts/noto-emoji/" target="_blank">Google</a></h3>
      <!--<h3>${emjs.magicBall} Codename: Sangria</h3>-->
      <h3>${emjs.microscope} Developed in 2022</h3>
    `;
    qs('#toPeriodCreator').addEventListener('click', () => {
      globals.closeSettings();
      globals.paintPage('periodCreator');
    });
    qs('#toDebug').addEventListener('click', () => {
      globals.closeSettings();
      globals.paintPage('debugPage');
    });
    qs('#uploadData').addEventListener('click', async () => await uploadData(globals));
    qs('#getData').addEventListener('click', async () => {
      const link = await downloadData(globals);
      link.click();
    });
    const remind = await globals.db.getItem('settings', 'backupReminder');
    const value = remind.value ? 1 : 0;
    togglableElement(qs('#reminderInfo'), value ? 'showing' : 'hided');
    renderToggler({
      name: `${emjs.alarmClock} Remind me`, id: 'reminder', buttons: [{
        emoji: emjs[value ? 'sign' : 'blank'],
        func: onReminderClick, args: { globals }
      }], page: qs('#reminder'), value
    });
    qs('#reminderList').addEventListener('change', async (e) => {
      const reminder = qs('[data-id="reminder"]');
      reminder.dataset.value = 1;
      reminder.children[1].innerHTML = emjs.sign;
      await onRemindIdChange(globals, e.target.value);
    });
    renderToggler({
      name: `${emjs.experiments} Enable experiments`, id: 'experiments', buttons: [{
        emoji: emjs[dailerData.experiments ? 'sign' : 'blank'],
        func: async ({e, elem}) => {
          dailerData.experiments = toggleFunc({e, elem});
          await globals.db.updateItem('settings', 'session', (session) => {
            session.experiments = dailerData.experiments;
          });
          globals.message({
            state: 'success', text: 'You probably need to reload app for all experiments will take effect'
          });
          toggleExperiments();
        }
      }], page: qs('#experiments'), value: dailerData.experiments
    });
    if (!dailerData.experiments) return;
    qs('#notificationsC').style.display = 'flex';
    const getNotifPerm = (value = Notification.permission) => value == 'granted' ? 1 : value == 'denied' ? 2 : 0;
    const getEmoji = (notifPerm) => {
      const value = getNotifPerm(notifPerm);
      return emjs[value == 1 ? 'sign' : value == 2 ? 'cross' : 'blank'];
    };
    renderToggler({
      name: `${emjs.bell} Enable notifications`, id: 'notifications', buttons: [{
        emoji: getEmoji(),
        func: async ({e, elem}) => {
          if (Notification.permission !== 'default') return;
          const target = e.target.dataset.action ? e.target : e.target.parentElement;
          target.innerHTML = emjs.loading;
          const resp = await Notification.requestPermission();
          target.innerHTML = getEmoji(resp);
        }
      }], page: qs('#notifications'), value: getNotifPerm()
    });
  },
  opening: async ({globals}) => {
    if (!qs('#periodsContainer').children.length) {
      await paintPeriods(globals);
    }
    if (!qs('#reminderList').children.length) {
      const reminderList = await globals.getList('reminderList');
      createOptionsList(qs('#reminderList'), reminderList);
      const remind = await globals.db.getItem('settings', 'backupReminder');
      if (remind.id) qs('#reminderList').value = remind.id;
      if (!remind.value) return;
      qs('#nextRemind').innerHTML = getNextRemindText(remind.nextRemind);
      qs('#nextRemind').style.display = 'block';
    }
  }
};

export async function paintPeriods(globals) {
  const pc = qs('#periodsContainer');
  const periods = await globals.getPeriods();
  const periodData = await globals.db.getItem('settings', 'periods');
  const editTitle = 'View or edit period';
  const markTitle = (per) => `Add period${per ? ` "${per}"` : ''} to drop down list`;
  pc.innerHTML = '';
  for (let per in periods) {
    const period = periods[per];
    const buttons = [];
    if (isCustomPeriod(period.id)) {
      buttons.push({
        emoji: emjs.pen, args: { globals },
        title: editTitle, aria: `${editTitle}: ${period.title}`,
        func: async ({globals}) => {
          if (!globals.pageInfo) globals.pageInfo = {};
          globals.pageInfo.periodId = period.id;
          globals.pageInfo.periodAction = 'edit';
          globals.closeSettings();
          await globals.paintPage('periodCreator');
        }
      });
    }
    const used = getPeriodUsed(periodData.list, per);
    buttons.push({
      emoji: emjs[used ? 'sign' : 'blank'], value: used,
      title: markTitle(), aria: markTitle(period.title),
      func: updatePeriodsList, args: { globals, periodsCount }
    });
    renderToggler({ name: period.title, id: period.id, page: pc, buttons });
  }
}

async function updatePeriodsList({e, globals, periodsCount, elem }) {
  const periodData = await globals.db.getItem('settings', 'periods');
  const list = periodData.list;
  const id = elem.dataset.id;
  if (list.includes(id)) {
    if (list.length == 1) {
      return globals.message({
        state: 'fail', text: `You need to have at least 1 period`
      });
    }
    const idx = list.indexOf(id);
    list.splice(idx, 1);
  } else {
    const isFull = list.length == periodsCount;
    isFull ? globals.message({
        state: 'fail', text: `You already choose ${periodsCount} periods`
      })
    : list.push(id);
    if (isFull) return;
  }
  list.sort((el1, el2) => {
    el1 = Number(el1);
    el2 = Number(el2);
    if (el1 > el2) return 1;
    if (el1 == el2) return 0;
    return -1;
  });
  await globals.db.setItem('settings', periodData);
  toggleFunc({e, elem});
}

function getPeriodUsed(periodsList, id) {
  return periodsList.includes(id) ? 1 : 0;
}

async function onReminderClick({e, elem, globals}) {
  const value = toggleFunc({e, elem});
  if (value) {
    const remindId = qs('#reminderList').value;
    if (remindId == '0') {
      toggleFunc({e, elem});
      globals.message({ state: 'fail', text: 'Select how often to remind you first' });
    } else await onRemindIdChange(globals, remindId);
  } else {
    await globals.db.updateItem('settings', 'backupReminder', (remind) => {
      remind.value = value;
    });
    qs('#reminderInfo').setStyle('hided');
    globals.message({ state: 'success', text: 'Reminder was removed' });
  }
}

async function onRemindIdChange(globals, remindId) {
  const reminderList = await globals.getList('reminderList');
  const remind = await globals.db.updateItem('settings', 'backupReminder', (remind) => {
    remind.knowAboutFeature = true;
    remind.id = remindId;
    remind.value = reminderList[remind.id].offset * oneDay;
    remind.nextRemind = getToday() + remind.value;
    remind.isDownloaded = false;
  });
  qs('#nextRemind').innerHTML = getNextRemindText(remind.nextRemind);
  qs('#reminderInfo').setStyle('showing');
  globals.message({
    state: 'success', text: `Now you will get reminders ${reminderList[remind.id].title}`
  });
  const elem = qs('.floatingMsg[data-id="reminderPromo"]');
  if (elem) elem.remove();
}

export function getNextRemindText(nextRemind) {
  if (nextRemind == getToday()) {
    return `You got reminder today`;
  }
  return `Next reminder will be ${getTextDate(nextRemind)}`;
}
