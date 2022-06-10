export async function getData(globals) {
  const data = {
    dailer_about: `dailer user's data file exported from the app`,
    dailer_created: Date.now().toString(),
    dailer_tasks: []
  };
  const tasks = await globals.db.getAll('tasks');
  for (let td of tasks) { // td - task data
    if (td.deleted) return;
    const task = {
      name: td.name,
      period: td.period,
      periodId: td.periodId,
      periodDay: td.periodDay,
      periodStart: td.periodStart,
      created: new Date(Number(td.id)).setHours(0, 0, 0, 0),
      priority: td.priority,
      history: td.history
    };
    if (td.endDate) task.endDate = td.endDate;
    if (td.special) task.special = td.special;
    if (td.disabled) task.disabled = true;
    data.dailer_tasks.push(task);
  }
  return data;
}
