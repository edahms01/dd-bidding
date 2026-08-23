import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // js/autosave.js is pure/DOM-free — plain Node environment is enough,
    // no jsdom needed for the Phase 1 unit tests.
    environment: 'node',
    include: ['tests/unit/**/*.test.js']
  }
});
