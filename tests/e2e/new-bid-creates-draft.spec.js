import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('clicking New Bid with a draft already open creates a second, empty draft — first is untouched', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Draft One');
  await page.waitForTimeout(900); // past debounce

  await page.click('#new-bid-btn'); // createDraft()
  await expect(page.locator('#proj-name')).toHaveValue('');

  // The new blank draft is not persisted server-side until a real edit
  // happens — see src/state/forms.js's _createAndActivateBlankDraft().
  await page.fill('#proj-gc', 'QA Draft Two GC');
  await page.waitForTimeout(900); // past debounce

  await page.click('.nav-item[title="Bid History"]');
  const rows = page.locator('#page-bids tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(page.locator('#page-bids tbody')).toContainText('QA Draft One');
  await expect(page.locator('#page-bids tbody')).toContainText('Untitled bid');
});
