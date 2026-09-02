import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Phase C, Steps 1 + 4 together create an interaction this project
// hadn't tested: navigation (the Bids list's Open button, which routes
// through switchToDraft -> _flushAndSwitch) can now fire while autosave's
// 700ms debounce is mid-flight. Same failure family as A2's row-key
// cross-draft leak and Phase B's save-timing races, one layer up.
//
// Stress it: start an edit on draft A, let the debounce begin but not
// fire, immediately open draft B — the in-flight edit on A must be
// flushed, B's data must be what loads, and nothing may leak across.

test('opening another draft mid-autosave flushes the outgoing edit and loads the incoming draft cleanly', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  // Draft A, fully saved.
  await page.fill('#proj-name', 'Race Draft A');
  await page.waitForTimeout(900);

  // Draft B, fully saved.
  await page.click('#new-bid-btn');
  await page.fill('#proj-name', 'Race Draft B');
  await page.waitForTimeout(900);

  // Back to A via the Bids list.
  await page.click('.nav-item[data-nav="bids"]');
  await page.locator('#page-bids tbody tr', { hasText: 'Race Draft A' }).locator('button:has-text("Open")').click();
  await expect(page.locator('#proj-name')).toHaveValue('Race Draft A');

  // Edit A, then jump straight to B before the 700ms debounce fires.
  await page.fill('#proj-gc', 'Race GC — in flight');
  await page.waitForTimeout(120); // well inside the debounce window
  await page.click('.nav-item[data-nav="bids"]');
  await page.locator('#page-bids tbody tr', { hasText: 'Race Draft B' }).locator('button:has-text("Open")').click();

  // B loaded, not A — and B never had a GC.
  await expect(page.locator('#proj-name')).toHaveValue('Race Draft B');
  await expect(page.locator('#proj-gc')).toHaveValue('');

  // The in-flight edit on A survived the switch (flushed by
  // _flushAndSwitch), and persists a full reload.
  await page.reload();
  await page.click('.nav-item[data-nav="bids"]');
  await page.locator('#page-bids tbody tr', { hasText: 'Race Draft A' }).locator('button:has-text("Open")').click();
  await expect(page.locator('#proj-name')).toHaveValue('Race Draft A');
  await expect(page.locator('#proj-gc')).toHaveValue('Race GC — in flight');

  // And B is still clean after all of that.
  await page.click('.nav-item[data-nav="bids"]');
  await page.locator('#page-bids tbody tr', { hasText: 'Race Draft B' }).locator('button:has-text("Open")').click();
  await expect(page.locator('#proj-gc')).toHaveValue('');
});
