const database = { name: 'dailer', version: 5 };

const getRawDay = (date) => {
  return new Date(date).setHours(0, 0, 0, 0);
};

const isUnder3AM = (date) => {
  if (!date) date = new Date();
  return date.getTime() === getRawDay(date)
  ? false : date.getHours() < 3;
};

const oneDay = 86400000; // 86 400 000 milliseconds in one day

const normalizeDate = (date) => {
  if (typeof date == 'string') date = Number(date);
  date = new Date(date);
  const rawDate = getRawDay(date);
  return isUnder3AM(date) ? rawDate - oneDay : rawDate;
};

const getToday = () => { // date in milliseconds
  return normalizeDate(Date.now());
};

/**
* @objectStores - array e.g. [{name: 'name', index: {keyPath: 'title'}}]
*/

class IDB {
  constructor(name, version, objectStores) {
    if (typeof name != 'string' || typeof version != 'number' || !Array.isArray(objectStores)) {
      return console.error(`[IDB] Wrong arguments data types, can't open database`);
    }
    this.idb = indexedDB.open(name, version);
    this.idb.addEventListener('upgradeneeded', () => this.upgradeneeded(objectStores));
    this.idb.addEventListener('success', () => this.success());
    return this;
  }
  upgradeneeded(objectStores) {
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
  success() {
    console.log('[IDB] Database successfully opened');
    this.db = this.idb.result;
  }
  async isComplete() {
    if (!this.db) await new Promise((resolve) => {
      const isComplete = () => this.db ? resolve() : setTimeout(isComplete, 10);
      isComplete();
    });
    return true;
  }
  static wrongArguments(functionName) {
    console.error('[IDB] Wrong arguments passed to db.' + functionName);
  }
  checkStore(store) {
    if (!this.db.objectStoreNames.contains(store)) {
      console.error(`[IDB] Database haven't "${store}" store`);
      return false;
    }
    return true;
  }
/**
* @item - object e.g. {title: 'title', author: 'name', data: new ArrayBuffer(32)}
*/
  async setItem(store, item) {
    if (typeof store != 'string' || typeof item != 'object') return IDB.wrongArguments('setItem');
    await this.isComplete();
    const check = this.checkStore(store);
    if (!check) return;
    const setter = this.db
      .transaction(store, 'readwrite')
      .objectStore(store)
      .put(item);
    let complete = false;
    setter.addEventListener('success', () => complete = true);
    await new Promise((resolve) => {
      const isComplete = () => complete ? resolve() : setTimeout(isComplete, 10);
      isComplete();
    });
    return this;
  }
  async getItem(store, title) {
    if (typeof store != 'string' || !title) return IDB.wrongArguments('getItem');
    await this.isComplete();
    const check = this.checkStore(store);
    if (!check) return;
    const getter = this.db
      .transaction(store, 'readonly')
      .objectStore(store)
      .get(title);
    let complete = false;
    getter.addEventListener('success', () => complete = true);
    await new Promise((resolve) => {
      const isComplete = () => complete ? resolve() : setTimeout(isComplete, 10);
      isComplete();
    });
    return getter.result;
  }
/**
* @onData(item) - async function that calls every time when new store item is received
*/
  async getAll(store, onData) {
    if (typeof store != 'string' || (onData && typeof onData != 'function')) return IDB.wrongArguments('getAll');
    await this.isComplete();
    const check = this.checkStore(store);
    if (!check) return;
    const getter = this.db
      .transaction(store, 'readonly')
      .objectStore(store)
      .openCursor();
    let complete = false;
    const result = [];
    getter.addEventListener('success', async () => {
      if (getter.result) {
        const value = getter.result.value;
        result.push(value);
        if (onData) await onData(value);
        getter.result.continue();
      } else complete = true;
    });
    await new Promise((resolve) => {
      const isComplete = () => complete ? resolve() : setTimeout(isComplete, 10);
      isComplete();
    });
    return result;
  }
  async deleteItem(store, title) {
    if (typeof store != 'string' || !title) return IDB.wrongArguments('deleteItem');
    await this.isComplete();
    const check = this.checkStore(store);
    if (!check) return;
    const deleter = this.db
      .transaction(store, 'readwrite')
      .objectStore(store)
      .delete(title);
    let complete = false;
    deleter.addEventListener('success', () => complete = true);
    await new Promise((resolve) => {
      const isComplete = () => complete ? resolve() : setTimeout(isComplete, 10);
      isComplete();
    });
    return this;
  }
};

const db = new IDB(database.name, database.version, []);
