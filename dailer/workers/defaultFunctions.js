const database = { name: 'dailer', version: 5 };

const getRawDate = (date) => {
  return new Date(date).setHours(0, 0, 0, 0);
};

const isUnder3AM = (date) => {
  if (!date) date = new Date();
  return date.getTime() === getRawDate(date)
  ? false : date.getHours() < 3;
};

const oneDay = 86400000; // 86 400 000 milliseconds in one day

const normalizeDate = (date) => {
  if (typeof date == 'string') date = Number(date);
  date = new Date(date);
  const rawDate = getRawDate(date);
  return isUnder3AM(date) ? rawDate - oneDay : rawDate;
};

const getToday = () => { // date in milliseconds
  return normalizeDate(Date.now());
};

function isCustomPeriod(periodId) {
  if (!periodId) return undefined;
  return Number(periodId) > 50;
}

function intlDate(date) {
  return new Date(typeof date == 'string' ? Number(date) : date)
    .toLocaleDateString(navigator.language);
}

function getTextDate(date) {
  let resp = intlDate(date);
  if (date == getToday()) resp = 'today';
  else if (date - oneDay == getToday()) resp = 'tomorrow';
  else if (date + oneDay == getToday()) resp = 'yesterday';
  return resp;
}

function setPeriodTitle(task) {
  task.periodStart = normalizeDate(task.periodStart);
  const startTitle = getTextDate(task.periodStart);
  const endTitle = task.endDate ? getTextDate(task.endDate) : null;

  if (task.special == 'oneTime' && task.period.length == 1) {
    task.periodTitle = `Only ${startTitle}`;
  } else if (task.special == 'untilComplete' && task.endDate) {
    task.periodTitle = `${task.disabled ? 'Ended' : 'Complete until'} ${endTitle}`;
  } else if (task.periodStart > getToday()) {
    task.periodTitle += ` from ${startTitle}`;
  } else if (task.endDate && !task.disabled) {
    task.periodTitle += ` to ${endTitle}`;
  }
}

/**
* @objectStores - array e.g. [{name: 'name', index: {keyPath: 'title'}}]
*/

