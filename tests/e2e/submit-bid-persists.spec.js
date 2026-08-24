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

  // Reload the whole page — confirms this is actually server-side now,
  // not just working because the page never refreshed.
  await page.reload();
  await page.click('.nav-item[title="Bid History"]');

  const page_ = page.locator('#page-history');
  await expect(page_).toContainText('Harborview');
  await expect(page_.locator('.total-item .total-val').first()).toHaveText('6');
});
