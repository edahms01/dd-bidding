import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// 5.1 expected value (P(win) band × margin$, rendered as a RANGE with a
// visible caveat, never a point value) and win-likelihood attribution
// (click the pill, see the model's own per-option `factors` and their
// direction). EV bands are the wide/conservative set (Q2 = A). The
// attribution panel renders opt.factors directly — the live agent
// response carries them; demo mode has a hardcoded set in js/agent.js's
// _demoResponse(). There is no more client-side scoring table.

async function seedToAgent(page) {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);
  await page.click('#tab-agent');
  await page.waitForTimeout(1000);
}

test('every option card shows EV as a range, with the honesty caveat in a hover tooltip', async ({ page }) => {
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

  // The caveat is now a per-card hover tooltip on the "Risk-adjusted profit"
  // label under each card's Experimental section, not a standing paragraph.
  const tip = page.locator('#page-agent [data-bid-opt="competitive"] .ev-caveat');
  await expect(tip).toBeHidden();
  await page.locator('#page-agent [data-bid-opt="competitive"] .ev-tip').hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('not yet calibrated against');
  await expect(tip).toContainText('rough guide, not a dollar forecast');
});

test("clicking a win-likelihood pill expands the model's factors with directions and grounded notes", async ({ page }) => {
  await seedToAgent(page);

  const card = page.locator('#page-agent [data-bid-opt="competitive"]');
  await expect(card.locator('.win-attr')).toHaveCount(0);

  await card.locator('.win-likelihood-pill-btn').click();
  const attr = card.locator('.win-attr');
  await expect(attr).toBeVisible();

  // The demo Competitive option's hardcoded factors (js/agent.js
  // _demoResponse) — two positive, one negative — with a grounded note each.
  await expect(attr).toContainText('Strong relationship with Callahan');
  await expect(attr).toContainText('Priced below the takeoff risk');
  await expect(attr).toContainText('Thin cushion for the curved feature wall');
  await expect(attr).toContainText('curved wall is captured in conditions');

  // No base/score header — that system is gone.
  await expect(attr).not.toContainText('Base +');
  await expect(attr).not.toContainText('score ');

  // Direction arrows: two positive (▲), one negative (▼).
  await expect(attr.getByText('▲')).toHaveCount(2);
  await expect(attr.getByText('▼')).toHaveCount(1);

  // toggles closed again
  await card.locator('.win-likelihood-pill-btn').click();
  await expect(card.locator('.win-attr')).toHaveCount(0);
});

test('an option with no factors renders no attribution panel and does not crash the pill', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-agent');
  await page.waitForTimeout(500);

  // Stand in a fallback-shaped result (agent unreachable) — options carry
  // no `factors`. The pill still renders and toggles; the panel stays empty.
  await page.evaluate(() => {
    const pageEl = document.getElementById('page-agent');
    _renderAgentResult(pageEl, {
      reasoning: 'Agent unavailable.',
      options: [
        { type: 'competitive', label: 'Competitive', bidAmount: 250000, margin: 20, winLikelihood: 'High', rationale: 'x' },
        { type: 'recommended', label: 'Recommended', bidAmount: 260000, margin: 24, winLikelihood: 'Medium', rationale: 'x' },
        { type: 'ambitious', label: 'Ambitious', bidAmount: 270000, margin: 30, winLikelihood: 'Low–Medium', rationale: 'x' }
      ],
      signals: [], riskFlags: [], historicalNotes: []
    });
  });

  const card = page.locator('#page-agent [data-bid-opt="recommended"]');
  await card.locator('.win-likelihood-pill-btn').click();
  await expect(card.locator('.win-attr')).toHaveCount(0);
  await expect(card.locator('.win-likelihood-pill-btn')).toBeVisible();
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
