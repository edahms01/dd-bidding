import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clearAll } from './helpers.js';

test('export then import round-trips a bid spanning project, assembly, and wall tabs', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Round Trip Project');
  await page.click('#tab-assemblies');
  await page.locator('#asm-body tr:first-child .asm-id').fill('W9');
  await page.click('#tab-walls');
  await page.locator('#wall-body tr:first-child input').nth(0).fill('QA Floor 2');
  await page.fill('#wall-body tr:first-child .wgsf', '750');

  await page.waitForTimeout(900); // past debounce, so we're exporting settled state

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Export")')
  ]);
  const filePath = path.join(os.tmpdir(), 'dirigo-qa-export.json');
  await download.saveAs(filePath);
  const exported = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  expect(exported.schemaVersion).toBeDefined();
  expect(exported.project.name).toBe('QA Round Trip Project');

  await clearAll(page);
  await page.setInputFiles('#import-file-input', filePath);
  await page.waitForTimeout(300);

  await expect(page.locator('#proj-name')).toHaveValue('QA Round Trip Project');
  await page.click('#tab-assemblies');
  await expect(page.locator('#asm-body tr:first-child .asm-id')).toHaveValue('W9');
  await page.click('#tab-walls');
  await expect(page.locator('#wall-body tr:first-child input').nth(0)).toHaveValue('QA Floor 2');
  await expect(page.locator('#wall-body tr:first-child .wgsf')).toHaveValue('750');

  fs.unlinkSync(filePath);
});
