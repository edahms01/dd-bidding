import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Criterion 5: editing any field inside an already-confirmed tab's owned
// slice reverts that tab to amber automatically — no reload, no extra
// click — across the different edit paths (controlled field, row add,
// row delete, template load).

test('a confirmed tab reverts to amber on a controlled field edit', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600);

  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);
  await page.click('#tab-project');
  await page.fill('#proj-gc', (await page.inputValue('#proj-gc')) + ' X');

  await expect(page.locator('#tab-project')).toHaveClass(/\bpartial\b/);
  await expect(page.locator('#tab-project')).not.toHaveClass(/\bdone\b/);
});

test('a confirmed row tab reverts on row add and on row delete', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600);

  await expect(page.locator('#tab-walls')).toHaveClass(/\bdone\b/);
  await page.click('#tab-walls');

  // Row add
  await page.click('button:has-text("+ Add wall area")');
  await page.waitForTimeout(800);
  await expect(page.locator('#tab-walls')).not.toHaveClass(/\bdone\b/);

  // Re-confirm, then row delete
  await page.click('#page-walls .tab-confirm-btn');
  await expect(page.locator('#tab-walls')).toHaveClass(/\bdone\b/);
  await page.locator('#wall-body tr .del-btn').first().click();
  await page.waitForTimeout(800);
  await expect(page.locator('#tab-walls')).not.toHaveClass(/\bdone\b/);
});

test('a confirmed Rates tab reverts when a template load overwrites the fields', async ({ page }) => {
  const templateName = 'E2E Confirm Revert ' + Date.now();

  // A persistent handler instead of a fresh page.once() per click — three
  // confirm()/prompt() dialogs fire across this test (save/load/delete),
  // and chaining once() calls interleaved with clicks is a real race: if
  // a dialog fires (or gets auto-dismissed by Playwright before a handler
  // is attached) even slightly out of step with the click that triggers
  // it, the next once() throws "Cannot accept dialog which is already
  // handled" on an unrelated dialog. One handler covering the whole test
  // sidesteps the ordering assumption entirely. Found flaky exactly this
  // way during Migration Phase 5, Bucket 1, Step C — a legitimate,
  // unrelated module-graph change (history.js's port) shifted dev-server
  // timing just enough to trip it.
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? templateName : undefined));

  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600);

  await page.click('#tab-rates');
  await page.click('button:has-text("Save as template")');
  await page.waitForTimeout(500);

  // Change a rate, re-confirm the tab green against the new value.
  await page.fill('#rate-frame', '9.99');
  await page.waitForTimeout(400);
  await page.click('#page-rates .tab-confirm-btn');
  await expect(page.locator('#tab-rates')).toHaveClass(/\bdone\b/);

  // Loading the template mutates bid.rates -> snapshot no longer matches.
  await page.selectOption('#rate-template-select', { label: templateName });
  await page.click('button:has-text("Load")');
  await page.waitForTimeout(400);
  await expect(page.locator('#tab-rates')).not.toHaveClass(/\bdone\b/);

  // Teardown — delete the template through its own affordance.
  await page.click('button[title="Delete selected template"]');
});
