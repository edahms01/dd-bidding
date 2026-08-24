import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criterion 3: updating a bid's outcome/split actual costs
// persists across a reload — proves saveUpdate()'s async updateBid() call
// actually reaches the server, not just a local re-render. Split-cost
// entry replaced the old single "Actual cost ($)" field (Bid Agent
// Analytics Tier 2 data capture) — this also proves the labor/material
// variances and their sum (cost_variance) all persist correctly.
test("updating a bid's outcome/split actual costs via the Update row persists across reload", async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('.nav-item[title="Bid History"]');
  const bid = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids[0])
  );
  const bidId = bid.bid_id;

  await page.evaluate((id) => toggleUpdate(id), bidId);
  await page.fill('#uf-actuallabor-'    + bidId, '50000');
  await page.fill('#uf-actualmaterial-' + bidId, '27000');
  await page.selectOption('#uf-outcome-' + bidId, 'won');
  await page.click(`#uprow-${bidId} button:has-text("Save")`);
  await page.waitForTimeout(800);

  await page.reload();
  const updated = await page.evaluate((id) =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids.find(b => b.bid_id === id)),
    bidId
  );

  expect(updated.outcome).toBe('won');
  expect(updated.actual_labor_cost).toBe(50000);
  expect(updated.actual_material_cost).toBe(27000);
  expect(updated.actual_cost).toBe(77000);

  // Seed record (data/seed.json) has no estimated_labor_cost/estimated_material_cost
  // baseline — legacy path applies: labor/material variances stay null, and the
  // combined cost_variance falls back to the old direct_cost-vs-actual-sum formula.
  expect(updated.labor_cost_variance).toBeNull();
  expect(updated.material_cost_variance).toBeNull();
  expect(updated.cost_variance).toBe(77000 - bid.direct_cost);
});

// Confirms the other half of the legacy-record fallback: entering only
// one of the two split fields must not silently treat the missing half
// as 0 — cost_variance must stay null rather than understating the
// actual cost (js/history-analytics.js's computeCostVariances()).
test('logging only one of the two split actual costs on a legacy record leaves cost_variance null', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('.nav-item[title="Bid History"]');
  const bidId = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids[0].bid_id)
  );

  await page.evaluate((id) => toggleUpdate(id), bidId);
  await page.fill('#uf-actuallabor-' + bidId, '50000');
  await page.selectOption('#uf-outcome-' + bidId, 'won');
  await page.click(`#uprow-${bidId} button:has-text("Save")`);
  await page.waitForTimeout(800);

  await page.reload();
  const updated = await page.evaluate((id) =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids.find(b => b.bid_id === id)),
    bidId
  );

  expect(updated.actual_labor_cost).toBe(50000);
  expect(updated.actual_material_cost).toBeNull();
  expect(updated.actual_cost).toBeNull();
  expect(updated.cost_variance).toBeNull();
});
