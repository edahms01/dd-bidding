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
  // Labor burden + supervision now load onto raw labor before markup and
  // are part of direct_cost (js/calculator.js buildCostSummary() →
  // applyLaborBurden()). They surface as their own rows in the Category
  // subtotals panel; read them from the DOM as independent ground truth,
  // same reasoning as displayedLogistics above.
  const rowVal = (label) => page.locator(`#output-phase3 [data-row="${label}"] .subtotal-val`).innerText().then(parseCost);
  const displayedRawLabor    = await rowVal('Labor (raw)');
  const displayedBurden      = await rowVal('Burden');
  const displayedSupervision = await rowVal('Supervision');

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
  // estimated_labor_cost stays RAW (pre-burden) on purpose — buildBidRecord()
  // (js/state.js) keeps Math.round(summary.laborTotal), matching the
  // "Labor (raw)" row, so a future labor-burden report has the un-loaded
  // split. It equals direct_cost minus logistics, burden, and supervision:
  //   estimated_labor_cost + estimated_material_cost
  //     = direct_cost - logistics - burden - supervision
  // A badly wrong split (e.g. material silently zeroed) still fails this;
  // ±2 tolerance because each part is Math.round()'d independently.
  const expectedSplitTotal =
    saved.direct_cost - displayedLogistics - displayedBurden - displayedSupervision;
  expect(Math.abs((saved.estimated_labor_cost + saved.estimated_material_cost) - expectedSplitTotal)).toBeLessThanOrEqual(2);
  // And the raw split is genuinely raw: estimated_labor_cost tracks the
  // "Labor (raw)" row, not the burden-loaded figure.
  expect(Math.abs(saved.estimated_labor_cost - displayedRawLabor)).toBeLessThanOrEqual(2);
  expect(displayedBurden).toBeGreaterThan(0);
  expect(displayedSupervision).toBeGreaterThan(0);

  // Reload the whole page — confirms this is actually server-side now,
  // not just working because the page never refreshed.
  await page.reload();
  await page.click('.nav-item[title="Bid History"]');

  const page_ = page.locator('#page-bids');
  await expect(page_).toContainText('Harborview');
  await expect(page_.locator('.total-item .total-val').first()).toHaveText('6');
});
