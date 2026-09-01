import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B pre-merge check, requested explicitly: this phase introduced
// several separate save-triggering mechanisms in the same window — the
// 700ms autosave debounce (typing), the mode toggle's immediate
// needsImmediateSave (3.3), the per-action save on duplicate/undo (3.5,
// after the blanket-watcher regression was reverted — see CLAUDE.md's
// standing rule on hydration-vs-edit), and the 500ms scheduleRecalc
// debounce (4.2). Each was verified individually; this fires them in
// quick succession — mode toggle, then duplicate a row, then edit a
// field — and confirms nothing races, double-saves, or drops an update
// after a reload.

test('mode toggle, duplicate, and a field edit in quick succession all survive a reload with nothing dropped', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-walls');
  const before = await page.locator('#wall-body tr').count();

  // Three different save-triggering actions, back to back, no waits
  // between them.
  await page.click('#page-walls .mode-toggle-btn:has-text("Enter by area")');
  await page.locator('#wall-body tr').first().locator('.dup-btn').click();
  await page.locator('#wall-body tr').last().locator('.wall-location').fill('Race-check row');

  // Past every debounce window in play (700ms autosave, 500ms recalc).
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForTimeout(500);

  await page.click('#tab-walls');
  // The mode switch survived.
  await expect(page.locator('#page-walls .mode-toggle-btn.on')).toHaveText('Enter by area');
  // The duplicate survived (row count is +1).
  await expect(page.locator('#wall-body tr')).toHaveCount(before + 1);
  // The field edit survived, on the correct (last) row -- not dropped,
  // not applied to the wrong row.
  await expect(page.locator('#wall-body tr').last().locator('.wall-location')).toHaveValue('Race-check row');
});
