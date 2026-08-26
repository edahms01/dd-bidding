import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// ⚠ INVERTED TEST -- READ BEFORE TOUCHING.
// This spec currently PASSES because the app has a bug. If it starts
// FAILING, that means someone fixed the bug (wired the finalize modal's
// selected amount through to submitBid()) -- that is success, not a
// regression. The correct response is to INVERT this test's assertion
// (or delete it and write a normal positive one) to match the fixed
// behavior, NOT to "fix" the code to make this test pass again, and NOT
// to treat this test's failure as something A2 broke. If you are a Code
// session with no memory of the conversation that produced this file:
// this is that context, in full, right here in this comment.
//
// NEW FINDING, not a pre-existing known issue -- reported to Eric
// alongside this spec, not silently fixed (Phase A makes no business
// logic changes) and not silently hidden by only testing the parts that
// happen to work.
//
// _finalizeBid() (js/ui.js) reads whichever row is selected in the
// finalize modal -- a standard agent option or the custom override --
// and computes `amount`/`label` from it. But it passes neither into
// submitBid(): submitBid() independently recomputes the bid from
// buildBidRecord(state, summary, markupResult), where
// `markupResult.finalBidPrice` is the plain calculator markup result
// (Rates/Conditions markup inputs), entirely unrelated to whatever the
// user picked in the modal. `amount`/`label` are used only for the
// client-side success toast (_showBidToast), never for what's actually
// saved.
//
// Net effect: the finalize modal visually implies "you are submitting at
// $X, the option you chose" but the persisted final_bid is always the
// same number regardless of which row -- or override amount -- was
// selected. Confirmed with both a standard option (Ambitious) and a
// custom override amount; both produced the identical final_bid as the
// calculator's own baseline. This spec pins that current (buggy)
// behavior down as an explicit, visible regression test rather than
// leaving it to be rediscovered by accident -- it is expected to start
// FAILING the day someone wires the selected amount through, which is
// the point: that's the signal the fix landed and this test (and its
// comment) can be deleted.
test('KNOWN BUG — the finalize modal\'s selected option/override amount is not what gets persisted as final_bid', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  // The plain calculator's own bid price, independent of the agent/modal.
  await page.click('#tab-output');
  await page.waitForTimeout(300);
  const outputText = await page.locator('#output-phase3').innerText();
  const calculatorBidMatch = outputText.match(/\$[\d,]+/g);
  expect(calculatorBidMatch).toBeTruthy();

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

  // This is the bug, pinned down: what the user saw and clicked
  // ("Ambitious", a specific dollar figure) is NOT what was saved.
  expect(savedAmount).not.toBe(ambitiousDisplayedAmount);
});
