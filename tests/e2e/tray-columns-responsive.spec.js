// Responsive tray columns — the Material Rates / Labor Rates / Site
// Conditions trays put each sub-group in its own .tray-col and let CSS
// Grid auto-fit wrap them 3 -> 2 -> 1 as the container narrows (no JS, no
// breakpoints — see .tray-cols in css/components.css).
//
// The project has required visual/behavioural proof for every CSS-only
// layout change since the A1 before/after precedent. This asserts:
//   - 3 columns render at a maximized-laptop width, collapsing to 2 then
//     1 as the viewport shrinks — live, without a reload
//   - no horizontal body scroll at any of those widths
//   - the "2-column" baseline trays (Logistics/Markup, Market signals/
//     Competitive signals) are untouched — each still one centered
//     .tray-col, i.e. a single grid track
//   - below 768px every tray is a single full-width column

import { test, expect } from '@playwright/test';

async function seed(page) {
  await page.goto('/');
  await page.evaluate(() => window.loadSeedData());
  await page.waitForTimeout(1200); // loadSeedData()'s 500ms pre-run-agent setTimeout + settle
}

function trackCount(page, header) {
  return page.evaluate((header) => {
    const tray = [...document.querySelectorAll('.tray')].find(
      (t) => (t.querySelector('.tray-hdr')?.textContent || '').trim().startsWith(header)
    );
    if (!tray) return -1;
    const cs = getComputedStyle(tray.querySelector('.tray-cols'));
    return cs.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
  }, header);
}

test('Rates trays wrap 3 -> 2 -> 1 on live resize with no horizontal overflow', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/#/rates');
  await page.waitForTimeout(500);

  // 980 (not lower) — below 960 the pre-existing .shell{min-width:960px}
  // desktop rule scrolls the whole app horizontally, unrelated to trays.
  for (const [width, expected] of [[1500, 3], [1200, 2], [980, 1]]) {
    await page.setViewportSize({ width, height: 1000 }); // no reload — a real drag-resize
    await page.waitForTimeout(450);
    expect(await trackCount(page, 'Labor Rates'), `Labor Rates @ ${width}`).toBe(expected);
    expect(await trackCount(page, 'Material Rates'), `Material Rates @ ${width}`).toBe(expected);
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
      `no body overflow @ ${width}`).toBe(true);
  }

  // reversible
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.waitForTimeout(450);
  expect(await trackCount(page, 'Labor Rates')).toBe(3);
});

test('Site Conditions tray shows 3 columns at laptop width', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/#/site-conditions');
  await page.waitForTimeout(500);
  expect(await trackCount(page, 'Site Conditions')).toBe(3);
});

test('the "2-column" baseline trays stay a single centered track', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('/#/rates');
  await page.waitForTimeout(500);
  expect(await trackCount(page, 'Logistics')).toBe(1);
  expect(await trackCount(page, 'Markup')).toBe(1);
  await page.goto('/#/market-read');
  await page.waitForTimeout(500);
  expect(await trackCount(page, 'Market signals')).toBe(1);
  expect(await trackCount(page, 'Competitive signals')).toBe(1);
});

test('below 768px every tray is one full-width column', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [hash, header] of [['/#/rates', 'Labor Rates'], ['/#/site-conditions', 'Site Conditions']]) {
    await page.goto(hash);
    await page.waitForTimeout(500);
    const r = await page.evaluate((header) => {
      const tray = [...document.querySelectorAll('.tray')].find(
        (t) => (t.querySelector('.tray-hdr')?.textContent || '').trim().startsWith(header)
      );
      const tc = tray.querySelector('.tray-cols');
      const cols = [...tc.querySelectorAll(':scope > .tray-col')];
      return {
        tracks: getComputedStyle(tc).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        colsW: Math.round(tc.getBoundingClientRect().width),
        colW: Math.round(cols[0].getBoundingClientRect().width),
        overflow: document.body.scrollWidth <= window.innerWidth,
      };
    }, header);
    expect(r.tracks, `${header} single track`).toBe(1);
    expect(r.colW, `${header} col fills the row`).toBeGreaterThanOrEqual(r.colsW - 2);
    expect(r.overflow, `${header} no body overflow`).toBe(true);
  }
});
