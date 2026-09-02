import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criterion 4: deleting a bid is gone after a reload, not just
// removed from the current view — proves deleteBidRecord()'s async
// deleteBid() call actually reaches the server.
test('deleting a bid record is gone after reload, not just removed from the current view', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('.nav-item[title="Bids"]');
  const bidId = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids[0].bid_id)
  );

  page.once('dialog', d => d.accept());
  await page.evaluate((id) => deleteBidRecord(id), bidId);
  await page.waitForTimeout(800);

  await page.reload();
  const remaining = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  expect(remaining.length).toBe(4);
  expect(remaining.find(b => b.bid_id === bidId)).toBeUndefined();
});
