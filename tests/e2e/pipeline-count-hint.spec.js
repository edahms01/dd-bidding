import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Acceptance criterion 6: the pipeline-count hint reflects
// getOpenDraftCount() end to end — a second draft opened while one is
// already open shows a count of 1 (the other draft), not 2 (which would
// mean the active draft counted itself) or 0 (which would mean the second
// draft wasn't picked up at all). _renderPipelineHint() (js/ui.js) is
// re-run on every visit to the step holding the Pipeline pressure card —
// Phase C moved that from Site Conditions to the Market Read step
// (MarketReadPage's on-become-active effect), so navigating there after
// creating the second draft is what actually exercises the wiring.
test('opening a second draft shows a pipeline count of 1 on the Market Read tab', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.click('#tab-market');
  await expect(page.locator('#pipeline-count-hint')).toHaveText('No other bids currently open');

  await page.click('#new-bid-btn'); // createDraft() — now two drafts, this one active
  await page.click('#tab-market');
  await expect(page.locator('#pipeline-count-hint')).toHaveText('1 other bid currently open');
});
