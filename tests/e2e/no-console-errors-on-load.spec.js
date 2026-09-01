import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Preflight finding (see docs/preflight-report.md): a broken classic
// <script> throws a hard syntax error that Playwright's own console/page
// error events DO catch — but nothing in the suite was asserting on them.
// The break didn't blank-page the app; other scripts kept running and the
// damage only surfaced once a specific tab was visited. That's the
// failure shape a quick manual check misses. This spec makes "no errors
// anywhere in the app" an explicit, permanent check rather than something
// only a full functional test run happens to reveal.
//
// Note: the actual Preflight failure ("Unexpected token 'export'") fired
// as a `pageerror` event (an uncaught exception), not a `console.error`
// call — so this listens for both. A console-errors-only check would not
// have caught it on page load alone.
test('page load and a full pass through every tab produce zero console errors and zero uncaught page errors', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1200); // covers the 500ms pre-run-agent setTimeout in loadSeedData()

  // Visit every workflow tab plus Dashboard and History — the calculator
  // break in the Preflight test only surfaced once the Output tab
  // (which calls calculator.js functions) was actually visited.
  const workflowTabs = [
    'tab-project', 'tab-conditions', 'tab-assemblies', 'tab-walls',
    'tab-ceilings', 'tab-rates', 'tab-output', 'tab-market', 'tab-agent'
  ];
  for (const tabId of workflowTabs) {
    await page.click(`#${tabId}`);
    await page.waitForTimeout(150);
  }
  await page.click('.nav-item[data-nav="dashboard"]');
  await page.waitForTimeout(150);
  await page.click('.nav-item[data-nav="history"]');
  await page.waitForTimeout(150);

  expect(pageErrors, `Uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
