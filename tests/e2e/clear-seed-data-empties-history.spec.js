import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criterion 6: clearSeedData() (dev toolbar) leaves bid history
// actually empty, confirmed by reload — proves the reload-before-clear-
// completes race (clearSeedData() must await dev-clear-bids before calling
// location.reload()) is actually fixed, not just diagrammed in the plan.
test('clearSeedData() leaves bid history empty, confirmed by reload', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  const seeded = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  expect(seeded.length).toBe(5);

  await clearAll(page); // clicks "Clear all data" and waits for the real reload

  const cleared = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  expect(cleared.length).toBe(0);

  // Reload again for good measure — nothing should reappear.
  await page.reload();
  const afterReload = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  expect(afterReload.length).toBe(0);
});
