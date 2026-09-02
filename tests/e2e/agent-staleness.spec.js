import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase E, Step 2 (docs/dirigo-ux-decisions.md §9.9) — the agent-option
// display-staleness fix. Replaces the Phase B interim passive caveat
// ("These options may reflect an earlier version of your inputs.", which
// was always visible above the cards) with an ACTIVE warning shown only
// when the live reactive calculation has actually drifted from the
// inputs the agent ran against, plus an acknowledge checkbox that gates
// the finalize Confirm button. Q1 = B: warn + acknowledge + record the
// delta on the bid record. Was previously agent-staleness-caveat.spec.js.

async function seedAndAgent(page) {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500); // agent's 900ms demo delay + margin
  await page.click('#tab-agent');
  await page.waitForTimeout(1000);
}

// Drift the live calculation well past the staleness threshold by
// bumping a per-SF labor rate — multiplied across thousands of hung SF,
// this moves the bid price by tens of thousands of dollars.
async function makeStale(page) {
  await page.click('#tab-rates');
  await page.fill('#rate-hang', '9.99');
  await page.waitForTimeout(900); // reactive-recalc debounce (500ms) + margin
  await page.click('#tab-agent');
  await page.waitForTimeout(300);
}

test('a fresh agent result shows no staleness warning, and the old always-on caveat is gone', async ({ page }) => {
  await seedAndAgent(page);
  await expect(page.locator('#page-agent .agent-staleness-warn')).toHaveCount(0);
  await expect(
    page.locator('#page-agent >> text=These options may reflect an earlier version of your inputs.')
  ).toHaveCount(0);
});

test('editing inputs after the agent ran surfaces the active warning; re-running clears it', async ({ page }) => {
  await seedAndAgent(page);
  await makeStale(page);

  const warn = page.locator('#page-agent .agent-staleness-warn');
  await expect(warn).toBeVisible();
  await expect(warn).toContainText('Inputs changed since these options were generated');
  await expect(warn).toContainText('when the agent ran');

  await warn.getByRole('button', { name: 'Re-run agent' }).click();
  await page.waitForTimeout(1500);
  await expect(page.locator('#page-agent .agent-staleness-warn')).toHaveCount(0);
});

test('BidSummaryPage carries the same active warning when stale', async ({ page }) => {
  await seedAndAgent(page);
  await makeStale(page);
  // Reach the mobile-only Bid Summary via its route (desktop deep link
  // still renders the read-only page — §7 "reached in-app only" is about
  // no share link, not no route).
  await page.evaluate(() => { window.location.hash = '#/summary'; });
  await page.waitForTimeout(300);
  await expect(page.locator('#page-summary .agent-staleness-warn')).toBeVisible();
});

test('the staleness acknowledge checkbox composes with the override-amount gate on Confirm', async ({ page }) => {
  await seedAndAgent(page);
  await makeStale(page);

  await page.click('#agent-finalize-btn');
  const confirm = page.locator('#finalize-confirm-btn');
  const ack = page.locator('#finalize-stale-ack');

  // stale + not acknowledged + default (recommended) selection → blocked
  await expect(ack).toBeVisible();
  await expect(confirm).toBeDisabled();

  // stack the override-amount gate on top: still blocked (two gates)
  await page.click('[data-modal-opt="override"]');
  await expect(confirm).toBeDisabled();

  // acknowledge staleness while the override amount is still missing →
  // STILL blocked (the override gate holds independently)
  await ack.check();
  await expect(confirm).toBeDisabled();

  // enter a valid override amount → both gates clear → enabled
  await page.fill('#modal-custom-amount', '250000');
  await expect(confirm).toBeEnabled();

  // clear the amount → re-blocked (override gate, despite the ack)
  await page.fill('#modal-custom-amount', '');
  await expect(confirm).toBeDisabled();

  // restore the amount, then un-acknowledge → re-blocked (stale gate,
  // despite a valid amount) — neither condition OR-passes for the other
  await page.fill('#modal-custom-amount', '250000');
  await expect(confirm).toBeEnabled();
  await ack.uncheck();
  await expect(confirm).toBeDisabled();
});

test('finalizing while stale records the acknowledgement and the delta on the bid record', async ({ page }) => {
  await seedAndAgent(page);
  await makeStale(page);

  await page.click('#agent-finalize-btn');
  await page.locator('[data-modal-opt="recommended"]').click();
  await page.check('#finalize-stale-ack');
  await page.click('#finalize-confirm-btn');
  await expect(page.locator('#bid-submit-toast')).toBeVisible();

  const saved = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids =>
      bids.find(b => b.project_name && b.project_name.includes('Harborview')))
  );
  expect(saved.inputs_stale_at_submit).toBe(true);
  expect(typeof saved.stale_bid_price_delta).toBe('number');
  expect(Math.abs(saved.stale_bid_price_delta)).toBeGreaterThan(500);
  expect(typeof saved.stale_direct_cost_delta).toBe('number');
});

test('a non-stale finalize has no acknowledge checkbox and records inputs_stale_at_submit false', async ({ page }) => {
  await seedAndAgent(page);

  await page.click('#agent-finalize-btn');
  await page.locator('[data-modal-opt="recommended"]').click();
  await expect(page.locator('#finalize-stale-ack')).toHaveCount(0);
  await page.click('#finalize-confirm-btn');
  await expect(page.locator('#bid-submit-toast')).toBeVisible();

  const saved = await page.evaluate(() =>
    fetch('/.netlify/functions/bids').then(r => r.json()).then(bids =>
      bids.find(b => b.project_name && b.project_name.includes('Harborview')))
  );
  expect(saved.inputs_stale_at_submit).toBe(false);
});
