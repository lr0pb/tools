export const getToday = () => { // date in milliseconds
  return new Date().setHours(0, 0, 0, 0);
};

export const convertDate = (date) => {
  return new Date(date).toLocaleDateString('en-ca');
};

export const oneDay = 86400000; // 86 400 000 milliseconds in one day

export const periods = {
  '01': {
    id: '01',
    title: 'Today only',
    days: [1],
    get startDate() { return getToday(); },
    periodDay: -1,
    special: 'oneTime',
    selected: true
  },
  '02': {
    id: '02',
    title: 'Tomorrow',
    days: [1],
    get startDate() { return getToday() + oneDay; },
    periodDay: -1,
    special: 'oneTime'
  },
  '03': {
    id: '03',
    title: 'Everyday',
    days: [1],
    selectTitle: 'Select day to start',
    periodDay: -1,
    maxDate: 6
  },
  '04': {
    id: '04',
    title: 'Every second day',
    days: [1, 0],
    selectTitle: 'Select day to start',
    periodDay: -1,
    maxDate: 13
  },
  '05': {
    id: '05',
    title: 'Two over two',
    days: [1, 1, 0, 0],
    selectTitle: 'Select day to start',
    periodDay: -1,
    maxDate: 13
  },
  '06': {
    id: '06',
    title: 'On weekdays',
    days: [0, 1, 1, 1, 1, 1, 0],
    getWeekStart: true
  },
  '07': {
    id: '07',
    title: 'Only weekends',
    days: [1, 0, 0, 0, 0, 0, 1],
    getWeekStart: true
  },
  '08': {
    id: '08',
    title: 'One time only',
    days: [1],
    selectTitle: 'Select the day',
    periodDay: -1,
    special: 'oneTime'
  },
  '09': {
    id: '09',
    title: 'One time until complete',
    days: [1],
    get startDate() { return getToday(); },
    description: 'Task will be active unlimited time until you complete them',
    periodDay: -1,
    special: 'untilComplete'
  }
};

export function isCustomPeriod(periodId) {
  if (!periodId) return undefined;
  return Number(periodId) > Number(localStorage.defaultLastPeriodId);
}

export function getWeekStart() { // date in milliseconds
  const day = new Date(getToday());
  return day.setDate(day.getDate() - day.getDay());
}
