import { defineConfig } from '@playwright/test';

// This app has no build step — it's plain <script src> files served as-is.
// webServer starts a static file server on 4173 for the duration of the
// test run, so `npm run test:e2e` is self-contained: nobody has to
// remember to start a dev server by hand first.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // each spec clears/writes localStorage — keep runs from stepping on each other
  webServer: {
    command: 'npx http-server -p 4173 -c-1',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },
  use: {
    baseURL: 'http://localhost:4173'
  }
});
