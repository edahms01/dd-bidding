import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Tier 4: competitor-specific loss patterns. Seed data already has one
// loss to "Northeast Drywall Inc." (seed-2) sitting below
// MIN_LOSSES_FOR_COMPETITOR_CONFIDENCE (timesLost: 1, avgUndercutPct:
// null). Logging a second loss to the same competitor via the Update
// form — on a different, currently-pending seed bid — crosses that
// threshold live, proving the full capture-to-payload path (Update
// form -> bids storage -> getHistorySummary() -> computeCompetitorPatterns())
// in one real round trip, without a real Anthropic call.
test('a second loss to an already-seen competitor crosses the confidence threshold in the agent payload', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  const before = await page.evaluate(() => getHistorySummary('Callahan Construction Group', 'Retail'));
  const beforeEntry = before.competitorPatterns.find(c => c.name === 'Northeast Drywall Inc.');
  expect(beforeEntry).toEqual({ name: 'Northeast Drywall Inc.', timesLost: 1, avgUndercutPct: null });

  // seed-5 ("Consigli Construction Co.") is the one pending seed bid —
  // repurpose it as a second loss to the same competitor as seed-2.
  await page.click('.nav-item[title="Bid History"]');
  const pendingBid = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids.find(b => b.outcome === 'pending'))
  );
  const bidId = pendingBid.bid_id;

  await page.evaluate((id) => toggleUpdate(id), bidId);
  await page.selectOption('#uf-outcome-' + bidId, 'lost');
  await page.fill('#uf-winner-' + bidId, 'Northeast Drywall Inc.');
  await page.fill('#uf-winbid-' + bidId, String(Math.round(pendingBid.final_bid * 0.9)));
  await page.click(`#uprow-${bidId} button:has-text("Save")`);
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => getHistorySummary('Callahan Construction Group', 'Retail'));
  const afterEntry = after.competitorPatterns.find(c => c.name === 'Northeast Drywall Inc.');
  expect(afterEntry.timesLost).toBe(2);
  expect(afterEntry.avgUndercutPct).not.toBeNull();
  expect(typeof afterEntry.avgUndercutPct).toBe('number');
});
