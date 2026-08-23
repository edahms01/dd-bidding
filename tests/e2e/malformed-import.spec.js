import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clearAll } from './helpers.js';

test('importing an invalid file shows a visible error and leaves existing data untouched', async ({ page }) => {
  await page.goto('/');
  await clearAll(page);

  await page.fill('#proj-name', 'QA Untouched Data');
  await page.waitForTimeout(900); // let it autosave so we know what "untouched" means

  const badFile = path.join(os.tmpdir(), 'dirigo-qa-bad.json');
  fs.writeFileSync(badFile, '{ this is not valid json ]');
  await page.setInputFiles('#import-file-input', badFile);

  await expect(page.locator('#form-toast')).toContainText(/fail|error/i);
  await expect(page.locator('#proj-name')).toHaveValue('QA Untouched Data');

  fs.unlinkSync(badFile);
});
