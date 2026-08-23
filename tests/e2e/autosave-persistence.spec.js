import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('fills project name + one wall row, survives a hard reload past the debounce window', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Autosave Project');
  await page.click('#tab-walls');
  await page.locator('#wall-body tr:first-child input').nth(0).fill('QA Floor 1');
  await page.fill('#wall-body tr:first-child .wgsf', '500');

  await page.waitForTimeout(1000); // past the 700ms debounce (AUTOSAVE_DEBOUNCE_MS)
  await page.reload();

  await expect(page.locator('#proj-name')).toHaveValue('QA Autosave Project');
  await page.click('#tab-walls');
  await expect(page.locator('#wall-body tr:first-child input').nth(0)).toHaveValue('QA Floor 1');
  await expect(page.locator('#wall-body tr:first-child .wgsf')).toHaveValue('500');
});
