import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criterion 3: updating a bid's outcome/actual cost persists
// across a reload — proves saveUpdate()'s async updateBid() call actually
// reaches the server, not just a local re-render.
test("updating a bid's outcome/actual cost via the Update row persists across reload", async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('.nav-item[title="Bid History"]');
  const bidId = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids[0].bid_id)
  );

  await page.evaluate((id) => toggleUpdate(id), bidId);
  await page.fill('#uf-actualcost-' + bidId, '77000');
  await page.selectOption('#uf-outcome-' + bidId, 'won');
  await page.click(`#uprow-${bidId} button:has-text("Save")`);
  await page.waitForTimeout(800);

  await page.reload();
  const updated = await page.evaluate((id) =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids.find(b => b.bid_id === id)),
    bidId
  );
  expect(updated.outcome).toBe('won');
  expect(updated.actual_cost).toBe(77000);
});
