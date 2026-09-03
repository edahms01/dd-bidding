import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clearAll, loadSeed } from './helpers.js';

// DateField (src/components/DateField.jsx) replaces the two native
// <input type="date"> fields on Project with a controlled MM/DD/YYYY
// text input. Storage stays ISO (a hidden <input id="proj-bid"> the
// existing collectFormData()/export path reads), so these specs prove
// (a) US display in, ISO out, (b) an invalid entry doesn't corrupt the
// stored value, (c) ISO from a loaded draft renders as MM/DD/YYYY.

const bidDue = (page) =>
  page.locator('.field', { hasText: 'Bid due date' }).locator('.datefield-input');

async function exportJson(page, name) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => window.exportBid())
  ]);
  const filePath = path.join(os.tmpdir(), name);
  await download.saveAs(filePath);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  fs.unlinkSync(filePath);
  return json;
}

test('a typed MM/DD/YYYY date displays formatted and exports as ISO', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await bidDue(page).fill('03/15/2026');
  await bidDue(page).blur();
  await expect(bidDue(page)).toHaveValue('03/15/2026');

  await page.waitForTimeout(900); // past the autosave debounce
  const exported = await exportJson(page, 'dirigo-datefield-valid.json');
  expect(exported.project.bidDate).toBe('2026-03-15');
});

test('an unparseable date shows an error state and leaves the stored value blank', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await bidDue(page).fill('13/45/2026');
  await bidDue(page).blur();
  await expect(bidDue(page)).toHaveClass(/invalid/);
  await expect(bidDue(page)).toHaveAttribute('aria-invalid', 'true');

  await page.waitForTimeout(900);
  const exported = await exportJson(page, 'dirigo-datefield-invalid.json');
  expect(exported.project.bidDate).toBe('');
});

test('clearing a populated date exports as empty string, not stale', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await bidDue(page).fill('03/15/2026');
  await bidDue(page).blur();
  await expect(bidDue(page)).toHaveValue('03/15/2026');

  await bidDue(page).fill('');
  await bidDue(page).blur();
  await expect(bidDue(page)).toHaveValue('');

  await page.waitForTimeout(900);
  const exported = await exportJson(page, 'dirigo-datefield-cleared.json');
  expect(exported.project.bidDate).toBe('');
});

test('an ISO date loaded from a draft renders as MM/DD/YYYY', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page); // seed project.bidDate === '2026-07-15'
  await page.waitForTimeout(1200);

  await expect(bidDue(page)).toHaveValue('07/15/2026');
  // and the hidden input still carries the ISO value the export path reads
  await expect(page.locator('#proj-bid')).toHaveValue('2026-07-15');
});
