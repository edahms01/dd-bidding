import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Regression test for A2.5. Filename kept as-is (matches existing
// cross-references in CLAUDE.md and docs/dirigo-ux-decisions.md) even
// though this is no longer an inverted spec.
//
// Formerly an INVERTED test: it used to pass because of a real bug —
// _finalizeBid()/FinalizeModal.jsx computed the selected option/override
// amount but only used it for the client-side success toast; submitBid()
// independently recomputed final_bid from buildBidRecord(state, summary,
// markupResult), where markupResult.finalBidPrice is the plain calculator
// markup result, entirely unrelated to whatever the user picked in the
// modal. Confirmed with both a standard option (Ambitious) and a custom
// override amount — both produced the identical final_bid as the
// calculator's own baseline, regardless of what was clicked.
//
// A2.5 fixed this: FinalizeModal.jsx now passes { amount, selectedOption }
// into submitBid(), which threads it through to buildBidRecord() (js/
// state.js) — final_bid (and markup_pct, recomputed from the same chosen
// amount) now reflect the user's actual selection. This spec now asserts
// that behavior directly instead of pinning the old mismatch.
test('the finalize modal\'s selected option amount is exactly what gets persisted as final_bid', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('#tab-agent');
  await page.click('#agent-finalize-btn');

  const ambitiousRow = page.locator('[data-modal-opt="ambitious"]');
  const ambitiousDisplayedAmount = (await ambitiousRow.locator('.bid-option-amount').textContent()).trim();

  const before = await page.evaluate(async () => (await (await fetch('/.netlify/functions/bids')).json()).map(b => b.bid_id));
  await ambitiousRow.click();
  await page.click('#finalize-confirm-btn');
  await page.waitForTimeout(800);

  const after = await page.evaluate(async () => await (await fetch('/.netlify/functions/bids')).json());
  const newBid = after.find(b => !before.includes(b.bid_id));
  expect(newBid).toBeTruthy();

  const savedAmount = '$' + newBid.final_bid.toLocaleString();

  // The fix: what the user saw and clicked ("Ambitious", a specific
  // dollar figure) is exactly what gets saved.
  expect(savedAmount).toBe(ambitiousDisplayedAmount);
  expect(newBid.selected_option).toBe('ambitious');
});
