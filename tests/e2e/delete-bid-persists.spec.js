import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criterion 4: deleting a bid is gone after a reload, not just
// removed from the current view — proves the async deleteBid() call
// actually reaches the server. (Was deleteBidRecord() — a dead js/ui.js
// wrapper removed in the A2 close-out.) deleteBid() (src/state/history.js,
// Migration Phase 5, Bucket 1, Step C) is a real import in BidsPage.jsx
// now, no longer a window global — this drives it through the real ×
// button + confirm() dialog on BidsPage.jsx, the same pattern
// delete-draft.spec.js already uses for the sibling draft-row delete,
// rather than calling the function directly.
test('deleting a bid record is gone after reload, not just removed from the current view', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('.nav-item[title="Bid History"]');
  const target = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids[0])
  );

  page.once('dialog', d => d.accept());
  await page.locator('tr', { hasText: target.project_name }).locator('button:has-text("×")').click();
  await page.waitForTimeout(800);

  await page.reload();
  const remaining = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  expect(remaining.length).toBe(4);
  expect(remaining.find(b => b.bid_id === target.bid_id)).toBeUndefined();
});
