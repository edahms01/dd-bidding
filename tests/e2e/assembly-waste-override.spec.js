import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clearAll, loadSeed } from './helpers.js';

// Tier 3: per-assembly waste factors. Starting from a fully blank form
// (clearAll()) leaves every rate at 0, so board material -- and with it
// the weighted-average waste display -- would be $0 regardless of any
// override, which can't prove anything. loadSeed() gives real rates
// (Harborview Plaza), so instead we isolate the scenario: strip every
// wall/ceiling row down to the ones using assembly "W1" (seed data's
// first assembly), so the weighted-average waste % becomes exactly
// that one assembly's effective rate -- an unambiguous assertion.
async function isolateToFirstWallRow(page) {
  await page.click('#tab-walls');
  // Seed data has 5 wall rows; keep only the first (typeId "W1").
  for (let i = 0; i < 4; i++) {
    await page.click('#wall-body tr:last-child .del-btn');
  }
  await page.click('#tab-ceilings');
  // Seed data has 4 ceiling rows, none using "W1" -- remove them all so
  // they don't contribute board material to the weighted average.
  for (let i = 0; i < 4; i++) {
    await page.click('#ceil-body tr:first-child .del-btn');
  }
}

test('a per-assembly waste override changes Bid Output and survives export/import', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await isolateToFirstWallRow(page);

  await page.click('#tab-assemblies');
  await page.locator('#asm-body tr:first-child .asm-waste').fill('25');
  await page.waitForTimeout(900); // past debounce, settled state

  await page.click('#tab-output');
  await expect(page.locator('#output-phase3')).toContainText('25.0%');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Export")')
  ]);
  const filePath = path.join(os.tmpdir(), 'dirigo-qa-waste-export.json');
  await download.saveAs(filePath);
  const exported = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  expect(exported.assemblies[0].wastePctOverride).toBe(25);

  await clearAll(page);
  await page.setInputFiles('#import-file-input', filePath);
  await page.waitForTimeout(300);

  await page.click('#tab-assemblies');
  await expect(page.locator('#asm-body tr:first-child .asm-waste')).toHaveValue('25');

  await page.click('#tab-output');
  await expect(page.locator('#output-phase3')).toContainText('25.0%');

  fs.unlinkSync(filePath);
});

test('an explicit 0% override is distinct from an unset one and survives export/import as 0', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await isolateToFirstWallRow(page);

  await page.click('#tab-assemblies');
  await page.locator('#asm-body tr:first-child .asm-waste').fill('0');
  await page.waitForTimeout(900);

  await page.click('#tab-output');
  await expect(page.locator('#output-phase3')).toContainText('0.0%');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Export")')
  ]);
  const filePath = path.join(os.tmpdir(), 'dirigo-qa-zero-waste-export.json');
  await download.saveAs(filePath);
  const exported = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // Must be the number 0, not null/undefined -- the exact bug this phase
  // guarded against (parseFloat(...) || null would have collapsed this).
  expect(exported.assemblies[0].wastePctOverride).toBe(0);

  await clearAll(page);
  await page.setInputFiles('#import-file-input', filePath);
  await page.waitForTimeout(300);

  await page.click('#tab-assemblies');
  await expect(page.locator('#asm-body tr:first-child .asm-waste')).toHaveValue('0');

  fs.unlinkSync(filePath);
});
