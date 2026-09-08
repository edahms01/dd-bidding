// Vitest runs in the plain 'node' environment (no jsdom). src/state/store.jsx
// reads localStorage.getItem() at module scope (initialState.ui.navCollapsed),
// so importing it — as tests/unit/fieldRegistry.test.js does, to walk the real
// initialState.bid — needs a localStorage that exists and doesn't throw.
// No test relies on localStorage behavior; this only needs to be inert.
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
    clear: () => { mem.clear(); },
    key: (i) => Array.from(mem.keys())[i] ?? null,
    get length() { return mem.size; },
  };
}
