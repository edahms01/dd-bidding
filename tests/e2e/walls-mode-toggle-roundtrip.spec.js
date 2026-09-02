import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 3.3 — dimensions/area mode toggle. Height is the only column
// that hides (confirmed by reading calculator.js before building this:
// it's never read by the cost math) — CSS-hide, not conditional
// unmount, specifically so a value already typed into it survives a
// mode round-trip. LF stays visible and required in both modes.
//
// Every locator below is scoped to #page-walls/#page-ceilings, not the
// bare .mode-toggle-btn class — AppShell.jsx mounts every page
// unconditionally (only className toggles), so an unscoped selector
// matches two buttons at once (one per page) and Playwright's strict
// mode throws rather than silently picking one.

test('switching to area mode hides the Height column without losing a previously typed value', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');

  const row = page.locator('#wall-body tr').first();
  await row.locator('.wall-height').fill('12');

  await page.click('#page-walls .mode-toggle-btn:has-text("Enter by area")');
  await expect(page.locator('#page-walls th:has-text("Height (ft)")')).toBeHidden();
  await expect(row.locator('.wall-height')).toBeHidden();

  await page.click('#page-walls .mode-toggle-btn:has-text("Enter by dimensions")');
  await expect(row.locator('.wall-height')).toBeVisible();
  await expect(row.locator('.wall-height')).toHaveValue('12');
});

test('LF stays visible and required in both modes, with its own guardrail in area mode', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');

  const row = page.locator('#wall-body tr').first();
  await row.locator('.wall-location').fill('Level 1');
  await row.locator('.wgsf').fill('300');

  // Dimensions mode: LF empty isn't specifically flagged as an
  // area-mode violation (still shown, just no "required" badge).
  await expect(row.locator('.wlf')).toBeVisible();
  await expect(row).not.toContainText('LF is required');

  await page.click('#page-walls .mode-toggle-btn:has-text("Enter by area")');
  await expect(row.locator('.wlf')).toBeVisible();
  await expect(row).toContainText('LF is required');

  await row.locator('.wlf').fill('40');
  await expect(row).not.toContainText('LF is required');
});

test('the mode persists per draft through autosave and reload', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');
  await page.click('#page-walls .mode-toggle-btn:has-text("Enter by area")');
  await page.click('#tab-ceilings');
  await page.click('#page-ceilings .mode-toggle-btn:has-text("Enter by area")');

  // Past the 700ms autosave debounce.
  await page.waitForTimeout(1000);
  await page.reload();
  await page.waitForTimeout(500);

  await page.click('#tab-walls');
  await expect(page.locator('#page-walls .mode-toggle-btn.on')).toHaveText('Enter by area');
  await page.click('#tab-ceilings');
  await expect(page.locator('#page-ceilings .mode-toggle-btn.on')).toHaveText('Enter by area');
});

test('the mode round-trips through export and import', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-walls');
  await page.click('#page-walls .mode-toggle-btn:has-text("Enter by area")');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Export")')
  ]);
  const filePath = path.join(os.tmpdir(), 'dirigo-qa-mode-toggle.json');
  await download.saveAs(filePath);
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  expect(payload.wallsMode).toBe('area');
  fs.unlinkSync(filePath);

  // Switch back to dimensions, then import the exported (area-mode) file.
  await page.click('#page-walls .mode-toggle-btn:has-text("Enter by dimensions")');
  await expect(page.locator('#page-walls .mode-toggle-btn.on')).toHaveText('Enter by dimensions');

  fs.writeFileSync(filePath, JSON.stringify(payload));
  await page.setInputFiles('#import-file-input', filePath);
  await page.waitForTimeout(500);
  await expect(page.locator('#page-walls .mode-toggle-btn.on')).toHaveText('Enter by area');
  fs.unlinkSync(filePath);
});

test('an old draft with no saved mode defaults to dimensions, not whatever mode is currently active', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  // Switch to area mode on the seed draft, then create a brand-new
  // draft (which never set a mode at all) and confirm it defaults to
  // dimensions rather than inheriting area from the session.
  await page.click('#tab-walls');
  await page.click('#page-walls .mode-toggle-btn:has-text("Enter by area")');

  await page.click('#new-bid-btn');
  await page.waitForTimeout(300);
  await page.click('#tab-walls');
  await expect(page.locator('#page-walls .mode-toggle-btn.on')).toHaveText('Enter by dimensions');
});
