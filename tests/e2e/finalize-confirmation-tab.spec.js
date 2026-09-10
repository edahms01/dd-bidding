import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase E, Step 1 (5.6) — the durable finalize confirmation / failure
// panel must render on the tab where finalize actually happens (Bid
// Strategy / #page-agent), not only on Cost Summary / #page-output where
// it was stranded and invisible (docs/dirigo-ux-decisions.md §9.9, the
// wrong-tab defect held open for this phase). Same state.ui.submitResult,
// now rendered by a shared SubmitResultPanel on both pages; the visible
// one is whichever page is .active.

test('a failed finalize from Bid Strategy shows the durable failure panel on that same tab', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('#tab-agent');
  await page.waitForTimeout(1000);

  await page.route('**/.netlify/functions/bids', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'simulated failure' }) });
    } else {
      route.continue();
    }
  });

  await page.click('#agent-finalize-btn');
  await page.click('#finalize-confirm-btn');
  await expect(page.locator('#finalize-modal-error')).toBeVisible();

  // Close the modal — the durable panel is what the user is left with.
  await page.click('.modal-footer .btn-ghost'); // Cancel
  await expect(page.locator('#finalize-modal-overlay')).not.toHaveClass(/open/);

  // Visible on the active Bid Strategy page...
  await expect(page.locator('#page-agent .submit-result-panel')).toBeVisible();
  await expect(page.locator('#page-agent .submit-result-panel')).toContainText('Bid submission failed');
  // ...and present-but-not-visible on the inactive Cost Summary page
  // (the old wrong-tab location — the panel exists there too, just not
  // where the user is looking).
  await expect(page.locator('#page-output .submit-result-panel')).toHaveCount(1);
  await expect(page.locator('#page-output .submit-result-panel')).not.toBeVisible();
});

test('a successful finalize flashes "Submitted ✓", lands on Home, and shows the corner toast', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('#tab-agent');
  await page.waitForTimeout(1000);

  await page.click('#agent-finalize-btn');
  // Choose Competitive ($271,000) — a non-recommended option, so the
  // persisted recommended-vs-chosen figures have a real gap.
  await page.locator('[data-modal-opt="competitive"]').click();
  await page.click('#finalize-confirm-btn');

  // The confirm button flashes "Submitted ✓" for a beat before the modal
  // closes (tight ~700ms window — rely on Playwright's auto-retry).
  await expect(page.locator('#finalize-confirm-btn')).toHaveText('Submitted ✓');

  // Then the modal closes and the user lands on Home, not the background
  // blank draft clearFinalizedDraft() created.
  await expect(page.locator('#finalize-modal-overlay')).not.toHaveClass(/open/);
  await expect(page.locator('#page-home')).toBeVisible();
  await expect(page.locator('#page-agent')).not.toBeVisible();

  // The corner toast (React BidSubmitToast) overlays Home, then self-dismisses.
  const toast = page.locator('#bid-submit-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Bid submitted: $271,000');
  await expect(toast).toHaveCount(0, { timeout: 5000 });

  // The persisted record carries the recommended figures for later
  // recommended-vs-chosen analysis, not just the live UI.
  const saved = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids =>
      bids.find(b => b.project_name && b.project_name.includes('Harborview')))
  );
  expect(saved.selected_option).toBe('competitive');
  expect(saved.final_bid).toBe(271000);
  expect(saved.recommended_bid).toBe(284500);
  expect(saved.recommended_margin_pct).toBe(28.4);
});
