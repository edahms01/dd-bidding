import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

test('loadSeedData() still completes end to end, unchanged from current behavior', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await loadSeed(page);
  await page.waitForTimeout(1200); // covers the 500ms pre-run-agent setTimeout in loadSeedData()

  await expect(page.locator('#page-output')).toHaveClass(/active/);
  const badge = (await page.locator('.proj-badge span').textContent()).trim();
  expect(badge).not.toBe('');
  expect(badge).not.toBe('New bid');
});
