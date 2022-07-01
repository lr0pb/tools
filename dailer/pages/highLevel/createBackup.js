export async function getData(globals) {
  const data = {
    dailer_about: `User's data backup from dailer app`,
    dailer_link: location.origin + location.pathname,
    dailer_created: Date.now(),
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
      created: td.created || new Date(Number(td.id)).setHours(0, 0, 0, 0),
      priority: td.priority,
      history: td.history
    };
    if (td.endDate) task.endDate = td.endDate;
    if (td.special) task.special = td.special;
    if (td.disabled) task.disabled = true;
    data.dailer_tasks.push(task);
  });
  await globals.db.getAll('periods', (per) => {
    delete per.selectTitle;
    delete per.periodDay;
    data.dailer_periods.push(per);
  });
  return data;
}
