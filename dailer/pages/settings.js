import { renderToggler } from './highLevel/taskThings.js'
import { emjs, globQs as qs } from './highLevel/utils.js'
import { getToday } from './highLevel/periods.js'
import { uploading } from './highLevel/uploadBackup.js'
import { getData } from './highLevel/createBackup.js'

const periodsCount = 5;

export const settings = {
  sections: ['periods', 'import'],
  paint: async ({globals, page}) => {
    page.innerHTML = `
      <h2 data-section="periods">Periods</h2>
      <h3>Set up to ${periodsCount} periods that will be shown in Period choise drop down list of task</h3>
      <div id="periodsContainer" class="first doubleColumns"></div>
      <h3>Create your own period for specific task performance</h3>
      <button id="toPeriodCreator">${emjs.calendar} Create custom period</button>
      <!--<h2 data-section="storage">Protect your data</h2>
      <h3>We store your data on your device and have no remote access to it</h3>
      <h3>Install app to the home screen to show your browser importance of the site's data to activate site's data protection</h3>-->
      <h2 data-section="import">Data management</h2>
      <div class="floatingMsg notFixed">
        <h3>${emjs.lockWKey} Your data is stored only on your device and have no remote access</h3>
      </div>
      <h3>Backup your data to be safe and prevent accidental deletion or transfer it to other device or upload your existent backup to this device</h3>
      <button id="uploadData" class="beforeUpload">${emjs.crateDown} Upload existent backup</button>
      <h3 class="beforeUpload">Accepted .dailer files only</h3>
      <input type="file" accept=".dailer" id="chooseFile">
      <progress class="uploadUI"></progress>
      <h3 class="uploadUI">Be patient and don't quit the app before uploading done</h3>
      <h2 class="uploadSuccess emoji">${emjs.sign}</h2>
      <h3 class="uploadSuccess">Upload successfully completed, go back to check the tasks</h3>
      <button id="getData" class="success">${emjs.crateUp} Backup your current data</button>
      <a id="downloadData" class="downloadLink"></a>
      <button id="toDebug" class="secondary">${emjs.construction} Open debug page</button>
    `;
    qs('#toPeriodCreator').addEventListener('click', () => {
      globals.closeSettings(true);
      globals.paintPage('periodCreator');
    });
    qs('#toDebug').addEventListener('click', () => {
      globals.closeSettings(true);
      globals.paintPage('debugPage');
    });
    qs('#uploadData').addEventListener('click', async () => await uploadData(globals));
    qs('#getData').addEventListener('click', async () => await downloadData(globals));
  },
  opening: async ({globals}) => {
    if (!qs('#periodsContainer').children.length) {
      await paintPeriods(globals);
    }
  }
};

export async function paintPeriods(globals) {
  const pc = qs('#periodsContainer');
  const periods = await globals.getPeriods();
  pc.innerHTML = '';
  for (let per in periods) {
    const period = periods[per];
    renderToggler({
      name: period.title, id: period.id,
      emoji: getPeriodUsed(per),
      func: updatePeriodsList,
      args: { globals, periodsCount }, page: pc
    });
  }
}

function updatePeriodsList({e, globals, periodsCount, elem }) {
  const list = JSON.parse(localStorage.periodsList);
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
    list.length == periodsCount
    ? globals.message({
        state: 'fail', text: `You already choose ${periodsCount} periods`
      })
    : list.push(id);
  }
  list.sort((el1, el2) => {
    el1 = Number(el1);
    el2 = Number(el2);
    if (el1 > el2) return 1;
    if (el1 == el2) return 0;
    return -1;
  });
  localStorage.periodsList = JSON.stringify(list);
  e.target.innerHTML = getPeriodUsed(id);
}

function getPeriodUsed(id) {
  return JSON.parse(localStorage.periodsList).includes(id)
  ? emjs.sign : emjs.blank;
}

async function uploadData(globals) {
  const chooser = qs('#chooseFile');
  chooser.addEventListener('change', () => {
    const file = chooser.files[0];
    if (!file.name.includes('.dailer')) return globals.message({
      state: 'fail', text: 'Wrong file choosed'
    });
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async () => {
      const data = JSON.parse(reader.result);
      if (typeof data !== 'object') return globals.message({
        state: 'fail', text: 'Unknown file content'
      });
      const cr = data.dailer_created;
      if ( !cr || (cr && new Date(cr).setHours(0, 0, 0, 0) !== getToday()) ) return globals.message({
        state: 'fail', text: `You must upload today's created backup`
      });
      await uploading(globals, data);
    };
  });
  chooser.click();
}

async function downloadData(globals) {
  const data = await getData(globals);
  const blob = new Blob([JSON.stringify(data)], {type: 'application/vnd.dailer+json'});
  const link = qs('#downloadData');
  const name = String(data.dailer_created).match(/(?<=\d\d)\d{6}/)[0];
  link.download = `${name}.dailer`;
  link.href = URL.createObjectURL(blob);
  link.click();
}
