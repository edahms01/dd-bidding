import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

test('finalizing a bid removes its source draft and the same data appears correctly in Bid History', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  const activeIdBefore = await page.evaluate(() => localStorage.getItem('dirigo_active_draft_id'));
  expect(activeIdBefore).toBeTruthy();

  await page.click('#tab-agent');
  await page.click('#agent-finalize-btn');
  await page.locator('.bid-option-row').first().click();
  await page.click('#finalize-confirm-btn');
  await page.waitForTimeout(300);

  const stillPresent = await page.evaluate((id) => {
    const drafts = JSON.parse(localStorage.getItem('dirigo_drafts') || '{}');
    return !!drafts[id];
  }, activeIdBefore);
  expect(stillPresent).toBe(false);

  // Phase C 2.5 — in the unified Bids list the finalized bid appears once,
  // as a Submitted row; the source draft is gone (no second Harborview
  // row with a Draft status).
  await page.click('.nav-item[title="Bid History"]');
  const harborviewRows = page.locator('#page-bids tbody tr:not([id])', { hasText: 'Harborview' });
  await expect(harborviewRows).toHaveCount(1);
  await expect(harborviewRows).toContainText('Submitted');
  await expect(harborviewRows).not.toContainText('Draft');
});
