import { test, expect } from '@playwright/test';
import { clearAll } from './helpers.js';

// Cleanup pass, Part A acceptance criteria 1-2: markup-like text entered
// into a project name or a rate template name must render as literal
// visible text wherever displayed, never as actual formatting/elements.

test('markup-like text in a project name renders as literal text on the Dashboard', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  const projectName = '<b>XSS Test</b> & "quoted"';
  await page.fill('#proj-name', projectName);
  await page.waitForTimeout(900); // past the 700ms autosave debounce

  await page.click('.nav-item[title="Bid History"]');
  await page.waitForTimeout(300);

  const dashboard = page.locator('#page-bids');
  await expect(dashboard).toContainText(projectName);
  expect(await dashboard.locator('b').count()).toBe(0);
});

test('markup-like text in a rate template name renders as literal text in the template dropdown', async ({ page }) => {
  const templateName = `<b>XSS Template</b> ${Date.now()}`;

  await page.goto('/');
  await clearAll(page);
  await page.click('#tab-rates');

  page.once('dialog', dialog => dialog.accept(templateName));
  await page.click('button:has-text("Save as template")');
  await page.waitForTimeout(500);

  const options = page.locator('#rate-template-select option');
  await expect(options.filter({ hasText: 'XSS Template' })).toHaveText(templateName);
  expect(await page.locator('#rate-template-select b').count()).toBe(0);

  // Teardown — delete via the UI's own delete affordance, same as
  // tests/e2e/rate-templates.spec.js (no dev-clear endpoint for templates).
  await page.selectOption('#rate-template-select', { label: templateName });
  page.once('dialog', dialog => dialog.accept());
  await page.click('button[title="Delete selected template"]');
  await page.waitForTimeout(500);

  const remainingOptions = await page.locator('#rate-template-select option').allTextContents();
  expect(remainingOptions).not.toContain(templateName);
});
