import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase E, Step 5 — 5.5 override reason capture. When the chosen finalize
// option differs from the recommended one (a non-recommended standard
// option OR a custom override), the modal offers reason chips + free text;
// both optional, neither gates Confirm; both persist to the bid record as
// override_reason_chips / override_reason_text.

async function seedToFinalize(page) {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);
  await page.click('#tab-agent');
  await page.waitForTimeout(1000);
  await page.click('#agent-finalize-btn');
}

async function readSeedBid(page) {
  return page.evaluate(() =>
    fetch('/.netlify/functions/bids').then((r) => r.json()).then((bids) =>
      bids.find((b) => b.project_name && b.project_name.includes('Harborview')))
  );
}

test('the reason block shows only when the choice differs from recommended', async ({ page }) => {
  await seedToFinalize(page);
  const block = page.locator('#finalize-reason-block');

  // default selection is recommended → no reason block
  await expect(block).toHaveCount(0);

  await page.click('[data-modal-opt="competitive"]');
  await expect(block).toBeVisible();
  await expect(block.locator('.reason-chip')).toHaveCount(5);

  await page.click('[data-modal-opt="recommended"]');
  await expect(block).toHaveCount(0);

  await page.click('[data-modal-opt="override"]');
  await expect(block).toBeVisible();
});

test('reason chips and text are optional — Confirm is not gated by them', async ({ page }) => {
  await seedToFinalize(page);
  await page.click('[data-modal-opt="ambitious"]');
  await expect(page.locator('#finalize-reason-block')).toBeVisible();
  // no chip, no text
  await expect(page.locator('#finalize-confirm-btn')).toBeEnabled();
});

test('a real captured record carries the exact chosen option, recommended figures, chips and text', async ({ page }) => {
  await seedToFinalize(page);

  await page.click('[data-modal-opt="competitive"]');
  await page.click('.reason-chip:has-text("need the work")');
  await page.click('.reason-chip:has-text("competitor intel")');
  const note = 'GC hinted Summit is coming in low on this one';
  await page.fill('#finalize-reason-text', note);

  await page.click('#finalize-confirm-btn');
  await expect(page.locator('#bid-submit-toast')).toBeVisible();

  const saved = await readSeedBid(page);
  expect(saved.selected_option).toBe('competitive');
  expect(saved.final_bid).toBe(271000);
  expect(saved.recommended_bid).toBe(284500);
  // click order is preserved
  expect(saved.override_reason_chips).toEqual(['need the work', 'competitor intel']);
  expect(saved.override_reason_text).toBe(note);
});

test('choosing the recommended bid records empty reason fields, never null', async ({ page }) => {
  await seedToFinalize(page);
  await page.locator('[data-modal-opt="recommended"]').click();
  await page.click('#finalize-confirm-btn');
  await expect(page.locator('#bid-submit-toast')).toBeVisible();

  const saved = await readSeedBid(page);
  expect(saved.selected_option).toBe('recommended');
  expect(saved.override_reason_chips).toEqual([]);
  expect(saved.override_reason_text).toBe('');
});

test('reason selections reset every time the modal reopens', async ({ page }) => {
  await seedToFinalize(page);
  await page.click('[data-modal-opt="competitive"]');
  await page.click('.reason-chip:has-text("gut")');
  await page.fill('#finalize-reason-text', 'temp');
  await expect(page.locator('.reason-chip:has-text("gut")')).toHaveClass(/selected/);

  await page.click('.modal-footer .btn-ghost'); // Cancel
  await page.click('#agent-finalize-btn');
  await page.click('[data-modal-opt="competitive"]');

  await expect(page.locator('.reason-chip:has-text("gut")')).not.toHaveClass(/selected/);
  await expect(page.locator('#finalize-reason-text')).toHaveValue('');
});
