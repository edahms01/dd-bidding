import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Criterion 8: Bid Strategy has no button — its indicator is derived.
// Gray when nothing has been sent; green when a fresh result is cached;
// amber (NOT gray) once upstream data drifts from what the agent ran on.

test('Bid Strategy: gray when unsent, green on a fresh result, amber after an upstream edit', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  // Nothing sent yet.
  await expect(page.locator('#tab-agent')).not.toHaveClass(/\b(done|partial)\b/);
  await expect(page.locator('#page-agent .tab-confirm-btn')).toHaveCount(0); // no button on this tab

  await loadSeed(page);
  await page.waitForTimeout(1600); // canned agent result lands
  await expect(page.locator('#tab-agent')).toHaveClass(/\bdone\b/);

  // Move an upstream input after the result is cached.
  await page.click('#tab-rates');
  await page.fill('#rate-frame', String(Number(await page.inputValue('#rate-frame') || 0) + 25));
  await page.waitForTimeout(800);

  await expect(page.locator('#tab-agent')).toHaveClass(/\bpartial\b/);
  await expect(page.locator('#tab-agent')).not.toHaveClass(/\bdone\b/);
});
