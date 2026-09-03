import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criteria 1 + 2: submitting a bid saves it correctly, and it's
// still there after a full page reload — the one thing only a real network
// round trip through a real function proves, the same way Phase 1's reload
// test was the one thing a unit test couldn't cover.
test('submitting a bid saves it, and it survives a full reload', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  // Visit Tab 7 first — loadSeedData() already ran runCalculation() and
  // rendered #output-phase3's totals-bar (Labor/Materials/Logistics/Direct
  // cost total, in that order — js/ui.js:150-169), so read the displayed
  // Logistics figure here as the independent ground truth this assertion
  // needs. Reading it from the DOM rather than recomputing it locally is
  // what makes this a real check against what the app itself shows, not
  // just against its own formula restated in the test.
  await page.click('#tab-output');
  await page.waitForTimeout(300);
  const totalVals = page.locator('#output-phase3 .total-item .total-val');
  const parseCost = (t) => parseInt(t.replace(/[$,]/g, ''), 10);
  const displayedLogistics = parseCost(await totalVals.nth(2).innerText());

  // Visit Tab 8 explicitly — goto('output') alone doesn't render the agent
  // UI; #agent-finalize-btn only exists once renderAgentTab() has run.
  await page.click('#tab-agent');
  await page.waitForTimeout(1000);

  await page.click('#agent-finalize-btn');
  await page.locator('[data-modal-opt="recommended"]').click();
  await page.click('#finalize-confirm-btn');
  // The visible confirmation right after Finalize is the bottom-right toast
  // (#output-bid's own success panel sits behind Tab 8's active page and
  // isn't what the user actually sees at this point) — "text=Bid submitted"
  // alone is ambiguous between the two, so scope to the toast specifically.
  await expect(page.locator('#bid-submit-toast')).toBeVisible();
  await expect(page.locator('#bid-submit-toast')).toContainText('Bid submitted');

  // Bid Agent Analytics Tier 2 data capture: the submitted record must
  // include the labor/material split alongside direct_cost — the split
  // already exists in memory at submission time (buildCostSummary()), this
  // just confirms it actually survives past that point now.
  const saved = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids =>
      bids.find(b => b.project_name && b.project_name.includes('Harborview')))
  );
  expect(saved.estimated_labor_cost).toBeGreaterThan(0);
  expect(saved.estimated_material_cost).toBeGreaterThan(0);
  // direct_cost = laborTotal + materialTotal + logisticsTotal (js/calculator.js,
  // buildCostSummary() — confirmed no other component). Checking the split
  // sums to exactly direct_cost minus the independently-displayed Logistics
  // figure is the tight version of this check: a badly wrong split (e.g.
  // material silently zeroed) would fail it, where a bare <= would not.
  // A ±2 tolerance, not exact equality, because estimated_labor_cost and
  // estimated_material_cost are each Math.round()'d independently
  // (js/state.js's buildBidRecord()) — sum-of-rounded-parts can legitimately
  // differ by a dollar or two from a value rounded once as a whole.
  const expectedSplitTotal = saved.direct_cost - displayedLogistics;
  expect(Math.abs((saved.estimated_labor_cost + saved.estimated_material_cost) - expectedSplitTotal)).toBeLessThanOrEqual(2);

  // Reload the whole page — confirms this is actually server-side now,
  // not just working because the page never refreshed.
  await page.reload();
  await page.click('.nav-item[title="Bid History"]');

  const page_ = page.locator('#page-bids');
  await expect(page_).toContainText('Harborview');
  await expect(page_.locator('.total-item .total-val').first()).toHaveText('6');
});
