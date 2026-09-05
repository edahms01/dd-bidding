import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// The left nav's single "current bid" item was replaced with an "Open
// bids" list — one row per draft in dirigo_drafts, newest first, same
// source/sort as the header's "Open Bid" combobox. Clicking a row
// switches to that draft (or, for the already-active row, just returns
// to the workflow).

const navRowLabels = (page) =>
  page.locator('.nav-item[data-nav="workflow"] .nav-label').allTextContents();

test('lists every open draft, newest first, and marks the active one', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'Alpha');
  await page.waitForTimeout(900);
  await page.click('#new-bid-btn');
  await page.fill('#proj-name', 'Beta');
  await page.waitForTimeout(900);
  await page.click('#new-bid-btn');
  await page.fill('#proj-name', 'Gamma');
  await page.waitForTimeout(900);

  // One row per draft, most-recently-modified first.
  await expect.poll(() => navRowLabels(page)).toEqual(['Gamma', 'Beta', 'Alpha']);
  expect(await page.evaluate(() => Object.keys(window.getAllDrafts()).length)).toBe(3);

  // The section label shows (and is a real .section-label, per the brief).
  await expect(page.locator('.leftnav-top .section-label')).toHaveText('Open bids');

  // Only the active draft's row is .active.
  await expect(page.locator('.nav-item[data-nav="workflow"].active .nav-label')).toHaveText('Gamma');
  await expect(page.locator('.nav-item[data-nav="workflow"].active')).toHaveCount(1);
});

test('clicking a non-active row switches to that draft; the active row returns to the workflow', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'Alpha');
  await page.waitForTimeout(900);
  await page.click('#new-bid-btn');
  await page.fill('#proj-name', 'Beta');
  await page.waitForTimeout(900);

  // Switch to Alpha from its nav row.
  await page.locator('.nav-item[data-nav="workflow"]', { hasText: 'Alpha' }).click();
  await expect(page.locator('#proj-name')).toHaveValue('Alpha');
  await expect(page.locator('.nav-item[data-nav="workflow"].active .nav-label')).toHaveText('Alpha');

  // Same result as the header "Open Bid" combobox for the other draft.
  await page.locator('.open-bid-menu button').click();
  await page.locator('.open-bid-option', { hasText: 'Beta' }).click();
  await expect(page.locator('#proj-name')).toHaveValue('Beta');

  // Leave the workflow, then click the active draft's row — it returns
  // to the workflow (tab bar reappears), same as the old "current bid" item.
  await page.click('.nav-item[data-nav="bids"]');
  await expect(page.locator('#app-tabs')).toHaveCount(0);
  await page.locator('.nav-item[data-nav="workflow"]', { hasText: 'Beta' }).click();
  await expect(page.locator('#app-tabs')).toBeVisible();
  await expect(page.locator('#proj-name')).toHaveValue('Beta');
});
