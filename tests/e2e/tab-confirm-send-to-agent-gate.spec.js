import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Criteria 9-10: "Send to Agent" (Market Read) is disabled until all 8
// input tabs read green; it re-enables live the instant the last one
// turns green; its disabled tooltip names the outstanding tabs; and using
// it once then editing any gated tab re-locks it — the core "prevent
// accidental / wasteful requests" behavior.

const sendBtn = (page) => page.locator('#page-market button:has-text("Send to Agent")');

test('Send to Agent is gated on every input tab being confirmed green', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600); // seed confirms all 8 gated tabs

  await page.click('#tab-market');
  await expect(sendBtn(page)).toBeEnabled();

  // Break one gated tab.
  await page.click('#tab-project');
  await page.fill('#proj-name', (await page.inputValue('#proj-name')) + ' edit');
  await expect(page.locator('#tab-project')).not.toHaveClass(/\bdone\b/);

  await page.click('#tab-market');
  await expect(sendBtn(page)).toBeDisabled();
  await expect(sendBtn(page)).toHaveAttribute('title', /Project/);

  // Re-confirm it — Send re-enables without a reload.
  await page.click('#tab-project');
  await page.click('#page-project .tab-confirm-btn');
  await page.click('#tab-market');
  await expect(sendBtn(page)).toBeEnabled();
});

test('after a send, editing a gated tab re-locks Send to Agent', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1600);

  await page.click('#tab-market');
  await sendBtn(page).click();
  await expect(page.locator('#tab-agent')).toHaveClass(/\bactive\b/);

  await page.click('#tab-rates');
  await page.fill('#rate-frame', String(Number(await page.inputValue('#rate-frame') || 0) + 3));
  await page.waitForTimeout(800);

  await page.click('#tab-market');
  await expect(sendBtn(page)).toBeDisabled();
  await expect(sendBtn(page)).toHaveAttribute('title', /Rates/);
});
