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

export const intlDate = (date) => {
  return new Date(typeof date == 'string' ? Number(date) : date)
    .toLocaleDateString(navigator.language);
};

export const emjs = {
  sign: '&#x2705;',
  blank: '&#x2B1C;',
  cross: '&#x274C;',
  back: '&#x23EA;',
  stars: '&#x1F4AB;',
  book: '&#x1F4D2',
  notes: '&#x1F4D1;',
  paperWPen: '&#x1F4DD;',
  pen: '&#x1F58A;',
  trashCan: '&#x1F5D1;',
  sword: '&#x1F5E1;',
  empty: '&#x1F4AD;',
  save: '&#x1F4BE;',
  magic: '&#x1F52E;',
  calendar: '&#x1F5D3;',
  fire: '&#x1F525;',
  clock: '&#x1F551;',
  oldPaper: '&#x1F4DC;',
  paperList: '&#x1F4CB;',
  construction: '&#x1F3D7;',
  crateUp: '&#x1F4E4;',
  crateDown: '&#x1F4E5;',
  lockWKey: '&#x1F510;',
  settings: '&#x2699;',
  eyes: '&#x1F440;',
  light: '&#x1F4A1',
  fileBox: '&#x1F5C3;',
  label: '&#x1F3F7;',
  microscope: '&#x1F52C;',
  alarmClock: '&#x23F0;',
  bread: '&#x1F35E;',
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

export function createOptionsList(elem, options) {
  elem.innerHTML = '';
  for (let i = 0; i < options.length; i++) {
    const opt = document.createElement('option');
    opt.value = options[i].id || i;
    opt.textContent = options[i].title;
    if (options[i].selected) opt.selected = 'selected';
    if (options[i].disabled) opt.disabled = 'disabled';
    elem.append(opt);
  }
}

const inertElem = document.createElement('div');
if ('inert' in inertElem) window.dailerData.inert = true;
inertElem.remove();

export const inert = {
  set(elem) {
    if (!elem) return;
    elem.inert = true;
    if (dailerData.inert) return;
  },
  remove(elem) {
    if (!elem) return;
    elem.inert = false;
    if (dailerData.inert) return;
  }
};
