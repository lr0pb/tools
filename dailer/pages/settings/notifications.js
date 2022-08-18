import { globQs as qs, globQsa as qsa } from '../highLevel/utils.js'
import { renderToggler, toggleFunc } from '../highLevel/taskThings.js'
import { installApp } from '../main.js'

export async function addNotifications(globals) {
  const session = await globals.db.getItem('settings', 'session');
  const notifications = await globals.db.getItem('settings', 'notifications');
  const periodicSync = await globals.db.getItem('settings', 'periodicSync');
  if (dailerData.isIOS || !notifications.support || !periodicSync.support) {
    return qs('.notifStyle').innerHTML = '.notif { display: none !important; }';
  }
  const currentValue = getNotifPerm(session, null, notifications.enabled);
  toggleNotifReason(session, currentValue, globals);
  renderToggler({
    name: `${emjs.bell} Enable notifications`, id: 'notifications', buttons: [{
      emoji: getEmoji(session, null, notifications.enabled),
      func: onNotifTogglerClick, args: { globals }
    }], page: qs('#notifications'), value: currentValue
  });
}

function getNotifPerm(session, value = Notification.permission, enabled) {
  if (value == 'granted') return enabled ? 1 : 0;
  return !session.installed ? 3 : value == 'granted' ? 1 : value == 'denied' ? 2 : 0;
}

function getEmoji(session, notifPerm, enabled, forcedValue) {
  const value = forcedValue !== undefined
  ? forcedValue : getNotifPerm(session, notifPerm, enabled);
  return emjs[value == 1 ? 'sign' : value == 2 ? 'cross' : value == 3 ? 'lock' : 'blank'];
}

function isBadValue(value) {
  return [2, 3].includes(value);
}

function toggleNotifReason(session, value, globals) {
  if (!value && value !== 0) value = getNotifPerm(session);
  if (isBadValue(value)) {
    qs('#notifTopics').innerHTML = '';
    qs('#notifReason').innerHTML = value == 2
    ? `${emjs.warning} You denied in notifications permission, so grant it via site settings in browser`
    : `${emjs.warning} Notifications are available only as you install app on your home screen`;
    if (value == 3) {
      qs('#install').style.display = 'block';
      qs('#install').onclick = async () => {
        if (!globals) return;
        if (!globals.installPrompt) return;
        await installApp(globals);
        const actualSession = await globals.db.getItem('settings', 'session');
        const actualValue = getNotifPerm(actualSession);
        setNotifTogglerState(elem, actualValue);
        toggleNotifReason(actualSession, actualValue, globals);
      };
    }
  } else {
    qs('#notifReason').innerHTML = 'Set what about notifications you will get';
    qs('#install').style.display = 'none';
    if (globals) fillNotifTopics(globals, value);
  }
}

export async function fillNotifTopics(globals, enabled) {
  const session = await globals.db.getItem('settings', 'session');
  const notifications = await globals.db.getItem('settings', 'notifications');
  if (!enabled && enabled !== 0) {
    enabled = notifications.enabled ? 1 : 0;
  }
  const value = getNotifPerm(session, null, enabled);
  if (isBadValue(value)) return;
  const notifTopics = qs('#notifTopics');
  notifTopics.innerHTML = '';
  const list = await globals.getList('notifications');
  for (let item of list) {
    const firstValue = notifications.byCategories[item.name] ? 1 : 0;
    renderToggler({
      name: item.title, id: 'notifTopic', buttons: [{
        emoji: emjs[firstValue ? 'sign' : 'blank'],
        func: async ({e, elem}) => {
          const value = toggleFunc({e, elem});
          await globals.db.updateItem('settings', 'notifications', (data) => {
            data.byCategories[item.name] = value ? true : false;
          });
        }
      }], page: notifTopics, value: firstValue, disabled: !enabled
    });
  }
}

function setNotifTogglerState(elem, value) {
  if (!elem) elem = qs('[data-id="notifications"]');
  elem.dataset.value = value;
  elem.querySelector('button').innerHTML = getEmoji(null, null, null, value);
}

async function onNotifTogglerClick({e, elem, globals}) {
  const session = await globals.db.getItem('settings', 'session');
  const target = e.target.dataset.action ? e.target : e.target.parentElement;
  if (!session.installed) {
    setNotifTogglerState(elem, 3);
    return globals.message({
      state: 'success', text: 'Install dailer on your home screen to unlock notifications'
    });
  }
  if (Notification.permission == 'denied') {
    setNotifTogglerState(elem, 2);
    return globals.message({
      state: 'fail', text: 'Enable notifications via site settings in browser'
    });
  }
  if (Notification.permission == 'default') {
    target.innerHTML = emjs.loading;
    const resp = await Notification.requestPermission();
    const data = await globals.db.updateItem('settings', 'notifications', (data) => {
      data.permission = resp;
      data.enabled = resp == 'granted' ? true : false;
    });
    const value = getNotifPerm(session, resp, data.enabled);
    isBadValue(value) ? toggleNotifReason(session, value) : updateNotifTopics(!value);
    elem.dataset.value = value;
    return target.innerHTML = getEmoji(session, resp, data.enabled);
  }
  const value = toggleFunc({e, elem});
  await globals.db.updateItem('settings', 'notifications', (data) => {
    data.enabled = value ? true : false;
  });
  updateNotifTopics(!value);
}

function updateNotifTopics(disabled) {
  for (let elem of qsa('[data-id="notifTopic"]')) {
    elem
      .querySelector('button')
      [disabled ? 'setAttribute' : 'removeAttribute']
      ('disabled', '');
  }
}
