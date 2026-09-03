import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Coverage gap closed (see docs/step-0-coverage-report.md, Gap 3): no
// existing spec ever selects "Custom override" in the finalize modal or
// types into #modal-custom-amount -- only the standard agent-option path
// and the inflight-disabled-guard (bid-storage-error-handling.spec.js)
// are covered.

async function openFinalizeModal(page) {
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);
  await page.click('#tab-agent');
  await page.click('#agent-finalize-btn');
}

test('Confirm is disabled the moment Custom override is selected, and only re-enables once a positive amount is entered', async ({ page }) => {
  await page.goto('/');
  await openFinalizeModal(page);

  const confirmBtn = page.locator('#finalize-confirm-btn');
  const amountInput = page.locator('#modal-custom-amount');
  const overrideRow = page.locator('[data-modal-opt="override"]');

  // A standard agent option is pre-selected on open, so Confirm starts enabled.
  await expect(confirmBtn).toBeEnabled();

  await overrideRow.click();
  await expect(confirmBtn).toBeDisabled();
  await expect(amountInput).toBeVisible();

  await amountInput.fill('0');
  await expect(confirmBtn).toBeDisabled();

  await amountInput.fill('-500');
  await expect(confirmBtn).toBeDisabled();

  await amountInput.fill('125000');
  await expect(confirmBtn).toBeEnabled();

  // Clearing the field back out re-disables it -- not a one-way latch.
  await amountInput.fill('');
  await expect(confirmBtn).toBeDisabled();

  // Switching back to a standard option re-enables Confirm and hides the
  // amount field again, without needing a value in it.
  await page.locator('.bid-option-row').first().click();
  await expect(confirmBtn).toBeEnabled();
  await expect(amountInput).not.toBeVisible();
});

test('finalizing with a custom override amount clears the draft and creates a Bid History record', async ({ page }) => {
  // A2.5: prior to the fix, this deliberately did NOT assert the override
  // amount ended up as the saved final_bid -- submitBid() independently
  // recomputed final_bid from the plain calculator markup result and
  // never received the modal's selection (see finalize-modal-selection-
  // not-persisted.spec.js for the dedicated regression coverage). Now
  // that FinalizeModal.jsx threads { amount, selectedOption } through to
  // buildBidRecord(), it's safe to assert the override path directly here
  // too, rather than only in the standard-option spec.
  await page.goto('/');
  await openFinalizeModal(page);

  const activeIdBefore = await page.evaluate(() => localStorage.getItem('dirigo_active_draft_id'));
  expect(activeIdBefore).toBeTruthy();

  const before = await page.evaluate(async () => (await (await fetch('/.netlify/functions/bids')).json()).map(b => b.bid_id));

  await page.locator('[data-modal-opt="override"]').click();
  await page.locator('#modal-custom-amount').fill('317500');
  await page.click('#finalize-confirm-btn');
  await page.waitForTimeout(300);

  const stillPresent = await page.evaluate((id) => {
    const drafts = JSON.parse(localStorage.getItem('dirigo_drafts') || '{}');
    return !!drafts[id];
  }, activeIdBefore);
  expect(stillPresent).toBe(false);

  const after = await page.evaluate(async () => await (await fetch('/.netlify/functions/bids')).json());
  const newBid = after.find(b => !before.includes(b.bid_id));
  expect(newBid).toBeTruthy();
  expect(newBid.final_bid).toBe(317500);
  expect(newBid.selected_option).toBe('override');
  expect(newBid.custom_override_amount).toBe(317500);

  await page.click('.nav-item[title="Bid History"]');
  await expect(page.locator('#page-bids')).toContainText('Harborview');
});
