import { globQs as qs, globQsa as qsa, intlDate } from './utils.js'
import { getToday, oneDay } from './periods.js'
import { createTask } from '../taskCreator.js'
import { getRawDay } from '../main.js'
import { isHistoryAvailable, getHistory } from '../taskInfo.js'

export async function uploading(globals, data) {
  qs('#uploadSuccess').style.display = 'none';
  for (let elem of qsa('.beforeUpload')) {
    elem.style.display = 'none';
  }
  for (let elem of qsa('.uploadUI')) {
    elem.style.display = 'block';
  }
  const periods = await globals.getPeriods();
  const days = await globals.db.getAll('days');
  let earliestDay = getToday();
  const tasks = [];
  for (let td of data.dailer_tasks) {
    td.id = Date.now().toString();
    if (td.periodStart < earliestDay) earliestDay = td.periodStart;
    const task = createTask(periods, td);
    tasks.push(task);
    await globals.db.setItem('tasks', task);
  }
  const diff = (getToday() - earliestDay + oneDay) / oneDay;
  for (let i = 0; i < diff; i++) {
    const date = String(earliestDay + oneDay * i);
    let day = await globals.db.getItem('days', date);
    if (day) continue;
    day = getRawDay(date, true);
    await globals.db.setItem('days', day);
  }
  const prog = qs('progress.uploadUI');
  prog.max = tasks.length;
  prog.value = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const iha = isHistoryAvailable(task);
    const onActiveDay = async (date, item) => {
      const day = await globals.db.getItem('days', String(date));
      if (!day) return console.log(date, intlDate(date));
      console.log(`${task.name} ${intlDate(date)}`);
      day.tasks[task.priority][task.id] = item;
      await globals.db.setItem('days', day);
    };
    if (iha) await getHistory({ task, onActiveDay });
    else if (iha === false && task.special == 'oneTime') {
      await onActiveDay(task.periodStart, task.history[0]);
    }
    prog.value = i + 1;
  }
  prog.removeAttribute('value');
  //
  /*for (let elem of qsa('.beforeUpload')) {
    elem.style.display = 'block';
  }*/
  for (let elem of qsa('.uploadUI')) {
    elem.style.display = 'none';
  }
  qs('#uploadSuccess').style.display = 'block';
}