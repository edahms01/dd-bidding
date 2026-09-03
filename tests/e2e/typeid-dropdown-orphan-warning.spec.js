import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 3.1 — Type ID dropdown bound to Assemblies. Free-text typeId
// <input> replaced with a real <select> (TypeIdSelect.jsx), so a case
// mismatch or typo becomes structurally impossible. The only remaining
// way to end up with an unresolved reference is an assembly deleted
// while a row still references it — exactly what this spec exercises.

test('the dropdown options match the "id: studSize / boardType / L#" format and update live as assemblies change', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-walls');
  const select = page.locator('#wall-body tr').first().locator('td:nth-child(2) select');
  // Seed data's W1: studSize '3-5/8"', boardType 'Standard', finishLevel 3.
  await expect(select.locator('option[value="W1"]')).toHaveText('W1: 3-5/8" / Standard / L3');

  // Add a brand new assembly on Tab 4 and confirm it shows up as a
  // selectable option here without any reload.
  await page.click('#tab-assemblies');
  await page.click('button:has-text("+ Add assembly type")');
  const newAsmRow = page.locator('#asm-body tr').last();
  const newAsmId = await newAsmRow.locator('.asm-id').inputValue();

  await page.click('#tab-walls');
  await expect(select.locator('option[value="' + newAsmId + '"]')).toHaveCount(1);
});

test('deleting a still-referenced assembly shows an inline orphan warning and keeps the stale value visible', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-walls');
  const select = page.locator('#wall-body tr').first().locator('td:nth-child(2) select');
  await select.selectOption('W3');
  await expect(page.locator('#wall-body tr').first()).not.toContainText('not found');

  // Delete W3 from Assemblies.
  await page.click('#tab-assemblies');
  const w3Row = page.locator('#asm-body tr').filter({ has: page.locator('.asm-id[value="W3"]') });
  await w3Row.locator('.del-btn').click();

  await page.click('#tab-walls');
  const firstRow = page.locator('#wall-body tr').first();
  // The stale value stays visible (the synthetic "(not found)" option),
  // not silently replaced by whatever option now happens to be first.
  await expect(firstRow.locator('select')).toHaveValue('W3');
  await expect(firstRow).toContainText('Assembly "W3" not found');
});
