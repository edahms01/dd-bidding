import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Manual tab-confirmation model (src/state/stepStatus.js + TabConfirmButton).
// A tab is green (.tab.done) only after the estimator clicks "Finished with
// this tab" / "Reviewed" AND the data still matches the snapshot taken at
// click time; it silently drops to amber (.tab.partial) on any later edit.
// The old field-presence heuristic — and its assertions — are retired.

// Fills every field in the Project tab's owned slice so its "Finished"
// button becomes eligible (scope pills default to 2-on, already non-blank).
async function fillProject(page) {
  await page.fill('#proj-name', 'Completion Check');
  await page.fill('#proj-addr', '1 Main St, Portland, ME');
  await page.selectOption('#proj-type', 'Office');
  await page.fill('#proj-floors', '3');
  await page.fill('#proj-gc', 'Acme GC');
  await page.fill('#proj-drawings', 'Rev B');
  await page.fill('#proj-dur', '12');
  // Bid due date / Est. start date render as visible .datefield-input text
  // boxes (the #proj-bid / #proj-start inputs are hidden ISO carriers).
  const dates = page.locator('#page-project .datefield-input');
  await dates.nth(0).fill('01/15/2026');
  await dates.nth(1).fill('02/01/2026');
  await page.fill('#proj-exclusions', 'Excludes ACT grid.');
}

test('a fresh bid shows every tab gray, Cost Summary included', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await expect(page.locator('#app-tabs .tab.done')).toHaveCount(0);
  await expect(page.locator('#app-tabs .tab.partial')).toHaveCount(0);
  // The old heuristic false-greened this one on a blank bid.
  await expect(page.locator('#tab-output')).not.toHaveClass(/\b(done|partial)\b/);
});

test('a row tab: Finished disabled until the first real row, then click turns it green', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-assemblies');

  const btn = page.locator('#page-assemblies .tab-confirm-btn');
  await expect(btn).toBeDisabled();

  await page.click('button:has-text("+ Add assembly type")');
  await page.waitForTimeout(800); // reactive recalc refreshes ui.output.state
  await expect(btn).toBeEnabled();

  await btn.click();
  await expect(page.locator('#tab-assemblies')).toHaveClass(/\bdone\b/);
});

test('a field tab: Finished stays disabled at partial entry, enables only when every field is filled', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-project');

  const btn = page.locator('#page-project .tab-confirm-btn');
  await expect(btn).toBeDisabled();

  await page.fill('#proj-name', 'Only the name');
  await expect(btn).toBeDisabled(); // partial entry is not enough

  await fillProject(page);
  await expect(btn).toBeEnabled();

  await btn.click();
  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);
  await expect(btn).toHaveText(/✓/);
});

test('editing a confirmed tab reverts it to amber; restoring the value returns it to green', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-project');
  await fillProject(page);
  await page.click('#page-project .tab-confirm-btn');
  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);

  await page.fill('#proj-gc', 'Acme GC — updated');
  await expect(page.locator('#tab-project')).toHaveClass(/\bpartial\b/);
  await expect(page.locator('#tab-project')).not.toHaveClass(/\bdone\b/);

  await page.fill('#proj-gc', 'Acme GC');
  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);
});

test('a confirmed tab stays green across a tab switch (snapshot held in state)', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-project');
  await fillProject(page);
  await page.click('#page-project .tab-confirm-btn');
  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);

  await page.click('#tab-conditions');
  await page.click('#tab-project');
  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);
});

test('seed data reads all nine tabs green', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600); // seed: calc + agent pre-run (500ms) + confirm-all

  for (const id of ['tab-project', 'tab-conditions', 'tab-assemblies', 'tab-walls',
    'tab-ceilings', 'tab-rates', 'tab-output', 'tab-market', 'tab-agent']) {
    await expect(page.locator('#' + id), id).toHaveClass(/\bdone\b/);
  }
});

test("Finalize's orphan-reference block is unaffected by the confirmation model", async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600);

  // Orphan the seed's wall rows by deleting an assembly they reference.
  await page.click('#tab-assemblies');
  const w1Row = page.locator('#asm-body tr').filter({ has: page.locator('.asm-id[value="W1"]') });
  await w1Row.locator('.del-btn').click();
  await page.waitForTimeout(800);

  await page.click('#tab-agent');
  await expect(page.locator('#agent-finalize-btn')).toBeDisabled();
});
