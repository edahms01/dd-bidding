import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase C 2.5 — the unified Bids list (BidsPage.jsx) replacing the
// separate Dashboard + Bid History screens, plus 2.4's stable-shell
// filter toolbar. Drafts (sync localStorage) and submitted bids (async
// function) merge into one list with a derived Draft/Submitted/Won/Lost
// status column.

// Data rows have the full 7 cells; the empty/no-match <tr> is a single
// colSpan cell, and the BidUpdateRow expandos carry an id.
const rows = (page) => page.locator('#page-bids tbody tr:not([id]):has(td:nth-child(6))');
const totalVal = (page, label) => page.locator('.total-item', { hasText: label }).locator('.total-val');

async function openBids(page) {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(700);
  await page.click('.nav-item[data-nav="bids"]');
  await expect(page.locator('#page-bids')).toHaveClass(/active/);
}

test('the frame stays put — header, left nav, and the Bids filter toolbar in the step-bar slot', async ({ page }) => {
  await openBids(page);
  await expect(page.locator('.header')).toBeVisible();
  await expect(page.locator('#app-leftnav')).toBeVisible();
  await expect(page.locator('#bids-toolbar')).toBeVisible();
  await expect(page.locator('#app-tabs')).toHaveCount(0); // no workflow step bar, but the frame is intact
});

test('drafts and submitted bids show in one list with a status column', async ({ page }) => {
  await openBids(page);
  // seed = 5 submitted bids + 1 draft (the seed's Harborview draft; Load
  // Seed replaces the drafts map, so the boot blank draft is gone).
  await expect(rows(page)).toHaveCount(6);
  const body = page.locator('#page-bids tbody');
  await expect(body).toContainText('Draft');
  await expect(body).toContainText('Won');
  await expect(body).toContainText('Lost');
  await expect(body).toContainText('Submitted'); // the one pending seed bid
  // the active draft is marked
  await expect(page.locator('#page-bids tbody tr', { hasText: 'Harborview' }).first()).toContainText('current');
});

test('the status filter narrows the list; GC and date filters too', async ({ page }) => {
  await openBids(page);

  await page.selectOption('#hf-status', 'Draft');
  await expect(rows(page)).toHaveCount(1); // the seed's Harborview draft
  await expect(page.locator('#page-bids tbody')).toContainText('Draft');

  await page.selectOption('#hf-status', 'Won');
  await expect(rows(page)).toHaveCount(2);

  await page.selectOption('#hf-status', '');
  await page.fill('#hf-gc', 'Cianbro');
  await expect(rows(page)).toHaveCount(1);
  await expect(totalVal(page, 'Won')).toHaveText('1');
  await expect(totalVal(page, 'Win rate')).toHaveText('100%');

  await page.click('#hf-clear');
  await expect(rows(page)).toHaveCount(6);

  // seed submitted dates: 2025-10 .. 2026-06
  await page.fill('#hf-from', '2026-01-01');
  await page.fill('#hf-to', '2026-03-01');
  await expect(rows(page)).toHaveCount(1); // only the 2026-02-19 bid
});

test('a filter that matches nothing shows a distinct message', async ({ page }) => {
  await openBids(page);
  await page.fill('#hf-gc', 'zzz-no-such-gc');
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('#page-bids')).toContainText('No bids match the current filter.');
});

test('the Clear button only shows while a filter is active', async ({ page }) => {
  await openBids(page);
  await expect(page.locator('#hf-clear')).toBeHidden();
  await page.fill('#hf-gc', 'x');
  await expect(page.locator('#hf-clear')).toBeVisible();
  await page.click('#hf-clear');
  await expect(page.locator('#hf-clear')).toBeHidden();
});

test('draft row actions: Open loads it into the workflow; Duplicate adds a row; Delete removes it', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.fill('#proj-name', 'Bids List QA');
  await page.waitForTimeout(900);
  await page.click('.nav-item[data-nav="bids"]');

  const draftRow = page.locator('#page-bids tbody tr', { hasText: 'Bids List QA' });
  await draftRow.locator('button:has-text("Duplicate")').click();
  await expect(rows(page)).toHaveCount(2);

  page.once('dialog', (d) => d.accept());
  await draftRow.first().locator('button:has-text("×")').click();
  await expect(rows(page)).toHaveCount(1);

  await page.locator('#page-bids tbody tr').first().locator('button:has-text("Open")').click();
  await expect(page.locator('#page-project')).toHaveClass(/active/);
});

test('the New Bid header button spawns a fresh draft without leaving the list', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.fill('#proj-name', 'Header New Bid QA');
  await page.waitForTimeout(900);
  await page.click('.nav-item[data-nav="bids"]');
  await expect(rows(page)).toHaveCount(1);

  await page.click('#new-bid-btn');           // header action, not a nav item
  await expect(page.locator('#page-project')).toHaveClass(/active/); // lands you in the fresh draft
  await page.fill('#proj-name', 'Second QA');
  await page.waitForTimeout(900);

  await page.click('.nav-item[data-nav="bids"]');
  await expect(rows(page)).toHaveCount(2);
});

test('the async bids fetch failing still shows drafts, with an error note', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.route('**/.netlify/functions/bids', (route) => {
    if (route.request().method() === 'GET') route.fulfill({ status: 500, body: '{}' });
    else route.continue();
  });

  await page.click('.nav-item[data-nav="bids"]');
  await expect(page.locator("text=Couldn't load submitted bids")).toBeVisible();
  await expect(page.locator('#page-bids tbody')).toContainText('Harborview'); // the seed draft still renders
});
