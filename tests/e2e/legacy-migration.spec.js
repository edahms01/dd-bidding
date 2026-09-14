import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Migration Phase 2 Step 2B: drafts moved server-side — dirigo_drafts no
// longer holds real data (it's just the legacy-migration "already ran"
// marker, see js/forms.js's _runLegacyMigrationIfNeeded()). Draft state
// is read via window.getAllDrafts() (the real endpoint) instead of a raw
// localStorage read, which would now always read the marker, not drafts.
// The out-of-scope migration LOGIC itself (migrateLegacyBidToDrafts(),
// the draftsAlreadyExist exactly-once guard) is untouched — only this
// spec's assertions changed, to match where the migrated draft actually
// lands now.

test('a fresh reload with an existing dirigo_current_bid but no dirigo_drafts migrates cleanly and only once', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  // Migration Phase 2 Step 2B: drafts are server-side now — wiping the
  // local dirigo_drafts marker no longer cascades to deleting real draft
  // data the way removing that one bulk localStorage key used to.
  // clearAll()'s own reload already creates a blank draft server-side
  // (resumeActiveDraft()'s no-active-draft fallback); without an
  // explicit clear here, that orphan would survive the fixture setup
  // below and inflate the post-migration draft count. dev-clear-drafts
  // is the real endpoint clearSeedData() itself uses for this.
  await page.evaluate(async () => {
    await fetch('/.netlify/functions/dev-clear-drafts', { method: 'POST' });
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

  const afterFirst = await page.evaluate(async () => ({
    draftCount: Object.keys(await window.getAllDrafts()).length,
    legacyGone: localStorage.getItem('dirigo_current_bid') === null
  }));
  expect(afterFirst.draftCount).toBe(1);
  expect(afterFirst.legacyGone).toBe(true);

  // Reload again — must not re-migrate / double-wrap
  await page.reload();
  await page.waitForFunction(() => typeof window.goto === 'function');
  const afterSecond = await page.evaluate(async () => Object.keys(await window.getAllDrafts()).length);
  expect(afterSecond).toBe(1);
  await expect(page.locator('#proj-name')).toHaveValue('QA Legacy Bid');
});
