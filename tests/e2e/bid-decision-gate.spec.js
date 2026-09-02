import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Phase C 8.4 — standalone bid/no-bid gate. Reached only from the Bids
// list, not the 9-step flow. Ephemeral: five factor selects, reset to
// neutral on every visit, no persistence, no bid record touched.

async function openGate(page) {
  await page.goto('/');
  await clearAll(page);
  await page.click('.nav-item[data-nav="bids"]');
  await page.click('#bid-decision-btn');
  await expect(page.locator('#page-biddecision')).toHaveClass(/active/);
}

test('reached from the Bids list; not a step in the workflow bar', async ({ page }) => {
  await openGate(page);
  await expect(page.locator('#app-tabs')).toHaveCount(0);
  await expect(page.locator('#app-tabs div:has-text("Bid / no-bid")')).toHaveCount(0);
  // deep-linkable
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/bid-decision');
});

test('the recommendation tracks the factor scores', async ({ page }) => {
  await openGate(page);
  const verdict = page.locator('#bd-verdict');

  // All neutral -> caution.
  await expect(verdict).toHaveAttribute('data-verdict', 'Proceed with caution');

  // All favourable -> Bid.
  for (const k of ['fit', 'gc', 'competition', 'capacity', 'schedule']) {
    await page.selectOption('#bd-' + k, 'good');
  }
  await expect(verdict).toHaveAttribute('data-verdict', 'Bid');

  // All unfavourable -> Pass.
  for (const k of ['fit', 'gc', 'competition', 'capacity', 'schedule']) {
    await page.selectOption('#bd-' + k, 'bad');
  }
  await expect(verdict).toHaveAttribute('data-verdict', 'Pass');
});

test('the gate is ephemeral — leaving and returning resets the factors', async ({ page }) => {
  await openGate(page);
  await page.selectOption('#bd-fit', 'bad');
  await page.selectOption('#bd-gc', 'bad');
  await expect(page.locator('#bd-verdict')).not.toHaveAttribute('data-verdict', 'Proceed with caution');

  await page.click('#page-biddecision button:has-text("Back to Bids")');
  await expect(page.locator('#page-bids')).toHaveClass(/active/);
  await page.click('#bid-decision-btn');

  await expect(page.locator('#bd-fit')).toHaveValue('ok');
  await expect(page.locator('#bd-gc')).toHaveValue('ok');
  await expect(page.locator('#bd-verdict')).toHaveAttribute('data-verdict', 'Proceed with caution');
});

test('the gate writes nothing — no draft change, no bid record, no new localStorage key', async ({ page }) => {
  await openGate(page);
  await page.waitForTimeout(1200); // let boot-time draft autosave settle before snapshotting

  const before = await page.evaluate(() => ({
    drafts: localStorage.getItem('dirigo_drafts'),
    keys: Object.keys(localStorage).sort()
  }));

  for (const k of ['fit', 'gc', 'competition', 'capacity', 'schedule']) {
    await page.selectOption('#bd-' + k, 'good');
  }
  await page.waitForTimeout(900); // well past any autosave debounce

  const after = await page.evaluate(() => ({
    drafts: localStorage.getItem('dirigo_drafts'),
    keys: Object.keys(localStorage).sort()
  }));
  expect(after.drafts).toBe(before.drafts); // gate selects don't touch the active draft
  expect(after.keys).toEqual(before.keys);  // no new storage key
  const bids = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  expect(bids).toEqual([]);                  // no bid record
});
