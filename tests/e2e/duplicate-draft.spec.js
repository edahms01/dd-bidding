import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('duplicating a draft creates a separate Dashboard entry; editing the copy leaves the original untouched', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Original');
  await page.waitForTimeout(900);

  await page.click('.nav-item[title="Bids"]');
  await page.locator('tr', { hasText: 'QA Original' }).locator('button:has-text("Duplicate")').click();
  await expect(page.locator('#page-bids tbody tr')).toHaveCount(2);

  // Open one of the two "QA Original" rows and edit it
  await page.locator('#page-bids tbody tr', { hasText: 'QA Original' }).first()
    .locator('button:has-text("Open")').click();
  await page.fill('#proj-name', 'QA Original — edited copy');
  await page.waitForTimeout(900);

  await page.click('.nav-item[title="Bids"]');
  const dashText = page.locator('#page-bids tbody');
  await expect(dashText).toContainText('QA Original — edited copy');
  await expect(dashText).toContainText('QA Original'); // the untouched original is still there
});

test('duplicating a draft with zero rows in assemblies/walls/ceilings does not error', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Zero Row Source');
  await page.click('#tab-walls');
  await page.click('#wall-body tr:first-child .del-btn');
  await page.click('#tab-ceilings');
  await page.click('#ceil-body tr:first-child .del-btn');
  await page.click('#tab-assemblies');
  await page.click('#asm-body tr:first-child .del-btn');
  await page.waitForTimeout(900);

  await page.click('.nav-item[title="Bids"]');
  await page.locator('tr', { hasText: 'QA Zero Row Source' }).locator('button:has-text("Duplicate")').click();
  await expect(page.locator('#page-bids tbody tr')).toHaveCount(2);
});
