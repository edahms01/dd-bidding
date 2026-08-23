import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('a fresh reload with an existing dirigo_current_bid but no dirigo_drafts migrates cleanly and only once', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.evaluate(() => {
    localStorage.removeItem('dirigo_drafts');
    localStorage.removeItem('dirigo_active_draft_id');
    localStorage.setItem('dirigo_current_bid', JSON.stringify({
      schemaVersion: 1,
      project: { name: 'QA Legacy Bid' },
      conditions: {}, rates: {}, assemblies: [], walls: [], ceilings: [], intelligence: {}, markupInputs: {}
    }));
  });

  await page.reload();
  await expect(page.locator('#proj-name')).toHaveValue('QA Legacy Bid');

  const afterFirst = await page.evaluate(() => ({
    draftCount: Object.keys(JSON.parse(localStorage.getItem('dirigo_drafts') || '{}')).length,
    legacyGone: localStorage.getItem('dirigo_current_bid') === null
  }));
  expect(afterFirst.draftCount).toBe(1);
  expect(afterFirst.legacyGone).toBe(true);

  // Reload again — must not re-migrate / double-wrap
  await page.reload();
  const afterSecond = await page.evaluate(() =>
    Object.keys(JSON.parse(localStorage.getItem('dirigo_drafts') || '{}')).length
  );
  expect(afterSecond).toBe(1);
  await expect(page.locator('#proj-name')).toHaveValue('QA Legacy Bid');
});
