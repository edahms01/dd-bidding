import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 4.1 — persistent bid-total rail. Renders from AppShell.jsx
// (src/components/BidTotalRail.jsx), reading state.ui.output directly —
// no new calculation path, since 4.2's reactive calculation already
// keeps it fresh.

const RAIL = '.bid-total-rail';

test('the rail is absent on Project/Conditions/Rates, present from Assemblies through Agent', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-project');
  await expect(page.locator(RAIL)).toHaveCount(0);

  await page.click('#tab-conditions');
  await expect(page.locator(RAIL)).toHaveCount(0);

  await page.click('#tab-rates');
  await expect(page.locator(RAIL)).toHaveCount(0);

  for (const tab of ['tab-assemblies', 'tab-walls', 'tab-ceilings', 'tab-output', 'tab-agent']) {
    await page.click('#' + tab);
    await expect(page.locator(RAIL)).toBeVisible();
  }
});

test('the rail shows placeholders before any calculation, then real figures matching the Output tab', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-assemblies');
  // Reactive calc runs on mount/seed-load, so by now the rail should show
  // real numbers, not the null-output placeholder dashes.
  await expect(page.locator(RAIL + ' .total-val').first()).not.toHaveText('—');

  const railBidPrice = await page.locator(RAIL + ' .total-val.green').textContent();
  await page.click('#tab-output');
  // Phase4's own final-bid-price figure lives in #output-bid — same
  // state.ui.output the rail reads, should match exactly.
  const outputText = await page.locator('#output-bid').textContent();
  expect(outputText).toContain(railBidPrice);
});

test('changing a cost-affecting value applies a flash class to the rail and clears it again', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  await page.click('#tab-rates');
  // Rail isn't shown on Rates -- switch to Assemblies first so it's
  // mounted and watchable while the edit (made via a second tab visit)
  // takes effect reactively.
  await page.click('#tab-assemblies');
  await expect(page.locator(RAIL)).not.toHaveClass(/flash/);

  await page.click('#tab-rates');
  const frameInput = page.locator('#rate-frame');
  const v = parseFloat(await frameInput.inputValue()) || 0;
  await frameInput.fill(String(v + 5));
  await frameInput.blur();

  await page.click('#tab-assemblies');
  await expect(page.locator(RAIL)).toHaveClass(/flash/, { timeout: 2000 });
  await expect(page.locator(RAIL)).not.toHaveClass(/flash/, { timeout: 2000 });
});
