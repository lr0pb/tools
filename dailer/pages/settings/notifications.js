import { globQs as qs } from '../highLevel/utils.js'
import { renderToggler, toggleFunc } from '../highLevel/taskThings.js'
import { installApp } from '../main.js'

export async function addNotifications(globals) {
  const session = await globals.db.getItem('settings', 'session');
  const notifications = await globals.db.getItem('settings', 'notifications');
  const periodicSync = await globals.db.getItem('settings', 'periodicSync');
  if (dailerData.isIOS || !notifications.support || !periodicSync.support) {
    return qs('style.notif').innerHTML = '.notif { display: none !important; }';
  }
  const currentValue = getNotifPerm(null, notifications.enabled);
  toggleNotifReason(currentValue);
  renderToggler({
    name: `${emjs.bell} Enable notifications`, id: 'notifications', buttons: [{
      emoji: getEmoji(null, notifications.enabled),
      func: onNotifTogglerClick, args: { globals }
    }], page: qs('#notifications'), value: currentValue
  });
}

function getNotifPerm(value = Notification.permission, enabled) {
  if (value == 'granted') return enabled ? 1 : 0;
  return !session.installed ? 3 : value == 'granted' ? 1 : value == 'denied' ? 2 : 0;
}

function getEmoji(notifPerm, enabled) {
  const value = getNotifPerm(notifPerm, enabled);
  return emjs[value == 1 ? 'sign' : value == 2 ? 'cross' : value == 3 ? 'lock' : 'blank'];
}

function toggleNotifReason(value, globals) {
  if (!value && value !== 0) value = getNotifPerm();
  if ([2, 3].includes(value)) {
    qs('#notifReason').style.display = 'block';
    qs('#notifReason').innerHTML = value == 2
    ? `${emjs.warning} You denied in notifications permission, so grant it via site settings in browser`
    : `${emjs.warning} Notifications are available only as you install app on your home screen`;
    if (value == 3) {
      qs('#install').style.display = 'block';
      qs('#install').onClick = async () => {
        if (!globals.installPrompt) return;
        await installApp(globals);
      };
    }
  } else {
    qs('#notifReason').style.display = 'none';
    qs('#install').style.display = 'none';
    if (globals) fillNotifTopics(globals, value);
  }
}

export async function fillNotifTopics(globals, enabled) {
  if (!enabled && enabled !== 0) {
    const notifications = await globals.db.getItem('settings', 'notifications');
    enabled = notifications.enabled ? 1 : 0;
  }
  const notifTopics = qs('#notifTopics');
  notifTopics.innerHTML = '';
  const list = await globals.getList('notifications');
  for (let item of list) {
    const firstValue = notifications.byCategories[item.name] ? 1 : 0;
    renderToggler({
      name: item.title, value: firstValue, buttons: [{
        emoji: emjs[firstValue ? 'sign' : 'blank'],
        func: async ({e, elem}) => {
          const value = toggleFunc({e, elem});
          await globals.db.updateItem('settings', 'notifications', (data) => {
            data.byCategories[item.name] = value ? true : false;
          });
        }
      }], page: notifTopics, disabled: !enabled
    });
  }
}

async function onNotifTogglerClick({e, elem, globals}) {
  const session = await globals.db.getItem('settings', 'session');
  const target = e.target.dataset.action ? e.target : e.target.parentElement;
  if (!session.installed) {
    elem.dataset.value = '3';
    target.innerHTML = emjs.lock;
    return globals.message({
      state: 'success', text: 'Install dailer on your home screen to unlock notifications'
    });
  }
  if (Notification.permission == 'denied') {
    elem.dataset.value = '2';
    target.innerHTML = emjs.cross;
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
    const value = getNotifPerm(resp, data.enabled);
    toggleNotifReason(value, globals);
    elem.dataset.value = value;
    return target.innerHTML = getEmoji(resp, data.enabled);
  }
  const value = toggleFunc({e, elem});
  await globals.db.updateItem('settings', 'notifications', (data) => {
    data.enabled = value ? true : false;
  });
  await fillNotifTopics(globals, value);
}
