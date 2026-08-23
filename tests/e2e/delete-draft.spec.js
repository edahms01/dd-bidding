import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('deleting a draft prompts for confirmation, then removes it from the list and storage', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA To Delete');
  await page.waitForTimeout(900);
  await page.click('.nav-item[title="New Bid"]');
  await page.fill('#proj-name', 'QA To Keep');
  await page.waitForTimeout(900);

  await page.click('.nav-item[title="Dashboard"]');

  let dialogSeen = false;
  page.once('dialog', d => { dialogSeen = true; d.accept(); });
  await page.locator('tr', { hasText: 'QA To Delete' }).locator('button:has-text("×")').click();

  expect(dialogSeen).toBe(true);
  await expect(page.locator('#page-dashboard tbody')).not.toContainText('QA To Delete');
  await expect(page.locator('#page-dashboard tbody')).toContainText('QA To Keep');

  const stillInStorage = await page.evaluate(() => {
    const drafts = JSON.parse(localStorage.getItem('dirigo_drafts') || '{}');
    return Object.values(drafts).some(d => d.project?.name === 'QA To Delete');
  });
  expect(stillInStorage).toBe(false);
});

test('deleting the only active draft replaces it immediately — never leaves a draftless state', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Only Draft');
  await page.waitForTimeout(900);

  await page.click('.nav-item[title="Dashboard"]');
  page.once('dialog', d => d.accept());
  await page.locator('tr', { hasText: 'QA Only Draft' }).locator('button:has-text("×")').click();
  await page.waitForTimeout(200);

  const { activeId, hasRecord } = await page.evaluate(() => {
    const activeId = localStorage.getItem('dirigo_active_draft_id');
    const drafts   = JSON.parse(localStorage.getItem('dirigo_drafts') || '{}');
    return { activeId, hasRecord: !!(activeId && drafts[activeId]) };
  });
  expect(activeId).toBeTruthy();
  expect(hasRecord).toBe(true);

  // The replacement is surfaced, not silent — see the finalize-path bug this closes
  await expect(page.locator('#form-toast')).toContainText('Started a new bid');
});
