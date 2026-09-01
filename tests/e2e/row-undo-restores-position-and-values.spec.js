import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 3.5 — the two empirical checks Eric explicitly required as
// real Playwright assertions, not inferred from the reducer logic being
// correct on paper: undo restores the exact same position and values,
// and duplicate-then-delete-the-original-then-undo resolves correctly
// (the one piece of this phase with genuinely non-obvious state
// interaction, per the same scrutiny the row-key bug and the
// cache-fallthrough bug got during A2).

async function readWallRows(page) {
  return page.locator('#wall-body tr').evaluateAll((rows) =>
    rows.map((tr) => ({
      location: tr.querySelector('.wall-location')?.value,
      typeId:   tr.querySelector('.wall-typeid')?.value,
      height:   tr.querySelector('.wall-height')?.value,
      lf:       tr.querySelector('.wlf')?.value,
      grossSF:  tr.querySelector('.wgsf')?.value,
      openings: tr.querySelector('.wded')?.value
    }))
  );
}

test('delete then undo restores the exact same row count, position, and values', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);
  await page.click('#tab-walls');

  const before = await readWallRows(page);
  expect(before.length).toBe(5); // seed data has 5 wall rows

  // Delete the middle row (index 2, "Level 1 — Feature wall" / W3).
  await page.locator('#wall-body tr').nth(2).locator('.del-btn').click();
  const afterDelete = await readWallRows(page);
  expect(afterDelete.length).toBe(4);
  expect(afterDelete.map((r) => r.location)).not.toContain(before[2].location);

  await page.click('.row-undo-toast-btn:has-text("Undo")');
  await page.waitForTimeout(200);

  const afterUndo = await readWallRows(page);
  expect(afterUndo).toEqual(before);
});

test('duplicate, then delete the original, then undo — the duplicate is untouched and the original is correctly restored', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);
  await page.click('#tab-walls');

  const original = (await readWallRows(page))[0];

  // Duplicate row 0 -- row 1 is now the duplicate, sharing all the
  // original's values.
  await page.locator('#wall-body tr').first().locator('.dup-btn').click();
  const afterDuplicate = await readWallRows(page);
  expect(afterDuplicate.length).toBe(6);
  const duplicate = afterDuplicate[1];
  expect(duplicate.typeId).toBe(original.typeId);
  expect(duplicate.location).toBe(original.location);

  // Delete the ORIGINAL (still at index 0) -- the duplicate (now at
  // index 0 after the shift) must not be mistaken for it.
  await page.locator('#wall-body tr').first().locator('.del-btn').click();
  const afterDelete = await readWallRows(page);
  expect(afterDelete.length).toBe(5);
  // What's now at index 0 is the (untouched) duplicate, not the original.
  expect(afterDelete[0]).toEqual(duplicate);

  await page.click('.row-undo-toast-btn:has-text("Undo")');
  await page.waitForTimeout(200);

  const afterUndo = await readWallRows(page);
  expect(afterUndo.length).toBe(6);
  // The original is correctly reinserted at index 0, exactly as it was.
  expect(afterUndo[0]).toEqual(original);
  // The duplicate (pushed to index 1) survived completely untouched --
  // not merged, overwritten, or corrupted by the undo.
  expect(afterUndo[1]).toEqual(duplicate);
});
