// Phase D — mobile layout regression coverage.
//
// The project has required visual/behavioural proof (not "the media
// query looks right") for every CSS-only layout change since the A1
// before/after precedent. This spec runs the app at two real mobile
// viewports and asserts the Step 1 structural guarantees hold:
//   - no page scrolls horizontally at the body level
//   - the left nav is an off-canvas drawer (hamburger opens it, backdrop
//     and nav-item selection close it)
//   - the 9-chip step bar scrolls horizontally instead of clipping
//   - demo controls are hidden below 768px
//   - key interactive controls are >=44px
//   - a full tab sweep produces zero console errors / uncaught page
//     errors at a narrow width (a resize handler or layout loop is a
//     different failure mode than a media-query typo — see
//     no-console-errors-on-load.spec.js)
//
// Demo controls are display:none below 768px, so helpers.js's
// loadSeed()/clearAll() (which click #dev-toolbar buttons) can't be used
// at a mobile viewport — seed via the window global instead.

import { test, expect } from '@playwright/test';

const PHONE = { width: 390, height: 844 };   // iPhone 12/13/14 class
const TABLET = { width: 768, height: 1024 }; // the breakpoint edge itself

const WORKFLOW_TABS = [
  'tab-project', 'tab-conditions', 'tab-assemblies', 'tab-walls',
  'tab-ceilings', 'tab-rates', 'tab-output', 'tab-market', 'tab-agent'
];

async function seed(page) {
  await page.goto('/');
  await page.evaluate(() => window.loadSeedData());
  await page.waitForTimeout(1200); // covers loadSeedData()'s 500ms pre-run-agent setTimeout
}

// On mobile the left nav is an off-canvas drawer — its items aren't
// hittable until the hamburger opens it. Selecting an item also closes
// the drawer (AppShell's closeDrawer()).
async function navVia(page, dataNav) {
  await page.click('.nav-hamburger');
  await page.waitForTimeout(260);
  await page.click(`.nav-item[data-nav="${dataNav}"]`);
  await page.waitForTimeout(260);
}

async function assertNoHorizontalScroll(page, label) {
  // html{overflow:hidden} + .app-layout/.body{overflow:hidden} mean
  // documentElement.scrollWidth stays pinned to the viewport even when
  // content (e.g. the header row) overflows and gets clipped — so it's
  // a false all-clear. document.body.scrollWidth is the honest signal.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(
    overflow.scrollWidth,
    `${label}: content overflows horizontally (${overflow.scrollWidth} > ${overflow.clientWidth})`
  ).toBeLessThanOrEqual(overflow.clientWidth + 1); // +1 for sub-pixel rounding
}

for (const [name, viewport] of [['phone-390', PHONE], ['tablet-768', TABLET]]) {
  test.describe(`mobile layout @ ${name}`, () => {
    test.use({ viewport });

    test('no page scrolls horizontally at the body level', async ({ page }) => {
      await seed(page);
      for (const tabId of WORKFLOW_TABS) {
        await page.click(`#${tabId}`);
        await page.waitForTimeout(120);
        await assertNoHorizontalScroll(page, `${name} / ${tabId}`);
      }
      // Bids list
      await navVia(page, 'bids');
      await assertNoHorizontalScroll(page, `${name} / bids`);
      // Bid/no-bid gate
      await page.click('#bid-decision-btn');
      await page.waitForTimeout(150);
      await assertNoHorizontalScroll(page, `${name} / bid-decision`);
    });

    test('demo controls are hidden', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#dev-toolbar')).toBeHidden();
    });

    test('the step bar scrolls horizontally instead of clipping', async ({ page }) => {
      await seed(page);
      await page.click('#tab-project');
      const tabs = page.locator('#app-tabs');
      const m = await tabs.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX
      }));
      expect(m.overflowX).toBe('auto');
      // 9 chips + 8 separators must exceed a phone/tablet width.
      expect(m.scrollWidth).toBeGreaterThan(m.clientWidth);
      // And it must actually be scrollable (not just overflowing).
      await tabs.evaluate((el) => { el.scrollLeft = 9999; });
      const scrolled = await tabs.evaluate((el) => el.scrollLeft);
      expect(scrolled).toBeGreaterThan(0);
    });

    test('key interactive controls are at least 44px tall', async ({ page }) => {
      await seed(page);
      await page.click('#tab-assemblies');
      const selectors = ['#new-bid-btn', '.nav-hamburger', '#tab-project', '.add-row-btn', '.del-btn'];
      for (const sel of selectors) {
        const box = await page.locator(sel).first().boundingBox();
        expect(box, `${sel} not found`).not.toBeNull();
        expect(box.height, `${sel} is ${box.height}px tall`).toBeGreaterThanOrEqual(43.5);
      }
    });

    test('a full tab sweep produces zero console / page errors', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(err.message));
      await seed(page);
      for (const tabId of WORKFLOW_TABS) {
        await page.click(`#${tabId}`);
        await page.waitForTimeout(120);
      }
      await navVia(page, 'bids');
      await navVia(page, 'workflow');
      expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
      expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
    });
  });
}

