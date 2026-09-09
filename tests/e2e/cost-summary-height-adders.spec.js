import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Height adders (rates.adder12Pct "Above 12 ft" / rates.adder20Pct "Above
// 20 ft") apply a labor % premium to the job-wide SF in each height band
// (conditions.sfAbove12 / sfAbove20), approximated via the job's average
// labor $/SF. They load onto raw labor BEFORE burden — burden is computed on
// the height-adjusted labor — and surface as their own rows in the Cost
// Summary "Category subtotals" panel so the total isn't a silently bigger
// number. See js/calculator.js buildCostSummary().
//
// Seed carries adder12Pct 18 / adder20Pct 35 / sfAbove12 3200 / sfAbove20 0,
// so "Above 12 ft" is non-zero and "Above 20 ft" is exactly $0.

const parseCost = (t) => parseInt(t.replace(/[$,]/g, ''), 10);

test('height-adder rows render and the Category subtotals panel sums to the direct cost total', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1200);
  await page.click('#tab-output');
  await page.waitForTimeout(400);

  const rowVal = (label) =>
    page.locator(`#output-phase3 [data-row="${label}"] .subtotal-val`).innerText().then(parseCost);

  const rawLabor    = await rowVal('Labor (raw)');
  const above12     = await rowVal('Above 12 ft');
  const above20     = await rowVal('Above 20 ft');
  const burden      = await rowVal('Burden');
  const supervision = await rowVal('Supervision');
  const materials   = await page.locator('#output-phase3 [data-row^="Materials"] .subtotal-val').innerText().then(parseCost);
  const logistics   = await page.locator('#output-phase3 [data-row^="Logistics"] .subtotal-val').innerText().then(parseCost);

  // 12 ft band is priced; 20 ft band is zero SF on the seed.
  expect(above12).toBeGreaterThan(0);
  expect(above20).toBe(0);

  // Burden is computed on the height-adjusted labor, so its ratio to raw
  // labor slightly exceeds the 34% rate by the uplift factor.
  expect(burden / (rawLabor + above12 + above20)).toBeCloseTo(0.34, 2);

  // All seven category numbers sum to Direct cost total.
  const totals = page.locator('#output-phase3 .total-item .total-val');
  const direct = parseCost(await totals.nth(3).innerText());
  expect(
    Math.abs((rawLabor + above12 + above20 + burden + supervision + materials + logistics) - direct)
  ).toBeLessThanOrEqual(2);
});

test('bumping sfAbove20 stacks both adders on that band', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1200);

  // Move some SF into the >20 ft band on Site Conditions.
  await page.click('#tab-conditions');
  await page.fill('#cond-sf20', '1600');
  await page.waitForTimeout(900); // reactive recalc debounce

  await page.click('#tab-output');
  await page.waitForTimeout(400);

  const rowVal = (label) =>
    page.locator(`#output-phase3 [data-row="${label}"] .subtotal-val`).innerText().then(parseCost);

  const above12 = await rowVal('Above 12 ft');
  const above20 = await rowVal('Above 20 ft');

  // Both bands now priced; the 20 ft band stacks adder12 + adder20 (18 + 35 =
  // 53%) vs the 12 ft band's 18%, over half the SF (1600 vs 3200) — so the
  // 20 ft uplift lands close to (1600·0.53)/(3200·0.18) ≈ 1.47× the 12 ft one.
  expect(above20).toBeGreaterThan(0);
  expect(above20 / above12).toBeCloseTo(1.47, 1);
});
