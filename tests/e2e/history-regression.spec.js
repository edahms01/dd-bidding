import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase C 2.5 — Bid History folded into the unified Bids list. Seed data
// renders as 6 rows: 5 submitted bid_history records + the seed's own
// Harborview draft (Load Seed replaces the drafts map, so the boot blank
// draft is gone). The totals bar stays intact.
test('the Bids list renders seed history data, not an empty state', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('.nav-item[title="Bid History"]');
  const page_ = page.locator('#page-bids');
  await expect(page_).toContainText(/win rate/i);
  await expect(page_).toContainText(/won/i);
  // Each bid row plus its hidden uprow-* detail row; count only the visible ones.
  await expect(page_.locator('tbody tr:not([id^="uprow-"])')).toHaveCount(6);
  await expect(page_).not.toContainText('No bids yet');
});
