import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase E, 4.3 — Top cost drivers panel on Cost Summary: the five line
// items contributing the most dollars, plus labor as a % of direct cost.
// Pure display over state.ui.output — no calculator change. Standalone,
// unrelated to the agent work.

const parseCost = (t) => parseInt(t.replace(/[$,]/g, ''), 10);

test('the panel lists up to 5 area rows, dollar-descending, with labor % of direct cost', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1200);
  await page.click('#tab-output');
  await page.waitForTimeout(400);

  const panel = page.locator('#page-output .top-cost-drivers');
  await expect(panel).toBeVisible();

  const rows = panel.locator('.driver-row');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(5);

  // dollar-descending
  const amounts = [];
  for (let i = 0; i < count; i++) {
    amounts.push(parseCost(await rows.nth(i).locator('.driver-dollars').innerText()));
  }
  for (let i = 1; i < amounts.length; i++) {
    expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1]);
  }

  // Labor % of direct cost — cross-check against the totals bar the page
  // itself renders (Labor is total-val nth(0), Direct cost total nth(3)).
  const totals = page.locator('#output-phase3 .total-item .total-val');
  const labor = parseCost(await totals.nth(0).innerText());
  const direct = parseCost(await totals.nth(3).innerText());
  const expectedPct = (labor / direct) * 100;

  const shown = parseFloat(await panel.locator('.labor-pct').innerText());
  expect(Math.abs(shown - expectedPct)).toBeLessThan(0.15); // one-dp rounding

  // the top driver's own % is total/direct, to one dp
  const topPct = parseFloat(await rows.nth(0).locator('.driver-pct').innerText());
  expect(Math.abs(topPct - (amounts[0] / direct) * 100)).toBeLessThan(0.15);
});

test('the panel is absent when there is no calculation yet', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-output');
  await page.waitForTimeout(300);
  await expect(page.locator('#page-output .top-cost-drivers')).toHaveCount(0);
});
