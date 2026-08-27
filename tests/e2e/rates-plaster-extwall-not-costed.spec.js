import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// ⚠ INVERTED TEST -- READ BEFORE TOUCHING.
// This spec currently PASSES because the app has a real gap: the
// Plastering and External wall rate inputs on the Rates page have no
// effect on the bid whatsoever. If it starts FAILING, that means
// someone wired these rates into the cost engine -- that is success,
// not a regression. The correct response is to INVERT this test's
// assertion (or delete it and write a normal positive one) to match the
// fixed behavior, NOT to "fix" the code to make this test pass again.
// If you are a Code session with no memory of the conversation that
// produced this file: this is that context, in full, right here.
//
// NOT a wiring bug with a broken assembly-level path -- verified there
// is no path at all: calculateWallCosts()/calculateCeilingCosts()
// (js/calculator.js) never read rates.plaster or rates.extwall, no
// assembly/wall/ceiling row can be typed as "plaster" or "exterior"
// (category is Wall/Ceiling only, boardType is Standard/Type-X/
// Moisture/Impact only) so there's no quantity for either rate to
// multiply against, conditions.exteriorExposure (the flag that reads as
// though it should gate the External-wall rate) is captured but never
// read by calculator.js either, and the canonical Harborview seed data
// doesn't even populate these two rate keys. See
// docs/dirigo-ux-decisions.md §9.9 for the full writeup and severity —
// this is real cost that can go silently missing from a bid, not
// cosmetic dead UI. Scheduling is Eric's call, not fixed here.
test('KNOWN GAP — Plastering and External wall rates have zero effect on the direct cost total', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('#tab-output');
  await page.waitForTimeout(300);
  const totalBefore = await page.locator('#output-phase3 .total-val.green').textContent();

  await page.click('#tab-rates');
  await page.fill('#rate-plaster', '999');
  await page.fill('#rate-extwall', '888');
  await page.waitForTimeout(200);

  await page.click('#tab-output');
  await page.waitForTimeout(300);
  const totalAfter = await page.locator('#output-phase3 .total-val.green').textContent();

  // This is the gap, pinned down: two real, filled-in $/SF rates with
  // no effect at all on the number that becomes the bid.
  expect(totalAfter).toBe(totalBefore);
});
