import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// 2026-09-05: the confidence-level -> contingency % auto-fill was removed.
// Picking an Estimator confidence level on Market Read used to silently
// write a hardcoded contingency % (High -> 4, Medium -> 8, Low -> 15) into
// the Rates -> Markup tray the first time a calculation ran, but only if
// the field was still empty. That link is gone: the two identical pre-fill
// blocks in js/ui.js (calculateOnly() and submitBid()) and the now-dead
// _currentConfidence() helper were deleted. Confidence and contingency are
// independent now — confidence still saves to the bid record and feeds the
// agent, contingency is purely manual.
//
// This behavior was previously untested in either direction. The submit
// path (submitBid()'s copy of the block) is not given its own assertion
// here: it was structurally identical, is removed in the same commit, and
// had no record-observable effect anyway — the finalize modal always
// passes a chosen amount, and buildBidRecord() derives final_bid/markup_pct
// from that amount, not from markupResult's contingency (js/state.js). The
// calc path below exercises the exact mechanism both blocks shared.
test('picking a confidence level never auto-fills the contingency % field', async ({ page }) => {
  await page.goto('/');
  await clearAll(page); // fresh blank draft — contingency starts '', the
                        // exact condition the old pre-fill keyed off of.

  for (const level of ['c-hi', 'c-md', 'c-lo']) {
    // Pick the confidence level on Market Read.
    await page.click('#tab-market');
    await page.click(`#${level}`);
    await expect(page.locator(`#${level}`)).toHaveClass(/conf-btn.*\b(hi|md|lo)\b/);

    // Run a calculation the same way the app does — visiting Cost Summary
    // calls window.calculateOnly() (js/state/bridges.js), which is where
    // the pre-fill used to live.
    await page.click('#tab-output');
    await page.waitForTimeout(700); // past the 500ms reactive-calc debounce

    // Contingency must still be blank.
    await page.click('#tab-rates');
    await expect(page.locator('#markup-contingency')).toHaveValue('');
  }
});