class IDB {
  constructor(name, version, objectStores) {
    if (typeof name != 'string' || typeof version != 'number' || !Array.isArray(objectStores)) {
      return console.error(`[IDB] Wrong arguments data types, can't open database`);
    }
    this._timeToWait = 5;
    this._listeners = {};
    this.idb = indexedDB.open(name, version);
    this.idb.addEventListener('upgradeneeded', () => this._upgradeneeded(objectStores));
    this.idb.addEventListener('success', () => this._success());
    return this;
  }
  _upgradeneeded(objectStores) {
    console.log('[IDB] Upgradeneeded event');
    this.db = this.idb.result;
    const actualStores = {};
    for (let store of objectStores) {
      if (typeof store.name == 'string' && typeof store.index == 'object') {
        if (!this.db.objectStoreNames.contains(store.name)) {
          this.db.createObjectStore(store.name, store.index);
        }
        actualStores[store.name] = true;
      }
    };
    for (let storeName of this.db.objectStoreNames) {
      if (!actualStores[storeName]) this.db.deleteObjectStore(storeName);
    };
  }
  _success() {
    console.log('[IDB] Database successfully opened');
    this.db = this.idb.result;
    this.db.addEventListener('versionchange', () => this._versionchange());
  }
  _versionchange() {
    this.db.close();
    this._closedDueToVersionChange = true;
    console.error('[IDB] Database closed due to version change, update page');
  }
  async _isDbReady() {
    if (this._closedDueToVersionChange) return false;
    if (!this.db) await new Promise((resolve) => {
      const isComplete = () => this.db ? resolve() : setTimeout(isComplete, this._timeToWait);
      isComplete();
    });
    return true;
  }
  _err(name) { return `[IDB] Error in db.${name}: `; }
  _checkStore(name, store) {
    if (!this.db.objectStoreNames.contains(store)) {
      console.error(`${this._err(name)}database haven't "${store}" store`);
      return false;
    }
    return true;
  }
  _argsCheck(name, args) {
    for (let argName in args) {
      const arg = args[argName];
      if (!arg.required && !arg.value) continue;
      if (arg.required && !arg.value) return console.error(`${this._err(name)}waited for ${argName} argument but receives nothing`);
      if (arg.type && typeof arg.value !== arg.type) {
        return console.error(`${this._err(name)}waited for ${argName} argument type ${arg.type} but receives type ${typeof arg.value}`);
      }
    }
    return true;
  }
  async _dbCall(name, args, mode, action, actionArgument, onResult, onSuccess) {
    if(!this._argsCheck(name, args)) return;
    const isReady = await this._isDbReady();
    if (!isReady) return;
    const store = args.store.value;
    if(!this._checkStore(name, store)) return;
    const objectStore = this.db
      .transaction(store, mode)
      .objectStore(store);
    const actioner = objectStore[action](actionArgument);
    let complete = false;
    actioner.addEventListener('success', () => {
      complete = onSuccess ? onSuccess(actioner.result) : true;
    });
    await new Promise((resolve) => {
      const isComplete = () => complete ? resolve() : setTimeout(isComplete, this._timeToWait);
      isComplete();
    });
    const resp = onResult ? onResult(actioner.result) : null;
    return resp || this;
  }
/**
* @item - object e.g. {title: 'title', author: 'name', data: new ArrayBuffer(32)}
*/
  async setItem(store, item) {
    const resp = await this._dbCall('setItem', {
      store: { value: store, required: true, type: 'string' },
      item: { value: item, required: true, type: 'object' }
    }, 'readwrite', 'put', item, () => {
      if (store in this._listeners) {
        this._listeners[store].map((callback) => callback(store, item));
      }
    });
    return resp;
  }
  async getItem(store, title) {
    const resp = await this._dbCall('getItem', {
      store: { value: store, required: true, type: 'string' },
      title: { value: title, required: true }
    }, 'readonly', 'get', title, (result) => result);
    return resp;
  }
/**
* @updateCallback(item) - async function that receive item and can change fields in them
*/
  async updateItem(store, title, updateCallback) {
    if (!this._argsCheck('updateItem', {
      store: { value: store, required: true, type: 'string' },
      title: { value: title, required: true },
      updateCallback: { value: updateCallback, required: true, type: 'function' }
    })) return;
    const data = await this.getItem(store, title);
    await updateCallback(data);
    await this.setItem(store, data);
    return data;
  }
/**
* @onData(item, index) - async function that calls every time when new store item is received
*/
  async getAll(store, onData) {
    const items = [];
    const resp = await this._dbCall('getAll', {
      store: { value: store, required: true, type: 'string' },
      onData: { value: onData, type: 'function' }
    }, 'readonly', 'openCursor', null, null, async (result) => {
      if (result) {
        const value = result.value;
        const index = items.length;
        items.push(value);
        if (onData) await onData(value, index);
        result.continue();
      } else return true;
    });
    return resp ? items : resp;
  }
  async deleteItem(store, title) {
    const resp = await this._dbCall('deleteItem', {
      store: { value: store, required: true, type: 'string' },
      title: { value: title, required: true }
    }, 'readwrite', 'delete', title);
    return resp;
  }
  async deleteAll(store) {
    const resp = await this._dbCall('deleteAll', {
      store: { value: store, required: true, type: 'string' }
    }, 'readwrite', 'clear');
    return resp;
  }
  async hasItem(store, title) {
    const resp = await this._dbCall('hasItem', {
      store: { value: store, required: true, type: 'string' },
      title: { value: title, required: true }
    }, 'readonly', 'count', title, (result) => result == 1 ? true : false);
    return resp;
  }
/**
* @callback(store, item) - async function that calls every time when some items updated in store
*/
  async onDataUpdate(store, callback) {
    if (!this._argsCheck('updateItem', {
      store: { value: store, required: true, type: 'string' },
      callback: { value: callback, required: true, type: 'function' }
    })) return;
    const isReady = await this._isDbReady();
    if (!isReady) return;
    if(!this._checkStore(store)) return;
    if (!(store in this._listeners)) this._listeners[store] = [];
    this._listeners[store].push(callback);
    return this;
  }
};

const db = new IDB(database.name, database.version, []);