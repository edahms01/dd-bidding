import { test, expect } from '@playwright/test';
import { clearAll, loadSeed } from './helpers.js';

// Tier 5, Part 1: rate templates. Covers acceptance criteria 1-2 as one
// real round trip — the "only a real round trip proves this" standard
// applied to every storage-touching feature since Phase 1. Uses a
// uniquely-named template (timestamped) and deletes it via the UI's own
// delete affordance as teardown — there's no dev-clear endpoint for
// rate templates (unlike bids), and this phase's own scope explicitly
// keeps the backend minimal (single digits, no versioning), so cleanup
// happens through the feature itself rather than a new dev-only route.
test('saving, loading, and persisting a rate template updates the fields and totals bar, and survives a reload', async ({ page }) => {
  const templateName = 'E2E Rate Template ' + Date.now();

  await page.goto('/');
  await clearAll(page);
  await loadSeed(page);
  await page.waitForTimeout(1500);

  await page.click('#tab-rates');

  // Set distinct values across labor, material, and logistics sections.
  await page.fill('#rate-frame', '5.00');
  await page.fill('#rate-brd-std', '0.60');
  await page.fill('#rate-delivery', '150.00');
  await page.waitForTimeout(300);

  const totalsBeforeSave = await page.textContent('#t-tot');

  // Save as a template (the dialog handler above auto-accepts the prompt()).
  page.once('dialog', dialog => dialog.accept(templateName));
  await page.click('button:has-text("Save as template")');
  await page.waitForTimeout(500);

  // Change the fields to different values, so Load has something real to overwrite.
  await page.fill('#rate-frame', '9.99');
  await page.fill('#rate-brd-std', '1.23');
  await page.fill('#rate-delivery', '999.00');
  await page.waitForTimeout(300);

  // Select the saved template and Load it — hasUnsavedChanges is true,
  // so a confirm() dialog appears.
  await page.selectOption('#rate-template-select', { label: templateName });
  page.once('dialog', dialog => dialog.accept());
  await page.click('button:has-text("Load")');
  await page.waitForTimeout(500);

  // Fields reflect the loaded (originally-saved) values, not the edited ones.
  await expect(page.locator('#rate-frame')).toHaveValue('5');
  await expect(page.locator('#rate-brd-std')).toHaveValue('0.6');
  await expect(page.locator('#rate-delivery')).toHaveValue('150');

  // Totals bar reflects the loaded values too, not just the raw inputs —
  // the exact detail applyRateTemplate()'s trailing calc() call exists for.
  const totalsAfterLoad = await page.textContent('#t-tot');
  expect(totalsAfterLoad).toBe(totalsBeforeSave);

  // Reload — proves the immediate-save-to-draft path actually persisted,
  // not just an in-memory calc() refresh.
  await page.reload();
  await page.waitForTimeout(1000);
  await page.click('#tab-rates');

  await expect(page.locator('#rate-frame')).toHaveValue('5');
  await expect(page.locator('#rate-brd-std')).toHaveValue('0.6');
  await expect(page.locator('#rate-delivery')).toHaveValue('150');
  const totalsAfterReload = await page.textContent('#t-tot');
  expect(totalsAfterReload).toBe(totalsBeforeSave);

  // Teardown: delete the template via the UI's own delete affordance.
  await page.selectOption('#rate-template-select', { label: templateName });
  page.once('dialog', dialog => dialog.accept());
  await page.click('button[title="Delete selected template"]');
  await page.waitForTimeout(500);

  const remainingOptions = await page.locator('#rate-template-select option').allTextContents();
  expect(remainingOptions).not.toContain(templateName);
});
