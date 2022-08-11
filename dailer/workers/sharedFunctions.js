async function checkBackupReminder() {
  const data = await db.getItem('settings', 'backupReminder');
  const resp = { show: false };
  if (!data.remindValue) return resp;
  if (data.nextRemind === getToday() && data.reminded) return resp;
  while (data.nextRemind < getToday()) {
    data.reminded = false;
    data.nextRemind += data.remindValue;
  }
  if (data.nextRemind === getToday()) resp.show = true;
  await db.setItem('settings', data);
  return resp;
};
