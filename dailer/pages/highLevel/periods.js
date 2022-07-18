export const isUnder3AM = () => {
  return new Date().getHours() < 3;
};

export const oneDay = 86400000; // 86 400 000 milliseconds in one day

export const getToday = () => { // date in milliseconds
  const rawToday = new Date().setHours(0, 0, 0, 0);
  return isUnder3AM() ? rawToday - oneDay : rawToday;
};

export const convertDate = (date) => {
  return new Date(date).toLocaleDateString('en-ca');
};

export function isCustomPeriod(periodId) {
  if (!periodId) return undefined;
  return Number(periodId) > Number(localStorage.defaultLastPeriodId);
}

export function getWeekStart() { // date in milliseconds
  const day = new Date(getToday());
  return day.setDate(day.getDate() - day.getDay());
}
