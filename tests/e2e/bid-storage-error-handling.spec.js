import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Edge case coverage beyond the numbered acceptance criteria: a failed
// bids.js call must never look like success, and Finalize needs a
// double-submit guard now that it's a real network round trip instead of
// an instant synchronous action.

test('a failed submit shows an error panel, never a false "Bid submitted", and the confirm button recovers', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('#tab-agent');
  await page.waitForTimeout(1000);

  let postCount = 0;
  await page.route('**/.netlify/functions/bids', route => {
    if (route.request().method() === 'POST') {
      postCount++;
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'simulated failure' }) });
    } else {
      route.continue();
    }
  });

  await page.click('#agent-finalize-btn');
  const confirmBtn = page.locator('#finalize-confirm-btn');
  await confirmBtn.click();

  // The visible failure surfaces in the still-open modal (#finalize-modal-error)
  // — not in #output-bid, which sits behind Tab 8's active page and is hidden
  // from the user at this point; confirmed via a real run that a locator
  // finding hidden DOM text isn't the same as the user actually seeing it.
  await expect(page.locator('#finalize-modal-error')).toBeVisible();
  await expect(page.locator('#finalize-modal-error')).toContainText('failed');
  await expect(page.locator('text=Bid submitted')).toHaveCount(0);
  await expect(confirmBtn).toBeEnabled();
  expect(postCount).toBe(1);
});

test('double-clicking Finalize during the network round trip creates exactly one bid record', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('#tab-agent');
  await page.waitForTimeout(1000);

  await page.route('**/.netlify/functions/bids', async route => {
    if (route.request().method() === 'POST') {
      await new Promise(r => setTimeout(r, 500)); // widen the window a double-click would exploit
    }
    await route.continue();
  });

  await page.click('#agent-finalize-btn');
  const confirmBtn = page.locator('#finalize-confirm-btn');

  await confirmBtn.click();
  await expect(confirmBtn).toBeDisabled(); // guard engaged before the response lands
  await confirmBtn.click({ force: true }).catch(() => {}); // disabled — should be a no-op

  await page.waitForTimeout(1200);
  const bids = await page.evaluate(() => fetch('/.netlify/functions/bids').then(r => r.json()));
  const submittedCount = bids.filter(b => b.project_name === 'Harborview Plaza — Retail Fit-Out').length;
  expect(submittedCount).toBe(1);
});

test('renderHistory() shows a visible error state on a failed fetch, distinct from the empty-table message', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.route('**/.netlify/functions/bids', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'simulated failure' }) });
    } else {
      route.continue();
    }
  });

  await page.click('.nav-item[title="Bid History"]');
  await expect(page.locator("text=Couldn't load bid history")).toBeVisible();
  await expect(page.locator('text=No bids submitted yet')).toHaveCount(0);
});
