import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Labor burden (payroll tax / workers comp / benefits, rates.burdenPct) and
// supervision (foreman cost, rates.superPct) load onto raw labor BEFORE
// markup — part of directCostTotal — and surface as their own rows in the
// Cost Summary "Category subtotals" panel so the total isn't a silently
// bigger number. See js/calculator.js buildCostSummary() / applyLaborBurden().

const parseCost = (t) => parseInt(t.replace(/[$,]/g, ''), 10);

test('Burden and Supervision render as their own subtotal rows and the panel sums to the direct cost total', async ({ page }) => {
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

  // Seed rates are burdenPct 34 / superPct 9. Burden/supervision are computed
  // on the height-adjusted labor (raw + Above 12 ft + Above 20 ft), so ratio
  // to that, not to raw labor alone.
  const heightAdjLabor = rawLabor + above12 + above20;
  expect(burden).toBeGreaterThan(0);
  expect(supervision).toBeGreaterThan(0);
  expect(Math.abs(burden / heightAdjLabor - 0.34)).toBeLessThan(0.005);
  expect(Math.abs(supervision / heightAdjLabor - 0.09)).toBeLessThan(0.005);

  // Category subtotals panel's numbers sum to Direct cost total.
  const totals = page.locator('#output-phase3 .total-item .total-val');
  const direct = parseCost(await totals.nth(3).innerText());
  expect(Math.abs((rawLabor + above12 + above20 + burden + supervision + materials + logistics) - direct)).toBeLessThanOrEqual(2);
});

test('the top totals-bar Labor figure is burden-loaded, so the three visible numbers sum to the fourth', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1200);
  await page.click('#tab-output');
  await page.waitForTimeout(400);

  const totals = page.locator('#output-phase3 .total-item .total-val');
  const barLabor    = parseCost(await totals.nth(0).innerText());
  const barMaterial = parseCost(await totals.nth(1).innerText());
  const barLogistic = parseCost(await totals.nth(2).innerText());
  const barDirect   = parseCost(await totals.nth(3).innerText());

  // Labor + Materials + Logistics visually sum to Direct cost total — the
  // regression the burden-loaded totals-bar figure exists to prevent.
  expect(Math.abs((barLabor + barMaterial + barLogistic) - barDirect)).toBeLessThanOrEqual(2);

  // And that Labor figure is laborWithBurden (raw + height uplift + burden +
  // supervision), not raw labor.
  const rowVal = (label) =>
    page.locator(`#output-phase3 [data-row="${label}"] .subtotal-val`).innerText().then(parseCost);
  const laborWithBurden = (await rowVal('Labor (raw)')) + (await rowVal('Above 12 ft'))
    + (await rowVal('Above 20 ft')) + (await rowVal('Burden')) + (await rowVal('Supervision'));
  expect(Math.abs(barLabor - laborWithBurden)).toBeLessThanOrEqual(2);
});
