if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

class IteratorPolyfill {
  [Symbol.iterator]() {
    return this;
  }
  find(predicate) {
    for (const item of this) {
      if (predicate(item)) return item;
    }
    return undefined;
  }
  filter(predicate) {
    const self = this;
    return (function* () {
      for (const item of self) {
        if (predicate(item)) yield item;
      }
    })();
  }
  map(mapper) {
    const self = this;
    return (function* () {
      for (const item of self) {
        yield mapper(item);
      }
    })();
  }
}

if (typeof Iterator === "undefined") {
  globalThis.Iterator = IteratorPolyfill;
} else if (!Iterator.prototype.find) {
  Iterator.prototype.find = function (predicate) {
    for (const item of this) {
      if (predicate(item)) return item;
    }
    return undefined;
  };
}
