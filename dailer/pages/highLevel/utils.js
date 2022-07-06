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
  if (!elem) return;
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

export function handleKeyboard(elem, noBubbeling) {
  if (!dailerData.isDesktop) return;
  elem.addEventListener('keydown', (e) => {
    if (['Enter', 'Space'].includes(e.code)) {
      if (noBubbeling && e.target !== elem) return;
      e.preventDefault();
      e.target.click();
    }
  });
}

const transform = 'translateY(3rem)';

export function togglableElement(elem, styleCode) {
  if (!elem || !styleCode) return;
  elem.classList.add('togglableElement');
  elem.setStyle = (styleCode) => {
    if (!['hided', 'showing'].includes(styleCode)) return;
    if (elem.children.length !== 2) return;
    elem.dataset.styleCode = styleCode;
    const value = styleCode == 'showing' ? 1 : 0;
    elem.children[0].style.transform = value ? 'none' : transform;
    elem.children[1].style.opacity = value;
  };
  elem.toggleStyle = () => {
    const newStyle = elem.dataset.styleCode == 'hided' ? 'showing' : 'hided';
    elem.setStyle(newStyle);
  };
  elem.setStyle(styleCode);
}

export function checkForFeatures(features) {
  let elem = document.createElement('div');
  for (let feat of features) {
    window.dailerData[feat] = feat in elem;
  }
  elem.remove();
  elem = null;
}

export function isDesktop() {
  if (navigator.userAgentData) {
    return !navigator.userAgentData.mobile;
  }
  if ('standalone' in navigator) return false;
  return window.matchMedia('(pointer: fine) and (hover: hover)').matches;
}

const focusables = [
  'button:not(:disabled)', 'input:not(:disabled)', '[role="button"]:not([disabled])'
].join(', ');

export const inert = {
  set(elem, dontSaveFocus) {
    if (!elem) return;
    const page = {};
    if (!dontSaveFocus) page.focused = document.activeElement;
    elem.inert = true;
    if (!dailerData.inert) {
      elem.ariaHidden = true;
      let focusableElems = elem.querySelectorAll(focusables);
      page.existentAttributes = new Map();
      for (let el of focusableElems) {
        page.existentAttributes.set(el, {
          disabled: el.disabled,
          tabIndex: el.tabIndex
        });
        el.disabled = true;
        el.tabIndex = -1;
      }
    }
    inert._cache.set(elem, page);
  },
  remove(elem) {
    if (!elem) return;
    elem.inert = false;
    const page = inert._cache.get(elem);
    if (!dailerData.inert) {
      elem.ariaHidden = false;
      if (page) for (let [el, saved] of page.existentAttributes) {
        el.disabled = saved.disabled;
        el.tabIndex = saved.tabIndex;
      }
    }
    const elemToFocus = page && page.focused
    ? page.focused : elem.querySelector(focusables);
    if (elemToFocus) elemToFocus.focus();
  },
  _cache: new Map(),
  clearCache(elem) { inert._cache.delete(elem); }
};
