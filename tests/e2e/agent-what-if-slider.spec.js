import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Phase E, Step 4 — 5.3 what-if price slider. Interpolates margin / win
// likelihood band / EV between the demo response's own three option
// anchors (never an independent recompute), so at any anchor value the
// slider reads back exactly what that option card shows. Pure local
// state — it must not change the finalize selection or persist anything.

async function seedToAgent(page) {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);
  await page.click('#tab-agent');
  await page.waitForTimeout(1000);
}

const ANCHOR = {
  competitive: { amount: 271000, margin: '22.4%', win: 'Very High', ev: '$42,493–$54,634' },
  recommended: { amount: 284500, margin: '28.4%', win: 'High',      ev: '$44,439–$60,599' },
  ambitious:   { amount: 298000, margin: '34.1%', win: 'Medium',    ev: '$40,647–$60,971' }
};

test('the slider renders below the cards and starts on the recommended amount', async ({ page }) => {
  await seedToAgent(page);
  const slider = page.locator('#page-agent .whatif-slider');
  await expect(slider).toBeVisible();
  await expect(slider.locator('.whatif-price')).toHaveText('$284,500');
  // three anchor markers, one per option
  await expect(slider.locator('.whatif-anchor')).toHaveCount(3);
});

test('at each anchor the slider readout equals that option card exactly', async ({ page }) => {
  await seedToAgent(page);
  const range = page.locator('#page-agent .whatif-range');

  for (const [type, exp] of Object.entries(ANCHOR)) {
    await range.fill(String(exp.amount));

    const slider = page.locator('#page-agent .whatif-slider');
    await expect(slider.locator('.whatif-price')).toHaveText('$' + exp.amount.toLocaleString());
    await expect(slider.locator('.whatif-margin')).toContainText(exp.margin);
    await expect(slider.locator('.whatif-win')).toHaveText(exp.win);
    await expect(slider.locator('.whatif-ev')).toHaveText(exp.ev);

    // …and that must be the SAME string the option card itself shows.
    const cardEv = await page.locator(`#page-agent [data-bid-opt="${type}"] .option-ev`).innerText();
    await expect(slider.locator('.whatif-ev')).toHaveText(cardEv.trim());
  }
});

test('between anchors it interpolates — margin lands between the bracketing options, win shows a band', async ({ page }) => {
  await seedToAgent(page);
  const range = page.locator('#page-agent .whatif-range');
  // between competitive (271000) and recommended (284500), on-step
  await range.fill('277800');

  const slider = page.locator('#page-agent .whatif-slider');
  const marginTxt = await slider.locator('.whatif-margin').innerText();
  const marginNum = parseFloat(marginTxt);
  expect(marginNum).toBeGreaterThan(22.4);
  expect(marginNum).toBeLessThan(28.4);

  // no single label between anchors — a ~lo–hi% band instead
  await expect(slider.locator('.whatif-win')).toHaveText(/^~\d+–\d+%$/);
  await expect(slider.locator('.whatif-ev')).toHaveText(/^\$[\d,]+–\$[\d,]+$/);
});

test('moving the slider changes nothing on the bid — selection stays on recommended', async ({ page }) => {
  await seedToAgent(page);
  await page.locator('#page-agent .whatif-range').fill('271000');
  await page.locator('#page-agent .whatif-anchor[data-anchor="ambitious"]').click();

  // open finalize — the modal's default selection must still be recommended,
  // i.e. the slider never dispatched SELECT_AGENT_OPTION
  await page.click('#agent-finalize-btn');
  await expect(page.locator('[data-modal-opt="recommended"].selected')).toHaveCount(1);
  await expect(page.locator('[data-modal-opt="ambitious"].selected')).toHaveCount(0);
});
