import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // js/autosave.js is pure/DOM-free — plain Node environment is enough,
    // no jsdom needed for the Phase 1 unit tests.
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    // Inert localStorage stub so src/state/store.jsx (reads localStorage at
    // module scope) is importable here — see tests/unit/_setup.js.
    setupFiles: ['./tests/unit/_setup.js']
  }
});
