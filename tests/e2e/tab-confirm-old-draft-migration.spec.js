import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Criterion 12: a draft saved before this feature shipped has no
// `tabConfirmations` key. It must load without error, every tab
// defaulting to unconfirmed (LOAD_SECTION's mergeDeep no-ops on the
// missing key, keeping the reducer's default all-unconfirmed map).

test('a pre-feature draft (no tabConfirmations) loads clean with every tab unconfirmed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600);

  // Rewrite every stored draft to look like it predates the feature.
  // Migration Phase 2 Step 2B: drafts are server-side now — fetch each
  // one, strip tabConfirmations, PUT it back (the same upsert path
  // window.forms.js's normal draft writes use), instead of a raw
  // localStorage rewrite (which no longer touches real draft data at
  // all — dirigo_drafts is just the legacy-migration marker now).
  await page.evaluate(async () => {
    const drafts = await window.getAllDrafts();
    for (const [id, record] of Object.entries(drafts)) {
      const { tabConfirmations, ...rest } = record;
      await fetch('/.netlify/functions/drafts?id=' + encodeURIComponent(id), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rest)
      });
    }
  });

  await page.reload();
  await page.waitForTimeout(1200);

  expect(errors).toEqual([]);
  // "Unconfirmed" means not green — NOT gray. The seed filled every field,
  // so every tab is correctly amber (eligible, awaiting confirmation); the
  // point is that no confirmation carried over and nothing false-greened.
  await expect(page.locator('#app-tabs .tab.done')).toHaveCount(0);

  // And the confirmation flow still works from that loaded state.
  await page.click('#tab-project');
  await expect(page.locator('#page-project .tab-confirm-btn')).toBeEnabled(); // seed filled every field
  await page.click('#page-project .tab-confirm-btn');
  await expect(page.locator('#tab-project')).toHaveClass(/\bdone\b/);
});
