export const qs = (elem) => document.querySelector(elem);

export const getLast = (arr) => arr[arr.length - 1];

export const copyObject = (obj) => {
  const response = {};
  for (let name in obj) response[name] = obj[name];
  return response;
};

export const intlDate = (date) => new Date(date).toLocaleDateString(navigator.language);

export const emjs = {
  sign: '&#9989;',
  blank: '&#11036;',
  cross: '&#10060;',
  back: '&#9194;',
  stars: '&#128171;',
  books: '&#128218;',
  notes: '&#128209;',
  paperWPen: '&#128221;',
  pen: '&#128394;',
  trashCan: '&#128465;',
  sword: '&#128481;',
  empty: '&#128173;',
  save: '&#128190;',
  magic: '&#128302;',
  calendar: '&#128467;',
  fire: '&#128293;',
  clock: '&#128337;',
  oldPaper: '&#128220;',
  paperList: '&#128203;',
};
