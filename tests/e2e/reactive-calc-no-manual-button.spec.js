import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase B, 4.2 — Recalculate button removed, calculation reactive.
//
// js/ui.js's runCalculation() split into calculateOnly() (numbers only)
// and runCalculation() (calculateOnly() + agent launch, unchanged). The
// new debounced trigger, window.scheduleRecalc, calls calculateOnly()
// only — wired from js/forms.js's _handleFormChange() (uncontrolled-
// input keystrokes) and src/AppShell.jsx's state.bid watcher (React
// dispatches: row add/delete, controlled fields, hydration). Agent
// relaunch stays exactly where it already was: window.goto('output')
// and the post-finalize "Back to output" button, both still calling the
// full runCalculation().
//
// Every page stays mounted at all times (AppShell.jsx, CSS-class-toggled
// visibility only) — Output's DOM, including the direct-cost total, is
// readable via textContent() even while a different tab is active. Used
// throughout this spec specifically so reading the reactive result never
// requires visiting the Output tab itself, which has its own unrelated,
// unconditional recalc trigger (window.goto('output') → bridges.js) that
// would confound whether the reactive path did anything.

const DIRECT_COST = '#output-phase3 .total-val.green';

test('the Recalculate button no longer exists on the Output tab', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);
  await page.click('#tab-output');
  await expect(page.locator('button:has-text("Recalculate")')).toHaveCount(0);
});

test('editing a rate updates the direct-cost total live, with no click and no visit to Output', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  // Reactive calc fires on mount and again on every seed-driven state
  // change (AppShell's state.bid watcher) — give its 500ms debounce time
  // to settle before capturing a baseline.
  await page.waitForTimeout(800);

  const before = await page.locator(DIRECT_COST).textContent();
  expect(before).not.toBe('');

  await page.click('#tab-rates');
  const frameInput = page.locator('#rate-frame');
  const currentVal = parseFloat(await frameInput.inputValue()) || 0;
  await frameInput.fill(String(currentVal + 5));
  await frameInput.blur();

  await page.waitForTimeout(800);
  const after = await page.locator(DIRECT_COST).textContent();
  expect(after).not.toBe(before);
});

test('recalculation also fires on row add, not just keystrokes', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  const before = await page.locator(DIRECT_COST).textContent();

  await page.click('#tab-walls');
  await page.click('button:has-text("+ Add wall area")');
  const newRow = page.locator('#wall-body tr').last();
  await newRow.locator('td:nth-child(1) input').fill('Reactive QA wall');
  // A blank/unmatched Type ID makes calculator.js tag this row as an
  // unresolved reference (zero cost, see 3.1's Type ID work) — use a
  // real seed assembly id (data/seed.json) so this row actually prices.
  await newRow.locator('td:nth-child(2) input').fill('W1');
  await newRow.locator('td:nth-child(3) input').fill('10');
  await newRow.locator('.wlf').fill('40');
  await newRow.locator('.wgsf').fill('400');

  await page.waitForTimeout(800);
  const after = await page.locator(DIRECT_COST).textContent();
  expect(after).not.toBe(before);
});

test('recalculation fires on row delete too', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(800);

  const before = await page.locator(DIRECT_COST).textContent();

  await page.click('#tab-walls');
  await page.locator('#wall-body tr').first().locator('.del-btn').click();

  await page.waitForTimeout(800);
  const after = await page.locator(DIRECT_COST).textContent();
  expect(after).not.toBe(before);
});

test('the bid agent does not relaunch on a plain reactive edit — only on the same explicit triggers as before', async ({ page }) => {
  // The app runs in demo mode (js/agent.js's DEMO_MODE = true) — agent
  // invocation never actually reaches /.netlify/functions/bid-agent, so
  // that endpoint can't be used as the signal. getHistorySummary()'s own
  // request (GET /.netlify/functions/bids) is used instead: grepped, it's
  // called only from _launchBidAgent() and runAgentIfNeeded()'s
  // background pre-run (js/ui.js) — never from calculateOnly()/the
  // reactive path, and never from anything else this test's flow touches
  // (HistoryPage/Dashboard, the only other callers, aren't visited here).
  let bidsCalls = 0;
  page.on('request', (req) => {
    if (req.method() === 'GET' && req.url().includes('/.netlify/functions/bids')) bidsCalls++;
  });

  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  // Let the background pre-run (runAgentIfNeeded) and the initial
  // reactive calc both settle before establishing a baseline.
  await page.waitForTimeout(2000);
  const baseline = bidsCalls;

  // Visiting Output once is an existing, unchanged agent-launch trigger
  // (window.goto('output') → runCalculation()).
  await page.click('#tab-output');
  await page.waitForTimeout(1500);
  const afterVisit = bidsCalls;
  expect(afterVisit).toBeGreaterThan(baseline);

  // Several plain reactive edits on a different tab — none should add
  // another agent-launch call, since window.scheduleRecalc calls
  // calculateOnly() (no agent launch), not runCalculation().
  await page.click('#tab-rates');
  const frameInput = page.locator('#rate-frame');
  for (let i = 0; i < 3; i++) {
    const v = parseFloat(await frameInput.inputValue()) || 0;
    await frameInput.fill(String(v + 1));
    await page.waitForTimeout(700);
  }

  expect(bidsCalls).toBe(afterVisit);
});
