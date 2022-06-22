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

let emjs = {
  sign: '2705',
  blank: '2B1C',
  cross: '274C',
  back: '23EA',
  stars: '1F4AB',
  books: '1F4DA',
  notes: '1F4D1',
  paperWPen: '1F4DD',
  pen: '1F58A',
  trashCan: '1F5D1',
  sword: '1F5E1',
  empty: '1F4AD',
  save: '1F4BE',
  magic: '1F52E',
  calendar: '1F5D3',
  fire: '1F525',
  clock: '1F551',
  oldPaper: '1F4DC',
  paperList: '1F4CB',
  construction: '1F3D7',
  crateUp: '1F4E4',
  crateDown: '1F4E5',
  lockWKey: '1F510',
  settings: '2699',
};
emjs = new Proxy(emjs, {
  get(target, prop) {
    if (prop in target) {
      return `&#x${target[prop]};`;
    } else return '';
  }
});
export emjs;

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
