import { test, expect } from '@playwright/test';

// #app-tabs is a horizontally scrolling row of 9 step chips. A useEffect
// in AppShell (keyed on activeTab / activeSection) scrolls the active
// chip into view on every nav path. At 390px, tab 9 (Bid Strategy) is
// off-screen from a fresh load and tab 1 (Project) is off-screen once
// you're on tab 9 — so this exercises both scroll directions.
//
// Playwright drives a real browser context; the viewport is set
// directly via test.use (the "iframe-injection technique" in CLAUDE.md
// is a manual claude-in-chrome workaround, not a Playwright pattern).

const PHONE = { width: 390, height: 844 };

test.describe('mobile step-chip auto-scroll @ phone-390', () => {
  test.use({ viewport: PHONE });

  // Geometry of a chip relative to the #app-tabs viewport. 1px slack
  // absorbs sub-pixel rounding.
  async function chipVsBar(page, chipId) {
    return page.evaluate((id) => {
      const bar = document.getElementById('app-tabs').getBoundingClientRect();
      const chip = document.getElementById(id).getBoundingClientRect();
      return {
        clippedLeft: chip.left < bar.left - 1,
        clippedRight: chip.right > bar.right + 1,
        fullyInside: chip.left >= bar.left - 1 && chip.right <= bar.right + 1,
      };
    }, chipId);
  }

  test('navigating to an off-screen tab scrolls its chip into view (rightward)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.goto('project')); // enter workflow on chip 1
    await expect(page.locator('#tab-project')).toBeVisible();

    await page.evaluate(() => window.goto('agent')); // chip 9 — off-screen on load
    await expect(page.locator('#tab-agent')).toBeVisible();

    const r = await chipVsBar(page, 'tab-agent');
    expect(r.clippedRight).toBe(false);
    expect(r.fullyInside).toBe(true);
  });

  test('navigating back to tab 1 scrolls left, not just right', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.goto('agent'));
    await expect(page.locator('#tab-agent')).toBeVisible();

    await page.evaluate(() => window.goto('project'));
    await expect(page.locator('#tab-project')).toBeVisible();

    const r = await chipVsBar(page, 'tab-project');
    expect(r.clippedLeft).toBe(false);
    expect(r.fullyInside).toBe(true);
  });
});
