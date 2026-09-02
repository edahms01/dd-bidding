import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 3.5 — a pending row-undo referencing a row from a *different*
// draft is actively data-corrupting (could resurrect that row into
// whatever's now active), not a cosmetic wrong-tab-style quirk — must
// be cleared on every draft switch/reset, not just left to expire.

test('deleting a row then switching drafts clears the undo toast — no cross-draft resurrection', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-walls');
  const before = await page.locator('#wall-body tr').count();
  await page.locator('#wall-body tr').first().locator('.del-btn').click();
  await expect(page.locator('.row-undo-toast')).toBeVisible();

  // Switch to a brand-new draft before clicking Undo.
  await page.click('#new-bid-btn');
  await page.waitForTimeout(300);

  await expect(page.locator('.row-undo-toast')).toHaveCount(0);

  // The new draft's Walls table is its own blank default -- confirm the
  // deleted row from the *other* draft never appears here.
  await page.click('#tab-walls');
  const newDraftCount = await page.locator('#wall-body tr').count();
  expect(newDraftCount).toBe(1); // fresh draft's single default blank row

  // Switching back to the original draft (via Dashboard) should show
  // the post-delete state, not a resurrected row -- confirms the delete
  // itself was never rolled back by anything.
  await page.click('.nav-item[title="Bids"]');
  await page.locator('tr', { hasText: 'Harborview' }).locator('button:has-text("Open")').click();
  await page.waitForTimeout(300);
  await page.click('#tab-walls');
  const originalDraftCount = await page.locator('#wall-body tr').count();
  expect(originalDraftCount).toBe(before - 1);
});
