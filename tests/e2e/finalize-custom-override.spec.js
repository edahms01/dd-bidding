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
  // NOTE: this does NOT assert the override amount ends up as the saved
  // final_bid. Verified directly (see docs/preflight-report.md-adjacent
  // finding, reported separately to Eric): _finalizeBid() computes the
  // selected amount/label but only uses it for the client-side toast --
  // submitBid() independently recomputes final_bid from the plain
  // calculator markup result and never receives the modal's selection.
  // This reproduces regardless of which row is picked (a standard option
  // or the override), so it isn't override-specific. A dedicated spec
  // (finalize-modal-selection-not-persisted.spec.js) documents that gap
  // precisely; asserting a specific dollar amount here would either fail
  // today or silently encode the bug as correct once "fixed" for real --
  // neither is what this gap-closing spec is for. What's asserted here
  // is what's actually true: the flow completes, the source draft is
  // cleared, and a record appears.
  await page.goto('/');
  await openFinalizeModal(page);

  const activeIdBefore = await page.evaluate(() => localStorage.getItem('dirigo_active_draft_id'));
  expect(activeIdBefore).toBeTruthy();

  await page.locator('[data-modal-opt="override"]').click();
  await page.locator('#modal-custom-amount').fill('317500');
  await page.click('#finalize-confirm-btn');
  await page.waitForTimeout(300);

  const stillPresent = await page.evaluate((id) => {
    const drafts = JSON.parse(localStorage.getItem('dirigo_drafts') || '{}');
    return !!drafts[id];
  }, activeIdBefore);
  expect(stillPresent).toBe(false);

  await page.click('.nav-item[title="Bid History"]');
  await expect(page.locator('#page-history')).toContainText('Harborview');
});
