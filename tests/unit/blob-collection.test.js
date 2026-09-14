import { describe, it, expect } from 'vitest';
import { readAllRecords } from '../../netlify/functions/lib/blob-collection.js';

// Same fakeStore() shape as bids-core.test.js — a Map-backed stand-in
// for a Netlify Blobs store, extended with list().
function fakeStore() {
  const m = new Map();
  return {
    _m: m,
    get: async (k, opts) => {
      if (!m.has(k)) return null;
      return (opts && opts.type === 'json') ? m.get(k) : JSON.stringify(m.get(k));
    },
    setJSON: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); },
    delete: async (k) => { m.delete(k); },
    list: async () => ({ blobs: Array.from(m.keys()).map((key) => ({ key, etag: 'fake' })), directories: [] })
  };
}

describe('readAllRecords', () => {
  it('returns an empty map for an empty store', async () => {
    expect(await readAllRecords(fakeStore())).toEqual({});
  });

  it('returns every key\'s record', async () => {
    const store = fakeStore();
    await store.setJSON('a', { v: 1 });
    await store.setJSON('b', { v: 2 });

    expect(await readAllRecords(store)).toEqual({ a: { v: 1 }, b: { v: 2 } });
  });

  it('skips a key whose read races a delete (resolves null) instead of including it', async () => {
    const store = fakeStore();
    await store.setJSON('a', { v: 1 });
    await store.setJSON('b', { v: 2 });

    // Simulate list() having already seen 'b', but the key is gone (or
    // its read races a concurrent delete / hasn't propagated yet) by
    // the time get() runs — get() legitimately resolves null in that
    // case, same as a never-written key.
    const realGet = store.get;
    store.get = async (k, opts) => (k === 'b' ? null : realGet(k, opts));

    expect(await readAllRecords(store)).toEqual({ a: { v: 1 } });
  });
});
