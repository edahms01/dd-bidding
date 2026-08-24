import { defineConfig } from '@playwright/test';

// Phase 3: bid storage moved to a Netlify Function + Blobs, which a plain
// static server (http-server, pre-Phase-3) can't serve — webServer now
// runs `netlify dev` instead, which genuinely serves netlify/functions/
// against a local Blobs emulator, so tests never touch production data.
// Requires the repo to be linked to its Netlify site (`netlify link`) —
// confirmed via manual testing that Blobs' local emulator needs that
// context; an unlinked `netlify dev` throws MissingBlobsEnvironmentError.
// Kept on port 4173 to match the pre-Phase-3 setup. Timeout raised from
// 30s — a `netlify dev` cold start (function bundling, Blobs emulator
// init) is meaningfully slower than a plain static server's near-instant
// boot; confirmed empirically, not guessed.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // each spec clears/writes localStorage — keep runs from stepping on each other
  // Phase 3: bid history now lives in ONE shared server-side Blobs store,
  // not per-browser-context localStorage — fullyParallel:false alone only
  // serializes tests *within* a spec file; different spec files still run
  // in separate workers by default and would race on that same store.
  // Confirmed via a real run: with the default worker count, two specs
  // touching bid history (finalize-clears-draft, history-regression)
  // failed intermittently from cross-file contamination; forcing a single
  // worker made the whole suite pass consistently.
  workers: 1,
  webServer: {
    command: 'npx netlify dev -p 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  },
  use: {
    baseURL: 'http://localhost:4173'
  }
});
