import { globQs as qs, globQsa as qsa, intlDate } from './utils.js'
import { getToday, oneDay, isCustomPeriod } from './periods.js'
import { createPeriod } from '../periodCreator.js'
import { createTask } from '../taskCreator.js'
import { isHistoryAvailable, getHistory } from '../taskInfo.js'

export async function uploading(globals, data) {
  for (let elem of qsa('.beforeUpload')) {
    elem.style.display = 'none';
  }
  for (let elem of qsa('.uploadUI')) {
    elem.style.display = 'block';
  }
  if (!localStorage.lastTasksChange) localStorage.lastTasksChange = Date.now().toString();
  const periodsConvert = {};
  for (let per of data.dailer_periods) {
    const period = createPeriod(per);
    periodsConvert[per.id] = period.id;
    await globals.db.setItem('periods', period);
  }
  const periods = await globals.getPeriods();
  const days = {};
  await globals.db.getAll('days', (day) => {
    days[day.date] = day;
  });
  let earliestDay = getToday();
  const tasks = [];
  const updateList = JSON.parse(localStorage.updateTasksList);
  for (let td of data.dailer_tasks) {
    if (td.periodStart < earliestDay) earliestDay = td.periodStart;
    td.id = Date.now().toString();
    if (isCustomPeriod(td.periodId)) td.periodId = periodsConvert[td.periodId];
    const task = createTask(periods, td);
    tasks.push(task);
    if (
      (task.special == 'oneTime' ? task.periodStart : task.endDate) == getToday() - oneDay
    ) updateList.push(task.id);
    await globals.db.setItem('tasks', task);
  }
  localStorage.updateTasksList = JSON.stringify(updateList);
  const diff = (getToday() - earliestDay + oneDay) / oneDay;
  for (let i = 0; i < diff; i++) {
    const date = earliestDay + oneDay * i;
    if (days[date]) continue;
    days[date] = await globals.worker.call({ process: 'getRawDay', args: [date, true] });
  }
  /*const prog = qs('progress.uploadUI');
  prog.max = tasks.length;
  prog.value = 0;*/
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const iha = isHistoryAvailable(task);
    const onActiveDay = async (date, item) => {
      const day = days[date];
      if (!day) return;
      console.log(`${task.name} ${intlDate(date)}`);
      day.tasks[task.priority][task.id] = item;
    };
    if (iha) await getHistory({ task, onActiveDay });
    else if (iha === false && task.special == 'oneTime') {
      await onActiveDay(task.periodStart, task.history[0]);
    } else if (iha === false && task.special == 'untilComplete') {
      const endDate = task.endDate ? Math.min(getToday(), task.endDate) : getToday();
      for (let i = task.periodStart; i < endDate; i += oneDay) {
        await onActiveDay(i, 0);
      }
      await onActiveDay(endDate, task.history[0]);
    }
    //prog.value = i + 1;
  }
  //prog.removeAttribute('value');
  for (let date in days) {
    await globals.db.setItem('days', days[date]);
  }
  //
  /*for (let elem of qsa('.beforeUpload')) {
    elem.style.display = 'block';
  }*/
  globals.pageInfo = { backupUploaded: true };
  for (let elem of qsa('.uploadUI')) {
    elem.style.display = 'none';
  }
  for (let elem of qsa('.uploadSuccess')) {
    elem.style.display = 'block';
  }
}
