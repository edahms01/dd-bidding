import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase C 2.2 — per-step empty / partial / complete indicators
// (src/state/stepStatus.js, rendered as .tab / .tab.partial / .tab.done
// in AppShell). Built only on signals that already exist; navigation
// stays unrestricted (this is display, not a gate).

test('a fresh board shows no step as complete', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await expect(page.locator('#app-tabs .tab.done')).toHaveCount(0);
});

test('Project fills empty -> partial -> complete as its key fields are entered', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  const projectTab = page.locator('#tab-project');
  await expect(projectTab).not.toHaveClass(/\bdone\b/);
  await expect(projectTab).not.toHaveClass(/\bpartial\b/);

  await page.fill('#proj-name', 'Completion Check');
  await expect(projectTab).toHaveClass(/\bpartial\b/);
  await expect(projectTab).not.toHaveClass(/\bdone\b/);

  await page.fill('#proj-gc', 'Acme GC');
  await page.selectOption('#proj-type', 'Office');
  await expect(projectTab).toHaveClass(/\bdone\b/);
});

test('Assemblies completion is self-contained — a second row marks it done, no Walls data needed', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  // Fresh board: one untouched default assembly row — neutral, not done.
  await expect(page.locator('#tab-assemblies')).not.toHaveClass(/\b(done|partial)\b/);

  await page.click('#tab-assemblies');
  await page.click('button:has-text("+ Add assembly type")');
  await expect(page.locator('#tab-assemblies')).toHaveClass(/\bdone\b/);

  // Walls untouched throughout — Assemblies' status never depended on it.
  await expect(page.locator('#tab-walls')).not.toHaveClass(/\b(done|partial)\b/);
});

test('seed data marks the input steps complete', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1400); // seed runs the calc + pre-runs the agent (500ms)

  for (const id of ['tab-project', 'tab-conditions', 'tab-rates', 'tab-assemblies', 'tab-walls', 'tab-ceilings', 'tab-output']) {
    await expect(page.locator('#' + id), id).toHaveClass(/\bdone\b/);
  }
});

test('an orphaned Type ID keeps Walls — and the steps it feeds — at partial, never complete', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1400); // calc + agent pre-run (500ms)

  for (const id of ['tab-walls', 'tab-output', 'tab-agent']) {
    await expect(page.locator('#' + id), id).toHaveClass(/\bdone\b/);
  }

  // Seed walls reference W1/W2/W3 — delete W1 from Assemblies so those
  // rows go orphaned.
  await page.click('#tab-assemblies');
  const w1Row = page.locator('#asm-body tr').filter({ has: page.locator('.asm-id[value="W1"]') });
  await w1Row.locator('.del-btn').click();
  await page.waitForTimeout(800); // reactive recalc debounce (500ms)

  // Walls goes amber, and so do Cost Summary and Bid Strategy — a total
  // and a recommendation computed against an unresolved reference must
  // not read as green next to an amber Walls step.
  for (const id of ['tab-walls', 'tab-output', 'tab-agent']) {
    await expect(page.locator('#' + id), id).toHaveClass(/\bpartial\b/);
    await expect(page.locator('#' + id), id).not.toHaveClass(/\bdone\b/);
  }
});
