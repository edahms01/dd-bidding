import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

test('switching between two drafts via Dashboard shows only each draft\'s own data', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Alpha Project');
  await page.waitForTimeout(900);
  await page.click('.nav-item[title="New Bid"]');
  await page.fill('#proj-name', 'QA Beta Project');
  await page.waitForTimeout(900);

  await page.click('.nav-item[title="Dashboard"]');
  await page.locator('tr', { hasText: 'QA Alpha Project' }).locator('button:has-text("Open")').click();
  await expect(page.locator('#proj-name')).toHaveValue('QA Alpha Project');

  await page.click('.nav-item[title="Dashboard"]');
  await page.locator('tr', { hasText: 'QA Beta Project' }).locator('button:has-text("Open")').click();
  await expect(page.locator('#proj-name')).toHaveValue('QA Beta Project');
});

test('Tab 8 agent cache does not leak from one draft into another', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Agent Draft A');
  await page.waitForTimeout(900);
  await page.click('#tab-output');
  await page.waitForTimeout(2500); // let the agent call resolve
  await page.click('#tab-agent');
  const tabAText = await page.locator('#page-agent').innerText();

  await page.click('.nav-item[title="New Bid"]');
  await page.fill('#proj-name', 'QA Agent Draft B');
  await page.waitForTimeout(900);
  // Jump straight to Tab 8 without visiting Tab 7 first — the exact path
  // that exposed the _lastAgentResult short-circuit bug.
  await page.click('#tab-agent');
  const tabBText = await page.locator('#page-agent').innerText();

  expect(tabBText).not.toBe(tabAText);
});
