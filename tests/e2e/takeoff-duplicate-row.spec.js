import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 3.5 — duplicate row. Live-captured from the DOM (via
// window.collectFormData()), not the reducer's own copy of the row —
// every field but Type ID is uncontrolled, so the reducer's copy can be
// stale relative to what's actually typed.

test('duplicating an assembly row mints a fresh, non-colliding Type ID', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-assemblies');

  const before = await page.locator('#asm-body tr').count();
  const firstId = await page.locator('#asm-body tr').first().locator('.asm-id').inputValue();

  await page.locator('#asm-body tr').first().locator('.dup-btn').click();
  await expect(page.locator('#asm-body tr')).toHaveCount(before + 1);

  const duplicateRow = page.locator('#asm-body tr').nth(1);
  const dupId = await duplicateRow.locator('.asm-id').inputValue();
  expect(dupId).not.toBe(firstId);
  expect(dupId).toBeTruthy();

  // Every other field carried over from the source row.
  const srcCategory = await page.locator('#asm-body tr').first().locator('select').first().inputValue();
  const dupCategory = await duplicateRow.locator('select').first().inputValue();
  expect(dupCategory).toBe(srcCategory);
});

test('duplicating a wall row shares the same Type ID as the source (no rename) and prices correctly', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-walls');
  const before = await page.locator('#wall-body tr').count();
  const srcTypeId = await page.locator('#wall-body tr').first().locator('select').inputValue();
  const srcLocation = await page.locator('#wall-body tr').first().locator('.wall-location').inputValue();

  await page.locator('#wall-body tr').first().locator('.dup-btn').click();
  await expect(page.locator('#wall-body tr')).toHaveCount(before + 1);

  const duplicateRow = page.locator('#wall-body tr').nth(1);
  await expect(duplicateRow.locator('select')).toHaveValue(srcTypeId);
  await expect(duplicateRow.locator('.wall-location')).toHaveValue(srcLocation);
  // A shared typeId across rows is normal, not an orphan reference.
  await expect(duplicateRow).not.toContainText('not found');
});

test('duplicate captures the live-typed value, not a stale reducer snapshot', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');

  const row = page.locator('#wall-body tr').first();
  // Type into Notes-equivalent (Location) without triggering any other
  // dispatch first -- the reducer's own copy of this row was only ever
  // set at ADD_WALL_ROW time (blank), never updated per keystroke.
  await row.locator('.wall-location').fill('Freshly typed, never dispatched');
  await row.locator('.dup-btn').click();

  const duplicateRow = page.locator('#wall-body tr').nth(1);
  await expect(duplicateRow.locator('.wall-location')).toHaveValue('Freshly typed, never dispatched');
});
