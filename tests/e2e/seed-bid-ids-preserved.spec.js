import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Acceptance criterion 5: loadSeedData() (dev toolbar) — seed bids appear
// with their original bid_ids (seed-1..seed-5) intact, proving dev-seed-bids
// actually bypasses id-generation the way the direct localStorage write
// used to, now that it's a real function call.
test('loadSeedData() preserves the original seed-1..seed-5 bid_ids', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  const ids = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids => bids.map(b => b.bid_id).sort())
  );
  expect(ids).toEqual(['seed-1', 'seed-2', 'seed-3', 'seed-4', 'seed-5']);
});
