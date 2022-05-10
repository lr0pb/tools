/**
* @objectStores - array e.g. [{name: 'name', index: {keyPath: 'title'}}]
*/

export default class IDB {
  constructor(name, version, objectStores) {
    if (typeof name != 'string' || typeof version != 'number' || !Array.isArray(objectStores)) return;
    this.idb = indexedDB.open(name, version);
    this.idb.addEventListener('upgradeneeded', () => this.upgradeneeded(objectStores));
    this.idb.addEventListener('success', () => this.success());
    /*if (!this.db) await new Promise((resolve) => {
      const isComplete = () => this.db ? resolve() : setTimeout(isComplete, 10);
      isComplete();
    });
    console.log(this.db);*/
    return this;
  }
  upgradeneeded(objectStores) {
    console.log('IDB upgradeneeded');
    this.db = this.idb.result;
    for (let store of objectStores) {
      if (typeof store.name == 'string' && typeof store.index == 'object') {
        this.db.createObjectStore(store.name, store.index);
      };
    };
  }
  success() {
    console.log('IDB success');
    this.db = this.idb.result;
  }
  async isComplete() {
    if (!this.db) await new Promise((resolve) => {
      const isComplete = () => this.db ? resolve() : setTimeout(isComplete, 10);
      isComplete();
    });
    return true;
  }
/**
* @item - object e.g. {title: 'title', author: 'name', data: new ArrayBuffer(32)}
*/
  async setItem(store, item) {
    if (typeof store != 'string' || typeof item != 'object') return;
    await this.isComplete();
    let setter = this.db
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
    if (typeof store != 'string' || typeof title != 'string') return;
    await this.isComplete();
    let getter = this.db
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
    if (typeof store != 'string') return;
    await this.isComplete();
    let getter = this.db
      .transaction(store, 'readonly')
      .objectStore(store)
      .openCursor();
    let complete = false;
    let result = [];
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
  async deleteItem(store, title) {
    if (typeof store != 'string' || typeof title != 'string') return;
    await this.isComplete();
    let deleter = this.db
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
