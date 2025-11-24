export default class RepeatPromise {
    _promiseObject;
    _resolveFunction;

    constructor() {
      this._promiseObject = new Promise(resolve => this._resolveFunction = resolve);
    }

    resolve(...args) {
        this._resolveFunction(...args);
        this._promiseObject = new Promise(resolve => this._resolveFunction = resolve);        
    }

    wait() {
        return this._promiseObject;
    }
}
