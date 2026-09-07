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
  await page.evaluate(() => {
    const drafts = JSON.parse(localStorage.getItem('dirigo_drafts') || '{}');
    for (const id of Object.keys(drafts)) delete drafts[id].tabConfirmations;
    localStorage.setItem('dirigo_drafts', JSON.stringify(drafts));
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
