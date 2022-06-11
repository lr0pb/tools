export const qs = (elem, page) => q('querySelector', elem, page, true);
export const qsa = (elem, page) => q('querySelectorAll', elem, page, true);

export const globQs = (elem) => q('querySelector', elem);
export const globQsa = (elem) => q('querySelectorAll', elem);

function q(func, elem, page, local) {
  if (page) {
    if (!document.querySelector(`#${page}`)) return null;
    return document[func](`#${page} ${elem}`);
  }
  return document[func](`${local ? '.current ' : ''}${elem}`);
}

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
  construction: '&#127959;',
  crateUp: '&#128228;',
  crateDown: '&#128229;',
  lockWKey: '&#128272;',
};

export function safeDataInteractions(elems) {
  for (let elem of elems) {
    if (history.state && history.state[elem]) qs(`#${elem}`).value = history.state[elem];
    qs(`#${elem}`).addEventListener('input', stateSave);
  }
}

function stateSave(e) {
  const state = copyObject(history.state);
  state[e.target.id] = e.target.value;
  history.replaceState(state, '', location.href);
}