test.describe('nav drawer @ phone-390', () => {
  test.use({ viewport: PHONE });

  test('hamburger opens the drawer; backdrop and nav-item selection close it', async ({ page }) => {
    await seed(page);
    await page.click('#tab-project'); // known starting page for the tap-through check
    const nav = page.locator('#app-leftnav');
    const hamburger = page.locator('.nav-hamburger');
    const backdrop = page.locator('.nav-backdrop');

    await expect(hamburger).toBeVisible();
    await expect(backdrop).toHaveCount(0);
    // Closed: the drawer is translated off-screen (its right edge <= 0).
    let box = await nav.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(1);

    await hamburger.click();
    await page.waitForTimeout(260); // transform transition
    await expect(nav).toHaveClass(/drawer-open/);
    await expect(backdrop).toBeVisible();
    box = await nav.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(-1); // now on-screen

    // Background content is non-interactive while the drawer is open: a
    // tap aimed at a step-bar chip lands on the backdrop (which closes
    // the drawer) and never reaches the chip's handler, so the workflow
    // does NOT navigate. force:true bypasses Playwright's actionability
    // wait (the chip is covered) and clicks at its coordinates, which is
    // exactly the "tap-through" a real finger would attempt.
    await page.click('#tab-conditions', { force: true });
    await page.waitForTimeout(260);
    await expect(page.locator('#page-project')).toHaveClass(/active/);
    await expect(page.locator('#page-conditions')).not.toHaveClass(/active/);
    await expect(nav).not.toHaveClass(/drawer-open/); // the backdrop caught it and closed

    // Backdrop tap closes it — click well right of the ~260px drawer.
    await hamburger.click();
    await page.waitForTimeout(260);
    await expect(backdrop).toBeVisible();
    await backdrop.click({ position: { x: 360, y: 400 } });
    await page.waitForTimeout(260);
    await expect(nav).not.toHaveClass(/drawer-open/);
    await expect(backdrop).toHaveCount(0);

    // Re-open, then selecting a nav item closes it and navigates.
    await hamburger.click();
    await page.waitForTimeout(260);
    await page.click('.nav-item[data-nav="bids"]');
    await page.waitForTimeout(260);
    await expect(nav).not.toHaveClass(/drawer-open/);
    await expect(page.locator('#page-bids')).toHaveClass(/active/);
  });
});

test.describe('desktop is unaffected', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('hamburger hidden, nav in flow, demo controls visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.nav-hamburger')).toBeHidden();
    await expect(page.locator('#dev-toolbar')).toBeVisible();
    const nav = page.locator('#app-leftnav');
    const box = await nav.boundingBox();
    expect(box.x).toBe(0);
    expect(box.width).toBeGreaterThan(60); // 200px expanded, in normal flow
  });
});
