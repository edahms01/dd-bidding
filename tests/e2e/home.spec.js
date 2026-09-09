import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Home-launcher brief (Option A). The cold-load section is 'home' — a
// New Bid CTA + the 3 most recent drafts + a link into the Bids list.
// No Load Demo button on Home (tests populate data via the window
// global), no Insights/BidDecision/staleness nudges.

test('cold load lands on the Home launcher, no step bar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-home')).toHaveClass(/active/);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/home');
  // The workflow step bar and the Bids toolbar both belong to other
  // sections — neither renders on Home.
  await expect(page.locator('#app-tabs')).toHaveCount(0);
  await expect(page.locator('#bids-toolbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ New Bid' }).first()).toBeVisible();
});

test('empty state — no drafts shows only the CTA, no list', async ({ page }) => {
  await page.goto('/');
  // Boot always mints one blank draft (resumeActiveDraft), so a truly
  // empty getAllDrafts() only happens on a parse error / pre-boot. Force
  // it, then re-enter Home so its useEffect refetches.
  await page.evaluate(() => { window.getAllDrafts = () => ({}); });
  await page.click('.nav-item[data-nav="bids"]');
  await page.click('.nav-item[data-nav="home"]');
  await expect(page.locator('#page-home .empty-state')).toBeVisible();
  await expect(page.locator('.home-draft-row')).toHaveCount(0);
  await expect(page.locator('#page-home .home-viewall')).toHaveCount(0);
});

test('populated — recent drafts list, Open resumes the draft on Project', async ({ page }) => {
  await page.goto('/');
  await clearAll(page); // clean slate, lands in the workflow
  await page.evaluate(async () => { await window.loadSeedData(); });
  await expect(page.locator('#page-output')).toHaveClass(/active/);

  await page.click('.nav-item[data-nav="home"]');
  await expect(page.locator('#page-home')).toHaveClass(/active/);

  const rows = page.locator('.home-draft-row');
  await expect(rows).toHaveCount(1); // seed replaces the drafts map with one draft
  await expect(rows.first().locator('.home-draft-name')).toHaveText('Harborview Plaza - Retail Fit-Out');
  await expect(rows.first().locator('.home-draft-meta')).toContainText('Retail');

  await rows.first().getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('#page-project')).toHaveClass(/active/);
  await expect(page.locator('#proj-name')).toHaveValue('Harborview Plaza - Retail Fit-Out');
});

test('New Bid from Home creates a blank draft on Project; View all bids goes to the Bids list', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.evaluate(async () => { await window.loadSeedData(); });
  await expect(page.locator('#page-output')).toHaveClass(/active/);
  await page.click('.nav-item[data-nav="home"]');

  await page.locator('#page-home').getByRole('button', { name: '+ New Bid' }).click();
  await expect(page.locator('#page-project')).toHaveClass(/active/);
  await expect(page.locator('#proj-name')).toHaveValue('');

  await page.click('.nav-item[data-nav="home"]');
  await page.locator('#page-home .home-viewall').click();
  await expect(page.locator('#page-bids')).toHaveClass(/active/);
});

test('Home nav item works from another section and highlights only when active', async ({ page }) => {
  await page.goto('/');
  await page.click('.nav-item[data-nav="bids"]');
  await expect(page.locator('#page-bids')).toHaveClass(/active/);
  await expect(page.locator('.nav-item[data-nav="home"]')).not.toHaveClass(/active/);

  await page.click('.nav-item[data-nav="home"]');
  await expect(page.locator('#page-home')).toHaveClass(/active/);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/home');
  await expect(page.locator('.nav-item[data-nav="home"]')).toHaveClass(/active/);
  await expect(page.locator('.nav-item[data-nav="bids"]')).not.toHaveClass(/active/);
});
