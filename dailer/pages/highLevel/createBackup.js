import { getToday, normalizeDate, isCustomPeriod } from './periods.js'

export async function getData(globals) {
  const data = {
    dailer_about: `User's data backup from dailer app`,
    dailer_link: location.origin + location.pathname,
    dailer_created: getToday(),
    dailer_tasks: [],
    dailer_periods: []
  };
  await globals.db.getAll('tasks', (td) => {
    if (td.deleted) return;
    const task = {
      name: td.name,
      period: td.period,
      periodId: td.periodId,
      periodDay: td.periodDay,
      periodStart: td.periodStart,
      created: td.created || normalizeDate(td.id),
      priority: td.priority,
      history: td.history
    };
    if (td.endDate) task.endDate = td.endDate;
    if (td.special) task.special = td.special;
    if (td.disabled) task.disabled = true;
    data.dailer_tasks.push(task);
  });
  await globals.db.getAll('periods', (per) => {
    if (!isCustomPeriod(per.id)) return;
    delete per.selectTitle;
    delete per.periodDay;
    data.dailer_periods.push(per);
  });
  return data;
}
