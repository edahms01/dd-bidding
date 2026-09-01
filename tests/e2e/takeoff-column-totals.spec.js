import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 3.5 — column totals. Summed from the same page-level
// computeDerived() pass 3.4 already runs, over non-blank rows only.

test('Walls totals sum LF/gross/net correctly and exclude blank rows', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');

  const row = page.locator('#wall-body tr').first();
  await row.locator('.wall-location').fill('Level 1');
  await row.locator('.wlf').fill('100');
  await row.locator('.wgsf').fill('800');
  await row.locator('.wded').fill('50');

  await page.click('button:has-text("+ Add wall area")');
  const row2 = page.locator('#wall-body tr').nth(1);
  await row2.locator('.wall-location').fill('Level 2');
  await row2.locator('.wlf').fill('50');
  await row2.locator('.wgsf').fill('400');
  await row2.locator('.wded').fill('0');

  // A third, blank row (the freshly added default) should not count.
  await page.click('button:has-text("+ Add wall area")');

  const totalsRow = page.locator('#page-walls .totals-row');
  await expect(totalsRow).toContainText('150'); // LF: 100 + 50
  await expect(totalsRow).toContainText('1,200'); // gross: 800 + 400
  await expect(totalsRow).toContainText('1,150'); // net: 750 + 400
});

test('Ceilings totals sum gross/soffit/net correctly', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-ceilings');

  const row = page.locator('#ceil-body tr').first();
  await row.locator('.ceil-location').fill('Level 1');
  await row.locator('.cgsf').fill('500');
  await row.locator('.ceil-soffitlf').fill('30');
  await row.locator('.cded').fill('20');

  const totalsRow = page.locator('#page-ceilings .totals-row');
  await expect(totalsRow).toContainText('500');
  await expect(totalsRow).toContainText('30');
  await expect(totalsRow).toContainText('480');
});

test('totals recompute after loading seed data', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-walls');
  const totalsRow = page.locator('#page-walls .totals-row');
  // Seed's 5 wall rows: LF 320+180+45+210+140 = 895.
  await expect(totalsRow).toContainText('895');
});
