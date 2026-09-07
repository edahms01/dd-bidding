import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Criterion 7: Cost Summary's "Reviewed" click snapshots the current
// total; an upstream edit (rates / walls / ceilings / conditions) reverts
// it to amber without ever visiting the Cost Summary tab.

test('an upstream rate edit reverts a Reviewed Cost Summary to amber', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600);

  await expect(page.locator('#tab-output')).toHaveClass(/\bdone\b/);

  // Edit a rate on the Rates tab; never open Cost Summary.
  await page.click('#tab-rates');
  await page.fill('#rate-frame', String(Number(await page.inputValue('#rate-frame') || 0) + 7));
  await page.waitForTimeout(800); // reactive recalc -> new ui.output.summary

  await expect(page.locator('#tab-output')).toHaveClass(/\bpartial\b/);
  await expect(page.locator('#tab-output')).not.toHaveClass(/\bdone\b/);
});
