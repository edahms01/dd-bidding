import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('deleting a draft prompts for confirmation, then removes it from the list and storage', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA To Delete');
  await page.waitForTimeout(900);
  await page.click('#new-bid-btn');
  await page.fill('#proj-name', 'QA To Keep');
  await page.waitForTimeout(900);

  await page.click('.nav-item[title="Bid History"]');

  let dialogSeen = false;
  page.once('dialog', d => { dialogSeen = true; d.accept(); });
  await page.locator('tr', { hasText: 'QA To Delete' }).locator('button:has-text("×")').click();

  expect(dialogSeen).toBe(true);
  await expect(page.locator('#page-bids tbody')).not.toContainText('QA To Delete');
  await expect(page.locator('#page-bids tbody')).toContainText('QA To Keep');

  // Migration Phase 2 Step 2B: drafts are server-side — read via the
  // real endpoint instead of a raw localStorage check (dirigo_drafts no
  // longer holds real draft data).
  const stillInStorage = await page.evaluate(async () => {
    const drafts = await window.getAllDrafts();
    return Object.values(drafts).some(d => d.project?.name === 'QA To Delete');
  });
  expect(stillInStorage).toBe(false);
});

test('deleting the only active draft replaces it immediately — never leaves a draftless state', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Only Draft');
  await page.waitForTimeout(900);

  await page.click('.nav-item[title="Bid History"]');
  page.once('dialog', d => d.accept());
  await page.locator('tr', { hasText: 'QA Only Draft' }).locator('button:has-text("×")').click();
  await page.waitForTimeout(200);

  // Migration Phase 2 Step 2B: drafts are server-side — the active id
  // itself stays local-only (per the migration plan), but the draft map
  // it points into is read via the real endpoint now.
  const { activeId, hasRecord } = await page.evaluate(async () => {
    const activeId = localStorage.getItem('dirigo_active_draft_id');
    const drafts   = await window.getAllDrafts();
    return { activeId, hasRecord: !!(activeId && drafts[activeId]) };
  });
  expect(activeId).toBeTruthy();
  expect(hasRecord).toBe(true);

  // The replacement is surfaced, not silent — see the finalize-path bug this closes
  await expect(page.locator('#form-toast')).toContainText('Started a new bid');
});
