import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clearAll } from './helpers.js';

// Cleanup pass, Part B acceptance criteria: the 8 Intelligence fields
// default to null (an explicit "not provided" signal for the agent), not
// '', when left blank — while project.buildingType/bidDate/startDate
// (still sel(), deliberately untouched) stay '' as before. This is the
// specific scoping boundary the brief drew, proven directly against the
// exported JSON.
test('blank Intelligence fields export as null, not empty string, while buildingType/bidDate/startDate stay untouched', async ({ page }) => {
  await page.goto('/');
  await clearAll(page); // fresh draft — all 8 Intelligence fields blank by default

  await page.waitForTimeout(900); // past the autosave debounce

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => window.exportBid())
  ]);
  const filePath = path.join(os.tmpdir(), 'dirigo-intelligence-null-export.json');
  await download.saveAs(filePath);
  const exported = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  fs.unlinkSync(filePath);

  const intel = exported.intelligence;
  for (const field of [
    'gcRelationship', 'gcPriceSensitivity', 'competitionLevel', 'dirigoEdge',
    'crewAvailability', 'pipelinePressure', 'materialTrend', 'knownCompetitors'
  ]) {
    expect(intel[field]).toBeNull();
  }

  // The scoping boundary: sel()-based project fields are untouched.
  expect(exported.project.buildingType).toBe('');
  expect(exported.project.bidDate).toBe('');
  expect(exported.project.startDate).toBe('');
});

test('a filled-in Intelligence field is unaffected — real values still export exactly as set', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.click('#tab-market'); // Phase C: the Intelligence fields moved to the Market Read step
  await page.selectOption('#intel-crew', 'tight');
  await page.selectOption('#intel-gc-rel', 'strong');
  await page.fill('#intel-competitors', 'Summit Drywall, Northeast Interiors');
  await page.waitForTimeout(900);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => window.exportBid())
  ]);
  const filePath = path.join(os.tmpdir(), 'dirigo-intelligence-filled-export.json');
  await download.saveAs(filePath);
  const exported = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  fs.unlinkSync(filePath);

  expect(exported.intelligence.crewAvailability).toBe('tight');
  expect(exported.intelligence.gcRelationship).toBe('strong');
  expect(exported.intelligence.knownCompetitors).toBe('Summit Drywall, Northeast Interiors');
  // The other 5 untouched fields on this same draft still export as null.
  expect(exported.intelligence.gcPriceSensitivity).toBeNull();
});
