import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase F, 8.1 — the Insights view (InsightsPage.jsx) rendering the
// analytics js/history-analytics.js already computes: win rate by margin
// band, win rate by quarter, competitor loss patterns. Read-only; the
// existing gates (15 decided bids for the margin curve, 2 priced losses
// for a competitor's avg undercut) are honoured as-is.
//
// With seed data (5 bids, 4 decided) the margin curve is below its gate
// — that "not enough data" state is the realistic primary one and is
// tested directly. The populated state is driven by a route-mock of the
// bids GET with tests/fixtures/insights-populated.json (18 decided) so
// it never touches the Blobs store.

const populated = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'insights-populated.json'), 'utf8')
);

const tray = (page, hdr) => page.locator('.tray', { has: page.locator('.tray-hdr', { hasText: hdr }) });

async function openInsights(page) {
  await page.click('.nav-item[data-nav="insights"]');
  await expect(page.locator('#page-insights')).toHaveClass(/active/);
  await expect(page.locator('#page-insights .tray-cols')).toBeVisible();
}

test('reached from the left-nav item, with its own #/insights route', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await openInsights(page);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/insights');
  await expect(page.locator('.nav-item[data-nav="insights"]')).toHaveClass(/active/);
});

test('deep link opens Insights directly', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.goto('/#/insights');
  await expect(page.locator('#page-insights')).toHaveClass(/active/);
  await expect(page.locator('#page-project')).not.toHaveClass(/active/);
});

test('seed data — the realistic "not enough data" primary state', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(700);
  await openInsights(page);

  // Margin curve: 4 decided seed bids, gate is 15 — an empty state, no bars.
  const margin = tray(page, 'Win rate by margin band');
  await expect(margin.locator('.empty-state')).toContainText('4 of 15');
  await expect(margin.locator('.insight-bar')).toHaveCount(0);

  // Seasonality: has no gate — seed's decided bids fall in 2 quarters,
  // and the low-volume note is shown.
  const season = tray(page, 'Win rate by quarter');
  await expect(season.locator('.insight-bar')).toHaveCount(2);
  await expect(season.locator('.insight-note')).toBeVisible();

  // Competitor patterns: two single-loss competitors, both below the
  // 2-priced-loss threshold so the undercut column is "—".
  const comp = tray(page, 'Competitor loss patterns');
  await expect(comp.locator('tbody tr')).toHaveCount(2);
  await expect(comp).toContainText('Northeast Drywall Inc.');
  await expect(comp).toContainText('Summit Drywall');
  await expect(comp.locator('tbody tr td:nth-child(3)').first()).toHaveText('-');
  await expect(comp.locator('.insight-note')).toBeVisible();
});

test('populated data — margin bands and a confident competitor undercut render', async ({ page }) => {
  await page.route('**/.netlify/functions/bids', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(populated) });
    } else {
      route.continue();
    }
  });

  await page.goto('/');
  await clearAll(page);
  await openInsights(page);

  // Margin curve: gate cleared (18 decided), 3 bands, no empty state.
  const margin = tray(page, 'Win rate by margin band');
  await expect(margin.locator('.empty-state')).toHaveCount(0);
  await expect(margin.locator('.insight-bar')).toHaveCount(3);
  await expect(margin.locator('.insight-bar', { hasText: '25–30%' })).toContainText('83% won');
  await expect(margin.locator('.insight-bar', { hasText: '25–30%' })).toContainText('5/6');

  // Seasonality: 3 quarters, all with 6 decided bids -> no low-volume note.
  const season = tray(page, 'Win rate by quarter');
  await expect(season.locator('.insight-bar')).toHaveCount(3);
  await expect(season.locator('.insight-note')).toHaveCount(0);

  // Competitor: Beacon Builders lost to 4×, 3 priced -> a real avg undercut.
  const comp = tray(page, 'Competitor loss patterns');
  const beacon = comp.locator('tbody tr', { hasText: 'Beacon Builders' });
  await expect(beacon.locator('td:nth-child(2)')).toHaveText('4');
  await expect(beacon.locator('td:nth-child(3)')).toHaveText('6%');
  await expect(comp.locator('.insight-note')).toHaveCount(0);
});

test('mobile 390px — no horizontal body scroll on Insights', async ({ page }) => {
  // Seed at desktop width first — the demo controls are display:none
  // below 768px (same reason mobile-layout.spec.js seeds this way).
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(700);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/insights');
  await expect(page.locator('#page-insights')).toHaveClass(/active/);
  const overflow = await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
