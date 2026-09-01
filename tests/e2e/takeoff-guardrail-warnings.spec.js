import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 3.4 — validation guardrails. Soft, non-blocking warnings
// (--status-warn, distinct from 3.1's --danger orphan warning) for
// openings exceeding gross SF, zero-height rows, and blank rows (dimmed,
// excluded from totals once 3.5 lands). Explicit constraint: none of
// this changes calcWall()/calcCeil()'s existing clamp-at-zero math —
// these are read-only display warnings over already-computed values.

test('openings exceeding gross SF shows a warning without changing the clamped Net SF', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');

  const row = page.locator('#wall-body tr').first();
  await row.locator('.wgsf').fill('100');
  await row.locator('.wded').fill('150');

  await expect(row).toContainText('Exceeds gross SF');
  // The existing clamp-at-zero math is untouched — Net SF still floors
  // at 0, not a negative number.
  await expect(row.locator('.wnet')).toHaveText('0');
});

test('a zero-height row with other data entered shows a warning; an untouched row does not', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');

  const row = page.locator('#wall-body tr').first();
  // Untouched (all blank, including height) — no zero-height badge; it's
  // a blank row, not a "zero height entered" mistake.
  await expect(row).not.toContainText('Height is 0');

  await row.locator('.wall-location').fill('Level 3');
  await row.locator('.wgsf').fill('200');
  // Height left at 0 -- now a real mistake worth flagging.
  await expect(row).toContainText('Height is 0');

  await row.locator('.wall-height').fill('10');
  await expect(row).not.toContainText('Height is 0');
});

test('a fully blank row is visually dimmed; entering any data clears it', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');

  const row = page.locator('#wall-body tr').first();
  await expect(row).toHaveClass(/row-blank/);

  await row.locator('.wall-location').fill('Level 1');
  await expect(row).not.toHaveClass(/row-blank/);
});

test('the same three guardrails apply to Ceilings', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-ceilings');

  const row = page.locator('#ceil-body tr').first();
  await expect(row).toHaveClass(/row-blank/);

  await row.locator('.cgsf').fill('100');
  await row.locator('.cded').fill('150');
  await expect(row).not.toHaveClass(/row-blank/);
  await expect(row).toContainText('Height is 0');
  await expect(row).toContainText('Exceeds gross SF');
});

test('guardrails also recompute after loading seed data, not just live typing', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-walls');
  // Seed data's real rows all have real dimensions -- none should be
  // flagged blank or zero-height.
  await expect(page.locator('#wall-body tr.row-blank')).toHaveCount(0);
  await expect(page.locator('#wall-body')).not.toContainText('Height is 0');
});
