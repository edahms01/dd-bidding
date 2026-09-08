import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// ── De-inverted from rates-plaster-extwall-not-costed.spec.js ────────
// That file was an INVERTED spec: it passed *because* the app had a real
// gap — the Plastering and External wall rate inputs on the Rates page
// had no effect on any bid total (calculator.js never read them, no
// assembly/wall/ceiling row could be typed to carry a quantity for
// them). Its contract said: if it ever starts failing, that means the
// gap got closed, which is success — invert it (or replace it) rather
// than "fixing" the code to make the old assertion pass again.
//
// The gap is now closed, per product decision (exterior-wall-assembly-
// property branch): Plastering is removed outright (not a Dirigo
// service), and External wall (rates.extwall) is a real, controlled
// rate that replaces the drywall-hanging rate for wall assemblies
// flagged Exterior on the Assemblies tab. This file is the positive
// regression that replaces the inverted one — renamed rather than
// keeping the now-misleading filename (Plastering no longer exists
// anywhere in the codebase; the old name would reference a deleted
// concept). Cross-refs in CLAUDE.md / docs/dirigo-ux-decisions.md were
// updated in the same commit as this rename.
//
// Seed rates (data/seed.json): hanging 0.95, extwall 1.85. No seed
// assembly is flagged Exterior, so a clean seed load costs every wall
// with rates.hanging exactly as before.

const DIRECT_COST = '#output-phase3 .total-val.green';
const money = (s) => Number(String(s).replace(/[^0-9.-]/g, ''));

async function directCostTotal(page) {
  await page.click('#tab-output');
  await page.waitForTimeout(400);
  return money(await page.locator(DIRECT_COST).textContent());
}

test('the External wall rate reaches the bid total only for an Exterior-flagged wall assembly', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  const baseline = await directCostTotal(page);

  // A large external-wall rate must NOT move the total while nothing is
  // flagged Exterior — the flag is what gates it.
  await page.click('#tab-rates');
  await page.fill('#rate-extwall', '9');
  await page.waitForTimeout(1000);
  expect(await directCostTotal(page)).toBe(baseline);

  // Flag assembly W1 (first row) Exterior = Yes. The two seed walls that
  // reference W1 now cost their hanging labor at rates.extwall (9),
  // pushing the direct-cost total up. Exterior is select .nth(7) since the
  // stud-spacing <select> was removed 2026-09-08 (was .nth(8)).
  await page.click('#tab-assemblies');
  await page.locator('#asm-body tr').first().locator('select').nth(7).selectOption('Yes');
  await page.waitForTimeout(1000);
  expect(await directCostTotal(page)).toBeGreaterThan(baseline);
});

test('the External wall rate replaces the drywall-hanging rate, it does not stack', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  const baseline = await directCostTotal(page);

  // Set the external-wall rate equal to the hanging rate (0.95). A pure
  // swap of one for the other is then a no-op — the total must not budge
  // when W1 is flagged Exterior. If the rate stacked on top of hanging
  // instead of replacing it, the W1 walls would cost more and the total
  // would rise.
  await page.click('#tab-rates');
  await page.fill('#rate-extwall', '0.95');
  await page.waitForTimeout(1000);
  expect(await directCostTotal(page)).toBe(baseline);

  await page.click('#tab-assemblies');
  await page.locator('#asm-body tr').first().locator('select').nth(7).selectOption('Yes');
  await page.waitForTimeout(1000);
  expect(await directCostTotal(page)).toBe(baseline);

  // And a non-exterior wall is untouched by rate-extwall: bump it right
  // up while W1 is the only Exterior assembly — W2/W3 walls (interior)
  // don't move, but W1 walls do, so the total rises from baseline.
  await page.click('#tab-rates');
  await page.fill('#rate-extwall', '12');
  await page.waitForTimeout(1000);
  const withExterior = await directCostTotal(page);
  expect(withExterior).toBeGreaterThan(baseline);

  // Un-flag W1: now nothing is Exterior, so rate-extwall = 12 is inert
  // again and the total falls back exactly to baseline.
  await page.click('#tab-assemblies');
  await page.locator('#asm-body tr').first().locator('select').nth(7).selectOption('No');
  await page.waitForTimeout(1000);
  expect(await directCostTotal(page)).toBe(baseline);
});

test('#rate-plaster no longer exists on the Rates page; #rate-extwall is a real field', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1200);

  await page.click('#tab-rates');
  await expect(page.locator('#rate-plaster')).toHaveCount(0);
  await expect(page.locator('#rate-extwall')).toHaveCount(1);
});
