import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase C 2.4 — stable shell on Bid History. The step-bar slot now
// carries a filter toolbar instead of going blank, and the filters
// narrow both the table and the totals bar.

// Data rows carry an Update button; the empty-state / no-match <tr> does
// not, and the always-present UpdateRow expandos carry an id.
const dataRows = (page) => page.locator('#page-history tbody tr:not([id]):has(button:has-text("Update"))');
const totalVal = (page, label) => page.locator('.total-item', { hasText: label }).locator('.total-val');

async function openHistory(page) {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(600);
  await page.click('.nav-item[data-nav="history"]');
  await expect(page.locator('#page-history')).toHaveClass(/active/);
}

test('the app frame stays put on Bid History — header, left nav, and a filter toolbar in the step-bar slot', async ({ page }) => {
  await openHistory(page);
  await expect(page.locator('.header')).toBeVisible();
  await expect(page.locator('#app-leftnav')).toBeVisible();
  await expect(page.locator('#history-toolbar')).toBeVisible();
  await expect(page.locator('#app-tabs')).toHaveCount(0); // the workflow step bar is gone, but the frame isn't
});

test('filtering by GC narrows the table and the totals', async ({ page }) => {
  await openHistory(page);
  await expect(dataRows(page)).toHaveCount(5);

  await page.fill('#hf-gc', 'Cianbro');
  await expect(dataRows(page)).toHaveCount(1);
  await expect(page.locator('#page-history tbody')).toContainText('Cianbro');
  await expect(page.locator('#page-history tbody')).not.toContainText('PC Construction');
  await expect(totalVal(page, 'Total bids')).toHaveText('1');
  await expect(totalVal(page, 'Won')).toHaveText('1');
  await expect(totalVal(page, 'Win rate')).toHaveText('100%');
});

test('filtering by outcome, and clearing, restores the full set', async ({ page }) => {
  await openHistory(page);

  await page.selectOption('#hf-outcome', 'won');
  await expect(dataRows(page)).toHaveCount(2); // seed-1, seed-3
  await expect(totalVal(page, 'Won')).toHaveText('2');

  await page.selectOption('#hf-outcome', 'lost');
  await expect(dataRows(page)).toHaveCount(2);
  await expect(totalVal(page, 'Won')).toHaveText('0');

  await page.click('#hf-clear');
  await expect(dataRows(page)).toHaveCount(5);
  await expect(page.locator('#hf-outcome')).toHaveValue('');
});

test('date range brackets date_submitted', async ({ page }) => {
  await openHistory(page);
  // Seed dates: 2025-10, 2025-12, 2026-02, 2026-04, 2026-06.
  await page.fill('#hf-from', '2026-01-01');
  await expect(dataRows(page)).toHaveCount(3);
  await page.fill('#hf-to', '2026-03-01');
  await expect(dataRows(page)).toHaveCount(1); // only 2026-02-19
});

test('a filter that matches nothing shows a distinct message, not the empty-history one', async ({ page }) => {
  await openHistory(page);
  await page.fill('#hf-gc', 'zzz-no-such-gc');
  await expect(dataRows(page)).toHaveCount(0);
  await expect(page.locator('#page-history')).toContainText('No bids match the current filter.');
  await expect(page.locator('#page-history')).not.toContainText('finalize a bid from the Bid Strategy step');
});

test('the Clear button only shows while a filter is active', async ({ page }) => {
  await openHistory(page);
  await expect(page.locator('#hf-clear')).toBeHidden();
  await page.fill('#hf-gc', 'x');
  await expect(page.locator('#hf-clear')).toBeVisible();
  await page.click('#hf-clear');
  await expect(page.locator('#hf-clear')).toBeHidden();
});
