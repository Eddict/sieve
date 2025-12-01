/*
 * A small inflight-style helper using `lru-cache`.
 *
 * Provides two helpers:
 * - `withInflightPromise(key, factory)` returns a Promise and dedupes concurrent calls.
 * - `withInflightCallback(key, factory, cb)` accepts a node-style callback and dedupes concurrent calls.
 *
 * The implementation caches the in-flight Promise. Keeping the Promise in the cache
 * ensures concurrent callers receive the same result. TTL can be passed to expire entries.
 */

import LRUCache from 'lru-cache';

const defaultCache = new LRUCache({ max: 1000 });

export function withInflightPromise(key, factory, opts = {}) {
  const { cache = defaultCache, ttl } = opts;

  let existing = cache.get(key);
  if (existing) return existing;

  // Call factory which should return a Promise (or be async).
  const p = (async () => {
    try {
      return await factory();
    } finally {
      // keep the promise in cache until it expires; do not delete here so
      // subsequent callers within TTL get the resolved promise as well.
    }
  })();

  // Store the promise so concurrent callers reuse it.
  if (typeof ttl === 'number' && ttl > 0) cache.set(key, p, { ttl });
  else cache.set(key, p);

  return p;
}

export function withInflightCallback(key, factory, cb, opts = {}) {
  const { cache = defaultCache, ttl } = opts;

  let existing = cache.get(key);
  if (existing) {
    existing.then((res) => cb(null, res)).catch(cb);
    return;
  }

  const p = new Promise((resolve, reject) => {
    try {
      factory((err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    } catch (ex) {
      reject(ex);
    }
  });

  if (typeof ttl === 'number' && ttl > 0) cache.set(key, p, { ttl });
  else cache.set(key, p);

  p.then((res) => cb(null, res)).catch(cb);
}

export default {
  withInflightPromise,
  withInflightCallback
};
