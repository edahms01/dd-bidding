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

  await page.click('.nav-item[title="Bid History"]');
  await expect(page.locator('#page-history')).toContainText('Harborview');

  await page.click('.nav-item[title="Dashboard"]');
  await expect(page.locator('#page-dashboard')).not.toContainText('Harborview');
});
