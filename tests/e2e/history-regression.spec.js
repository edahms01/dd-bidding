import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

test('Bid History still renders and behaves exactly as before Phase 2', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('.nav-item[title="Bid History"]');
  const page_ = page.locator('#page-history');
  await expect(page_).toContainText(/total bids/i);
  await expect(page_).toContainText(/win rate/i);
  // Seed data ships 5 bid_history records (js/data/seed.json) — confirms real data
  // rendered, not the empty state. renderHistory() emits two <tr> per bid (the row
  // itself plus a hidden uprow-* detail row) — count only the visible bid rows.
  await expect(page_.locator('tbody tr:not([id^="uprow-"])')).toHaveCount(5);
  await expect(page_).not.toContainText('No bids submitted yet');
});
