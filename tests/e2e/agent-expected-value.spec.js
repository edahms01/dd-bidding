import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase E, Step 3 — 5.1 expected value (P(win) band × margin$, rendered
// as a RANGE with a visible caveat, never a point value) and 5.2
// win-likelihood attribution (click the pill, see the four contributing
// signals and their direction). EV bands are the wide/conservative set
// (Q2 = A); the attribution reads js/agent.js's single source of truth
// (window.__winLikelihoodBreakdown), not a copied scoring table.

async function seedToAgent(page) {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);
  await page.click('#tab-agent');
  await page.waitForTimeout(1000);
}

test('every option card shows EV as a range, with the always-visible honesty caveat', async ({ page }) => {
  await seedToAgent(page);

  const evs = page.locator('#page-agent [data-bid-opt] .option-ev');
  await expect(evs).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const txt = (await evs.nth(i).innerText()).trim();
    // "$lo–$hi", lo < hi, never a bare point value
    expect(txt).toMatch(/^\$[\d,]+–\$[\d,]+$/);
    const [lo, hi] = txt.split('–').map((s) => parseInt(s.replace(/[$,]/g, ''), 10));
    expect(lo).toBeLessThan(hi);
  }

  // Competitive: winLikelihood "Very High" → band [0.70, 0.90];
  // margin$ = 271000 × 22.4% = 60,704 → EV $42,493–$54,634. Anchored to
  // the band constants + demo values so a change to either fails here.
  await expect(page.locator('#page-agent [data-bid-opt="competitive"] .option-ev'))
    .toHaveText('$42,493–$54,634');

  await expect(page.locator('#page-agent .ev-caveat')).toBeVisible();
  await expect(page.locator('#page-agent .ev-caveat')).toContainText('hand-tuned score');
  await expect(page.locator('#page-agent .ev-caveat')).toContainText('not a calibrated probability');
});

test('clicking a win-likelihood pill expands the four contributing signals with directions', async ({ page }) => {
  await seedToAgent(page);

  const card = page.locator('#page-agent [data-bid-opt="competitive"]');
  await expect(card.locator('.win-attr')).toHaveCount(0);

  await card.locator('.win-likelihood-pill-btn').click();
  const attr = card.locator('.win-attr');
  await expect(attr).toBeVisible();

  // Competitive base is +2; seed intelligence: gcRelationship strong (+1),
  // gcPriceSensitivity balanced (0), competitionLevel moderate (0),
  // dirigoEdge strong (+1) → score 4 → Very High.
  await expect(attr).toContainText('Base +2');
  await expect(attr).toContainText('score 4');
  await expect(attr).toContainText('Very High');

  await expect(attr).toContainText('GC relationship');
  await expect(attr).toContainText('Strong');
  await expect(attr).toContainText('+1');
  await expect(attr).toContainText('GC price sensitivity');
  await expect(attr).toContainText('Balanced');
  await expect(attr).toContainText('Competition level');
  await expect(attr).toContainText("Dirigo's edge");

  // toggles closed again
  await card.locator('.win-likelihood-pill-btn').click();
  await expect(card.locator('.win-attr')).toHaveCount(0);
});

test('each card’s pill expands independently and the pill does not select the card', async ({ page }) => {
  await seedToAgent(page);

  // recommended is selected by default on a cache hit
  await page.locator('#page-agent [data-bid-opt="ambitious"] .win-likelihood-pill-btn').click();
  await expect(page.locator('#page-agent [data-bid-opt="ambitious"] .win-attr')).toBeVisible();
  await expect(page.locator('#page-agent [data-bid-opt="competitive"] .win-attr')).toHaveCount(0);

  // opening the pill must not have switched the finalize selection to ambitious
  await page.click('#agent-finalize-btn');
  await expect(page.locator('[data-modal-opt="recommended"].selected')).toHaveCount(1);
});
