import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// If getHistorySummary() rejects during an agent run, _launchBidAgent()
// must fall back to the zeroed stats shape and still render a
// recommendation, with a visible (not silent) degraded-state notice — and
// that notice must be driven only by an actual failure, never by the
// legitimate "this GC has zero prior bids" success case.
test('a failed history fetch during an agent run degrades gracefully with a visible notice, and recovers once the fetch succeeds again', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.route('**/.netlify/functions/bids', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'simulated failure' }) });
    } else {
      route.continue(); // loadSeedData() writes via dev-seed-bids (POST), unaffected
    }
  });

  await loadSeed(page);
  await page.waitForTimeout(2000);

  await page.click('#tab-output');
  await page.waitForTimeout(500);
  await page.click('#tab-agent');
  await page.waitForTimeout(1500);

  await expect(page.locator('.page-title:has-text("Bid Strategy")')).toBeVisible();
  await expect(page.locator('text=Historical bid data unavailable')).toBeVisible();

  await page.unroute('**/.netlify/functions/bids');
  // Re-send to the agent explicitly (nothing re-runs it on tab
  // navigation any more) — this time the history fetch succeeds.
  await page.click('#tab-agent');
  await page.click('#agent-send-btn'); // "↻ Re-run agent" once a result exists
  await page.waitForTimeout(1500);

  await expect(page.locator('text=Historical bid data unavailable')).toHaveCount(0);
});

// Distinct from the failure case above: a GC/system with genuinely zero
// prior bids is a successful fetch (getHistorySummary() resolves to its
// own zeroed shape, doesn't throw) — must never trip the same notice as
// an actual fetch failure. These are different situations and need to
// stay visually distinct; _agentHistoryUnavailable is set only inside
// _launchBidAgent()'s catch block specifically to guarantee that.
test('a legitimate zero-prior-bids GC (successful fetch, not a failure) never shows the unavailable notice', async ({ page }) => {
  await page.goto('/');
  await clearAll(page); // zero bids system-wide — no seed load this time

  const bids = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  expect(bids.length).toBe(0);

  await page.fill('#proj-name', 'Zero History GC Test');
  await page.fill('#proj-gc', 'Totally New GC With No History');
  await page.click('#tab-output');
  await page.waitForTimeout(1000);
  await page.click('#tab-agent');
  await page.waitForTimeout(1500);

  const summary = await page.evaluate(() => getHistorySummary('Totally New GC With No History', ''));
  expect(summary.totalBids).toBe(0); // the resolved (not rejected) zeroed shape

  await expect(page.locator('.page-title:has-text("Bid Strategy")')).toBeVisible();
  await expect(page.locator('text=Historical bid data unavailable')).toHaveCount(0);

  const flagVal = await page.evaluate(() => _agentHistoryUnavailable);
  expect(flagVal).toBe(false);
});
