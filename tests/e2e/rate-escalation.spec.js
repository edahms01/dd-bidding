import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clearAll, loadSeed } from './helpers.js';

// Tier 5, Part 2: per-line-item rate escalation. loadSeed() is required,
// not clearAll() alone -- a blank form leaves every material rate at 0,
// so escalating it would still compute to $0 regardless of any override
// (the same lesson Tier 3's per-assembly-waste e2e spec learned the hard
// way). Isolated to a single Type-X-board wall row (seed assembly W2) so
// the Bid Output Materials subtotal change is unambiguous.
async function isolateToTypeXWallRow(page) {
  await page.click('#tab-walls');
  // Seed wall order: W1, W2, W3, W1, W2 (5 rows). Strip to just the first
  // Type-X row ("Level 1 -- Back of house", assembly W2).
  for (let i = 0; i < 3; i++) {
    await page.click('#wall-body tr:last-child .del-btn'); // removes rows 5, 4, 3
  }
  await page.click('#wall-body tr:first-child .del-btn'); // removes row 1 (W1) -- leaves W2
  await page.click('#tab-ceilings');
  for (let i = 0; i < 4; i++) {
    await page.click('#ceil-body tr:first-child .del-btn');
  }
}

test('escalation on one board type changes only that material, survives a rate template round trip, and survives export/import', async ({ page }) => {
  const templateName = 'E2E Escalation Template ' + Date.now();

  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await isolateToTypeXWallRow(page);

  // Baseline, computed via the exact same functions runCalculation() calls.
  // Seed data already ships a 5% escalation on Type-X board (data/seed.json).
  const before = await page.evaluate(() => {
    const state = collectFormData();
    const escalatedRates = applyRateEscalation(state.rates, state.rateEscalation);
    return calculateWallCosts(state.walls, state.assemblies, escalatedRates, state.conditions)[0];
  });

  await page.click('#tab-rates');
  await page.fill('#esc-brd-typex', '20');
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const state = collectFormData();
    const escalatedRates = applyRateEscalation(state.rates, state.rateEscalation);
    return calculateWallCosts(state.walls, state.assemblies, escalatedRates, state.conditions)[0];
  });

  // Board material moved with the new escalation percentage (5% -> 20%)...
  expect(after.boardMaterialBase).toBeCloseTo(before.boardMaterialBase * (1.20 / 1.05), 6);
  // ...every other material line, and labor, is completely untouched.
  expect(after.studMaterial).toBeCloseTo(before.studMaterial, 6);
  expect(after.tapeMaterial).toBeCloseTo(before.tapeMaterial, 6);
  expect(after.fastenMaterial).toBeCloseTo(before.fastenMaterial, 6);
  expect(after.insulMaterial).toBeCloseTo(before.insulMaterial, 6);
  expect(after.laborTotal).toBeCloseTo(before.laborTotal, 6);

  // Same change, now proven through the real render path (Bid Output DOM),
  // not just the pure functions directly -- the exact detail Part C.3's
  // trailing calc() call (in applyRateTemplate()) and this field's own
  // oninput="calc()" exist for.
  await page.click('#tab-output');
  const expectedMaterialsText = await page.evaluate(() => {
    const state = collectFormData();
    const escalatedRates = applyRateEscalation(state.rates, state.rateEscalation);
    const wallCosts = calculateWallCosts(state.walls, state.assemblies, escalatedRates, state.conditions);
    const ceilCosts = calculateCeilingCosts(state.ceilings, state.assemblies, escalatedRates, state.conditions);
    const logistics = calculateLogistics(state.conditions, state.rates);
    const summary   = buildCostSummary(wallCosts, ceilCosts, logistics, state.conditions.wastePct);
    return fmtCost(summary.materialTotal);
  });
  await expect(page.locator('#output-phase3')).toContainText(expectedMaterialsText);

  // Rate template round trip (acceptance criterion 5) -- escalation values
  // must survive, not just base rates.
  await page.click('#tab-rates');
  page.once('dialog', dialog => dialog.accept(templateName));
  await page.click('button:has-text("Save as template")');
  await page.waitForTimeout(500);

  await page.fill('#esc-brd-typex', '0');
  await page.waitForTimeout(300);

  await page.selectOption('#rate-template-select', { label: templateName });
  page.once('dialog', dialog => dialog.accept());
  await page.click('button:has-text("Load")');
  await page.waitForTimeout(500);

  await expect(page.locator('#esc-brd-typex')).toHaveValue('20');

  // Export/import round trip (acceptance criterion 6) -- verify, don't assume.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => window.exportBid())
  ]);
  const filePath = path.join(os.tmpdir(), 'dirigo-qa-escalation-export.json');
  await download.saveAs(filePath);
  const exported = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  expect(exported.rateEscalation.board['Type-X']).toBe(20);

  await clearAll(page);
  await page.setInputFiles('#import-file-input', filePath);
  await page.waitForTimeout(300);

  await page.click('#tab-rates');
  await expect(page.locator('#esc-brd-typex')).toHaveValue('20');

  fs.unlinkSync(filePath);

  // Teardown: delete the template via the UI's own delete affordance --
  // no dev-clear endpoint exists for rate templates (Tier 5 Part 1's
  // e2e spec used the same teardown for the same reason).
  await page.selectOption('#rate-template-select', { label: templateName });
  page.once('dialog', dialog => dialog.accept());
  await page.click('button[title="Delete selected template"]');
  await page.waitForTimeout(500);

  const remainingOptions = await page.locator('#rate-template-select option').allTextContents();
  expect(remainingOptions).not.toContain(templateName);
});
