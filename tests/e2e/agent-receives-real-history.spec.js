import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criterion 7: the agent recommendation (Tab 8) still receives
// real bidHistory data reflecting actual GC/building-type win rates —
// confirms getHistorySummary()'s async conversion didn't silently break the
// data it feeds the agent.
test('getHistorySummary() resolves with real aggregate stats and Tab 8 renders successfully', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  const summary = await page.evaluate(() => getHistorySummary('Callahan Construction Group', 'Retail'));
  expect(summary.totalBids).toBe(5);
  expect(typeof summary.winRate).toBe('number');

  await page.click('#tab-agent');
  await expect(page.locator('.page-title:has-text("Bid Strategy")')).toBeVisible();
  // A healthy fetch must never show the fetch-failure fallback notice.
  await expect(page.locator('text=Historical bid data unavailable')).toHaveCount(0);
});
