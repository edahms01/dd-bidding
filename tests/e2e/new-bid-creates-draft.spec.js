import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('clicking New Bid with a draft already open creates a second, empty draft — first is untouched', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Draft One');
  await page.waitForTimeout(900); // past debounce

  await page.click('.nav-item[title="New Bid"]'); // createDraft()
  await expect(page.locator('#proj-name')).toHaveValue('');

  await page.click('.nav-item[title="Dashboard"]');
  const rows = page.locator('#page-dashboard tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(page.locator('#page-dashboard tbody')).toContainText('QA Draft One');
  await expect(page.locator('#page-dashboard tbody')).toContainText('Untitled bid');
});
