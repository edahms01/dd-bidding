import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criterion 4: deleting a bid is gone after a reload, not just
// removed from the current view — proves the async deleteBid() call
// actually reaches the server. (Was deleteBidRecord() — a dead js/ui.js
// wrapper removed in the A2 close-out; deleteBid() is the live path
// BidsPage.jsx's delete button calls.)
test('deleting a bid record is gone after reload, not just removed from the current view', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('.nav-item[title="Bid History"]');
  const bidId = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids[0].bid_id)
  );

  await page.evaluate((id) => deleteBid(id), bidId);
  await page.waitForTimeout(800);

  await page.reload();
  const remaining = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  expect(remaining.length).toBe(4);
  expect(remaining.find(b => b.bid_id === bidId)).toBeUndefined();
});
