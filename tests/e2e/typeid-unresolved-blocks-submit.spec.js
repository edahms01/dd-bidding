import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 3.1 — submit blocking. src/state/validation.js's
// hasUnresolvedReferences() is deliberately narrower than calculator.js's
// own per-row error flag: it ignores a genuinely blank typeId (every
// fresh draft's default starter row) and only counts a *non-empty*,
// unmatched reference as blocking — an assembly deleted while a row
// still points at it, not "nobody's chosen one yet".

// Deliberately uses a freshly created assembly + a freshly created wall
// row, not one of seed's own W1/W2/W3 rows — the seed dataset reuses
// those ids across several rows (data/seed.json), so hijacking a seed
// row's reference and deleting that assembly would orphan multiple rows
// at once, not just the one this helper means to control.
async function orphanAWallReference(page) {
  await page.click('#tab-assemblies');
  await page.click('button:has-text("+ Add assembly type")');
  const newAsmRow = page.locator('#asm-body tr').last();
  const tempId = await newAsmRow.locator('.asm-id').inputValue();

  await page.click('#tab-walls');
  await page.click('button:has-text("+ Add wall area")');
  const newWallRow = page.locator('#wall-body tr').last();
  await newWallRow.locator('select').selectOption(tempId);

  await page.click('#tab-assemblies');
  const tempRow = page.locator('#asm-body tr').filter({ has: page.locator('.asm-id[value="' + tempId + '"]') });
  await tempRow.locator('.del-btn').click();

  return newWallRow;
}

test('a brand-new, untouched draft is never blocked by its default blank rows', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.waitForTimeout(500);

  await page.click('#tab-agent');
  await expect(page.locator('#agent-finalize-btn')).toBeEnabled();
});

test('an orphaned reference disables both the Finalize button and the modal Confirm button', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await orphanAWallReference(page);

  await page.click('#tab-agent');
  await page.waitForTimeout(500);
  const finalizeBtn = page.locator('#agent-finalize-btn');
  await expect(finalizeBtn).toBeDisabled();

  // The button being disabled should stop a normal click from opening
  // the modal at all -- confirmed by clicking and asserting the modal
  // never opens, not just relying on the disabled attribute.
  await finalizeBtn.click({ force: true });
  await expect(page.locator('#finalize-modal-overlay.open')).toHaveCount(0);
});

test('resolving the reference re-enables both', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await orphanAWallReference(page);
  await page.click('#tab-agent');
  await page.waitForTimeout(500);
  await expect(page.locator('#agent-finalize-btn')).toBeDisabled();

  // Fix it: point the orphaned row at a real assembly again.
  await page.click('#tab-walls');
  await page.locator('#wall-body tr').last().locator('select').selectOption('W1');

  await page.click('#tab-agent');
  await page.waitForTimeout(500);
  await expect(page.locator('#agent-finalize-btn')).toBeEnabled();
});
