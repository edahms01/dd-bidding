import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Coverage gap closed (see docs/step-0-coverage-report.md, Gap 1): no
// existing spec ever calls addAsm()/addWall()/addCeil() and checks the
// result, or asserts row deletion as the behavior under test (both
// existing uses of .del-btn are setup scaffolding for unrelated specs).
// addAsm()/addWall()/addCeil() are exactly what Step 3 of the Phase A
// migration rewrites into components, so this is the harness's only
// protection for that conversion.

const TABLES = [
  { tab: 'tab-assemblies', addBtnText: '+ Add assembly type', body: '#asm-body', fillSelector: '.asm-id' },
  { tab: 'tab-walls',      addBtnText: '+ Add wall area',      body: '#wall-body', fillSelector: 'td:first-child input' },
  { tab: 'tab-ceilings',   addBtnText: '+ Add ceiling area',   body: '#ceil-body', fillSelector: 'td:first-child input' }
];

for (const { tab, addBtnText, body, fillSelector } of TABLES) {
  test(`${tab}: adding a row increases the count and the new row's inputs work; deleting it removes exactly that row`, async ({ page }) => {
    await page.goto('/');
    await clearAll(page);
    await page.click(`#${tab}`);

    const before = await page.locator(`${body} tr`).count();

    await page.click(`button:has-text("${addBtnText}")`);
    await expect(page.locator(`${body} tr`)).toHaveCount(before + 1);

    // The new row's inputs are actually wired, not just present.
    const newRow = page.locator(`${body} tr`).last();
    await newRow.locator(fillSelector).fill('preflight-qa-row');
    await expect(newRow.locator(fillSelector)).toHaveValue('preflight-qa-row');

    await newRow.locator('.del-btn').click();
    await expect(page.locator(`${body} tr`)).toHaveCount(before);
  });
}

test('deleting a specific row leaves the others intact, identified by content not position', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');

  // A fresh/cleared draft already carries one default blank wall row
  // (addWall() is called once at load and once whenever a new blank
  // draft is created -- see js/forms.js) -- verified directly rather
  // than assumed after this test first failed on that exact miscount.
  // Strip down to zero so the three rows this test adds are the only
  // ones present and nth(0..2) is unambiguous.
  let existing = await page.locator('#wall-body tr').count();
  while (existing > 0) {
    await page.locator('#wall-body tr').last().locator('.del-btn').click();
    existing--;
  }

  await page.click('button:has-text("+ Add wall area")');
  await page.locator('#wall-body tr').nth(0).locator('td:first-child input').fill('Row-A');
  await page.click('button:has-text("+ Add wall area")');
  await page.locator('#wall-body tr').nth(1).locator('td:first-child input').fill('Row-B');
  await page.click('button:has-text("+ Add wall area")');
  await page.locator('#wall-body tr').nth(2).locator('td:first-child input').fill('Row-C');

  // Delete the middle row.
  await page.locator('#wall-body tr').nth(1).locator('.del-btn').click();

  await expect(page.locator('#wall-body tr')).toHaveCount(2);
  const remaining = await page.locator('#wall-body tr td:first-child input').evaluateAll(
    els => els.map(el => el.value)
  );
  expect(remaining).toEqual(['Row-A', 'Row-C']);
});
