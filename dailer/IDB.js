/**
* @objectStores - array e.g. [{name: 'name', index: {keyPath: 'title'}}]
*/

export default class IDB {
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
    if (typeof store != 'string' || typeof item != 'object') return this.wrongArguments('setItem');
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
    if (typeof store != 'string' || !title) return this.wrongArguments('getItem');
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
  async getAll(store) {
    if (typeof store != 'string') return this.wrongArguments('getAll');
    await this.isComplete();
    const check = this.checkStore(store);
    if (!check) return;
    const getter = this.db
      .transaction(store, 'readonly')
      .objectStore(store)
      .openCursor();
    let complete = false;
    const result = [];
    getter.addEventListener('success', () => {
      if (getter.result) {
        result.push(getter.result.value);
        getter.result.continue();
      } else complete = true;
    });
    await new Promise((resolve) => {
      const isComplete = () => complete ? resolve() : setTimeout(isComplete, 10);
      isComplete();
    });
    return result;
  }
  async *getAllGen(store) {
    if (typeof store != 'string') return this.wrongArguments('getAllGen');
    await this.isComplete();
    const check = this.checkStore(store);
    if (!check) return;
    const getter = this.db
      .transaction(store, 'readonly')
      .objectStore(store)
      .openCursor();
    getter.addEventListener('success', () => {
      if (getter.result) {
        yield getter.result.value;
        getter.result.continue();
      }
    });
  }
  async deleteItem(store, title) {
    if (typeof store != 'string' || !title) return this.wrongArguments('deleteItem');
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
