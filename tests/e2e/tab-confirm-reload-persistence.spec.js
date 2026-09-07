import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Criterion 13: a confirmed tab survives a real browser reload if nothing
// changed — the snapshot persists with the draft record (buildDraftRecord,
// js/drafts.js), and normalize() keeps it matching across the
// string<->number drift a save/reload round-trip introduces.

async function fillProject(page) {
  await page.fill('#proj-name', 'Reload Persist');
  await page.fill('#proj-addr', '2 Elm St, Portland, ME');
  await page.selectOption('#proj-type', 'Office');
  await page.fill('#proj-floors', '4');
  await page.fill('#proj-gc', 'Reload GC');
  await page.fill('#proj-drawings', 'Rev C');
  await page.fill('#proj-dur', '10');
  const dates = page.locator('#page-project .datefield-input');
  await dates.nth(0).fill('03/01/2026');
  await dates.nth(1).fill('04/01/2026');
  await page.fill('#proj-exclusions', 'None.');
}

test('a confirmed tab is still green after a full browser reload', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.click('#tab-project');
  await fillProject(page);
  await page.click('#page-project .tab-confirm-btn');
  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);

  await page.waitForTimeout(1000); // past the 700ms autosave debounce
  await page.reload();
  await page.waitForTimeout(1200);

  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);

  // Still reactive after the reload.
  await page.click('#tab-project');
  await page.fill('#proj-gc', 'Reload GC changed');
  await expect(page.locator('#tab-project')).not.toHaveClass(/\bdone\b/);
});
